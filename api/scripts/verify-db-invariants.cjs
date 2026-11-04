/*
 * Guards the parts of the schema that Prisma does not manage.
 *
 * The GiST index on tstzrange("startDate","endDate") is created by a raw
 * migration; Prisma cannot express an expression index, so a future migration
 * (or `prisma migrate diff` pasted into one) can drop it without any schema
 * change being visible. Without that index a 7-day report window falls back to
 * a sequential scan — ~45x slower on a 1.5M-row table.
 *
 * Run after applying migrations:  npm --prefix api run db:verify
 */
const fs = require('node:fs')
const path = require('node:path')
const {
  collectReferencedKeys,
  isManagedKey,
  listStoredFiles,
  loadDatabaseUrl,
  resolveRetentionHours,
  resolveStorageDir,
} = require('./lib/attachments.cjs')

const GIST_INDEX = 'TestResult_period_overlap_gist_idx'
const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations')

const failures = []
const warnings = []
const checks = []

function check(name, passed, detail) {
  checks.push({ name, passed, detail })
  if (!passed) failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function warn(name, detail) {
  warnings.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

/** Static guard: no migration may drop the interval index. */
function checkMigrations() {
  const drops = []
  for (const entry of fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(MIGRATIONS_DIR, entry.name, 'migration.sql')
    if (!fs.existsSync(file)) continue
    const sql = fs.readFileSync(file, 'utf8')
    if (new RegExp(`DROP\\s+INDEX[^;]*${GIST_INDEX}`, 'i').test(sql)) drops.push(entry.name)
  }
  check('миграции не удаляют GiST-индекс', drops.length === 0, drops.join(', ') || undefined)
}

async function checkDatabase() {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient({ datasourceUrl: loadDatabaseUrl() })
  try {
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'TestResult'
    `
    const byName = new Map(indexes.map((row) => [row.indexname, row.indexdef]))

    const gist = byName.get(GIST_INDEX)
    check(
      `GiST-индекс ${GIST_INDEX} существует`,
      Boolean(gist) && /USING gist/i.test(gist) && /tstzrange/i.test(gist),
      gist ? undefined : 'индекс не найден: запрос окна отчёта упадёт в seq scan',
    )

    check(
      'уникальный индекс (workspaceId, externalId)',
      byName.has('TestResult_workspaceId_externalId_key'),
      'без него повторный импорт архива создаёт дубли',
    )

    check(
      'индекс (workspaceId, circuit, startDate)',
      byName.has('TestResult_workspaceId_circuit_startDate_idx'),
      'без него фильтр по контуру не может ограничить диапазон датой',
    )

    check(
      'устаревший индекс (workspaceId, circuit) удалён',
      !byName.has('TestResult_workspaceId_circuit_idx'),
      'он дублирует префикс составного индекса',
    )

    const constraints = await prisma.$queryRaw`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = ('"' || current_schema() || '"."TestResult"')::regclass
    `
    check(
      'CHECK: канонические path и circuit',
      constraints.some((row) => row.conname === 'TestResult_circuit_lowercase_check')
        && constraints.some((row) => row.conname === 'TestResult_path_trimmed_check'),
    )

    const detailTable = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'TestResultDetail'
    `
    check('таблица TestResultDetail существует', detailTable.length === 1)

    const cascade = await prisma.$queryRaw`
      SELECT confdeltype FROM pg_constraint
      WHERE conname = 'TestResultDetail_resultId_fkey'
    `
    check(
      'FK TestResultDetail → TestResult с ON DELETE CASCADE',
      cascade.length === 1 && cascade[0].confdeltype === 'c',
      cascade.length ? `confdeltype=${cascade[0].confdeltype}` : 'ограничение не найдено',
    )

    const coldColumns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'TestResult'
        AND column_name IN ('message', 'steps', 'attachments', 'parameters', 'links', 'statusDetails')
    `
    check(
      'холодные колонки перенесены из TestResult',
      coldColumns.length === 0,
      coldColumns.map((row) => row.column_name).join(', ') || undefined,
    )

    // Files are not part of the schema, so this is a warning, not a failure.
    // Only runs inside the retention window are checked: with the hard TTL,
    // references of older runs are expected to point at deleted files.
    const retentionHours = resolveRetentionHours()
    const since = new Date(Date.now() - retentionHours * 3600_000)
    const referenced = await collectReferencedKeys(prisma, since)
    if (referenced.size) {
      const directory = resolveStorageDir()
      const stored = new Set(listStoredFiles(directory).filter((file) => isManagedKey(file.name)).map((file) => file.name))
      const missing = [...referenced].filter((key) => !stored.has(key))
      if (missing.length) {
        warn(
          `файлов в ${directory}: ${stored.size}, ссылок за последние ${retentionHours} ч без файла: ${missing.length}`,
          'скриншоты свежих запусков должны быть на диске; проверьте ATTACHMENTS_DIR и что сборщик мусора не удаляет лишнее',
        )
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

;(async () => {
  checkMigrations()
  await checkDatabase()

  for (const item of checks) {
    console.log(`${item.passed ? 'ok  ' : 'FAIL'} ${item.name}${!item.passed && item.detail ? ` — ${item.detail}` : ''}`)
  }
  for (const item of warnings) console.log(`warn ${item}`)
  if (failures.length) {
    console.error(`\nНарушено инвариантов: ${failures.length}. Исправьте миграцию или БД перед выкладкой.`)
    process.exit(1)
  }
  console.log('\nВсе инварианты схемы на месте.')
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

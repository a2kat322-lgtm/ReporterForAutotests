/*
 * Removes attachment files that no run references any more.
 *
 * Why this is needed: the storage is content-addressed and append-only. An
 * import writes files before the rows are committed, deleting a workspace
 * cascades the rows away but leaves the bytes, and a failed import can leave
 * files behind. Nothing else in the API deletes attachments.
 *
 * Deletion rule — a file is removed only when ALL hold:
 *   1. its name is a key this storage could have produced (`<sha256><ext>`);
 *   2. no `TestResultDetail` references it (top level or nested in steps);
 *   3. its mtime is older than the grace period (default 48 h).
 *
 * The grace period matters: the importer writes bytes before it inserts the
 * rows, so a fresh file can be unreferenced for a moment. It also keeps a
 * half-finished import from being deleted between two runs.
 *
 * Usage:
 *   npm --prefix api run attachments:gc              # delete (48 h grace)
 *   npm --prefix api run attachments:gc:dry-run       # report only
 *   node api/scripts/attachments-gc.cjs --grace-hours=6 --dry-run
 *   node api/scripts/attachments-gc.cjs --force       # allow wiping every file
 */
const fs = require('node:fs')
const {
  createPrismaClient,
  collectReferencedKeys,
  isManagedKey,
  listStoredFiles,
  resolveStorageDir,
  formatBytes,
} = require('./lib/attachments.cjs')

const DEFAULT_GRACE_HOURS = 48

function parseArgs(argv) {
  const options = { dryRun: false, force: false, graceHours: DEFAULT_GRACE_HOURS, help: false }
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '-n') options.dryRun = true
    else if (arg === '--force') options.force = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg.startsWith('--grace-hours=')) {
      const value = Number(arg.slice('--grace-hours='.length))
      if (!Number.isFinite(value) || value < 0) throw new Error('--grace-hours must be a number >= 0')
      options.graceHours = value
    } else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: node scripts/attachments-gc.cjs [options]

  --dry-run, -n        Only report; do not delete anything
  --grace-hours=N      Keep unreferenced files younger than N hours (default ${DEFAULT_GRACE_HOURS})
  --force              Allow deleting every file when the database references none
  --help, -h           Show this help`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) return printHelp()

  const directory = resolveStorageDir()
  console.log(`Storage:  ${directory}`)
  console.log(`Grace:    ${options.graceHours} h${options.dryRun ? '  (dry run: nothing will be deleted)' : ''}`)

  if (!fs.existsSync(directory)) {
    console.log('Каталог хранилища не существует — удалять нечего.')
    return
  }

  const prisma = createPrismaClient()
  let referenced
  try {
    referenced = await collectReferencedKeys(prisma)
  } finally {
    await prisma.$disconnect()
  }

  const files = listStoredFiles(directory)
  if (!files.length) {
    console.log('Файлов в хранилище нет.')
    return
  }

  const managed = files.filter((file) => isManagedKey(file.name))
  const unmanaged = files.filter((file) => !isManagedKey(file.name))
  const orphans = managed.filter((file) => !referenced.has(file.name))

  // A references query that silently returns nothing would wipe the storage.
  // Treat "database knows no attachments" as a reason to require --force.
  if (!referenced.size && files.length && !options.force) {
    console.error(
      `\nВ БД не найдено ни одной ссылки на вложения, а файлов на диске: ${files.length}.\n` +
        'Похоже на ошибку подключения к БД или пустую базу. Ничего не удалено.\n' +
        'Если это ожидаемо, повторите с --force.',
    )
    process.exit(2)
  }

  const cutoff = Date.now() - options.graceHours * 3600_000
  const expired = orphans.filter((file) => file.mtimeMs < cutoff)
  const fresh = orphans.filter((file) => file.mtimeMs >= cutoff)
  const missing = [...referenced].filter((key) => !files.some((file) => file.name === key))

  console.log('')
  console.log(`Файлов на диске:        ${files.length} (${formatBytes(files.reduce((sum, file) => sum + file.size, 0))})`)
  console.log(`Ссылок в БД:            ${referenced.size}`)
  console.log(`Нет ссылок (сироты):    ${orphans.length} (${formatBytes(orphans.reduce((sum, file) => sum + file.size, 0))})`)
  console.log(`  старше grace-периода: ${expired.length} (${formatBytes(expired.reduce((sum, file) => sum + file.size, 0))})`)
  console.log(`  в пределах grace:     ${fresh.length} — оставлены`)
  console.log(`Ссылки без файлов:      ${missing.length}${missing.length ? '  ← битые картинки в отчётах' : ''}`)
  console.log(`Посторонние файлы:      ${unmanaged.length} — не трогаем`)

  if (fresh.length) {
    console.log('\nОставлены как «слишком свежие» (возможно, идёт импорт):')
    for (const file of fresh.slice(0, 10)) console.log(`  ${file.name}`)
    if (fresh.length > 10) console.log(`  … ещё ${fresh.length - 10}`)
  }
  if (missing.length) {
    console.log('\nБД ссылается на отсутствующие файлы:')
    for (const key of missing.slice(0, 10)) console.log(`  ${key}`)
    if (missing.length > 10) console.log(`  … ещё ${missing.length - 10}`)
  }
  if (unmanaged.length) {
    console.log('\nФайлы не в формате ключа (не наши, не удаляются):')
    for (const file of unmanaged.slice(0, 10)) console.log(`  ${file.name}`)
    if (unmanaged.length > 10) console.log(`  … ещё ${unmanaged.length - 10}`)
  }

  if (!expired.length) {
    console.log('\nУдалять нечего.')
    return
  }

  if (options.dryRun) {
    console.log(`\nDry run: было бы удалено ${expired.length} файлов (${formatBytes(expired.reduce((sum, file) => sum + file.size, 0))}).`)
    for (const file of expired.slice(0, 20)) console.log(`  ${file.name} (${formatBytes(file.size)})`)
    if (expired.length > 20) console.log(`  … ещё ${expired.length - 20}`)
    return
  }

  let deleted = 0
  let freed = 0
  for (const file of expired) {
    try {
      fs.unlinkSync(file.path)
      deleted += 1
      freed += file.size
    } catch (error) {
      console.error(`Не удалось удалить ${file.name}: ${error.message}`)
    }
  }
  console.log(`\nУдалено: ${deleted} из ${expired.length}, освобождено ${formatBytes(freed)}.`)
  if (deleted !== expired.length) process.exit(1)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

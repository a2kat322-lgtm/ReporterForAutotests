/*
 * Deletes attachment files older than the retention period (default 48 h).
 *
 * Storage is content-addressed and append-only: nothing in the API deletes
 * files, so without this job the directory grows forever. The server has very
 * little disk, so the rule is a hard TTL: a file is removed by its age alone,
 * whether or not a run still references it.
 *
 * Consequences to keep in mind:
 *   - runs older than the retention period keep their rows but lose the
 *     picture; the report shows a placeholder instead of the screenshot;
 *   - the file name is `sha256(content)`, so one file is shared by every run
 *     that contains the same screenshot. Deleting it removes the picture from
 *     all of them at once;
 *   - re-importing the same content rewrites the file, which refreshes its
 *     mtime, so the retention period restarts from the last write;
 *   - files whose name is not in the `<sha256><ext>` format are never touched.
 *
 * Usage:
 *   npm --prefix api run attachments:gc              # delete (48 h retention)
 *   npm --prefix api run attachments:gc:dry-run       # report only
 *   node api/scripts/attachments-gc.cjs --ttl-hours=6 --dry-run
 */
const fs = require('node:fs')
const {
  isManagedKey,
  listStoredFiles,
  resolveStorageDir,
  formatBytes,
} = require('./lib/attachments.cjs')

/** Retention in hours: CLI flag wins, then `ATTACHMENT_TTL_HOURS`, then 48. */
const DEFAULT_TTL_HOURS = Number(process.env.ATTACHMENT_TTL_HOURS) > 0
  ? Number(process.env.ATTACHMENT_TTL_HOURS)
  : 48

function parseArgs(argv) {
  const options = { dryRun: false, ttlHours: DEFAULT_TTL_HOURS, help: false }
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '-n') options.dryRun = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg.startsWith('--ttl-hours=') || arg.startsWith('--grace-hours=')) {
      const value = Number(arg.slice(arg.indexOf('=') + 1))
      if (!Number.isFinite(value) || value < 0) throw new Error('--ttl-hours must be a number >= 0')
      options.ttlHours = value
    } else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: node scripts/attachments-gc.cjs [options]

  --dry-run, -n        Only report; do not delete anything
  --ttl-hours=N        Delete attachment files older than N hours (default ${DEFAULT_TTL_HOURS})
                       Alias kept for compatibility: --grace-hours=N
  --help, -h           Show this help`)
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) return printHelp()

  const directory = resolveStorageDir()
  console.log(`Storage:   ${directory}`)
  console.log(`Retention: ${options.ttlHours} h${options.dryRun ? '   (dry run: nothing will be deleted)' : ''}`)
  if (options.ttlHours === 0) {
    console.log('Внимание: retention 0 часов — будут удалены все файлы вложений.')
  }

  if (!fs.existsSync(directory)) {
    console.log('Каталог хранилища не существует — удалять нечего.')
    return
  }

  const files = listStoredFiles(directory)
  if (!files.length) {
    console.log('Файлов в хранилище нет.')
    return
  }

  const managed = files.filter((file) => isManagedKey(file.name))
  const unmanaged = files.filter((file) => !isManagedKey(file.name))
  const cutoff = Date.now() - options.ttlHours * 3600_000
  const expired = managed.filter((file) => file.mtimeMs < cutoff)
  const kept = managed.filter((file) => file.mtimeMs >= cutoff)
  const oldest = managed.reduce((min, file) => Math.min(min, file.mtimeMs), Number.POSITIVE_INFINITY)

  console.log('')
  console.log(`Файлов:                 ${files.length} (${formatBytes(files.reduce((sum, file) => sum + file.size, 0))})`)
  console.log(`  старше retention:     ${expired.length} (${formatBytes(expired.reduce((sum, file) => sum + file.size, 0))})`)
  console.log(`  в пределах retention: ${kept.length} (${formatBytes(kept.reduce((sum, file) => sum + file.size, 0))})`)
  if (Number.isFinite(oldest)) {
    const ageHours = (Date.now() - oldest) / 3600_000
    console.log(`  самый старый файл:    ${ageHours.toFixed(1)} ч назад`)
  }
  console.log(`Посторонние файлы:      ${unmanaged.length} — не трогаем`)

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
    for (const file of expired.slice(0, 20)) {
      const ageHours = ((Date.now() - file.mtimeMs) / 3600_000).toFixed(1)
      console.log(`  ${file.name} (${formatBytes(file.size)}, ${ageHours} ч)`)
    }
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

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

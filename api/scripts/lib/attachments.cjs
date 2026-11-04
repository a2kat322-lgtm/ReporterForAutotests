/*
 * Shared helpers for the attachment scripts.
 *
 * Attachment bytes live on disk under a content-addressed name (`<sha256><ext>`);
 * the database only holds the key inside `TestResultDetail.steps` (nested, any
 * depth) and `TestResultDetail.attachments` (top level). Both scripts below have
 * to read the same two things, so the logic lives here.
 */
const fs = require('node:fs')
const path = require('node:path')

const API_DIR = path.join(__dirname, '..', '..')
const ENV_PATH = path.join(API_DIR, '.env')

/**
 * One variable, with the same precedence the API has: the process environment
 * wins, then `.env` in `api/`. Reading `.env` matters for `ATTACHMENTS_DIR` and
 * `ATTACHMENT_TTL_HOURS`: a value set there is what the API uses, so a script
 * that ignored it would clean a different directory (or a different age) than
 * the one the API writes to.
 */
function loadEnvValue(name) {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  if (!fs.existsSync(ENV_PATH)) return undefined
  const pattern = new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`)
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = pattern.exec(line)
    if (match) return match[1].replace(/^["']|["']$/g, '') || undefined
  }
  return undefined
}

function loadDatabaseUrl() {
  return loadEnvValue('DATABASE_URL')
}

/**
 * Mirrors `app.config.ts`: a relative `ATTACHMENTS_DIR` is resolved against
 * `api/`, not against the current working directory, so the scripts behave the
 * same whether they run from the repo root or through `npm --prefix api`.
 */
function resolveStorageDir() {
  const configured = loadEnvValue('ATTACHMENTS_DIR') || 'storage/attachments'
  return path.isAbsolute(configured) ? configured : path.resolve(API_DIR, configured)
}

/** Retention in hours, as the API reads it: the same variable, the same default. */
function resolveRetentionHours() {
  const configured = Number(loadEnvValue('ATTACHMENT_TTL_HOURS'))
  return Number.isFinite(configured) && configured > 0 ? configured : 48
}

function createPrismaClient() {
  const candidates = [
    path.join(API_DIR, 'node_modules', '@prisma/client'),
    '@prisma/client',
  ]
  let lastError
  for (const candidate of candidates) {
    try {
      const { PrismaClient } = require(candidate)
      return new PrismaClient({ datasourceUrl: loadDatabaseUrl() })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

/**
 * Every attachment key the database references, at the top level and at any
 * nesting depth inside the step tree.
 *
 * With `since`, only runs started at or after that moment are considered. That
 * is what the retention check needs: with the 48 h TTL, references of older runs
 * are expected to point at deleted files.
 */
async function collectReferencedKeys(prisma, since) {
  const sql = `
    WITH refs AS (
      SELECT jsonb_path_query(
               jsonb_build_object('attachments', d."attachments", 'steps', d."steps"),
               '$.**.attachments[*].key'
             ) AS key
      FROM "TestResultDetail" d
      ${since ? 'JOIN "TestResult" r ON r.id = d."resultId" AND r."startDate" >= $1' : ''}
      WHERE d."attachments" <> '[]'::jsonb OR d."steps" <> '[]'::jsonb
    )
    SELECT DISTINCT key #>> '{}' AS key
    FROM refs
    WHERE key IS NOT NULL AND key <> 'null'::jsonb
  `
  const rows = since ? await prisma.$queryRawUnsafe(sql, since) : await prisma.$queryRawUnsafe(sql)
  return new Set(rows.map((row) => row.key).filter(Boolean))
}

/** `true` for names the storage service could have produced; anything else is left alone. */
function isManagedKey(name) {
  return /^[a-f0-9]{64}(\.[a-z0-9]{1,10})?$/.test(name)
}

/** Matches the service: keys are flat today, but a sharded layout must still be walked. */
const MAX_DEPTH = 4

/**
 * Files in the storage directory with their size and modification time.
 *
 * `name` is the file name (the content-addressed key), `relPath` is the path
 * inside the storage root — the two differ once the directory is sharded into
 * subfolders. Symlinks are ignored, so the walk never leaves the storage root.
 */
function listStoredFiles(directory) {
  return walkStorage(directory, directory, 0)
}

function walkStorage(root, directory, depth) {
  let entries
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }

  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH) files.push(...walkStorage(root, fullPath, depth + 1))
      continue
    }
    if (!entry.isFile()) continue
    try {
      const stat = fs.statSync(fullPath)
      files.push({
        name: entry.name,
        relPath: path.relative(root, fullPath).split(path.sep).join('/'),
        path: fullPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      })
    } catch {
      // Vanished between readdir and stat, or a broken link — skip it.
    }
  }
  return files
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`
}

module.exports = {
  API_DIR,
  createPrismaClient,
  collectReferencedKeys,
  isManagedKey,
  listStoredFiles,
  loadDatabaseUrl,
  loadEnvValue,
  resolveRetentionHours,
  resolveStorageDir,
  formatBytes,
}

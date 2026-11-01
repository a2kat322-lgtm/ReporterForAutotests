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

/** `.env` in `api/` is the same file the API reads; the process env wins. */
function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(API_DIR, '.env')
  if (!fs.existsSync(envPath)) return undefined
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line)
    if (match) return match[1].replace(/^["']|["']$/g, '')
  }
  return undefined
}

/**
 * Mirrors `app.config.ts`: a relative `ATTACHMENTS_DIR` is resolved against
 * `api/`, not against the current working directory, so the scripts behave the
 * same whether they run from the repo root or through `npm --prefix api`.
 */
function resolveStorageDir() {
  const configured = process.env.ATTACHMENTS_DIR || 'storage/attachments'
  return path.isAbsolute(configured) ? configured : path.resolve(API_DIR, configured)
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

/** Files in the storage directory with their size and modification time. */
function listStoredFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = path.join(directory, entry.name)
      const stat = fs.statSync(fullPath)
      return { name: entry.name, path: fullPath, size: stat.size, mtimeMs: stat.mtimeMs }
    })
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
  resolveStorageDir,
  formatBytes,
}

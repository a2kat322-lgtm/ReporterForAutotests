import { createHash } from 'node:crypto'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'

export interface StoredAttachment {
  name: string
  type: string
  size: number
  /**
   * Content-addressed file name (`<sha256><ext>`), null when the archive
   * referenced a file it does not contain.
   */
  key: string | null
  missing?: true
}

interface StoredFile {
  path: string
  name: string
  size: number
  mtimeMs: number
}

/** A name the storage service could have written: a digest plus an optional extension. */
const KEY_PATTERN = /^[a-f0-9]{64}(\.[a-z0-9]{1,10})?$/

/**
 * Depth limit for the sweep. Keys are flat today; the walk is recursive so that
 * sharding the directory later (the classic `ab/cd/<key>` layout) cannot
 * silently stop the cleanup from finding files.
 */
const MAX_DEPTH = 4

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.har': 'application/json',
}

const DEFAULT_TYPE = 'application/octet-stream'

/**
 * Stores attachment bytes on disk under a content-addressed name.
 *
 * Files are immutable and deduplicated by content, so repeated imports of the
 * same archive (or the same screenshot in several runs) do not grow the
 * directory. The key doubles as a safe URL path: only hex digests are served.
 *
 * The service also owns retention: [removeExpired] runs every hour and once at
 * startup, deleting files older than `ATTACHMENT_TTL_HOURS` (48 h by default).
 */
@Injectable()
export class AttachmentStorageService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentStorageService.name)
  private readonly directory: string
  private readonly ttlHours: number
  private readonly retentionEnabled: boolean
  /** Set while a sweep runs, so the startup pass and an hourly tick cannot overlap. */
  private sweeping = false

  constructor(config: ConfigService) {
    this.directory = config.get<string>('app.attachmentsDir') as string
    this.ttlHours = config.get<number>('app.attachmentsTtlHours') as number
    this.retentionEnabled = config.get<boolean>('app.attachmentsGcEnabled') as boolean
  }

  async onModuleInit() {
    await mkdir(this.directory, { recursive: true })
    this.logger.log(
      `Attachment storage: ${this.directory}`
        + (this.retentionEnabled ? ` (retention ${this.ttlHours} h)` : ' (retention disabled)'),
    )
    // The process may have been down for the whole retention window, so the
    // first sweep runs right away instead of waiting for the first hourly tick.
    await this.removeExpired()
  }

  async save(name: string, type: string, data: Buffer): Promise<StoredAttachment> {
    const digest = createHash('sha256').update(data).digest('hex')
    const key = `${digest}${this.extension(name, type)}`
    // Same key means identical bytes, so an unconditional write stays idempotent.
    // It also refreshes the mtime, which restarts the retention period.
    await writeFile(join(this.directory, key), data)
    return {
      name: name.slice(0, 200),
      type: type || CONTENT_TYPES[extname(name).toLowerCase()] || DEFAULT_TYPE,
      size: data.length,
      key,
    }
  }

  /** Resolves a stored file name to an absolute path; rejects anything that is not a hash key. */
  resolve(key: string): string | null {
    if (!KEY_PATTERN.test(key)) return null
    return join(this.directory, key)
  }

  contentType(key: string): string {
    return CONTENT_TYPES[extname(key).toLowerCase()] ?? DEFAULT_TYPE
  }

  /**
   * Deletes attachment files older than the retention period.
   *
   * The rule is age alone: a file is removed whether or not a run still
   * references it, because the alternative — keeping bytes alive per reference —
   * costs a database pass over every step tree on every sweep. Runs older than
   * the retention keep their rows and lose their pictures; the report renders a
   * placeholder instead.
   *
   * Two instances sweeping at the same time are safe: the decision is per-file
   * and `unlink` of an already-deleted file is treated as success.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async removeExpired(): Promise<void> {
    if (!this.retentionEnabled) return
    if (this.sweeping) {
      this.logger.warn('Attachment sweep is still running, skipping this hour')
      return
    }
    this.sweeping = true
    try {
      const cutoff = Date.now() - this.ttlHours * 3_600_000
      const files = await this.listStoredFiles(this.directory)
      const expired = files.filter((file) => file.mtimeMs < cutoff)

      let deleted = 0
      let freedBytes = 0
      for (const file of expired) {
        try {
          await unlink(file.path)
          deleted += 1
          freedBytes += file.size
        } catch (error) {
          // ENOENT means a parallel import (same content, same key) or another
          // instance got there first; the bytes are gone either way. Anything
          // else — EBUSY while the file is being streamed on Windows, EPERM
          // from an antivirus — is retried on the next sweep.
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            this.logger.warn(`Attachment ${file.name} was not deleted: ${(error as Error).message}`)
          }
        }
      }

      if (deleted > 0) {
        this.logger.log(
          `Attachment sweep: deleted ${deleted} of ${expired.length} expired file(s), `
            + `freed ${formatBytes(freedBytes)} (retention ${this.ttlHours} h)`,
        )
      }
    } finally {
      this.sweeping = false
    }
  }

  /** Managed files in the storage directory, at any depth. */
  private async listStoredFiles(directory: string, depth = 0): Promise<StoredFile[]> {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const files: StoredFile[] = []
    for (const entry of entries) {
      const path = join(directory, entry.name)
      // Directories only: a symlink is neither `isFile` nor `isDirectory` here,
      // so the walk never leaves the storage root.
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) files.push(...await this.listStoredFiles(path, depth + 1))
        continue
      }
      if (!entry.isFile() || !KEY_PATTERN.test(entry.name)) continue
      try {
        const info = await stat(path)
        files.push({ path, name: entry.name, size: info.size, mtimeMs: info.mtimeMs })
      } catch {
        // Vanished between readdir and stat — nothing to delete.
      }
    }
    return files
  }

  private extension(name: string, type: string): string {
    const fromName = extname(name).toLowerCase()
    if (/^\.[a-z0-9]{1,9}$/.test(fromName)) return fromName
    const known = Object.entries(CONTENT_TYPES).find(([, value]) => value.split(';')[0] === type)
    return known?.[0] ?? ''
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`
}

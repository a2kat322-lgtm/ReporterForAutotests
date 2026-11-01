import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

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
 */
@Injectable()
export class AttachmentStorageService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentStorageService.name)
  private readonly directory: string

  constructor(config: ConfigService) {
    this.directory = config.get<string>('app.attachmentsDir') as string
  }

  async onModuleInit() {
    await mkdir(this.directory, { recursive: true })
    this.logger.log(`Attachment storage: ${this.directory}`)
  }

  async save(name: string, type: string, data: Buffer): Promise<StoredAttachment> {
    const digest = createHash('sha256').update(data).digest('hex')
    const key = `${digest}${this.extension(name, type)}`
    // Same key means identical bytes, so an unconditional write stays idempotent.
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
    if (!/^[a-f0-9]{64}(\.[a-z0-9]{1,10})?$/.test(key)) return null
    return join(this.directory, key)
  }

  contentType(key: string): string {
    return CONTENT_TYPES[extname(key).toLowerCase()] ?? DEFAULT_TYPE
  }

  private extension(name: string, type: string): string {
    const fromName = extname(name).toLowerCase()
    if (/^\.[a-z0-9]{1,9}$/.test(fromName)) return fromName
    const known = Object.entries(CONTENT_TYPES).find(([, value]) => value.split(';')[0] === type)
    return known?.[0] ?? ''
  }
}

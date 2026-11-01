import { Controller, Get, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common'
import type { Response } from 'express'
import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { AttachmentStorageService } from '../service/attachment-storage.service'

@Controller('attachments')
export class AttachmentController {
  constructor(private readonly storage: AttachmentStorageService) {}

  /**
   * Serves an imported attachment by its content-addressed key. Keys are files
   * on disk, not database rows: the same screenshot is shared by every run that
   * referenced it.
   */
  @Get(':key')
  async find(@Param('key') key: string, @Res({ passthrough: true }) response: Response) {
    const file = this.storage.resolve(key)
    if (!file) throw new NotFoundException('Attachment not found')
    try {
      await access(file)
    } catch {
      throw new NotFoundException('Attachment file is missing from storage')
    }

    response.setHeader('Content-Type', this.storage.contentType(key))
    // Inline so screenshots open in the browser; other types are downloaded by the client.
    response.setHeader('Content-Disposition', 'inline')
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return new StreamableFile(createReadStream(file))
  }
}

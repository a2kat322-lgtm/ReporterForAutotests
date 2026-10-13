import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { appConfig } from '../../../config/app.config'
import { ImportRepository, LegacyImportPayload } from '../repository/import.repository'

@Injectable()
export class ImportService {
  constructor(
    @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
    private readonly importRepository: ImportRepository,
  ) {}

  importLegacy(confirmation: string, body: LegacyImportPayload) {
    if (!this.config.enableLegacyImport) throw new BadRequestException('Legacy import is disabled; enable it only for a trusted local migration')
    if (confirmation !== 'yes') throw new BadRequestException('Explicit import confirmation is required')
    if (!Array.isArray(body?.phases) || !Array.isArray(body?.reports) || !Array.isArray(body?.results)) throw new BadRequestException('Expected phases, reports, and results arrays')
    return this.importRepository.executeImport(body)
  }
}
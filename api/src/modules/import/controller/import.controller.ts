import { Body, Controller, Headers, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ImportService, LegacyImportPayload } from '../service/import.service'

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  @Throttle({ short: { limit: 1, ttl: 60_000 }, long: { limit: 3, ttl: 3_600_000 } })
  importLegacy(@Headers('x-import-confirmation') confirmation: string, @Body() body: LegacyImportPayload) {
    return this.importService.importLegacy(confirmation, body)
  }
}

import { Module } from '@nestjs/common'
import { ImportController } from './controller/import.controller'
import { ImportRepository } from './repository/import.repository'
import { ImportService } from './service/import.service'

@Module({
  controllers: [ImportController],
  providers: [ImportService, ImportRepository],
})
export class ImportModule {}

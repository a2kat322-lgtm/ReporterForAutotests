import { Module } from '@nestjs/common'
import { ResultsController } from './controller/results.controller'
import { ResultsRepository } from './repository/results.repository'
import { ResultsService } from './service/results.service'

@Module({
  controllers: [ResultsController],
  providers: [ResultsService, ResultsRepository],
  exports: [ResultsService, ResultsRepository],
})
export class ResultsModule {}

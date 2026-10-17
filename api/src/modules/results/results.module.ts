import { Module } from '@nestjs/common'
import { WorkspacesModule } from '../workspaces/workspaces.module'
import { ResultsController } from './controller/results.controller'
import { ResultsRepository } from './repository/results.repository'
import { ResultsService } from './service/results.service'

@Module({
  imports: [WorkspacesModule],
  controllers: [ResultsController],
  providers: [ResultsService, ResultsRepository],
  exports: [ResultsService, ResultsRepository],
})
export class ResultsModule {}

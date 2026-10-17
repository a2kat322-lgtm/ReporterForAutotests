import { Module } from '@nestjs/common'
import { WorkspacesController } from './controller/workspaces.controller'
import { WorkspacesRepository } from './repository/workspaces.repository'
import { WorkspacesService } from './service/workspaces.service'

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesRepository],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

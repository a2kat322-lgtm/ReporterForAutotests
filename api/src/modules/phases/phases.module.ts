import { Module } from '@nestjs/common'
import { PhasesController } from './controller/phases.controller'
import { PhasesRepository } from './repository/phases.repository'
import { PhasesService } from './service/phases.service'

@Module({
  controllers: [PhasesController],
  providers: [PhasesService, PhasesRepository],
  exports: [PhasesService],
})
export class PhasesModule {}

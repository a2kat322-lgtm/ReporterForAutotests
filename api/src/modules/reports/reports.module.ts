import { Module } from '@nestjs/common'
import { PhasesModule } from '../phases/phases.module'
import { PhaseReportsController } from './controller/phase-reports.controller'
import { ReportsController } from './controller/reports.controller'
import { ReportsRepository } from './repository/reports.repository'
import { ReportsService } from './service/reports.service'

@Module({
  imports: [PhasesModule],
  controllers: [PhaseReportsController, ReportsController],
  providers: [ReportsService, ReportsRepository],
})
export class ReportsModule {}

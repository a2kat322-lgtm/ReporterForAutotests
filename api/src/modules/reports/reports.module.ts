import { Module } from '@nestjs/common'
import { ResultsModule } from '../results/results.module'
import { PhasesModule } from '../phases/phases.module'
import { TestsModule } from '../tests/tests.module'
import { PhaseReportsController } from './controller/phase-reports.controller'
import { ReportsController } from './controller/reports.controller'
import { ReportsRepository } from './repository/reports.repository'
import { ReportsService } from './service/reports.service'

@Module({
  imports: [PhasesModule, ResultsModule, TestsModule],
  controllers: [PhaseReportsController, ReportsController],
  providers: [ReportsService, ReportsRepository],
})
export class ReportsModule {}

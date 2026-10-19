import { Module } from '@nestjs/common'
import { PhasesModule } from '../phases/phases.module'
import { ReportsModule } from '../reports/reports.module'
import { ResultsModule } from '../results/results.module'
import { TestsModule } from '../tests/tests.module'
import { PhaseAnalyticsController } from './controller/phase-analytics.controller'
import { PhaseAnalyticsService } from './service/phase-analytics.service'

@Module({
  imports: [PhasesModule, ReportsModule, ResultsModule, TestsModule],
  controllers: [PhaseAnalyticsController],
  providers: [PhaseAnalyticsService],
})
export class AnalyticsModule {}

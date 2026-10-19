import { Controller, Get, Param } from '@nestjs/common'
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe'
import { PhaseAnalyticsService } from '../service/phase-analytics.service'

@Controller('phases/:phaseId/analytics')
export class PhaseAnalyticsController {
  constructor(private readonly analyticsService: PhaseAnalyticsService) {}

  @Get()
  findForPhase(@Param('phaseId', ParseBigIntPipe) phaseId: bigint) {
    return this.analyticsService.getPhaseAnalytics(phaseId)
  }
}

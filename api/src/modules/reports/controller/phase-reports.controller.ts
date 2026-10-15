import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe'
import { CreateReportDto } from '../dto/create-report.dto'
import { ReportsService } from '../service/reports.service'

@Controller('phases/:phaseId/reports')
export class PhaseReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findByPhase(@Param('phaseId', ParseBigIntPipe) phaseId: bigint) { return this.reportsService.findByPhaseId(phaseId) }

  @Get('results-summary')
  findResultsSummary(@Param('phaseId', ParseBigIntPipe) phaseId: bigint) { return this.reportsService.findResultsByPhaseId(phaseId) }

  @Post()
  create(@Param('phaseId', ParseBigIntPipe) phaseId: bigint, @Body() dto: CreateReportDto) { return this.reportsService.createForPhase(phaseId, dto) }
}

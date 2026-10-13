import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common'
import { CreateReportDto } from '../dto/create-report.dto'
import { ReportsService } from '../service/reports.service'

@Controller('phases/:phaseId/reports')
export class PhaseReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findByPhase(@Param('phaseId', ParseIntPipe) phaseId: number) { return this.reportsService.findByPhaseId(phaseId) }

  @Post()
  create(@Param('phaseId', ParseIntPipe) phaseId: number, @Body() dto: CreateReportDto) { return this.reportsService.createForPhase(phaseId, dto) }
}

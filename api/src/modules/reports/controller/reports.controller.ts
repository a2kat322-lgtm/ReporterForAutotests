import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common'
import { UpsertResultDto } from '../dto/upsert-result.dto'
import { ReportsService } from '../service/reports.service'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':reportId')
  findById(@Param('reportId') reportId: string) { return this.reportsService.findById(reportId) }

  @Get(':reportId/results')
  findResults(@Param('reportId') reportId: string) { return this.reportsService.findResults(reportId) }

  @Post(':reportId/results')
  upsertResult(@Param('reportId') reportId: string, @Body() dto: UpsertResultDto) { return this.reportsService.upsertResult(reportId, dto) }

  @Delete(':reportId')
  @HttpCode(200)
  delete(@Param('reportId') reportId: string) { return this.reportsService.delete(reportId) }
}

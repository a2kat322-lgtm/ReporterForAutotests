import { Controller, Delete, Get, HttpCode, Param } from '@nestjs/common'
import { ReportsService } from '../service/reports.service'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':reportId')
  findById(@Param('reportId') reportId: string) { return this.reportsService.findById(reportId) }

  /** Merged view: catalog tests + runs covering the report date; `no_run` for unrun tests. */
  @Get(':reportId/results')
  findResults(@Param('reportId') reportId: string) { return this.reportsService.findResults(reportId) }

  @Delete(':reportId')
  @HttpCode(200)
  delete(@Param('reportId') reportId: string) { return this.reportsService.delete(reportId) }
}

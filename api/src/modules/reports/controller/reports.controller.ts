import { Body, Controller, Delete, Get, HttpCode, Param, Patch } from '@nestjs/common'
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe'
import { UpdateResultFeedbackDto } from '../dto/update-result-feedback.dto'
import { ReportsService } from '../service/reports.service'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':reportId')
  findById(@Param('reportId', ParseBigIntPipe) reportId: bigint) { return this.reportsService.findById(reportId) }

  /** Merged view: catalog tests + runs covering the report date; `no_run` for unrun tests. */
  @Get(':reportId/results')
  findResults(@Param('reportId', ParseBigIntPipe) reportId: bigint) { return this.reportsService.findResults(reportId) }

  @Patch('results/:resultId/feedback')
  updateResultFeedback(
    @Param('resultId', ParseBigIntPipe) resultId: bigint,
    @Body() dto: UpdateResultFeedbackDto,
  ) { return this.reportsService.updateResultFeedback(resultId, dto) }

  @Delete(':reportId')
  @HttpCode(200)
  delete(@Param('reportId', ParseBigIntPipe) reportId: bigint) { return this.reportsService.delete(reportId) }
}

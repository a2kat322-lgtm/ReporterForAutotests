import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, TestResult } from '@prisma/client'
import { PhasesService } from '../../phases/service/phases.service'
import { ResultsRepository } from '../../results/repository/results.repository'
import { ReportResultRow } from '../../results/dto/run-payload'
import { TestsRepository } from '../../tests/repository/tests.repository'
import { CreateReportDto } from '../dto/create-report.dto'
import { UpdateResultFeedbackDto } from '../dto/update-result-feedback.dto'
import { ReportsRepository } from '../repository/reports.repository'
import { dayEnd, dayStart, parseDateOnly, toRow } from './report-view.utils'

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly phasesService: PhasesService,
    private readonly resultsRepository: ResultsRepository,
    private readonly testsRepository: TestsRepository,
  ) {}

  async findById(id: bigint) {
    const report = await this.reportsRepository.findById(id)
    if (!report) throw new NotFoundException('Report not found')
    return report
  }

  async findByPhaseId(phaseId: bigint) {
    await this.phasesService.ensureExists(phaseId)
    return this.reportsRepository.findByPhaseId(phaseId)
  }

  async createForPhase(phaseId: bigint, dto: CreateReportDto) {
    const phase = await this.phasesService.findById(phaseId)
    const startDate = parseDateOnly(dto.startDate)
    const endDate = parseDateOnly(dto.endDate)
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date')
    }
    if (startDate < phase.startedAt || endDate > phase.endedAt) {
      throw new BadRequestException('Report dates must be within the phase date range')
    }
    return this.reportsRepository.createForPhase(phaseId, dto, startDate, endDate)
  }

  async delete(id: bigint) {
    try {
      await this.reportsRepository.delete(id)
    } catch (error) {
      // P2025: record to delete does not exist (e.g. deleted concurrently)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Report not found')
      }
      throw error
    }
    return { deleted: true, id }
  }

  async updateResultFeedback(resultId: bigint, dto: UpdateResultFeedbackDto) {
    const result = await this.resultsRepository.findById(resultId)
    if (!result) throw new NotFoundException('Test result not found')
    if (result.status !== 'failed' && result.status !== 'broken') {
      throw new BadRequestException('Feedback can only be added to failed or broken tests')
    }
    return this.resultsRepository.updateFeedback(resultId, {
      failureReason: dto.failureReason?.trim() || null,
      failureComment: dto.failureComment?.trim() || null,
    })
  }

  /**
   * The report view: every visible catalog test plus runs overlapping the
   * report's inclusive date range. Catalog tests without a matching run are
   * returned with status `no_run`; unregistered runs are included as well.
   */
  async findResults(id: bigint): Promise<ReportResultRow[]> {
    const report = await this.findById(id)
    const [catalog, runs] = await Promise.all([
      this.testsRepository.findAll(),
      this.resultsRepository.findRunsCoveringWindow(dayStart(report.startDate), dayEnd(report.endDate)),
    ])

    const latestRunByPath = new Map<string, TestResult>()
    for (const run of runs) {
      const current = latestRunByPath.get(run.path)
      // runs are sorted by startDate desc; keep the earliest passing run so a
      // later failure does not override an earlier pass in the report view.
      if (!current || (current.status !== 'passed' && run.status === 'passed')) {
        latestRunByPath.set(run.path, run)
      }
    }

    const rows: ReportResultRow[] = []
    const catalogPaths = new Set<string>()
    for (const test of catalog) {
      catalogPaths.add(test.resultPath)
      // Hidden catalog tests are excluded from the report, including their runs.
      if (!test.visible) continue
      const run = latestRunByPath.get(test.resultPath)
      rows.push(toRow(test, run ?? null))
    }
    for (const run of latestRunByPath.values()) {
      if (!catalogPaths.has(run.path)) rows.push(toRow(null, run))
    }
    return rows
  }
}

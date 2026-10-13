import { Injectable, NotFoundException } from '@nestjs/common'
import { AutomatedTest, Prisma, Report, TestResult } from '@prisma/client'
import { PhasesService } from '../../phases/service/phases.service'
import { ResultsRepository } from '../../results/repository/results.repository'
import { ReportResultRow } from '../../results/dto/run-payload'
import { TestsRepository } from '../../tests/repository/tests.repository'
import { CreateReportDto } from '../dto/create-report.dto'
import { ReportsRepository } from '../repository/reports.repository'

const MS_PER_DAY = 86_400_000

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly phasesService: PhasesService,
    private readonly resultsRepository: ResultsRepository,
    private readonly testsRepository: TestsRepository,
  ) {}

  async findById(id: string) {
    const report = await this.reportsRepository.findById(id)
    if (!report) throw new NotFoundException('Report not found')
    return report
  }

  async findByPhaseId(phaseId: number) {
    await this.phasesService.ensureExists(phaseId)
    return this.reportsRepository.findByPhaseId(phaseId)
  }

  async createForPhase(phaseId: number, dto: CreateReportDto) {
    await this.phasesService.ensureExists(phaseId)
    return this.reportsRepository.createForPhase(phaseId, dto)
  }

  async delete(id: string) {
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

  /**
   * The report view: every catalog test, plus runs whose [startDate, endDate]
   * window covers the report date. Catalog tests without a covering run are
   * returned with status `no_run`; runs are matched to catalog entries by
   * resultPath = path, otherwise shown as unregistered runs.
   */
  async findResults(id: string): Promise<ReportResultRow[]> {
    const report = await this.findById(id)
    const [catalog, runs] = await Promise.all([
      this.testsRepository.findAll(),
      this.resultsRepository.findRunsCoveringWindow(dayStart(report.createdAt), dayEnd(report.createdAt)),
    ])

    const latestRunByPath = new Map<string, TestResult>()
    for (const run of runs) {
      if (!latestRunByPath.has(run.path)) latestRunByPath.set(run.path, run)
    }

    const rows: ReportResultRow[] = []
    const catalogPaths = new Set<string>()
    for (const test of catalog) {
      catalogPaths.add(test.resultPath)
      const run = latestRunByPath.get(test.resultPath)
      rows.push(toRow(test, run ?? null))
    }
    for (const run of latestRunByPath.values()) {
      if (!catalogPaths.has(run.path)) rows.push(toRow(null, run))
    }
    return rows
  }
}

function dayStart(date: Date): Date {
  const day = new Date(date)
  day.setUTCHours(0, 0, 0, 0)
  return day
}

function dayEnd(date: Date): Date {
  return new Date(dayStart(date).valueOf() + MS_PER_DAY - 1)
}

function toRow(test: AutomatedTest | null, run: TestResult | null): ReportResultRow {
  const tags = (run?.tags ?? test?.tags ?? []) as unknown
  return {
    rowKey: run?.id ?? `catalog-${test?.id}`,
    path: run?.path ?? test?.resultPath ?? '',
    name: run?.caseName || test?.display || test?.defaultCaseName || run?.path || 'Unknown test',
    suiteName: run?.suiteName ?? test?.defaultSuiteName ?? null,
    caseName: run?.caseName ?? test?.defaultCaseName ?? null,
    owner: run?.owner ?? test?.defaultOwner ?? null,
    circuit: run?.circuit ?? null,
    message: run?.message ?? null,
    status: run?.status ?? 'no_run',
    startDate: run?.startDate ?? null,
    endDate: run?.endDate ?? null,
    durationMs: run ? Math.max(0, run.endDate.valueOf() - run.startDate.valueOf()) : null,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    inCatalog: Boolean(test),
    catalogId: test?.id ?? null,
    fullResponsibility: test?.fullResponsibility ?? null,
    resultId: run?.id ?? null,
  }
}

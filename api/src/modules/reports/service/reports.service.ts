import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AutomatedTest, Prisma, Report, TestResult } from '@prisma/client'
import { PhasesService } from '../../phases/service/phases.service'
import { ResultsRepository } from '../../results/repository/results.repository'
import { ReportResultRow } from '../../results/dto/run-payload'
import { TestsRepository } from '../../tests/repository/tests.repository'
import { CreateReportDto } from '../dto/create-report.dto'
import { ReportsRepository } from '../repository/reports.repository'

const MS_PER_DAY = 86_400_000

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Number.NaN)
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    ? date
    : new Date(Number.NaN)
}

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
      if (!latestRunByPath.has(run.path)) latestRunByPath.set(run.path, run)
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
    rowKey: run?.id != null ? Number(run.id) : `catalog-${test?.id}`,
    path: run?.path ?? test?.resultPath ?? '',
    name: run?.caseName || test?.defaultCaseName || run?.path || 'Unknown test',
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
    catalogId: test?.id == null ? null : Number(test.id),
    fullResponsibility: test?.fullResponsibility ?? null,
    resultId: run?.id == null ? null : Number(run.id),
  }
}

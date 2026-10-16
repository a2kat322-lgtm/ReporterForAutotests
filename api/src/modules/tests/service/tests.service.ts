import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AutomatedTest, Prisma } from '@prisma/client'
import { CreateAutomatedTestDto } from '../dto/create-automated-test.dto'
import { UpdateVisibilityDto } from '../dto/update-visibility.dto'
import { TestsRepository } from '../repository/tests.repository'
import { ResultsRepository } from '../../results/repository/results.repository'

const MS_PER_DAY = 86_400_000

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date : null
}

@Injectable()
export class TestsService {
  constructor(
    private readonly testsRepository: TestsRepository,
    private readonly resultsRepository: ResultsRepository,
  ) {}

  findAll() {
    return this.testsRepository.findAll()
  }

  /**
   * Catalog scoped to one environment: a test belongs to a phase's environment
   * when it is explicitly assigned to it via `AutomatedTestEnvironment` (Harvest).
   * Blank environment falls back to the full catalog.
   */
  async findForEnvironment(environment?: string) {
    const normalized = environment?.trim()
    if (!normalized) return this.testsRepository.findAll()
    return this.testsRepository.findForEnvironment(normalized)
  }

  /** Idempotent upsert keyed by resultPath: re-importing a file updates entries. */
  async create(dto: CreateAutomatedTestDto, source = 'manual') {
    const resultPath = dto.resultPath.trim()
    if (!resultPath) throw new NotFoundException('resultPath is required')
    const existing = await this.testsRepository.findByResultPath(resultPath)
    if (existing) {
      const updated = await this.testsRepository.update(resultPath, dto)
      return { test: updated, created: false }
    }
    const test = await this.testsRepository.create({ ...dto, resultPath }, source)
    return { test, created: true }
  }

  async createBulk(dtos: CreateAutomatedTestDto[], source = 'file') {
    let created = 0
    let updated = 0
    for (const dto of dtos) {
      const result = await this.create(dto, source)
      if (result.created) created += 1
      else updated += 1
    }
    return { created, updated, total: dtos.length }
  }

  updateVisibility(dto: UpdateVisibilityDto) {
    const resultPaths = [...new Set(dto.resultPaths.map((path) => path.trim()).filter(Boolean))]
    if (!resultPaths.length) throw new BadRequestException('At least one resultPath is required')
    return this.testsRepository.updateVisibility(resultPaths, dto.visible)
      .then(({ count }) => ({ updated: count, total: resultPaths.length }))
  }

  /**
   * Registers catalog entries for distinct paths seen within the selected period.
   * When `environment` is supplied, only runs whose circuit matches it are considered,
   * so harvested tests stay scoped to the environment of the phase that opened the catalog.
   */
  async harvestFromResults(startDateValue?: string, endDateValue?: string, environment?: string) {
    if (Boolean(startDateValue) !== Boolean(endDateValue)) {
      throw new BadRequestException('Both startDate and endDate are required')
    }

    const normalizedEnvironment = environment?.trim()
    if (normalizedEnvironment === '') {
      throw new BadRequestException('environment must not be blank when provided')
    }

    let periodStart: Date
    let periodEnd: Date
    if (startDateValue && endDateValue) {
      const startDate = parseDateOnly(startDateValue)
      const endDate = parseDateOnly(endDateValue)
      if (!startDate || !endDate || endDate < startDate) {
        throw new BadRequestException('A valid date range is required; endDate cannot be before startDate')
      }
      periodStart = startDate
      periodEnd = new Date(endDate.valueOf() + MS_PER_DAY - 1)
    } else {
      // Preserve existing API behavior when no period is supplied.
      periodStart = new Date(0)
      periodEnd = new Date('9999-12-31T23:59:59.999Z')
    }

    const groups = await this.resultsRepository.findDistinctPaths(periodStart, periodEnd, normalizedEnvironment)
    const paths = groups.map((group) => group.path)
    const latestRuns = await this.resultsRepository.findLatestRunPerPath(
      paths,
      periodStart,
      periodEnd,
      normalizedEnvironment,
    )
    const latestByPath = new Map<string, (typeof latestRuns)[number]>()
    for (const run of latestRuns) {
      if (!latestByPath.has(run.path)) latestByPath.set(run.path, run)
    }

    const entries = paths.map((path) => {
      const run = latestByPath.get(path)
      return {
        resultPath: path,
        defaultCaseName: run?.caseName || path,
        defaultSuiteName: run?.suiteName ?? undefined,
        defaultOwner: run?.owner ?? undefined,
        tags: Array.isArray(run?.tags) ? (run.tags as unknown[]).map(String) : [],
      }
    })
    const { created } = await this.testsRepository.harvestBatch(entries, normalizedEnvironment ?? '')
    return { created, skipped: paths.length - created, paths: paths.length }
  }

  async delete(id: bigint) {
    try {
      await this.testsRepository.delete(id)
    } catch (error) {
      // P2025: record to delete does not exist (e.g. deleted concurrently)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Automated test not found')
      }
      throw error
    }
    return { deleted: true, id }
  }
}

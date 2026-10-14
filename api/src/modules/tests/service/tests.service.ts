import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AutomatedTest, Prisma } from '@prisma/client'
import { CreateAutomatedTestDto } from '../dto/create-automated-test.dto'
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

  /** Registers catalog entries for distinct paths seen within the selected period. */
  async harvestFromResults(startDateValue?: string, endDateValue?: string) {
    if (Boolean(startDateValue) !== Boolean(endDateValue)) {
      throw new BadRequestException('Both startDate and endDate are required')
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

    const groups = await this.resultsRepository.findDistinctPaths(periodStart, periodEnd)
    const paths = groups.map((group) => group.path)
    const latestRuns = await this.resultsRepository.findLatestRunPerPath(paths, periodStart, periodEnd)
    const latestByPath = new Map<string, (typeof latestRuns)[number]>()
    for (const run of latestRuns) {
      if (!latestByPath.has(run.path)) latestByPath.set(run.path, run)
    }

    let created = 0
    let skipped = 0
    for (const path of paths) {
      const existing = await this.testsRepository.findByResultPath(path)
      if (existing) { skipped += 1; continue }
      const run = latestByPath.get(path)
      await this.testsRepository.create(
        {
          resultPath: path,
          defaultCaseName: run?.caseName || path,
          defaultSuiteName: run?.suiteName ?? undefined,
          defaultOwner: run?.owner ?? undefined,
          tags: Array.isArray(run?.tags) ? (run.tags as unknown[]).map(String) : [],
        },
        'harvested',
      )
      created += 1
    }
    return { created, skipped, paths: paths.length }
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

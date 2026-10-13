import { Injectable, NotFoundException } from '@nestjs/common'
import { AutomatedTest, Prisma } from '@prisma/client'
import { CreateAutomatedTestDto } from '../dto/create-automated-test.dto'
import { TestsRepository } from '../repository/tests.repository'
import { ResultsRepository } from '../../results/repository/results.repository'

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

  /** Registers catalog entries for every distinct path seen in stored runs. */
  async harvestFromResults() {
    const groups = await this.resultsRepository.findDistinctPaths()
    const paths = groups.map((group) => group.path)
    const latestRuns = await this.resultsRepository.findLatestRunPerPath(paths)
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

  async delete(id: string) {
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

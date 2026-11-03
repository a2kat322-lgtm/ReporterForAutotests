import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AllureLaunch, Prisma, TestStatus } from '@prisma/client'
import { ResultsRepository } from '../../results/repository/results.repository'
import { LaunchDetail, LaunchRunRow, LaunchStatusCounts, LaunchSummary } from '../dto/launch.dto'
import { LaunchesRepository } from '../repository/launches.repository'

const MAX_LAUNCH_ID_LENGTH = 128
const FAILURE_STATUSES: TestStatus[] = [TestStatus.failed, TestStatus.broken]

function emptyCounts(): LaunchStatusCounts {
  return { passed: 0, failed: 0, broken: 0, skipped: 0 }
}

function warningList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

@Injectable()
export class LaunchesService {
  constructor(
    private readonly launchesRepository: LaunchesRepository,
    private readonly resultsRepository: ResultsRepository,
  ) {}

  /** The history table: every uploaded archive of the workspace, newest first. */
  async findAll(workspaceId?: bigint): Promise<LaunchSummary[]> {
    const launches = await this.launchesRepository.findAll(workspaceId)
    if (!launches.length) return []

    const grouped = await this.launchesRepository.statusCounts(launches.map((launch) => launch.id))
    const byLaunch = new Map<string, LaunchStatusCounts>()
    for (const row of grouped) {
      if (!row.launchId) continue
      const counts = byLaunch.get(row.launchId) ?? emptyCounts()
      counts[row.status] = row._count._all
      byLaunch.set(row.launchId, counts)
    }
    return launches.map((launch) => this.toSummary(launch, byLaunch.get(launch.id) ?? emptyCounts()))
  }

  /**
   * One launch with its runs. This is the page a history row opens: the runs
   * are not merged with the catalog and hidden catalog tests stay visible,
   * because the page answers "what did this archive report", not "what is the
   * current state of the test catalog".
   */
  async findOne(launchId: string): Promise<LaunchDetail> {
    const id = launchId.trim()
    if (!id || id.length > MAX_LAUNCH_ID_LENGTH) {
      throw new BadRequestException(`launchId must be 1..${MAX_LAUNCH_ID_LENGTH} characters long`)
    }

    const launch = await this.launchesRepository.findById(id)
    if (!launch) throw new NotFoundException('Launch not found')

    const runs = await this.launchesRepository.findRuns(id)
    const failureIds = runs
      .filter((run) => FAILURE_STATUSES.includes(run.status))
      .map((run) => run.id)
    const messages = await this.resultsRepository.findMessagesByIds(failureIds)

    const counts = emptyCounts()
    for (const run of runs) counts[run.status] += 1

    const results: LaunchRunRow[] = runs.map((run) => ({
      rowKey: Number(run.id),
      resultId: Number(run.id),
      path: run.path,
      name: run.caseName || run.path,
      suiteName: run.suiteName,
      caseName: run.caseName,
      epic: run.epic,
      owner: run.owner,
      circuit: run.circuit,
      message: messages.get(run.id.toString()) ?? null,
      failureReason: run.failureReason,
      failureComment: run.failureComment,
      status: run.status,
      startDate: run.startDate,
      endDate: run.endDate,
      durationMs: Math.max(0, run.endDate.getTime() - run.startDate.getTime()),
      tags: Array.isArray(run.tags) ? run.tags.map((tag) => String(tag)) : [],
      // The archive registers every path it contains in the catalog, so a row
      // of a launch is normally catalogued; the flag only hides the "not
      // registered" hint in the case table.
      inCatalog: true,
    }))

    return { launch: this.toSummary(launch, counts), results }
  }

  private toSummary(launch: AllureLaunch, counts: LaunchStatusCounts): LaunchSummary {
    const startedAt = launch.startedAt
    const finishedAt = launch.finishedAt
    return {
      id: launch.id,
      workspaceId: launch.workspaceId,
      environment: launch.environment,
      origin: launch.origin,
      projectName: launch.projectName,
      fileName: launch.fileName,
      archives: launch.archives,
      imported: launch.imported,
      enriched: launch.enriched,
      duplicates: launch.duplicates,
      totalResults: launch.totalResults,
      attachments: launch.attachments,
      catalogCreated: launch.catalogCreated,
      warnings: warningList(launch.warnings),
      startedAt,
      finishedAt,
      durationMs: startedAt && finishedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : null,
      createdAt: launch.createdAt,
      updatedAt: launch.updatedAt,
      counts,
      total: counts.passed + counts.failed + counts.broken + counts.skipped,
    }
  }
}

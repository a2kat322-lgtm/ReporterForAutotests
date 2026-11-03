import { Injectable } from '@nestjs/common'
import { AllureLaunch, Prisma } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'
import { runSummarySelect } from '../../results/dto/run-summary'
import { LaunchImportRecord } from '../dto/launch.dto'

const MAX_WARNINGS = 100

function warningList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function earliest(left: Date | null, right: Date | null): Date | null {
  if (!left) return right
  if (!right) return left
  return left < right ? left : right
}

function latest(left: Date | null, right: Date | null): Date | null {
  if (!left) return right
  if (!right) return left
  return left > right ? left : right
}

@Injectable()
export class LaunchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest uploads first, optionally scoped to one workspace. */
  findAll(workspaceId?: bigint): Promise<AllureLaunch[]> {
    return this.prisma.allureLaunch.findMany({
      where: workspaceId == null ? {} : { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: string): Promise<AllureLaunch | null> {
    return this.prisma.allureLaunch.findUnique({ where: { id } })
  }

  /** Status tallies of several launches in one query (history table). */
  statusCounts(launchIds: string[]) {
    if (!launchIds.length) return Promise.resolve([])
    return this.prisma.testResult.groupBy({
      by: ['launchId', 'status'],
      where: { launchId: { in: launchIds } },
      _count: { _all: true },
    })
  }

  findRuns(launchId: string) {
    return this.prisma.testResult.findMany({
      where: { launchId },
      select: runSummarySelect,
      orderBy: [{ suiteName: 'asc' }, { caseName: 'asc' }, { startDate: 'asc' }],
    })
  }

  /**
   * Writes (or extends) the history row of one launch. A CI run may arrive as
   * several archives sharing `launchId`; counters accumulate, while the run
   * window and the warning list are merged.
   *
   * Called after the runs are stored: the history is bookkeeping and must never
   * be the reason a successful import reports a failure.
   */
  async recordImport(record: LaunchImportRecord): Promise<AllureLaunch> {
    const existing = await this.prisma.allureLaunch.findUnique({
      where: { id: record.id },
      select: { fileName: true, warnings: true, startedAt: true, finishedAt: true, origin: true },
    })

    if (!existing) {
      return this.prisma.allureLaunch.create({
        data: {
          id: record.id,
          workspaceId: record.workspaceId,
          environment: record.environment,
          origin: record.origin,
          projectName: record.projectName,
          fileName: record.fileName,
          archives: 1,
          imported: record.imported,
          enriched: record.enriched,
          duplicates: record.duplicates,
          totalResults: record.totalResults,
          attachments: record.attachments,
          catalogCreated: record.catalogCreated,
          warnings: record.warnings as unknown as Prisma.InputJsonValue,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt,
        },
      })
    }

    const warnings = [...warningList(existing.warnings), ...record.warnings].slice(0, MAX_WARNINGS)
    return this.prisma.allureLaunch.update({
      where: { id: record.id },
      data: {
        environment: record.environment,
        // A launch keeps the origin it was first recorded with. `unknown` is
        // the exception: a re-import may fill it with a known origin.
        origin: existing.origin === 'unknown' ? record.origin : existing.origin,
        projectName: record.projectName,
        fileName: record.fileName ?? existing.fileName,
        archives: { increment: 1 },
        imported: { increment: record.imported },
        enriched: { increment: record.enriched },
        duplicates: { increment: record.duplicates },
        totalResults: { increment: record.totalResults },
        attachments: { increment: record.attachments },
        catalogCreated: { increment: record.catalogCreated },
        warnings: warnings as unknown as Prisma.InputJsonValue,
        startedAt: earliest(existing.startedAt, record.startedAt),
        finishedAt: latest(existing.finishedAt, record.finishedAt),
      },
    })
  }
}

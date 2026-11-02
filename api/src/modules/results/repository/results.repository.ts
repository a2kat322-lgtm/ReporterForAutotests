import { Injectable } from '@nestjs/common'
import { Prisma, TestStatus } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'
import { NormalizedRun } from '../dto/run-payload'
import { RunSummary, runSummarySelect } from '../dto/run-summary'

/** Statuses whose failure text is needed by the failure analytics. */
const FAILURE_STATUSES: TestStatus[] = [TestStatus.failed, TestStatus.broken]

@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts the run and, when it carries a failure message, its cold detail row.
   * Both writes are one transaction so a run never ends up with a half-written
   * detail.
   */
  create(run: NormalizedRun) {
    const { message, ...rest } = run
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.testResult.create({ data: rest })
      if (message) {
        await tx.testResultDetail.create({ data: { resultId: saved.id, message } })
      }
      return saved
    })
  }

  /**
   * One run with the detail the drawer needs. The API contract is unchanged:
   * the split into `TestResultDetail` is an internal storage decision, so the
   * merged object keeps `message`, `steps`, `attachments`, `parameters`, `links`
   * and `statusDetails` as flat fields.
   */
  async findById(id: bigint) {
    const result = await this.prisma.testResult.findUnique({ where: { id }, include: { detail: true } })
    if (!result) return null
    const { detail, ...rest } = result
    return {
      ...rest,
      message: detail?.message ?? null,
      steps: detail?.steps ?? [],
      attachments: detail?.attachments ?? [],
      parameters: detail?.parameters ?? [],
      links: detail?.links ?? [],
      statusDetails: detail?.statusDetails ?? null,
    }
  }

  updateFeedback(id: bigint, data: { failureReason: string | null; failureComment: string | null }) {
    return this.prisma.testResult.update({ where: { id }, data })
  }

  /**
   * Runs whose [startDate, endDate] window overlaps the inclusive report period,
   * using an interval-overlap (&&) scan backed by the GiST index on
   * tstzrange(startDate, endDate). When `environment` is set, only runs whose
   * canonical (lowercase) circuit matches it are returned. Runs are always
   * scoped to `workspaceId`.
   *
   * Columns are listed explicitly (not `SELECT *`): the failure text lives in
   * `TestResultDetail` and must not travel with every report load.
   */
  findRunsCoveringWindow(workspaceId: bigint, periodStart: Date, periodEnd: Date, environment?: string): Promise<RunSummary[]> {
    const circuit = environment?.trim().toLowerCase()
    return this.prisma.$queryRaw<RunSummary[]>`
      SELECT "id", "workspaceId", "projectName", "path", "suiteName", "caseName", "status",
             "epic", "owner", "circuit", "failureReason", "failureComment",
             "startDate", "endDate", "tags", "externalId", "launchId", "createdAt", "updatedAt"
      FROM "TestResult"
      WHERE "workspaceId" = ${workspaceId}
        AND tstzrange("startDate", "endDate", '[]') && tstzrange(${periodStart}, ${periodEnd}, '[]')
        ${circuit ? Prisma.sql`AND "circuit" = ${circuit}` : Prisma.empty}
      ORDER BY "startDate" DESC
    `
  }

  /** Number of runs of every circuit overlapping the period (used for hygiene counters). */
  async countRunsCoveringWindow(workspaceId: bigint, periodStart: Date, periodEnd: Date) {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS "count"
      FROM "TestResult"
      WHERE "workspaceId" = ${workspaceId}
        AND tstzrange("startDate", "endDate", '[]') && tstzrange(${periodStart}, ${periodEnd}, '[]')
    `
    return Number(rows[0]?.count ?? 0)
  }

  /**
   * Failure text for a known set of runs. Report rows need the message of the
   * selected and of the latest run only, so this is a small lookup by primary
   * key instead of a column on the run scan.
   */
  async findMessagesByIds(ids: bigint[]) {
    if (!ids.length) return new Map<string, string | null>()
    const rows = await this.prisma.testResultDetail.findMany({
      where: { resultId: { in: ids } },
      select: { resultId: true, message: true },
    })
    return new Map(rows.map((row) => [row.resultId.toString(), row.message]))
  }

  /**
   * Failure text of failed/broken runs in the window. Failure analytics groups
   * these messages into signatures; no other run needs its message there, so the
   * heavy column is loaded for the failing subset only.
   */
  async findFailureMessages(workspaceId: bigint, periodStart: Date, periodEnd: Date, environment?: string) {
    const rows = await this.prisma.testResult.findMany({
      where: {
        workspaceId,
        status: { in: FAILURE_STATUSES },
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
        ...this.circuitFilter(environment),
      },
      select: { id: true, detail: { select: { message: true } } },
    })
    return new Map(rows.map((row) => [row.id.toString(), row.detail?.message ?? null]))
  }

  /**
   * Distinct paths seen in runs overlapping the inclusive harvest period.
   * When `environment` is set, only runs whose circuit matches it (exact, lowercase) count.
   */
  findDistinctPaths(workspaceId: bigint, periodStart?: Date, periodEnd?: Date, environment?: string) {
    const periodFilter = periodStart && periodEnd
      ? { startDate: { lte: periodEnd }, endDate: { gte: periodStart } }
      : {}
    return this.prisma.testResult.groupBy({
      by: ['path'],
      where: { workspaceId, ...periodFilter, ...this.circuitFilter(environment) },
      _count: { _all: true },
      _max: { startDate: true },
    })
  }

  findLatestRunPerPath(
    workspaceId: bigint,
    paths: string[],
    periodStart?: Date,
    periodEnd?: Date,
    environment?: string,
  ) {
    const periodFilter = periodStart && periodEnd
      ? { startDate: { lte: periodEnd }, endDate: { gte: periodStart } }
      : {}
    return this.prisma.testResult.findMany({
      where: { workspaceId, path: { in: paths }, ...periodFilter, ...this.circuitFilter(environment) },
      select: runSummarySelect,
      orderBy: { startDate: 'desc' },
    })
  }

  /** Exact lowercase circuit equality; empty when no environment is supplied. */
  private circuitFilter(environment?: string) {
    const circuit = environment?.trim().toLowerCase()
    return circuit ? { circuit } : {}
  }
}

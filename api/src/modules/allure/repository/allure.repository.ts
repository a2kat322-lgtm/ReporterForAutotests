import { Injectable } from '@nestjs/common'
import { Prisma, TestResult } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'

export interface MergeCandidate {
  id: bigint
  path: string
  startDate: Date
  status: TestResult['status']
  message: string | null
  suiteName: string | null
  caseName: string | null
  epic: string | null
  owner: string | null
  tags: Prisma.JsonValue
}

/**
 * Cold part of a run. The importer builds it for every parsed result and the
 * repository writes it to `TestResultDetail` next to the run row.
 */
export interface DetailData {
  message?: string | null
  steps?: Prisma.InputJsonValue
  attachments?: Prisma.InputJsonValue
  parameters?: Prisma.InputJsonValue
  links?: Prisma.InputJsonValue
  statusDetails?: Prisma.InputJsonValue
}

export interface ImportedRun {
  /** Row of `TestResult` (hot columns only). */
  result: Prisma.TestResultCreateManyInput
  /** Detail row; `null` when the run carries neither failure text nor Allure detail. */
  detail: DetailData | null
}

const BATCH_SIZE = 500
/** PostgreSQL bind-parameter budget for `externalId IN (...)`. */
const ID_CHUNK = 5000

@Injectable()
export class AllureRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts imported runs in batches. The unique `(workspaceId, externalId)`
   * index plus `skipDuplicates` make a repeated upload of the same archive a no-op.
   *
   * Batches keep the statement below the PostgreSQL bind-parameter limit
   * (65535): ~20 columns per row means a single 2000-row INSERT would already be
   * close, and a bigger archive would fail outright.
   *
   * The detail rows are written after the run rows because they need the
   * generated ids. Ids are resolved through `externalId` (not "rows just
   * inserted"), so a repeated upload also completes a detail row that a previous,
   * interrupted import left missing.
   */
  async createMany(workspaceId: bigint, runs: ImportedRun[]) {
    const keyed = runs.filter((run) => run.result.externalId != null)
    const unkeyed = runs.filter((run) => run.result.externalId == null)
    let count = 0

    for (let index = 0; index < keyed.length; index += BATCH_SIZE) {
      const batch = keyed.slice(index, index + BATCH_SIZE)
      const result = await this.prisma.testResult.createMany({
        data: batch.map((run) => run.result),
        skipDuplicates: true,
      })
      count += result.count
    }

    const idByExternalId = await this.resolveIds(
      workspaceId,
      keyed.map((run) => run.result.externalId as string),
    )
    const details: Prisma.TestResultDetailCreateManyInput[] = []
    for (const run of keyed) {
      if (!run.detail) continue
      const resultId = idByExternalId.get(run.result.externalId as string)
      if (resultId == null) continue
      details.push(this.toDetailRow(resultId, run.detail))
    }
    await this.insertDetails(details)

    // Rows without an Allure uuid cannot be matched back by key, so they are
    // inserted one by one to obtain their ids. Allure always writes a uuid; this
    // is the fallback for hand-made archives.
    for (const run of unkeyed) {
      const saved = await this.prisma.testResult.create({ data: run.result })
      if (run.detail) await this.prisma.testResultDetail.create({ data: this.toDetailRow(saved.id, run.detail) })
      count += 1
    }

    return { count }
  }

  private async resolveIds(workspaceId: bigint, externalIds: string[]) {
    const idByExternalId = new Map<string, bigint>()
    for (let index = 0; index < externalIds.length; index += ID_CHUNK) {
      const rows = await this.prisma.testResult.findMany({
        where: { workspaceId, externalId: { in: externalIds.slice(index, index + ID_CHUNK) } },
        select: { id: true, externalId: true },
      })
      for (const row of rows) {
        if (row.externalId) idByExternalId.set(row.externalId, row.id)
      }
    }
    return idByExternalId
  }

  private async insertDetails(details: Prisma.TestResultDetailCreateManyInput[]) {
    for (let index = 0; index < details.length; index += BATCH_SIZE) {
      await this.prisma.testResultDetail.createMany({
        data: details.slice(index, index + BATCH_SIZE),
        skipDuplicates: true,
      })
    }
  }

  private toDetailRow(resultId: bigint, detail: DetailData): Prisma.TestResultDetailCreateManyInput {
    return {
      resultId,
      message: detail.message ?? null,
      steps: detail.steps ?? [],
      attachments: detail.attachments ?? [],
      parameters: detail.parameters ?? [],
      links: detail.links ?? [],
      statusDetails: detail.statusDetails,
    }
  }

  /**
   * Runs posted by the automation form (`externalId IS NULL`) that could be the
   * same execution as an imported Allure result. They are enriched instead of
   * duplicated, so the ResultWriter stays the primary channel and the archive
   * only adds steps and attachments to the row the report already shows.
   */
  findUnlinkedRuns(workspaceId: bigint, circuit: string, from: Date, to: Date) {
    return this.prisma.testResult
      .findMany({
        where: {
          workspaceId,
          circuit,
          externalId: null,
          startDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          path: true,
          startDate: true,
          status: true,
          suiteName: true,
          caseName: true,
          epic: true,
          owner: true,
          tags: true,
          detail: { select: { message: true } },
        },
        orderBy: { startDate: 'asc' },
      })
      .then((rows) => rows.map(({ detail, ...row }) => ({ ...row, message: detail?.message ?? null })))
  }

  /**
   * Adds Allure detail to an already reported run: the run row keeps the values
   * the automation system posted, the detail row is created or completed.
   */
  async enrich(id: bigint, result: Prisma.TestResultUpdateInput, detail: DetailData) {
    await this.prisma.$transaction([
      this.prisma.testResult.update({ where: { id }, data: result }),
      this.prisma.testResultDetail.upsert({
        where: { resultId: id },
        create: this.toDetailRow(id, detail),
        update: detail,
      }),
    ])
  }

  countByLaunch(workspaceId: bigint, launchId: string) {
    return this.prisma.testResult.count({ where: { workspaceId, launchId } })
  }
}

import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma, TestStatus } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'

export interface LegacyPhase {
  id: unknown
  name?: string
  environment?: string
  startedAt?: string
  endedAt?: string
}

export interface LegacyReport {
  id: unknown
  phaseId?: unknown
  name?: string
  author?: string
  createdAt?: string
}

export interface LegacyResult {
  reportId?: unknown
  automatedTestId?: string
  name?: string
  status?: string
  lastRunAt?: string
  errorMessage?: string | null
}

export interface LegacyImportPayload {
  phases: LegacyPhase[]
  reports: LegacyReport[]
  results: LegacyResult[]
}

// Legacy rows used a `running` status that the run contract no longer has.
const LEGACY_STATUS_MAP: Record<string, TestStatus> = {
  passed: TestStatus.passed,
  failed: TestStatus.failed,
  broken: TestStatus.broken,
  skipped: TestStatus.skipped,
}

@Injectable()
export class ImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  executeImport(body: LegacyImportPayload) {
    return this.prisma.$transaction(async (tx) => {
      const phaseIds = new Map<unknown, number>()
      for (const phase of body.phases) {
        const environment = phase?.environment
        const startedAt = new Date(`${phase?.startedAt}T00:00:00.000Z`)
        const endedAt = new Date(`${phase?.endedAt}T00:00:00.000Z`)
        if (!phase?.name || typeof environment !== 'string' || !environment.trim() || Number.isNaN(startedAt.valueOf()) || Number.isNaN(endedAt.valueOf()) || endedAt < startedAt) throw new BadRequestException('Invalid legacy phase')
        const existing = await tx.phase.findFirst({ where: { name: phase.name, startedAt } })
        const saved = existing ?? await tx.phase.create({ data: { name: phase.name, environment, startedAt, endedAt } })
        phaseIds.set(phase.id, saved.id)
      }

      const reportIds = new Map<unknown, { id: number; createdAt: Date }>()
      for (const report of body.reports) {
        const phaseId = phaseIds.get(report.phaseId)
        if (!phaseId || !report.name) throw new BadRequestException('Legacy report references an unknown phase')
        const createdAt = report.createdAt ? new Date(report.createdAt) : new Date()
        const startDate = new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate()))
        const endDate = startDate
        const existing = await tx.report.findFirst({ where: { phaseId, name: report.name } })
        const saved = existing ?? await tx.report.create({ data: { phaseId, name: report.name, author: report.author || 'Imported', createdAt, startDate, endDate } })
        reportIds.set(report.id, { id: saved.id, createdAt: saved.createdAt })
      }

      let importedResults = 0
      let skippedResults = 0
      for (const result of body.results) {
        const report = reportIds.get(result.reportId)
        const status = result.status ? LEGACY_STATUS_MAP[result.status] : undefined
        // Rows without a known status (legacy `running`) or without an identity are skipped:
        // the run contract cannot represent them, and inventing a status would corrupt the data.
        if (!report || !result.automatedTestId || !status) { skippedResults += 1; continue }
        const ranAt = result.lastRunAt ? new Date(result.lastRunAt) : report.createdAt
        if (Number.isNaN(ranAt.valueOf())) { skippedResults += 1; continue }
        const path = result.automatedTestId.slice(0, 300)
        const existing = await tx.testResult.findFirst({ where: { path, startDate: ranAt } })
        if (existing) { skippedResults += 1; continue }
        await tx.testResult.create({
          data: {
            path,
            caseName: result.name?.slice(0, 300) ?? null,
            status,
            message: result.errorMessage ?? null,
            startDate: ranAt,
            endDate: ranAt,
            tags: [] as unknown as Prisma.InputJsonValue,
          },
        })
        importedResults += 1
      }

      return { imported: true, phases: phaseIds.size, reports: reportIds.size, results: importedResults, skippedResults }
    })
  }
}
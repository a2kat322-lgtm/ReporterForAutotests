import { BadRequestException, Injectable } from '@nestjs/common'
import { Environment, Prisma, TestStatus } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'
import { LegacyImportPayload } from '../service/import.service'

interface LegacyPhase {
  id: unknown
  name?: string
  environment?: Environment
  startedAt?: string
  endedAt?: string
}

interface LegacyReport {
  id: unknown
  phaseId?: unknown
  name?: string
  author?: string
  createdAt?: string
}

interface LegacyResult {
  phaseId?: unknown
  reportId?: unknown
  automatedTestId?: string
  name?: string
  status?: TestStatus
  duration?: unknown
  lastRunAt?: string
  errorMessage?: string | null
  steps?: unknown[]
}

@Injectable()
export class ImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  executeImport(body: LegacyImportPayload) {
    return this.prisma.$transaction(async (tx) => {
      const phaseIds = new Map<unknown, number>()
      for (const phase of body.phases as LegacyPhase[]) {
        const environment = phase?.environment
        const startedAt = new Date(`${phase?.startedAt}T00:00:00.000Z`)
        const endedAt = new Date(`${phase?.endedAt}T00:00:00.000Z`)
        if (!phase?.name || !environment || !Object.values(Environment).includes(environment) || Number.isNaN(startedAt.valueOf()) || Number.isNaN(endedAt.valueOf()) || endedAt < startedAt) throw new BadRequestException('Invalid legacy phase')
        const existing = await tx.phase.findFirst({ where: { name: phase.name, startedAt } })
        const saved = existing ?? await tx.phase.create({ data: { name: phase.name, environment, startedAt, endedAt } })
        phaseIds.set(phase.id, saved.id)
      }

      // Track each report's resolved phase alongside its id so results can be
      // validated from memory instead of re-querying every report (N+1).
      const reportRefs = new Map<unknown, { id: string; phaseId: number }>()
      for (const report of body.reports as LegacyReport[]) {
        const phaseId = phaseIds.get(report.phaseId)
        if (!phaseId || !report.name) throw new BadRequestException('Legacy report references an unknown phase')
        const existing = await tx.report.findFirst({ where: { phaseId, name: report.name } })
        const saved = existing ?? await tx.report.create({ data: { phaseId, name: report.name, author: report.author || 'Imported', createdAt: report.createdAt ? new Date(report.createdAt) : undefined } })
        reportRefs.set(report.id, { id: saved.id, phaseId })
      }

      for (const result of body.results as LegacyResult[]) {
        const phaseId = phaseIds.get(result.phaseId)
        const reportRef = reportRefs.get(result.reportId)
        const status = result.status
        if (!phaseId || !reportRef || !result.automatedTestId || !result.name || !status || !Object.values(TestStatus).includes(status)) throw new BadRequestException('Invalid legacy test result or relationship')
        if (reportRef.phaseId !== phaseId) throw new BadRequestException('Legacy result phase does not match its report')
        await tx.testResult.upsert({
          where: { reportId_automatedTestId: { reportId: reportRef.id, automatedTestId: result.automatedTestId } },
          create: { phaseId, reportId: reportRef.id, automatedTestId: result.automatedTestId, name: result.name, status, duration: Math.max(0, Number(result.duration) || 0), lastRunAt: result.lastRunAt ? new Date(result.lastRunAt) : new Date(), errorMessage: result.errorMessage ?? null, steps: (result.steps ?? []) as unknown as Prisma.InputJsonValue },
          update: {},
        })
      }
      return { imported: true, phases: phaseIds.size, reports: reportRefs.size, results: (body.results as LegacyResult[]).length }
    })
  }
}

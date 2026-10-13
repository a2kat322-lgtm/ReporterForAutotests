import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'
import { CreateReportDto } from '../dto/create-report.dto'
import { UpsertResultDto } from '../dto/upsert-result.dto'

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.report.findUnique({ where: { id }, include: { phase: true } })
  }

  findByPhaseId(phaseId: number) {
    return this.prisma.report.findMany({ where: { phaseId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { results: true } } } })
  }

  createForPhase(phaseId: number, dto: CreateReportDto) {
    return this.prisma.report.create({ data: { ...dto, phaseId } })
  }

  delete(id: string) {
    return this.prisma.report.delete({ where: { id } })
  }

  findResults(reportId: string) {
    return this.prisma.testResult.findMany({ where: { reportId }, orderBy: { lastRunAt: 'desc' } })
  }

  findReportReference(reportId: string) {
    return this.prisma.report.findUnique({ where: { id: reportId }, select: { id: true, phaseId: true } })
  }

  upsertResult(reportId: string, dto: UpsertResultDto) {
    const { phaseId, automatedTestId, name, status, duration, lastRunAt, errorMessage, steps } = dto
    const runAt = lastRunAt ? new Date(lastRunAt) : new Date()
    const stepsJson = (steps ?? []) as unknown as Prisma.InputJsonValue
    return this.prisma.testResult.upsert({
      where: { reportId_automatedTestId: { reportId, automatedTestId } },
      create: { phaseId, reportId, automatedTestId, name, status, duration, lastRunAt: runAt, errorMessage, steps: stepsJson },
      update: { phaseId, name, status, duration, lastRunAt: runAt, errorMessage, steps: stepsJson },
    })
  }
}

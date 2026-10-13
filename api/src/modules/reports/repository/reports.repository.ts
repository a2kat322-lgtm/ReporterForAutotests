import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/database/prisma.service'
import { CreateReportDto } from '../dto/create-report.dto'

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.report.findUnique({ where: { id }, include: { phase: true } })
  }

  findByPhaseId(phaseId: number) {
    return this.prisma.report.findMany({ where: { phaseId }, orderBy: { createdAt: 'desc' } })
  }

  findPhaseWithReports(id: string) {
    return this.prisma.report.findUnique({ where: { id }, include: { phase: true } })
  }

  createForPhase(phaseId: number, dto: CreateReportDto) {
    return this.prisma.report.create({ data: { ...dto, phaseId } })
  }

  delete(id: string) {
    return this.prisma.report.delete({ where: { id } })
  }
}
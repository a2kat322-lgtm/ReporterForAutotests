import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/database/prisma.service'
import { CreateReportDto } from '../dto/create-report.dto'

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: number) {
    return this.prisma.report.findUnique({ where: { id }, include: { phase: true } })
  }

  findByPhaseId(phaseId: number) {
    return this.prisma.report.findMany({ where: { phaseId }, orderBy: { createdAt: 'desc' } })
  }

  findPhaseWithReports(id: number) {
    return this.prisma.report.findUnique({ where: { id }, include: { phase: true } })
  }

  createForPhase(phaseId: number, dto: CreateReportDto, startDate: Date, endDate: Date) {
    return this.prisma.report.create({
      data: { name: dto.name, startDate, endDate, phaseId },
    })
  }

  delete(id: number) {
    return this.prisma.report.delete({ where: { id } })
  }
}
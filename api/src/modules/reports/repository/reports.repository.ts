import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/database/prisma.service'
import { CreateReportDto } from '../dto/create-report.dto'

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: bigint) {
    return this.prisma.report.findUnique({ where: { id }, include: { phase: true } })
  }

  findByPhaseId(phaseId: bigint) {
    return this.prisma.report.findMany({ where: { phaseId }, orderBy: { createdAt: 'desc' } })
  }

  findPhaseWithReports(id: bigint) {
    return this.prisma.report.findUnique({ where: { id }, include: { phase: true } })
  }

  createForPhase(phaseId: bigint, dto: CreateReportDto, startDate: Date, endDate: Date) {
    return this.prisma.report.create({
      data: { name: dto.name, startDate, endDate, phaseId },
    })
  }

  delete(id: bigint) {
    return this.prisma.report.delete({ where: { id } })
  }
}
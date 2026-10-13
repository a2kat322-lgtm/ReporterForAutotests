import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PhasesService } from '../../phases/service/phases.service'
import { CreateReportDto } from '../dto/create-report.dto'
import { UpsertResultDto } from '../dto/upsert-result.dto'
import { ReportsRepository } from '../repository/reports.repository'

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly phasesService: PhasesService,
  ) {}

  async findById(id: string) {
    const report = await this.reportsRepository.findById(id)
    if (!report) throw new NotFoundException('Report not found')
    return report
  }

  async findByPhaseId(phaseId: number) {
    await this.phasesService.ensureExists(phaseId)
    return this.reportsRepository.findByPhaseId(phaseId)
  }

  async createForPhase(phaseId: number, dto: CreateReportDto) {
    await this.phasesService.ensureExists(phaseId)
    return this.reportsRepository.createForPhase(phaseId, dto)
  }

  async findResults(id: string) {
    await this.findById(id)
    return this.reportsRepository.findResults(id)
  }

  async upsertResult(reportId: string, dto: UpsertResultDto) {
    const report = await this.reportsRepository.findReportReference(reportId)
    if (!report) throw new NotFoundException('Report not found')
    if (report.phaseId !== dto.phaseId) throw new BadRequestException('Result phaseId must match the report phaseId')
    return this.reportsRepository.upsertResult(reportId, dto)
  }

  async delete(id: string) {
    try {
      await this.reportsRepository.delete(id)
    } catch (error) {
      // P2025: record to delete does not exist (e.g. deleted concurrently)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Report not found')
      }
      throw error
    }
    return { deleted: true, id }
  }
}

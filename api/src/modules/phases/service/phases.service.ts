import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { CreatePhaseDto } from '../dto/create-phase.dto'
import { PhasesRepository } from '../repository/phases.repository'

@Injectable()
export class PhasesService {
  constructor(private readonly phasesRepository: PhasesRepository) {}

  findAll() {
    return this.phasesRepository.findAll()
  }

  async findById(id: bigint) {
    const phase = await this.phasesRepository.findById(id)
    if (!phase) throw new NotFoundException('Phase not found')
    return phase
  }

  async create(dto: CreatePhaseDto) {
    const startedAt = new Date(`${dto.startedAt}T00:00:00.000Z`)
    const endedAt = new Date(`${dto.endedAt}T00:00:00.000Z`)
    if (Number.isNaN(startedAt.valueOf()) || Number.isNaN(endedAt.valueOf()) || endedAt < startedAt) {
      throw new BadRequestException('End date cannot be before start date')
    }
    return this.phasesRepository.create(dto, startedAt, endedAt)
  }

  async ensureExists(id: bigint) {
    await this.findById(id)
    return id
  }

  async delete(id: bigint) {
    try {
      await this.phasesRepository.delete(id)
    } catch (error) {
      // P2025: record to delete does not exist (e.g. deleted concurrently)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Phase not found')
      }
      throw error
    }
    return { deleted: true, id }
  }
}

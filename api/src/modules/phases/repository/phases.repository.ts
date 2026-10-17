import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/database/prisma.service'
import { CreatePhaseDto } from '../dto/create-phase.dto'

@Injectable()
export class PhasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(workspaceId?: bigint) {
    return this.prisma.phase.findMany({ where: workspaceId == null ? {} : { workspaceId }, orderBy: { createdAt: 'desc' } })
  }

  findById(id: bigint) {
    return this.prisma.phase.findUnique({ where: { id } })
  }

  create(dto: CreatePhaseDto, startedAt: Date, endedAt: Date) {
    return this.prisma.phase.create({
      data: { workspaceId: BigInt(dto.workspaceId), name: dto.name, environment: dto.environment, startedAt, endedAt },
    })
  }

  delete(id: bigint) {
    return this.prisma.phase.delete({ where: { id } })
  }
}

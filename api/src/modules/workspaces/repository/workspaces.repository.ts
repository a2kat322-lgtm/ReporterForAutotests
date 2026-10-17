import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/database/prisma.service'

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.workspace.findMany({ orderBy: { createdAt: 'asc' } })
  }

  findById(id: bigint) {
    return this.prisma.workspace.findUnique({ where: { id } })
  }

  /** Canonical name lookup (lowercase + trimmed). */
  findByName(name: string) {
    return this.prisma.workspace.findUnique({ where: { name } })
  }

  create(name: string) {
    return this.prisma.workspace.create({ data: { name } })
  }

  delete(id: bigint) {
    return this.prisma.workspace.delete({ where: { id } })
  }
}

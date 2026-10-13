import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'
import { CreateAutomatedTestDto } from '../dto/create-automated-test.dto'

@Injectable()
export class TestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.automatedTest.findMany({ orderBy: { createdAt: 'asc' } })
  }

  findByResultPath(resultPath: string) {
    return this.prisma.automatedTest.findUnique({ where: { resultPath } })
  }

  create(dto: CreateAutomatedTestDto, source: string) {
    return this.prisma.automatedTest.create({
      data: { ...dto, tags: (dto.tags ?? []) as unknown as Prisma.InputJsonValue, source },
    })
  }

  update(resultPath: string, dto: CreateAutomatedTestDto) {
    return this.prisma.automatedTest.update({
      where: { resultPath },
      data: {
        fullResponsibility: dto.fullResponsibility ?? null,
        defaultSuiteName: dto.defaultSuiteName ?? null,
        defaultCaseName: dto.defaultCaseName ?? null,
        defaultOwner: dto.defaultOwner ?? null,
        tags: (dto.tags ?? []) as unknown as Prisma.InputJsonValue,
        // undefined keeps the current flag (file imports may omit it)
        visible: dto.visible,
      },
    })
  }

  delete(id: string) {
    return this.prisma.automatedTest.delete({ where: { id } })
  }
}

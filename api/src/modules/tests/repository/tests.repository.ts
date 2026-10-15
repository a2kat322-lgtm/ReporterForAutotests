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

  /** Catalog entries are scoped by environments explicitly assigned during Harvest. */
  findForEnvironment(environment: string) {
    return this.prisma.automatedTest.findMany({
      where: { environments: { has: environment } },
      orderBy: { createdAt: 'asc' },
    })
  }

  /** Add an environment to an existing path only after an explicit Harvest. */
  async addEnvironment(resultPath: string, environment: string) {
    const test = await this.prisma.automatedTest.findUnique({ where: { resultPath }, select: { environments: true } })
    if (!test) return false
    if (test.environments.some((item) => item.toLocaleLowerCase() === environment.toLocaleLowerCase())) return false
    await this.prisma.automatedTest.update({
      where: { resultPath },
      data: { environments: { push: environment } },
    })
    return true
  }

  findByResultPath(resultPath: string) {
    return this.prisma.automatedTest.findUnique({ where: { resultPath } })
  }

  create(dto: CreateAutomatedTestDto, source: string, environment?: string) {
    return this.prisma.automatedTest.create({
      data: {
        ...dto,
        environments: environment ? [environment] : [],
        tags: (dto.tags ?? []) as unknown as Prisma.InputJsonValue,
        source,
      },
    })
  }

  updateVisibility(resultPaths: string[], visible: boolean) {
    return this.prisma.automatedTest.updateMany({
      where: { resultPath: { in: resultPaths } },
      data: { visible },
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

  delete(id: bigint) {
    return this.prisma.automatedTest.delete({ where: { id } })
  }
}

import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../common/database/prisma.service'
import { CreateAutomatedTestDto } from '../dto/create-automated-test.dto'

@Injectable()
export class TestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(workspaceId?: bigint) {
    return this.prisma.automatedTest.findMany({ where: workspaceId == null ? {} : { workspaceId }, orderBy: { createdAt: 'asc' } })
  }

  /** Catalog entries scoped by workspace, then by environments explicitly assigned during Harvest. */
  findForEnvironment(environment: string, workspaceId?: bigint) {
    return this.prisma.automatedTest.findMany({
      where: {
        ...(workspaceId == null ? {} : { workspaceId }),
        environments: { some: { environment: environment.trim().toLowerCase() } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  /** Batch-register memberships and create missing catalog rows idempotently. */
  async harvestBatch(entries: Array<{
    resultPath: string
    defaultCaseName: string
    defaultSuiteName?: string
    defaultOwner?: string
    tags: string[]
  }>, environment: string, workspaceId: bigint) {
    if (!entries.length) return { created: 0 }
    const canonicalEnvironment = environment.trim().toLowerCase()
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.automatedTest.findMany({
        where: { workspaceId, resultPath: { in: entries.map((entry) => entry.resultPath) } },
        select: { resultPath: true },
      })
      await tx.automatedTest.createMany({
        data: entries.map((entry) => ({
          workspaceId,
          resultPath: entry.resultPath,
          defaultCaseName: entry.defaultCaseName,
          defaultSuiteName: entry.defaultSuiteName,
          defaultOwner: entry.defaultOwner,
          tags: entry.tags as unknown as Prisma.InputJsonValue,
          source: 'harvested',
        })),
        skipDuplicates: true,
      })
      const tests = await tx.automatedTest.findMany({
        where: { workspaceId, resultPath: { in: entries.map((entry) => entry.resultPath) } },
        select: { id: true },
      })
      await tx.automatedTestEnvironment.createMany({
        data: tests.map((test) => ({ automatedTestId: test.id, environment: canonicalEnvironment })),
        skipDuplicates: true,
      })
      return { created: Math.max(0, tests.length - before.length) }
    })
  }

  /** Add one membership; lowercase canonicalization makes this case-insensitive. */
  async addEnvironment(resultPath: string, environment: string, workspaceId?: bigint) {
    const test = await this.prisma.automatedTest.findFirst({
      where: { resultPath, ...(workspaceId == null ? {} : { workspaceId }) },
      select: { id: true },
    })
    if (!test) return false
    const result = await this.prisma.automatedTestEnvironment.createMany({
      data: [{ automatedTestId: test.id, environment: environment.trim().toLowerCase() }],
      skipDuplicates: true,
    })
    return result.count > 0
  }

  findByResultPath(resultPath: string, workspaceId?: bigint) {
    if (workspaceId == null) return this.prisma.automatedTest.findFirst({ where: { resultPath } })
    return this.prisma.automatedTest.findUnique({ where: { workspaceId_resultPath: { workspaceId, resultPath } } })
  }

  create(dto: CreateAutomatedTestDto, source: string, workspaceId: bigint, environment?: string) {
    return this.prisma.$transaction(async (tx) => {
      const test = await tx.automatedTest.create({
        data: {
          workspaceId,
          resultPath: dto.resultPath,
          tags: (dto.tags ?? []) as unknown as Prisma.InputJsonValue,
          source,
        },
      })
      if (environment?.trim()) {
        await tx.automatedTestEnvironment.create({
          data: { automatedTestId: test.id, environment: environment.trim().toLowerCase() },
        })
      }
      return test
    })
  }

  updateVisibility(resultPaths: string[], visible: boolean, workspaceId: bigint) {
    return this.prisma.automatedTest.updateMany({
      where: { workspaceId, resultPath: { in: resultPaths } },
      data: { visible },
    })
  }

  update(resultPath: string, dto: CreateAutomatedTestDto, workspaceId: bigint) {
    return this.prisma.automatedTest.update({
      where: { workspaceId_resultPath: { workspaceId, resultPath } },
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

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/database/prisma.service'
import { NormalizedRun } from '../dto/run-payload'

@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(run: NormalizedRun) {
    return this.prisma.testResult.create({ data: run })
  }

  findById(id: bigint) {
    return this.prisma.testResult.findUnique({ where: { id } })
  }

  updateFeedback(id: bigint, data: { failureReason: string | null; failureComment: string | null }) {
    return this.prisma.testResult.update({ where: { id }, data })
  }

  /**
   * Runs whose [startDate, endDate] window overlaps the inclusive report period.
   * Overlap condition: startDate <= periodEnd AND endDate >= periodStart.
   * When `environment` is set, only runs whose circuit matches it (case-insensitive) are returned.
   */
  findRunsCoveringWindow(periodStart: Date, periodEnd: Date, environment?: string) {
    return this.prisma.testResult.findMany({
      where: { startDate: { lte: periodEnd }, endDate: { gte: periodStart }, ...this.circuitFilter(environment) },
      orderBy: { startDate: 'desc' },
    })
  }

  /**
   * Distinct paths seen in runs overlapping the inclusive harvest period.
   * When `environment` is set, only runs whose circuit matches it (case-insensitive) count.
   */
  findDistinctPaths(periodStart?: Date, periodEnd?: Date, environment?: string) {
    const periodFilter = periodStart && periodEnd
      ? { startDate: { lte: periodEnd }, endDate: { gte: periodStart } }
      : {}
    return this.prisma.testResult.groupBy({
      by: ['path'],
      where: { ...periodFilter, ...this.circuitFilter(environment) },
      _count: { _all: true },
      _max: { startDate: true },
    })
  }

  findLatestRunPerPath(paths: string[], periodStart?: Date, periodEnd?: Date, environment?: string) {
    const periodFilter = periodStart && periodEnd
      ? { startDate: { lte: periodEnd }, endDate: { gte: periodStart } }
      : {}
    return this.prisma.testResult.findMany({
      where: { path: { in: paths }, ...periodFilter, ...this.circuitFilter(environment) },
      orderBy: { startDate: 'desc' },
    })
  }

  /** Case-insensitive circuit equality; empty when no environment is supplied. */
  private circuitFilter(environment?: string) {
    return environment
      ? { circuit: { equals: environment, mode: 'insensitive' as const } }
      : {}
  }
}

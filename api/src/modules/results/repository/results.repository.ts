import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/database/prisma.service'
import { NormalizedRun } from '../dto/run-payload'

@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(run: NormalizedRun) {
    return this.prisma.testResult.create({ data: run })
  }

  /**
   * Runs whose [startDate, endDate] window overlaps the inclusive report period.
   * Overlap condition: startDate <= periodEnd AND endDate >= periodStart.
   */
  findRunsCoveringWindow(periodStart: Date, periodEnd: Date) {
    return this.prisma.testResult.findMany({
      where: { startDate: { lte: periodEnd }, endDate: { gte: periodStart } },
      orderBy: { startDate: 'desc' },
    })
  }

  /** Distinct paths seen in runs overlapping the inclusive harvest period. */
  findDistinctPaths(periodStart?: Date, periodEnd?: Date) {
    const periodFilter = periodStart && periodEnd
      ? { startDate: { lte: periodEnd }, endDate: { gte: periodStart } }
      : {}
    return this.prisma.testResult.groupBy({
      by: ['path'],
      where: periodFilter,
      _count: { _all: true },
      _max: { startDate: true },
    })
  }

  findLatestRunPerPath(paths: string[], periodStart?: Date, periodEnd?: Date) {
    const periodFilter = periodStart && periodEnd
      ? { startDate: { lte: periodEnd }, endDate: { gte: periodStart } }
      : {}
    return this.prisma.testResult.findMany({
      where: { path: { in: paths }, ...periodFilter },
      orderBy: { startDate: 'desc' },
    })
  }
}

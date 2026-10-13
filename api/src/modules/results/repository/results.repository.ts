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
   * Runs whose [startDate, endDate] window overlaps the given day.
   * Overlap condition: startDate <= dayEnd AND endDate >= dayStart.
   */
  findRunsCoveringWindow(dayStart: Date, dayEnd: Date) {
    return this.prisma.testResult.findMany({
      where: { startDate: { lte: dayEnd }, endDate: { gte: dayStart } },
      orderBy: { startDate: 'desc' },
    })
  }

  /** Latest run per path — used when harvesting the catalog from stored runs. */
  findDistinctPaths() {
    return this.prisma.testResult.groupBy({
      by: ['path'],
      _count: { _all: true },
      _max: { startDate: true },
    })
  }

  findLatestRunPerPath(paths: string[]) {
    return this.prisma.testResult.findMany({
      where: { path: { in: paths } },
      orderBy: { startDate: 'desc' },
    })
  }
}

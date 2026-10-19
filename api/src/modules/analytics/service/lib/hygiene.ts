import { Report, TestResult } from '@prisma/client'
import { PhaseHygiene } from '../../dto/analytics.types'
import { isFailure } from './analytics.utils'

export function buildHygiene(
  allRuns: TestResult[],
  environmentRuns: TestResult[],
  catalogPaths: Set<string>,
  reports: Report[],
): PhaseHygiene {
  const uncatalogued = environmentRuns.filter((run) => !catalogPaths.has(run.path))
  const uncataloguedPaths = new Set(uncatalogued.map((run) => run.path))

  const duplicateMap = new Map<string, number>()
  for (const run of environmentRuns) {
    const key = `${run.path}\u0000${run.startDate.toISOString()}`
    duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1)
  }
  let duplicateGroups = 0
  let duplicateRuns = 0
  for (const count of duplicateMap.values()) {
    if (count > 1) {
      duplicateGroups += 1
      duplicateRuns += count - 1
    }
  }

  let overlappingReportPairs = 0
  const overlappingReports = new Set<number>()
  for (let left = 0; left < reports.length; left += 1) {
    for (let right = left + 1; right < reports.length; right += 1) {
      if (reports[left].startDate <= reports[right].endDate && reports[right].startDate <= reports[left].endDate) {
        overlappingReportPairs += 1
        overlappingReports.add(Number(reports[left].id))
        overlappingReports.add(Number(reports[right].id))
      }
    }
  }

  const byDay = new Map<string, number>()
  for (const run of environmentRuns) {
    const date = run.startDate.toISOString().slice(0, 10)
    byDay.set(date, (byDay.get(date) ?? 0) + 1)
  }

  const failedRuns = environmentRuns.filter((run) => isFailure(run.status))
  return {
    totalRuns: allRuns.length,
    environmentRuns: environmentRuns.length,
    uncataloguedRuns: uncatalogued.length,
    uncataloguedPaths: uncataloguedPaths.size,
    duplicateRuns,
    duplicateGroups,
    wrongCircuitRuns: allRuns.length - environmentRuns.length,
    overlappingReportPairs,
    overlappingReports: overlappingReports.size,
    missingOwnerRuns: environmentRuns.filter((run) => !run.owner?.trim()).length,
    missingMessageRuns: failedRuns.filter((run) => !run.message?.trim()).length,
    runsByDay: [...byDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((left, right) => left.date.localeCompare(right.date)),
  }
}

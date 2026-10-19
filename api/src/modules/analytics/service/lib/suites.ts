import { AutomatedTest } from '@prisma/client'
import { AnalyticsStatus, PhaseSuiteRow, StatusCounts } from '../../dto/analytics.types'
import { ReportEntry } from './entries'
import { durationOf, emptyCounts, percentile, ratio } from './analytics.utils'

interface SuiteAccumulator {
  suiteName: string
  counts: StatusCounts
  total: number
  durations: number[]
}

export function buildSuites(catalog: AutomatedTest[], latest: ReportEntry | null): PhaseSuiteRow[] {
  const accumulators = new Map<string, SuiteAccumulator>()

  for (const test of catalog) {
    const run = latest?.selected.get(test.resultPath) ?? null
    const status = (run?.status ?? 'no_run') as AnalyticsStatus
    const suiteName = run?.suiteName?.trim() || test.defaultSuiteName?.trim() || 'Без набора'
    const current = accumulators.get(suiteName) ?? {
      suiteName,
      counts: emptyCounts(),
      total: 0,
      durations: [],
    }
    current.counts[status] += 1
    current.total += 1
    const duration = durationOf(run)
    if (duration != null) current.durations.push(duration)
    accumulators.set(suiteName, current)
  }

  return [...accumulators.values()]
    .map((row) => ({
      suiteName: row.suiteName,
      total: row.total,
      failed: row.counts.failed,
      broken: row.counts.broken,
      no_run: row.counts.no_run,
      passRate: ratio(row.counts.passed, row.total),
      p90: percentile(row.durations, 0.9),
    }))
    .sort((left, right) => right.failed + right.broken - (left.failed + left.broken) || right.total - left.total)
}

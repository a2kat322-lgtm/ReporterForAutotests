import { AutomatedTest } from '@prisma/client'
import { AnalyticsStatus, PhaseOwnerRow, StatusCounts } from '../../dto/analytics.types'
import { ReportEntry } from './entries'
import { emptyCounts, isFailure, ratio } from './analytics.utils'

interface OwnerAccumulator extends StatusCounts {
  owner: string
  total: number
  analyzed: number
  failures: number
  flaky: number
}

export function buildOwners(
  catalog: AutomatedTest[],
  latest: ReportEntry | null,
  flakyPaths: Set<string>,
): PhaseOwnerRow[] {
  const accumulators = new Map<string, OwnerAccumulator>()

  for (const test of catalog) {
    const run = latest?.selected.get(test.resultPath) ?? null
    const status = (run?.status ?? 'no_run') as AnalyticsStatus
    const owner = run?.owner?.trim() || test.defaultOwner?.trim() || 'Не назначен'
    const current = accumulators.get(owner) ?? {
      owner,
      ...emptyCounts(),
      total: 0,
      analyzed: 0,
      failures: 0,
      flaky: 0,
    }
    current[status] += 1
    current.total += 1
    if (isFailure(status)) {
      current.failures += 1
      if (run?.failureReason?.trim()) current.analyzed += 1
    }
    if (flakyPaths.has(test.resultPath)) current.flaky += 1
    accumulators.set(owner, current)
  }

  return [...accumulators.values()]
    .map((row) => ({
      owner: row.owner,
      passed: row.passed,
      failed: row.failed,
      broken: row.broken,
      skipped: row.skipped,
      no_run: row.no_run,
      total: row.total,
      passRate: ratio(row.passed, row.total),
      analysisRate: ratio(row.analyzed, row.failures),
      flaky: row.flaky,
    }))
    .sort((left, right) => right.failed + right.broken - (left.failed + left.broken) || right.total - left.total)
}

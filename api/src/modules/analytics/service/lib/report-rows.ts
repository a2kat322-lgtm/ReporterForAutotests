import { AutomatedTest, TestResult } from '@prisma/client'
import { AnalyticsStatus, ReportComparisonRow } from '../../dto/analytics.types'
import { ReportEntry } from './entries'
import { durationOf, isFailure, percentile, ratio } from './analytics.utils'

export function buildReportRows(entries: ReportEntry[], catalog: AutomatedTest[], runs: TestResult[]): ReportComparisonRow[] {
  const rows: ReportComparisonRow[] = []
  const visiblePaths = new Set(catalog.map((test) => test.resultPath))
  let previous = new Map<string, AnalyticsStatus>()

  for (const entry of entries) {
    const durations: number[] = []
    let failedTotal = 0
    let analyzed = 0

    for (const test of catalog) {
      const status = entry.statusByPath.get(test.resultPath) ?? 'no_run'
      const run = entry.selected.get(test.resultPath)
      const duration = durationOf(run)
      if (duration != null) durations.push(duration)
      if (isFailure(status)) {
        failedTotal += 1
        if (run?.failureReason?.trim()) analyzed += 1
      }
    }

    let newFailures = 0
    let fixed = 0
    for (const [path, status] of entry.statusByPath) {
      const before = previous.get(path)
      if (before == null) continue
      if (before === 'passed' && isFailure(status)) newFailures += 1
      if (isFailure(before) && status === 'passed') fixed += 1
    }

    const executed = entry.counts.passed + entry.counts.failed + entry.counts.broken + entry.counts.skipped
    rows.push({
      reportId: Number(entry.report.id),
      name: entry.report.name,
      startDate: entry.report.startDate,
      endDate: entry.report.endDate,
      counts: entry.counts,
      total: catalog.length,
      passRate: ratio(entry.counts.passed, catalog.length),
      effectivePassRate: ratio(entry.counts.passed, executed),
      coverage: ratio(executed, catalog.length),
      p90: percentile(durations, 0.9),
      flaky: countFlaky(runs, entry.start, entry.end, visiblePaths),
      newFailures,
      fixed,
      analysisRate: ratio(analyzed, failedTotal),
    })
    previous = entry.statusByPath
  }
  return rows
}

export function collectFlakyPaths(runs: TestResult[], visiblePaths: Set<string>): Set<string> {
  const flags = new Map<string, { passed: boolean; failed: boolean }>()
  for (const run of runs) {
    if (!visiblePaths.has(run.path)) continue
    const current = flags.get(run.path) ?? { passed: false, failed: false }
    if (run.status === 'passed') current.passed = true
    else if (isFailure(run.status)) current.failed = true
    flags.set(run.path, current)
  }
  const flaky = new Set<string>()
  for (const [path, flag] of flags) {
    if (flag.passed && flag.failed) flaky.add(path)
  }
  return flaky
}

export function countFlaky(runs: TestResult[], start: Date, end: Date, visiblePaths: Set<string>): number {
  const flags = new Map<string, { passed: boolean; failed: boolean }>()
  for (const run of runs) {
    if (!visiblePaths.has(run.path) || run.startDate > end || run.endDate < start) continue
    const current = flags.get(run.path) ?? { passed: false, failed: false }
    if (run.status === 'passed') current.passed = true
    else if (isFailure(run.status)) current.failed = true
    flags.set(run.path, current)
  }
  let count = 0
  for (const flag of flags.values()) {
    if (flag.passed && flag.failed) count += 1
  }
  return count
}

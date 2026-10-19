import { AutomatedTest, TestResult } from '@prisma/client'
import { PhaseKpi, ReportComparisonRow } from '../../dto/analytics.types'
import { ReportEntry } from './entries'
import { isFailure, ratio } from './analytics.utils'

export function buildKpi(
  reportRows: ReportComparisonRow[],
  catalog: AutomatedTest[],
  runs: TestResult[],
  flakyPaths: Set<string>,
  entries: ReportEntry[],
): PhaseKpi {
  const passedOnce = new Set<string>()
  for (const entry of entries) {
    for (const [path, status] of entry.statusByPath) {
      if (status === 'passed') passedOnce.add(path)
    }
  }

  const catalogPaths = new Set(catalog.map((test) => test.resultPath))
  const executedPaths = new Set(runs.filter((run) => catalogPaths.has(run.path)).map((run) => run.path))
  const runsByPath = new Map<string, TestResult[]>()
  for (const run of runs) {
    const bucket = runsByPath.get(run.path)
    if (bucket) bucket.push(run)
    else runsByPath.set(run.path, [run])
  }

  let alwaysFailed = 0
  for (const test of catalog) {
    const pathRuns = runsByPath.get(test.resultPath)
    if (!pathRuns?.length) continue
    if (!pathRuns.some((run) => run.status === 'passed') && pathRuns.every((run) => isFailure(run.status))) {
      alwaysFailed += 1
    }
  }

  return {
    reports: reportRows.length,
    catalog: catalog.length,
    executed: executedPaths.size,
    passedOnce: passedOnce.size,
    neverPassed: catalog.length - passedOnce.size,
    alwaysFailed,
    flaky: flakyPaths.size,
    passRate: ratio(passedOnce.size, catalog.length),
    coverage: ratio(executedPaths.size, catalog.length),
    totalRuns: runs.length,
  }
}

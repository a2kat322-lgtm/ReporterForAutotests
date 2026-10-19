import { AutomatedTest, TestResult } from '@prisma/client'
import { PhaseLifecycle } from '../../dto/analytics.types'
import { isFailure } from './analytics.utils'

export function buildLifecycle(catalog: AutomatedTest[], runs: TestResult[]): PhaseLifecycle {
  const runsByPath = new Map<string, TestResult[]>()
  for (const run of runs) {
    const bucket = runsByPath.get(run.path)
    if (bucket) bucket.push(run)
    else runsByPath.set(run.path, [run])
  }

  const lifecycle: PhaseLifecycle = {
    stableGreen: 0,
    stableRed: 0,
    recovered: 0,
    regressed: 0,
    neverRun: 0,
    other: 0,
  }

  for (const test of catalog) {
    const pathRuns = (runsByPath.get(test.resultPath) ?? [])
      .sort((left, right) => left.startDate.valueOf() - right.startDate.valueOf())
    if (!pathRuns.length) {
      lifecycle.neverRun += 1
      continue
    }
    const passed = pathRuns.some((run) => run.status === 'passed')
    const failed = pathRuns.some((run) => isFailure(run.status))
    const latest = pathRuns[pathRuns.length - 1].status
    if (passed && !failed) lifecycle.stableGreen += 1
    else if (!passed && failed) lifecycle.stableRed += 1
    else if (latest === 'passed' && failed) lifecycle.recovered += 1
    else if (isFailure(latest) && passed) lifecycle.regressed += 1
    else lifecycle.other += 1
  }

  return lifecycle
}

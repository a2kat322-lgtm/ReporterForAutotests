import { AutomatedTest, TestResult } from '@prisma/client'
import { FailureAgeBucket, PhaseFailureAging } from '../../dto/analytics.types'
import { isFailure, percentile } from './analytics.utils'

export function buildFailureAging(catalog: AutomatedTest[], runs: TestResult[], phaseEnd: Date): PhaseFailureAging {
  const runsByPath = new Map<string, TestResult[]>()
  for (const run of runs) {
    const bucket = runsByPath.get(run.path)
    if (bucket) bucket.push(run)
    else runsByPath.set(run.path, [run])
  }

  const definitions = [
    { label: '<1д', maxDays: 1 },
    { label: '1–3д', maxDays: 3 },
    { label: '3–7д', maxDays: 7 },
    { label: '>7д', maxDays: Number.POSITIVE_INFINITY },
  ]
  const counts = definitions.map(() => 0)
  const mttrs: number[] = []
  let totalCurrentFailures = 0

  for (const test of catalog) {
    const pathRuns = (runsByPath.get(test.resultPath) ?? [])
      .sort((left, right) => left.startDate.valueOf() - right.startDate.valueOf())
    if (!pathRuns.length) continue

    const latest = pathRuns[pathRuns.length - 1]
    if (isFailure(latest.status)) {
      totalCurrentFailures += 1
      // Age of the current red streak: first failure since the last pass.
      let streakStart = latest
      for (let index = pathRuns.length - 1; index >= 0; index -= 1) {
        const run = pathRuns[index]
        if (run.status === 'passed') break
        if (isFailure(run.status)) streakStart = run
      }
      const ageDays = Math.max(0, phaseEnd.valueOf() - streakStart.startDate.valueOf()) / 86_400_000
      const bucketIndex = definitions.findIndex((definition) => ageDays < definition.maxDays)
      counts[bucketIndex < 0 ? counts.length - 1 : bucketIndex] += 1
    }

    const firstFailure = pathRuns.find((run) => isFailure(run.status))
    if (firstFailure) {
      const nextPass = pathRuns.find((run) => run.status === 'passed' && run.startDate > firstFailure.startDate)
      if (nextPass) mttrs.push(nextPass.startDate.valueOf() - firstFailure.startDate.valueOf())
    }
  }

  const buckets: FailureAgeBucket[] = definitions.map((definition, index) => ({
    label: definition.label,
    count: counts[index],
  }))

  return {
    totalCurrentFailures,
    buckets,
    mttrMedianMs: percentile(mttrs, 0.5),
    mttrCount: mttrs.length,
  }
}

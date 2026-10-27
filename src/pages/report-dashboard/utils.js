import { FAILURE_STATUSES, statuses } from './constants'

export function emptyCounts() {
  return Object.fromEntries(statuses.map(({ key }) => [key, 0]))
}

export function rate(part, total) {
  return total ? Math.round(part / total * 100) : null
}

export function showRate(value) {
  return value == null ? '—' : `${value}%`
}

export function percentile(values, rank) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))
  return sorted[index]
}

/**
 * Runs of one test that produced a verdict. `skipped` and `no_run` are not
 * executions, so they never take part in stability.
 */
export function runTotals(test) {
  const passedRuns = test.passedRuns ?? (test.status === 'passed' ? 1 : 0)
  const failedRuns = test.failedRuns ?? (FAILURE_STATUSES.has(test.status) ? 1 : 0)
  return { passedRuns, failedRuns, executedRuns: passedRuns + failedRuns }
}

/** Share of green runs among executed runs; `null` when the test never ran. */
export function stability(test) {
  const { passedRuns, executedRuns } = runTotals(test)
  if (!executedRuns) return null
  return Math.round(passedRuns / executedRuns * 100)
}

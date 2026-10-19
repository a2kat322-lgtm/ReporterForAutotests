import { statuses } from './constants'

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

export function stability(test) {
  const passedRuns = test.passedRuns ?? (test.status === 'passed' ? 1 : 0)
  const executedRuns = passedRuns + (test.failedRuns ?? (test.status === 'failed' || test.status === 'broken' ? 1 : 0))
  if (!executedRuns) return null
  return Math.round(passedRuns / executedRuns * 100)
}

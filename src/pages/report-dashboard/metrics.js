import { normalizeErrorMessage } from '../../utils/errorSignature'
import { DURATION_BUCKETS, FAILURE_STATUSES, STATUS_META, statuses } from './constants'
import { emptyCounts, percentile, rate, stability } from './utils'

export function buildReportMetrics(results) {
  const counts = emptyCounts()
  const suites = new Map()
  const owners = new Map()
  const signatures = new Map()
  const reasons = new Map()
  const failureFeedback = new Map()
  const durations = []
  const histogram = DURATION_BUCKETS.map(() => emptyCounts())
  let duration = 0
  let timed = 0
  let analysisTotal = 0
  let analysisDone = 0

  for (const test of results) {
    counts[test.status] = (counts[test.status] || 0) + 1
    const durationMs = test.durationMs
    if (durationMs > 0) {
      duration += durationMs
      timed += 1
      durations.push(durationMs)
      const bucketIndex = DURATION_BUCKETS.findIndex((bucket) => durationMs < bucket.max)
      histogram[bucketIndex < 0 ? DURATION_BUCKETS.length - 1 : bucketIndex][test.status] += 1
    }

    const suiteName = test.suiteName || 'Без набора'
    const suite = suites.get(suiteName) || { name: suiteName, total: 0, counts: emptyCounts(), durations: [] }
    suite.total += 1
    suite.counts[test.status] = (suite.counts[test.status] || 0) + 1
    if (durationMs > 0) suite.durations.push(durationMs)
    suites.set(suiteName, suite)

    const owner = test.owner || 'Не назначен'
    const ownerStats = owners.get(owner) || {
      owner,
      counts: emptyCounts(),
      total: 0,
      failed: 0,
      needsAnalysis: 0,
      durations: [],
      flaky: 0,
      stale: 0,
    }
    ownerStats.counts[test.status] = (ownerStats.counts[test.status] || 0) + 1
    ownerStats.total += 1
    if (durationMs > 0) ownerStats.durations.push(durationMs)
    if (test.flaky || (test.everPassed && test.everFailed)) ownerStats.flaky += 1
    if (test.staleGreen) ownerStats.stale += 1
    owners.set(owner, ownerStats)

    if (FAILURE_STATUSES.has(test.status)) {
      ownerStats.failed += 1
      analysisTotal += 1
      if (!test.failureReason?.trim()) ownerStats.needsAnalysis += 1
      else analysisDone += 1

      const signature = normalizeErrorMessage(test.message)
      const current = signatures.get(signature) || {
        signature,
        message: test.message?.trim() || '(без сообщения)',
        count: 0,
        tests: [],
      }
      current.count += 1
      current.tests.push({
        path: test.path,
        name: test.name || test.caseName || test.path,
        status: test.status,
        owner: test.owner || 'Не назначен',
      })
      signatures.set(signature, current)

      const reason = test.failureReason?.trim() || '(null)'
      reasons.set(reason, (reasons.get(reason) || 0) + 1)

      const comment = test.failureComment?.trim() || ''
      if (reason !== '(null)' || comment) {
        const key = `${reason}\u0000${comment}`
        const feedback = failureFeedback.get(key) || { reason: reason === '(null)' ? '' : reason, comment, count: 0 }
        feedback.count += 1
        failureFeedback.set(key, feedback)
      }
    }
  }

  const total = results.length
  const passed = counts.passed
  const executed = counts.passed + counts.failed + counts.broken + counts.skipped
  const failedTotal = counts.failed + counts.broken
  const signatureRows = [...signatures.values()]
    .map((row) => ({ ...row, share: failedTotal ? row.count / failedTotal : 0 }))
    .sort((left, right) => right.count - left.count || left.signature.localeCompare(right.signature))
    .slice(0, 10)
  const ownerRows = [...owners.values()]
    .map((row) => ({
      ...row,
      p90: percentile(row.durations, 0.9),
      passRate: rate(row.counts.passed, row.total),
    }))
    .sort((left, right) => right.failed - left.failed || right.total - left.total)
  const suiteRows = [...suites.values()]
    .map((row) => ({
      name: row.name,
      total: row.total,
      failed: row.counts.failed,
      broken: row.counts.broken,
      noRun: row.counts.no_run,
      passRate: rate(row.counts.passed, row.total),
      p90: percentile(row.durations, 0.9),
      durationMs: row.durations.reduce((sum, value) => sum + value, 0),
      timed: row.durations.length,
    }))
    .sort((left, right) => (right.failed + right.broken) - (left.failed + left.broken) || right.total - left.total)
  const flakyTests = results
    .filter((test) => test.flaky || (test.everPassed && test.everFailed))
    .sort((left, right) => (stability(left) ?? 101) - (stability(right) ?? 101) || (right.runCount || 0) - (left.runCount || 0))
  const staleGreenTests = results
    .filter((test) => test.staleGreen)
    .sort((left, right) => new Date(right.latestStartDate || 0).valueOf() - new Date(left.latestStartDate || 0).valueOf())
  const retryFixed = results.filter((test) => test.retryFixed).length
  const regressed = results.filter((test) => test.regressed).length
  const slowTests = [...results].filter((test) => test.durationMs > 0).sort((left, right) => right.durationMs - left.durationMs).slice(0, 8)
  const durationBandData = DURATION_BUCKETS.flatMap((bucket, index) => (
    ['passed', 'failed', 'broken', 'skipped'].map((status) => ({
      bucket: bucket.label,
      status: STATUS_META[status].label,
      count: histogram[index][status],
    }))
  )).filter((item) => item.count > 0)
  const ownerStackData = ownerRows.flatMap((row) => (
    statuses.map(({ key, label }) => ({ owner: row.owner, status: label, count: row.counts[key] || 0 }))
  )).filter((item) => item.count > 0)
  let cumulative = 0
  const paretoData = signatureRows.map((row) => {
    cumulative += row.share * 100
    return { ...row, cumulative: Math.min(100, Math.round(cumulative * 10) / 10) }
  })

  return {
    counts,
    total,
    passed,
    executed,
    passRate: rate(passed, total),
    effectivePassRate: rate(passed, executed),
    coverage: rate(executed, total),
    duration,
    timed,
    p50: percentile(durations, 0.5),
    p90: percentile(durations, 0.9),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
    durationBandData,
    ownerStackData,
    suites: suiteRows,
    owners: ownerRows,
    signatures: paretoData,
    failedTotal,
    reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    reasonTotal: failedTotal,
    failureFeedback: [...failureFeedback.values()].map((item, index) => ({ ...item, key: `${item.reason}-${item.comment}-${index}` })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason) || left.comment.localeCompare(right.comment)),
    analysisTotal,
    analysisDone,
    flakyTests,
    staleGreenTests,
    retryFixed,
    regressed,
    slowTests,
  }
}

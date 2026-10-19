import { TestResult } from '@prisma/client'
import { FailureReasonRow, FailureSignatureRow, PhaseFailures } from '../../dto/analytics.types'
import { isFailure, normalizeMessage, ratio } from './analytics.utils'

export function buildFailures(runs: TestResult[]): PhaseFailures {
  const failedRuns = runs.filter((run) => isFailure(run.status))
  const signatures = new Map<string, { count: number; sample: string }>()
  const reasons = new Map<string, number>()

  for (const run of failedRuns) {
    const signature = normalizeMessage(run.message)
    const current = signatures.get(signature) ?? { count: 0, sample: run.message?.trim() || '(без сообщения)' }
    current.count += 1
    signatures.set(signature, current)

    const reason = run.failureReason?.trim() || '(null)'
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }

  const total = failedRuns.length
  const signatureRows: FailureSignatureRow[] = [...signatures.entries()]
    .map(([signature, value]) => ({
      signature,
      message: value.sample.slice(0, 300),
      count: value.count,
      share: ratio(value.count, total),
    }))
    .sort((left, right) => right.count - left.count || left.signature.localeCompare(right.signature))
    .slice(0, 10)

  const reasonRows: FailureReasonRow[] = [...reasons.entries()]
    .map(([reason, count]) => ({ reason, count, share: ratio(count, total) }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))

  return { totalFailures: total, signatures: signatureRows, reasons: reasonRows }
}

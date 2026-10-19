import { Report, TestResult } from '@prisma/client'
import { AnalyticsStatus, StatusCounts } from '../../dto/analytics.types'

const URL_PATTERN = /https?:\/\/\S+/g
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g
const HEX_PATTERN = /\b0x[0-9a-f]+\b/g
const LOCATION_PATTERN = /[a-z0-9_./\\-]+\.(?:java|kt|ts|js|py|rb|cs|go):\d+/g
const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?/g
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g

const FAILURE_STATUSES = new Set<AnalyticsStatus>(['failed', 'broken'])

export function emptyCounts(): StatusCounts {
  return { passed: 0, failed: 0, broken: 0, skipped: 0, no_run: 0 }
}

export function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0
}

export function isFailure(status: AnalyticsStatus): boolean {
  return FAILURE_STATUSES.has(status)
}

export function durationOf(run: TestResult | null | undefined): number | null {
  if (!run) return null
  const value = run.endDate.valueOf() - run.startDate.valueOf()
  return value > 0 ? value : null
}

/** Nearest-rank percentile; returns null for an empty sample. */
export function percentile(values: number[], rank: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))
  return sorted[index]
}

export function statusCode(status: AnalyticsStatus): string {
  return status === 'no_run' ? 'n' : status.charAt(0)
}

/** Collapses variable fragments (ids, line numbers, timings) into a stable error fingerprint. */
export function normalizeMessage(message: string | null): string {
  const value = message?.trim()
  if (!value) return '(без сообщения)'
  const normalized = value
    .toLowerCase()
    .replace(URL_PATTERN, '<url>')
    .replace(UUID_PATTERN, '<uuid>')
    .replace(HEX_PATTERN, '<hex>')
    .replace(LOCATION_PATTERN, '<location>')
    .replace(TIMESTAMP_PATTERN, '<timestamp>')
    .replace(NUMBER_PATTERN, '<n>')
    .replace(/<<n>>/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized.slice(0, 160) || '(без сообщения)'
}

export function compareReports(left: Report, right: Report): number {
  const byStart = left.startDate.valueOf() - right.startDate.valueOf()
  if (byStart !== 0) return byStart
  const byCreated = left.createdAt.valueOf() - right.createdAt.valueOf()
  if (byCreated !== 0) return byCreated
  if (left.id === right.id) return 0
  return left.id < right.id ? -1 : 1
}

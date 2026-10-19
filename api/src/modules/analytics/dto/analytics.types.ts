import { Phase } from '@prisma/client'

export type AnalyticsStatus = 'passed' | 'failed' | 'broken' | 'skipped' | 'no_run'

export interface StatusCounts {
  passed: number
  failed: number
  broken: number
  skipped: number
  no_run: number
}

export interface PhaseKpi {
  reports: number
  catalog: number
  executed: number
  passedOnce: number
  neverPassed: number
  alwaysFailed: number
  flaky: number
  passRate: number
  coverage: number
  totalRuns: number
}

export interface ReportComparisonRow {
  reportId: number
  name: string
  startDate: Date
  endDate: Date
  counts: StatusCounts
  total: number
  passRate: number
  effectivePassRate: number
  coverage: number
  p90: number | null
  flaky: number
  newFailures: number
  fixed: number
  analysisRate: number
}

export interface PhaseOwnerRow extends StatusCounts {
  owner: string
  total: number
  passRate: number
  analysisRate: number
  flaky: number
}

export interface PhaseSuiteRow {
  suiteName: string
  total: number
  failed: number
  broken: number
  no_run: number
  passRate: number
  p90: number | null
}

export interface FailureSignatureRow {
  signature: string
  message: string
  count: number
  share: number
}

export interface FailureReasonRow {
  reason: string
  count: number
  share: number
}

export interface PhaseFailures {
  totalFailures: number
  signatures: FailureSignatureRow[]
  reasons: FailureReasonRow[]
}

export interface MatrixColumn {
  reportId: number
  name: string
  startDate: Date
  endDate: Date
}

export interface MatrixRow {
  path: string
  name: string
  suiteName: string
  owner: string | null
  /** One of p/f/b/s/n, aligned with `columns`. */
  cells: string[]
}

export interface PhaseMatrix {
  columns: MatrixColumn[]
  rows: MatrixRow[]
}

export interface PhaseHygiene {
  totalRuns: number
  environmentRuns: number
  uncataloguedRuns: number
  uncataloguedPaths: number
  duplicateRuns: number
  duplicateGroups: number
  wrongCircuitRuns: number
  overlappingReportPairs: number
  overlappingReports: number
  missingOwnerRuns: number
  missingMessageRuns: number
  runsByDay: Array<{ date: string; count: number }>
}

export interface PhaseLifecycle {
  stableGreen: number
  stableRed: number
  recovered: number
  regressed: number
  neverRun: number
  other: number
}

export interface FailureAgeBucket {
  label: string
  count: number
}

export interface PhaseFailureAging {
  /** Paths whose latest run is failed/broken. */
  totalCurrentFailures: number
  buckets: FailureAgeBucket[]
  /** Median first failure → first subsequent pass, in milliseconds. */
  mttrMedianMs: number | null
  mttrCount: number
}

export interface PhaseAnalytics {
  phase: Phase
  kpi: PhaseKpi
  reports: ReportComparisonRow[]
  matrix: PhaseMatrix
  owners: PhaseOwnerRow[]
  suites: PhaseSuiteRow[]
  failures: PhaseFailures
  lifecycle: PhaseLifecycle
  failureAging: PhaseFailureAging
  hygiene: PhaseHygiene
}

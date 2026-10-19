import { TestStatus } from '@prisma/client'

/**
 * Payload posted by the automation system as `application/x-www-form-urlencoded`.
 * Validated manually in ResultsService: the contract is external and evolving,
 * so unknown fields are ignored rather than rejected.
 */
export interface RunPayload {
  path: string
  suiteName?: string
  caseName?: string
  status: TestStatus
  owner?: string
  circuit?: string
  message?: string
  startDate: string
  endDate: string
  tag?: unknown
  /** Project identity posted by the automation system; resolves to a workspace. */
  projectName?: string
}

export interface NormalizedRun {
  workspaceId: bigint
  projectName: string
  path: string
  suiteName: string | null
  caseName: string | null
  status: TestStatus
  owner: string | null
  circuit: string | null
  message: string | null
  startDate: Date
  endDate: Date
  tags: string[]
}

/** A row of the merged report view: one catalog test with its latest run, or a run without a catalog entry. */
export interface ReportResultRow {
  rowKey: string | number
  path: string
  name: string
  suiteName: string | null
  caseName: string | null
  owner: string | null
  circuit: string | null
  message: string | null
  failureReason: string | null
  failureComment: string | null
  status: TestStatus | 'no_run'
  startDate: Date | null
  endDate: Date | null
  durationMs: number | null
  tags: string[]
  inCatalog: boolean
  catalogId: number | null
  fullResponsibility: string | null
  resultId: number | null

  /** How many runs of this path overlap the report window. */
  runCount: number
  /** Chronological first/last run statuses; null when there were no runs. */
  firstStatus: TestStatus | null
  latestStatus: TestStatus | null
  firstStartDate: Date | null
  latestStartDate: Date | null
  firstFailedStartDate: Date | null
  latestFailedStartDate: Date | null
  latestResultId: number | null
  /** Run counters used for stability and retry analytics. */
  passedRuns: number
  failedRuns: number
  everPassed: boolean
  everFailed: boolean
  /** Both passed and failed/broken runs in the window. */
  flaky: boolean
  /** Report view says passed, but the chronologically latest run failed/broke. */
  staleGreen: boolean
  /** First run failed/broke and the latest run passed. */
  retryFixed: boolean
  /** First run passed and the latest run failed/broke. */
  regressed: boolean
  /** Latest statuses, newest first (up to five). */
  recentStatuses: TestStatus[]
  latestMessage: string | null
  latestFailureReason: string | null
}

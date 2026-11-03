import { RunOrigin, TestStatus } from '@prisma/client'

/** Run statuses of one launch, tallied from the `TestResult` rows. */
export interface LaunchStatusCounts {
  passed: number
  failed: number
  broken: number
  skipped: number
}

/** One row of the «История запусков» page. */
export interface LaunchSummary {
  /** Allure `launchId`; also the value shown in the URL of the launch report. */
  id: string
  workspaceId: bigint
  environment: string
  /** Where the launch ran: `ci`, `local`, or `unknown` (not reported). */
  origin: RunOrigin
  projectName: string
  fileName: string | null
  /** How many archives were attached to this launch (CI may split one run). */
  archives: number
  imported: number
  enriched: number
  duplicates: number
  totalResults: number
  attachments: number
  catalogCreated: number
  warnings: string[]
  startedAt: Date | null
  finishedAt: Date | null
  durationMs: number | null
  createdAt: Date
  updatedAt: Date
  counts: LaunchStatusCounts
  /** Sum of `counts` — the number of runs in the launch. */
  total: number
}

/**
 * One run of a launch, shaped like a report row so the report tables and
 * filters can render it unchanged. Unlike the report view there is no catalog
 * merge and no `no_run`: the page shows exactly what the archive contained.
 */
export interface LaunchRunRow {
  rowKey: number
  resultId: number
  path: string
  name: string
  suiteName: string | null
  caseName: string | null
  epic: string | null
  owner: string | null
  circuit: string | null
  message: string | null
  failureReason: string | null
  failureComment: string | null
  status: TestStatus
  startDate: Date
  endDate: Date
  durationMs: number
  tags: string[]
  inCatalog: boolean
}

export interface LaunchDetail {
  launch: LaunchSummary
  results: LaunchRunRow[]
}

/** Metadata the importer writes after a successful upload. */
export interface LaunchImportRecord {
  id: string
  workspaceId: bigint
  environment: string
  origin: RunOrigin
  projectName: string
  fileName: string | null
  imported: number
  enriched: number
  duplicates: number
  totalResults: number
  attachments: number
  catalogCreated: number
  warnings: string[]
  startedAt: Date | null
  finishedAt: Date | null
}

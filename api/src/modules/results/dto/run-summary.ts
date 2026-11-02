import { Prisma } from '@prisma/client'

/**
 * Columns needed to build report rows and analytics.
 *
 * `message` and the Allure detail (`steps`, `attachments`, `parameters`,
 * `links`, `statusDetails`) live in `TestResultDetail` and are deliberately
 * excluded: list queries select thousands of run rows, while the detail is read
 * for a single run (detail drawer) or for failed runs only (failure analytics).
 * Selecting it here multiplies the pages the database must read by an order of
 * magnitude for big suites.
 *
 * Keep this selection in sync with the raw SQL in `ResultsRepository`.
 */
export const runSummarySelect = {
  id: true,
  workspaceId: true,
  projectName: true,
  path: true,
  suiteName: true,
  caseName: true,
  status: true,
  epic: true,
  owner: true,
  circuit: true,
  failureReason: true,
  failureComment: true,
  startDate: true,
  endDate: true,
  tags: true,
  externalId: true,
  launchId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TestResultSelect

export type RunSummary = Prisma.TestResultGetPayload<{ select: typeof runSummarySelect }>

/**
 * A run summary whose failure text was loaded separately from `TestResultDetail`
 * (report rows need it for the selected and the latest run; analytics needs it
 * for failed runs). The property is optional because most rows never load it.
 */
export type RunSummaryWithMessage = RunSummary & { message?: string | null }

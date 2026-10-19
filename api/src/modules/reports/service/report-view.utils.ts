import { AutomatedTest, TestResult } from '@prisma/client'
import { ReportResultRow } from '../../results/dto/run-payload'

function isFailure(status: TestResult['status']): boolean {
  return status === 'failed' || status === 'broken'
}

/**
 * Builds one report row from the catalog entry, the selected run (report rule:
 * latest run, but an earlier passed run wins) and all runs of this path inside
 * the report window. The selected run drives `status`; the run aggregates drive
 * staleness, flakiness and retry analytics.
 */
export function toRow(test: AutomatedTest | null, run: TestResult | null, runs: TestResult[] = []): ReportResultRow {
  const tags = (run?.tags ?? test?.tags ?? []) as unknown
  const effectiveRuns = runs.length ? runs : (run ? [run] : [])
  const ordered = [...effectiveRuns].sort((left, right) => left.startDate.valueOf() - right.startDate.valueOf())
  const first = ordered[0] ?? null
  const latest = ordered[ordered.length - 1] ?? null
  const firstFailed = ordered.find((item) => isFailure(item.status)) ?? null
  const latestFailed = [...ordered].reverse().find((item) => isFailure(item.status)) ?? null
  const passedRuns = ordered.filter((item) => item.status === 'passed').length
  const failedRuns = ordered.filter((item) => isFailure(item.status)).length
  const status = run?.status ?? 'no_run'
  const latestStatus = latest?.status ?? null

  return {
    rowKey: run?.id != null ? Number(run.id) : `catalog-${test?.id}`,
    path: run?.path ?? test?.resultPath ?? '',
    name: run?.caseName || test?.defaultCaseName || run?.path || 'Unknown test',
    suiteName: run?.suiteName ?? test?.defaultSuiteName ?? null,
    caseName: run?.caseName ?? test?.defaultCaseName ?? null,
    owner: run?.owner ?? test?.defaultOwner ?? null,
    circuit: run?.circuit ?? null,
    message: run?.message ?? null,
    failureReason: run?.failureReason ?? null,
    failureComment: run?.failureComment ?? null,
    status,
    startDate: run?.startDate ?? null,
    endDate: run?.endDate ?? null,
    durationMs: run ? Math.max(0, run.endDate.valueOf() - run.startDate.valueOf()) : null,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    inCatalog: Boolean(test),
    catalogId: test?.id == null ? null : Number(test.id),
    fullResponsibility: test?.fullResponsibility ?? null,
    resultId: run?.id == null ? null : Number(run.id),

    runCount: ordered.length,
    firstStatus: first?.status ?? null,
    latestStatus,
    firstStartDate: first?.startDate ?? null,
    latestStartDate: latest?.startDate ?? null,
    firstFailedStartDate: firstFailed?.startDate ?? null,
    latestFailedStartDate: latestFailed?.startDate ?? null,
    latestResultId: latest?.id == null ? null : Number(latest.id),
    passedRuns,
    failedRuns,
    everPassed: passedRuns > 0,
    everFailed: failedRuns > 0,
    flaky: passedRuns > 0 && failedRuns > 0,
    staleGreen: status === 'passed' && (latestStatus === 'failed' || latestStatus === 'broken'),
    retryFixed: Boolean(first && latest && isFailure(first.status) && latest.status === 'passed'),
    regressed: Boolean(first && latest && first.status === 'passed' && isFailure(latest.status)),
    recentStatuses: ordered.slice(-5).reverse().map((item) => item.status),
    latestMessage: latest?.message ?? null,
    latestFailureReason: latestFailed?.failureReason ?? null,
  }
}

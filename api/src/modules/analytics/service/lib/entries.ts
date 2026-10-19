import { AutomatedTest, Report, TestResult } from '@prisma/client'
import { dayEnd, dayStart } from '../../../../common/dates/day-range'
import { AnalyticsStatus, StatusCounts } from '../../dto/analytics.types'
import { emptyCounts } from './analytics.utils'

export interface ReportEntry {
  report: Report
  start: Date
  end: Date
  selected: Map<string, TestResult>
  statusByPath: Map<string, AnalyticsStatus>
  counts: StatusCounts
}

/** Replicates the report-view rule: the latest run wins unless an earlier run passed. */
export function buildEntries(reports: Report[], runs: TestResult[]): ReportEntry[] {
  return reports.map((report) => {
    const start = dayStart(report.startDate)
    const end = dayEnd(report.endDate)
    const selected = new Map<string, TestResult>()
    for (const run of runs) {
      if (run.startDate > end || run.endDate < start) continue
      const current = selected.get(run.path)
      if (!current || (current.status !== 'passed' && run.status === 'passed')) {
        selected.set(run.path, run)
      }
    }
    return { report, start, end, selected, statusByPath: new Map(), counts: emptyCounts() }
  })
}

export function fillStatus(entry: ReportEntry, catalog: AutomatedTest[]): void {
  for (const test of catalog) {
    const status = (entry.selected.get(test.resultPath)?.status ?? 'no_run') as AnalyticsStatus
    entry.statusByPath.set(test.resultPath, status)
    entry.counts[status] += 1
  }
}

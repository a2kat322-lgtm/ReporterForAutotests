import { Injectable } from '@nestjs/common'
import { AutomatedTest, Report, TestResult } from '@prisma/client'
import { dayEnd, dayStart } from '../../../common/dates/day-range'
import { PhasesService } from '../../phases/service/phases.service'
import { ReportsRepository } from '../../reports/repository/reports.repository'
import { ResultsRepository } from '../../results/repository/results.repository'
import { TestsRepository } from '../../tests/repository/tests.repository'
import {
  AnalyticsStatus,
  FailureReasonRow,
  FailureSignatureRow,
  MatrixRow,
  PhaseAnalytics,
  PhaseFailures,
  PhaseHygiene,
  PhaseKpi,
  PhaseMatrix,
  PhaseOwnerRow,
  PhaseSuiteRow,
  ReportComparisonRow,
  StatusCounts,
} from '../dto/analytics.types'

const URL_PATTERN = /https?:\/\/\S+/g
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g
const HEX_PATTERN = /\b0x[0-9a-f]+\b/g
const LOCATION_PATTERN = /[a-z0-9_./\\-]+\.(?:java|kt|ts|js|py|rb|cs|go):\d+/g
const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?/g
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g

const FAILURE_STATUSES = new Set<AnalyticsStatus>(['failed', 'broken'])

function emptyCounts(): StatusCounts {
  return { passed: 0, failed: 0, broken: 0, skipped: 0, no_run: 0 }
}

function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0
}

function isFailure(status: AnalyticsStatus): boolean {
  return FAILURE_STATUSES.has(status)
}

function durationOf(run: TestResult | null | undefined): number | null {
  if (!run) return null
  const value = run.endDate.valueOf() - run.startDate.valueOf()
  return value > 0 ? value : null
}

/** Nearest-rank percentile; returns null for an empty sample. */
function percentile(values: number[], rank: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))
  return sorted[index]
}

function statusCode(status: AnalyticsStatus): string {
  return status === 'no_run' ? 'n' : status.charAt(0)
}

/** Collapses variable fragments (ids, line numbers, timings) into a stable error fingerprint. */
function normalizeMessage(message: string | null): string {
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

function compareReports(left: Report, right: Report): number {
  const byStart = left.startDate.valueOf() - right.startDate.valueOf()
  if (byStart !== 0) return byStart
  const byCreated = left.createdAt.valueOf() - right.createdAt.valueOf()
  if (byCreated !== 0) return byCreated
  if (left.id === right.id) return 0
  return left.id < right.id ? -1 : 1
}

interface ReportEntry {
  report: Report
  start: Date
  end: Date
  selected: Map<string, TestResult>
  statusByPath: Map<string, AnalyticsStatus>
  counts: StatusCounts
}

interface OwnerAccumulator extends StatusCounts {
  owner: string
  total: number
  analyzed: number
  failures: number
  flaky: number
}

interface SuiteAccumulator {
  suiteName: string
  counts: StatusCounts
  total: number
  durations: number[]
}

@Injectable()
export class PhaseAnalyticsService {
  constructor(
    private readonly phasesService: PhasesService,
    private readonly reportsRepository: ReportsRepository,
    private readonly testsRepository: TestsRepository,
    private readonly resultsRepository: ResultsRepository,
  ) {}

  async getPhaseAnalytics(phaseId: bigint): Promise<PhaseAnalytics> {
    const phase = await this.phasesService.findById(phaseId)
    const environment = phase.environment.trim().toLowerCase()
    const [reports, catalog, allRuns] = await Promise.all([
      this.reportsRepository.findByPhaseId(phaseId),
      this.testsRepository.findForEnvironment(environment, phase.workspaceId),
      this.resultsRepository.findRunsCoveringWindow(
        phase.workspaceId,
        dayStart(phase.startedAt),
        dayEnd(phase.endedAt),
      ),
    ])

    const orderedReports = [...reports].sort(compareReports)
    const visibleCatalog = catalog.filter((test) => test.visible)
    const environmentRuns = allRuns
      .filter((run) => (run.circuit ?? '').trim().toLowerCase() === environment)
      .sort((left, right) => right.startDate.valueOf() - left.startDate.valueOf())
    const visiblePaths = new Set(visibleCatalog.map((test) => test.resultPath))

    const entries = this.buildEntries(orderedReports, visibleCatalog, environmentRuns)
    for (const entry of entries) this.fillStatus(entry, visibleCatalog)

    const reportRows = this.buildReportRows(entries, visibleCatalog, environmentRuns)
    const flakyPaths = this.collectFlakyPaths(environmentRuns, visiblePaths)
    const latestEntry = entries.length ? entries[entries.length - 1] : null

    return {
      phase,
      kpi: this.buildKpi(reportRows, visibleCatalog, environmentRuns, flakyPaths, entries),
      reports: reportRows,
      matrix: this.buildMatrix(entries, visibleCatalog),
      owners: this.buildOwners(visibleCatalog, latestEntry, flakyPaths),
      suites: this.buildSuites(visibleCatalog, latestEntry),
      failures: this.buildFailures(environmentRuns),
      hygiene: this.buildHygiene(allRuns, environmentRuns, new Set(catalog.map((test) => test.resultPath)), orderedReports),
    }
  }

  /** Replicates the report-view rule: the latest run wins unless an earlier run passed. */
  private buildEntries(reports: Report[], catalog: AutomatedTest[], runs: TestResult[]): ReportEntry[] {
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

  private fillStatus(entry: ReportEntry, catalog: AutomatedTest[]): void {
    for (const test of catalog) {
      const status = (entry.selected.get(test.resultPath)?.status ?? 'no_run') as AnalyticsStatus
      entry.statusByPath.set(test.resultPath, status)
      entry.counts[status] += 1
    }
  }

  private buildReportRows(entries: ReportEntry[], catalog: AutomatedTest[], runs: TestResult[]): ReportComparisonRow[] {
    const rows: ReportComparisonRow[] = []
    const visiblePaths = new Set(catalog.map((test) => test.resultPath))
    let previous = new Map<string, AnalyticsStatus>()

    for (const entry of entries) {
      const durations: number[] = []
      let failedTotal = 0
      let analyzed = 0

      for (const test of catalog) {
        const status = entry.statusByPath.get(test.resultPath) ?? 'no_run'
        const run = entry.selected.get(test.resultPath)
        const duration = durationOf(run)
        if (duration != null) durations.push(duration)
        if (isFailure(status)) {
          failedTotal += 1
          if (run?.failureReason?.trim()) analyzed += 1
        }
      }

      let newFailures = 0
      let fixed = 0
      for (const [path, status] of entry.statusByPath) {
        const before = previous.get(path)
        if (before == null) continue
        if (before === 'passed' && isFailure(status)) newFailures += 1
        if (isFailure(before) && status === 'passed') fixed += 1
      }

      const executed = entry.counts.passed + entry.counts.failed + entry.counts.broken + entry.counts.skipped
      rows.push({
        reportId: Number(entry.report.id),
        name: entry.report.name,
        startDate: entry.report.startDate,
        endDate: entry.report.endDate,
        counts: entry.counts,
        total: catalog.length,
        passRate: ratio(entry.counts.passed, catalog.length),
        effectivePassRate: ratio(entry.counts.passed, executed),
        coverage: ratio(executed, catalog.length),
        p90: percentile(durations, 0.9),
        flaky: this.countFlaky(runs, entry.start, entry.end, visiblePaths),
        newFailures,
        fixed,
        analysisRate: ratio(analyzed, failedTotal),
      })
      previous = entry.statusByPath
    }
    return rows
  }

  private buildKpi(
    reportRows: ReportComparisonRow[],
    catalog: AutomatedTest[],
    runs: TestResult[],
    flakyPaths: Set<string>,
    entries: ReportEntry[],
  ): PhaseKpi {
    const passedOnce = new Set<string>()
    for (const entry of entries) {
      for (const [path, status] of entry.statusByPath) {
        if (status === 'passed') passedOnce.add(path)
      }
    }

    const catalogPaths = new Set(catalog.map((test) => test.resultPath))
    const executedPaths = new Set(runs.filter((run) => catalogPaths.has(run.path)).map((run) => run.path))
    const runsByPath = new Map<string, TestResult[]>()
    for (const run of runs) {
      const bucket = runsByPath.get(run.path)
      if (bucket) bucket.push(run)
      else runsByPath.set(run.path, [run])
    }

    let alwaysFailed = 0
    for (const test of catalog) {
      const pathRuns = runsByPath.get(test.resultPath)
      if (!pathRuns?.length) continue
      if (!pathRuns.some((run) => run.status === 'passed') && pathRuns.every((run) => isFailure(run.status))) {
        alwaysFailed += 1
      }
    }

    return {
      reports: reportRows.length,
      catalog: catalog.length,
      executed: executedPaths.size,
      passedOnce: passedOnce.size,
      neverPassed: catalog.length - passedOnce.size,
      alwaysFailed,
      flaky: flakyPaths.size,
      passRate: ratio(passedOnce.size, catalog.length),
      coverage: ratio(executedPaths.size, catalog.length),
      totalRuns: runs.length,
    }
  }

  private collectFlakyPaths(runs: TestResult[], visiblePaths: Set<string>): Set<string> {
    const flags = new Map<string, { passed: boolean; failed: boolean }>()
    for (const run of runs) {
      if (!visiblePaths.has(run.path)) continue
      const current = flags.get(run.path) ?? { passed: false, failed: false }
      if (run.status === 'passed') current.passed = true
      else if (isFailure(run.status)) current.failed = true
      flags.set(run.path, current)
    }
    const flaky = new Set<string>()
    for (const [path, flag] of flags) {
      if (flag.passed && flag.failed) flaky.add(path)
    }
    return flaky
  }

  private countFlaky(runs: TestResult[], start: Date, end: Date, visiblePaths: Set<string>): number {
    const flags = new Map<string, { passed: boolean; failed: boolean }>()
    for (const run of runs) {
      if (!visiblePaths.has(run.path) || run.startDate > end || run.endDate < start) continue
      const current = flags.get(run.path) ?? { passed: false, failed: false }
      if (run.status === 'passed') current.passed = true
      else if (isFailure(run.status)) current.failed = true
      flags.set(run.path, current)
    }
    let count = 0
    for (const flag of flags.values()) {
      if (flag.passed && flag.failed) count += 1
    }
    return count
  }

  private buildOwners(
    catalog: AutomatedTest[],
    latest: ReportEntry | null,
    flakyPaths: Set<string>,
  ): PhaseOwnerRow[] {
    const accumulators = new Map<string, OwnerAccumulator>()

    for (const test of catalog) {
      const run = latest?.selected.get(test.resultPath) ?? null
      const status = (run?.status ?? 'no_run') as AnalyticsStatus
      const owner = run?.owner?.trim() || test.defaultOwner?.trim() || 'Не назначен'
      const current = accumulators.get(owner) ?? {
        owner,
        ...emptyCounts(),
        total: 0,
        analyzed: 0,
        failures: 0,
        flaky: 0,
      }
      current[status] += 1
      current.total += 1
      if (isFailure(status)) {
        current.failures += 1
        if (run?.failureReason?.trim()) current.analyzed += 1
      }
      if (flakyPaths.has(test.resultPath)) current.flaky += 1
      accumulators.set(owner, current)
    }

    return [...accumulators.values()]
      .map((row) => ({
        owner: row.owner,
        passed: row.passed,
        failed: row.failed,
        broken: row.broken,
        skipped: row.skipped,
        no_run: row.no_run,
        total: row.total,
        passRate: ratio(row.passed, row.total),
        analysisRate: ratio(row.analyzed, row.failures),
        flaky: row.flaky,
      }))
      .sort((left, right) => right.failed + right.broken - (left.failed + left.broken) || right.total - left.total)
  }

  private buildSuites(catalog: AutomatedTest[], latest: ReportEntry | null): PhaseSuiteRow[] {
    const accumulators = new Map<string, SuiteAccumulator>()

    for (const test of catalog) {
      const run = latest?.selected.get(test.resultPath) ?? null
      const status = (run?.status ?? 'no_run') as AnalyticsStatus
      const suiteName = run?.suiteName?.trim() || test.defaultSuiteName?.trim() || 'Без набора'
      const current = accumulators.get(suiteName) ?? {
        suiteName,
        counts: emptyCounts(),
        total: 0,
        durations: [],
      }
      current.counts[status] += 1
      current.total += 1
      const duration = durationOf(run)
      if (duration != null) current.durations.push(duration)
      accumulators.set(suiteName, current)
    }

    return [...accumulators.values()]
      .map((row) => ({
        suiteName: row.suiteName,
        total: row.total,
        failed: row.counts.failed,
        broken: row.counts.broken,
        no_run: row.counts.no_run,
        passRate: ratio(row.counts.passed, row.total),
        p90: percentile(row.durations, 0.9),
      }))
      .sort((left, right) => right.failed + right.broken - (left.failed + left.broken) || right.total - left.total)
  }

  private buildFailures(runs: TestResult[]): PhaseFailures {
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

  private buildMatrix(entries: ReportEntry[], catalog: AutomatedTest[]): PhaseMatrix {
    const latest = entries.length ? entries[entries.length - 1] : null
    const columns = entries.map((entry) => ({
      reportId: Number(entry.report.id),
      name: entry.report.name,
      startDate: entry.report.startDate,
      endDate: entry.report.endDate,
    }))

    const rows: MatrixRow[] = catalog.map((test) => {
      const latestRun = latest?.selected.get(test.resultPath) ?? null
      return {
        path: test.resultPath,
        name: latestRun?.caseName?.trim() || test.defaultCaseName?.trim() || test.resultPath,
        suiteName: latestRun?.suiteName?.trim() || test.defaultSuiteName?.trim() || 'Без набора',
        owner: latestRun?.owner?.trim() || test.defaultOwner?.trim() || null,
        cells: entries.map((entry) => statusCode(entry.statusByPath.get(test.resultPath) ?? 'no_run')),
      }
    })

    rows.sort((left, right) => left.suiteName.localeCompare(right.suiteName, 'ru', { sensitivity: 'base' })
      || left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' }))

    return { columns, rows }
  }

  private buildHygiene(
    allRuns: TestResult[],
    environmentRuns: TestResult[],
    catalogPaths: Set<string>,
    reports: Report[],
  ): PhaseHygiene {
    const uncatalogued = environmentRuns.filter((run) => !catalogPaths.has(run.path))
    const uncataloguedPaths = new Set(uncatalogued.map((run) => run.path))

    const duplicateMap = new Map<string, number>()
    for (const run of environmentRuns) {
      const key = `${run.path}\u0000${run.startDate.toISOString()}`
      duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1)
    }
    let duplicateGroups = 0
    let duplicateRuns = 0
    for (const count of duplicateMap.values()) {
      if (count > 1) {
        duplicateGroups += 1
        duplicateRuns += count - 1
      }
    }

    let overlappingReportPairs = 0
    const overlappingReports = new Set<number>()
    for (let left = 0; left < reports.length; left += 1) {
      for (let right = left + 1; right < reports.length; right += 1) {
        if (reports[left].startDate <= reports[right].endDate && reports[right].startDate <= reports[left].endDate) {
          overlappingReportPairs += 1
          overlappingReports.add(Number(reports[left].id))
          overlappingReports.add(Number(reports[right].id))
        }
      }
    }

    const byDay = new Map<string, number>()
    for (const run of environmentRuns) {
      const date = run.startDate.toISOString().slice(0, 10)
      byDay.set(date, (byDay.get(date) ?? 0) + 1)
    }

    const failedRuns = environmentRuns.filter((run) => isFailure(run.status))
    return {
      totalRuns: allRuns.length,
      environmentRuns: environmentRuns.length,
      uncataloguedRuns: uncatalogued.length,
      uncataloguedPaths: uncataloguedPaths.size,
      duplicateRuns,
      duplicateGroups,
      wrongCircuitRuns: allRuns.length - environmentRuns.length,
      overlappingReportPairs,
      overlappingReports: overlappingReports.size,
      missingOwnerRuns: environmentRuns.filter((run) => !run.owner?.trim()).length,
      missingMessageRuns: failedRuns.filter((run) => !run.message?.trim()).length,
      runsByDay: [...byDay.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((left, right) => left.date.localeCompare(right.date)),
    }
  }
}

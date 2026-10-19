import { Injectable } from '@nestjs/common'
import { dayEnd, dayStart } from '../../../common/dates/day-range'
import { PhasesService } from '../../phases/service/phases.service'
import { ReportsRepository } from '../../reports/repository/reports.repository'
import { ResultsRepository } from '../../results/repository/results.repository'
import { TestsRepository } from '../../tests/repository/tests.repository'
import { PhaseAnalytics } from '../dto/analytics.types'
import { compareReports } from './lib/analytics.utils'
import { buildEntries, fillStatus } from './lib/entries'
import { buildReportRows, collectFlakyPaths } from './lib/report-rows'
import { buildKpi } from './lib/kpi'
import { buildOwners } from './lib/owners'
import { buildSuites } from './lib/suites'
import { buildFailures } from './lib/failures'
import { buildLifecycle } from './lib/lifecycle'
import { buildFailureAging } from './lib/failure-aging'
import { buildMatrix } from './lib/matrix'
import { buildHygiene } from './lib/hygiene'

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

    const entries = buildEntries(orderedReports, environmentRuns)
    for (const entry of entries) fillStatus(entry, visibleCatalog)

    const reportRows = buildReportRows(entries, visibleCatalog, environmentRuns)
    const flakyPaths = collectFlakyPaths(environmentRuns, visiblePaths)
    const latestEntry = entries.length ? entries[entries.length - 1] : null

    return {
      phase,
      kpi: buildKpi(reportRows, visibleCatalog, environmentRuns, flakyPaths, entries),
      reports: reportRows,
      matrix: buildMatrix(entries, visibleCatalog),
      owners: buildOwners(visibleCatalog, latestEntry, flakyPaths),
      suites: buildSuites(visibleCatalog, latestEntry),
      failures: buildFailures(environmentRuns),
      lifecycle: buildLifecycle(visibleCatalog, environmentRuns),
      failureAging: buildFailureAging(visibleCatalog, environmentRuns, dayEnd(phase.endedAt)),
      hygiene: buildHygiene(allRuns, environmentRuns, new Set(catalog.map((test) => test.resultPath)), orderedReports),
    }
  }
}

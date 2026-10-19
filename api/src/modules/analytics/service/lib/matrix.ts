import { AutomatedTest } from '@prisma/client'
import { MatrixRow, PhaseMatrix } from '../../dto/analytics.types'
import { ReportEntry } from './entries'
import { statusCode } from './analytics.utils'

export function buildMatrix(entries: ReportEntry[], catalog: AutomatedTest[]): PhaseMatrix {
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

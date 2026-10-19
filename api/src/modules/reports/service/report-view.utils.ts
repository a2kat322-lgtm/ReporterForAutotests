import { AutomatedTest, TestResult } from '@prisma/client'
import { ReportResultRow } from '../../results/dto/run-payload'

export function toRow(test: AutomatedTest | null, run: TestResult | null): ReportResultRow {
  const tags = (run?.tags ?? test?.tags ?? []) as unknown
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
    status: run?.status ?? 'no_run',
    startDate: run?.startDate ?? null,
    endDate: run?.endDate ?? null,
    durationMs: run ? Math.max(0, run.endDate.valueOf() - run.startDate.valueOf()) : null,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    inCatalog: Boolean(test),
    catalogId: test?.id == null ? null : Number(test.id),
    fullResponsibility: test?.fullResponsibility ?? null,
    resultId: run?.id == null ? null : Number(run.id),
  }
}

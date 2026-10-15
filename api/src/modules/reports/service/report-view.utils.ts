import { AutomatedTest, TestResult } from '@prisma/client'
import { ReportResultRow } from '../../results/dto/run-payload'

const MS_PER_DAY = 86_400_000

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Number.NaN)
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    ? date
    : new Date(Number.NaN)
}

export function dayStart(date: Date): Date {
  const day = new Date(date)
  day.setUTCHours(0, 0, 0, 0)
  return day
}

export function dayEnd(date: Date): Date {
  return new Date(dayStart(date).valueOf() + MS_PER_DAY - 1)
}

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

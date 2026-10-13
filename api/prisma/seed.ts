import { PrismaClient, Environment, Prisma, TestStatus } from '@prisma/client'

const prisma = new PrismaClient()

function run(path: string, status: TestStatus, startDate: string, durationMs: number, extra: Partial<{ suiteName: string; caseName: string; owner: string; circuit: string; message: string; tags: string[] }> = {}) {
  const start = new Date(startDate)
  return {
    path,
    suiteName: extra.suiteName ?? null,
    caseName: extra.caseName ?? null,
    status,
    owner: extra.owner ?? null,
    circuit: extra.circuit ?? null,
    message: extra.message ?? null,
    startDate: start,
    endDate: new Date(start.valueOf() + durationMs),
    tags: (extra.tags ?? []) as unknown as Prisma.InputJsonValue,
  }
}

async function main() {
  const phases = [
    { name: 'Release 2.4.0', environment: Environment.stage, startedAt: new Date('2025-04-18'), endedAt: new Date('2025-04-21') },
    { name: 'Nightly regression · 17 Apr', environment: Environment.test, startedAt: new Date('2025-04-17'), endedAt: new Date('2025-04-17') },
    { name: 'Payments hotfix', environment: Environment.production, startedAt: new Date('2025-04-12'), endedAt: new Date('2025-04-13') },
  ]
  const ids: number[] = []
  for (const phase of phases) {
    const existing = await prisma.phase.findFirst({ where: { name: phase.name } })
    const saved = existing ? await prisma.phase.update({ where: { id: existing.id }, data: phase }) : await prisma.phase.create({ data: phase })
    ids.push(saved.id)
  }

  const reports = [
    { phaseId: ids[0], name: 'Smoke tests', createdAt: new Date('2025-04-21T10:42:00Z'), author: 'CI pipeline' },
    { phaseId: ids[0], name: 'Full regression', createdAt: new Date('2025-04-21T14:08:00Z'), author: 'QA team' },
    { phaseId: ids[1], name: 'Nightly suite', createdAt: new Date('2025-04-17T06:24:00Z'), author: 'CI pipeline' },
    { phaseId: ids[2], name: 'Checkout verification', createdAt: new Date('2025-04-13T09:10:00Z'), author: 'Release bot' },
  ]
  // Report ids are autoincrement integers now, so re-seeding matches on (phase, name).
  for (const report of reports) {
    const existing = await prisma.report.findFirst({ where: { phaseId: report.phaseId, name: report.name } })
    if (existing) await prisma.report.update({ where: { id: existing.id }, data: report })
    else await prisma.report.create({ data: report })
  }

  // Catalog entries mirroring the JSON file contract; resultPath links runs to
  // definitions. By convention resultPath is the fully qualified Java test class.
  const catalog = [
    { resultPath: 'com.acme.shop.checkout.PaymentFlowTest', fullResponsibility: 'Payments squad', defaultSuiteName: 'Checkout IT', defaultCaseName: 'paymentSucceedsWithValidCard', defaultOwner: 'alex.kim', tags: ['checkout', 'smoke'] },
    { resultPath: 'com.acme.shop.auth.LoginValidCredentialsTest', defaultSuiteName: 'Auth', defaultCaseName: 'loginWithValidCredentials', defaultOwner: 'maria.petrova', tags: ['auth', 'smoke'] },
    { resultPath: 'com.acme.shop.payments.RefundPermissionTest', defaultSuiteName: 'Payments', defaultCaseName: 'viewerCannotRefund', defaultOwner: 'alex.kim', tags: ['payments', 'rbac'] },
    { resultPath: 'com.acme.shop.search.GlobalSearchTest', defaultSuiteName: 'Search', tags: ['search'] },
    { resultPath: 'com.acme.shop.export.CsvExportTest', defaultSuiteName: 'Export', tags: ['export', 'feature-flag'], visible: false },
  ]
  for (const test of catalog) {
    await prisma.automatedTest.upsert({
      where: { resultPath: test.resultPath },
      create: { ...test, tags: test.tags as unknown as Prisma.InputJsonValue, source: 'file' },
      update: { ...test, tags: test.tags as unknown as Prisma.InputJsonValue },
    })
  }

  // Standalone run records: a report shows the runs whose [startDate, endDate]
  // window covers the report date, so seeds are dated to match the reports above.
  const runs = [
    run('com.acme.shop.checkout.PaymentFlowTest', TestStatus.passed, '2025-04-21T10:38:11Z', 8420, { suiteName: 'Checkout IT', caseName: 'paymentSucceedsWithValidCard', owner: 'alex.kim', circuit: 'green', tags: ['checkout', 'smoke'] }),
    run('com.acme.shop.auth.LoginValidCredentialsTest', TestStatus.passed, '2025-04-21T10:37:48Z', 3210, { suiteName: 'Auth', caseName: 'loginWithValidCredentials', owner: 'maria.petrova', circuit: 'green', tags: ['auth', 'smoke'] }),
    run('com.acme.shop.payments.RefundPermissionTest', TestStatus.failed, '2025-04-21T10:36:22Z', 10980, { suiteName: 'Payments', caseName: 'viewerCannotRefund', owner: 'alex.kim', circuit: 'red', message: 'org.opentest4j.AssertionFailedError: expected: <403> but was: <500> at RefundPermissionTest.java:87', tags: ['payments', 'rbac'] }),
    run('com.acme.shop.search.GlobalSearchTest', TestStatus.passed, '2025-04-21T14:02:04Z', 6040, { suiteName: 'Search', caseName: 'searchByEmailFindsRecords', owner: 'ivan.sokolov', circuit: 'green', tags: ['search'] }),
    run('com.acme.shop.export.CsvExportTest', TestStatus.skipped, '2025-04-21T14:01:33Z', 0, { suiteName: 'Export', caseName: 'exportResultsAsCsv', message: 'Skipped: feature flag export.v2 disabled', tags: ['export', 'feature-flag'] }),
    run('com.acme.shop.auth.LoginValidCredentialsTest', TestStatus.broken, '2025-04-17T06:24:01Z', 5300, { suiteName: 'Auth', caseName: 'loginWithValidCredentials', owner: 'maria.petrova', circuit: 'yellow', message: 'org.openqa.selenium.TimeoutException: waiting for #signin-form', tags: ['auth', 'nightly'] }),
    run('com.acme.shop.checkout.PaymentFlowTest', TestStatus.passed, '2025-04-13T09:02:51Z', 7340, { suiteName: 'Checkout IT', caseName: 'paymentSucceedsWithValidCard', owner: 'alex.kim', circuit: 'green', tags: ['checkout', 'smoke'] }),
    // A run without a catalog entry — shows up in reports as "unregistered".
    run('com.acme.legacy.OrphanProbeTest', TestStatus.passed, '2025-04-21T11:10:00Z', 1200, { caseName: 'probeResponds', tags: ['legacy'] }),
  ]
  for (const data of runs) {
    const existing = await prisma.testResult.findFirst({ where: { path: data.path, startDate: data.startDate } })
    if (!existing) await prisma.testResult.create({ data })
  }
}

main().finally(() => prisma.$disconnect())

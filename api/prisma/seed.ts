import { PrismaClient, Environment, TestStatus } from '@prisma/client'

const prisma = new PrismaClient()

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
    { id: 'report-smoke-24', phaseId: ids[0], name: 'Smoke tests', createdAt: new Date('2025-04-21T10:42:00Z'), author: 'CI pipeline' },
    { id: 'report-regression-24', phaseId: ids[0], name: 'Full regression', createdAt: new Date('2025-04-21T14:08:00Z'), author: 'QA team' },
    { id: 'report-nightly', phaseId: ids[1], name: 'Nightly suite', createdAt: new Date('2025-04-17T06:24:00Z'), author: 'CI pipeline' },
    { id: 'report-payments', phaseId: ids[2], name: 'Checkout verification', createdAt: new Date('2025-04-13T09:10:00Z'), author: 'Release bot' },
  ]
  for (const report of reports) await prisma.report.upsert({ where: { id: report.id }, create: report, update: report })
  const results = [
    { id: 'result-checkout', phaseId: ids[0], reportId: reports[0].id, automatedTestId: 'checkout-payment', name: 'Checkout payment flow', status: TestStatus.passed, duration: 8420, lastRunAt: new Date('2025-04-21T10:38:11Z'), steps: [{ name: 'Open checkout', status: 'passed', duration: 950, output: 'Checkout loaded in 950 ms' }, { name: 'Enter card details', status: 'passed', duration: 1870, output: '•••• 4242' }, { name: 'Confirm payment', status: 'passed', duration: 5600, output: 'Payment intent succeeded' }] },
    { id: 'result-login', phaseId: ids[0], reportId: reports[0].id, automatedTestId: 'login-valid', name: 'User can log in with valid credentials', status: TestStatus.passed, duration: 3210, lastRunAt: new Date('2025-04-21T10:37:48Z'), steps: [{ name: 'Open sign in', status: 'passed', duration: 740 }, { name: 'Submit credentials', status: 'passed', duration: 2470, output: 'Redirected to dashboard' }] },
    { id: 'result-refund', phaseId: ids[0], reportId: reports[0].id, automatedTestId: 'refund-permission', name: 'Refund is restricted by role', status: TestStatus.failed, duration: 10980, lastRunAt: new Date('2025-04-21T10:36:22Z'), errorMessage: 'Expected HTTP 403, received 500 from /api/refunds', steps: [{ name: 'Create viewer account', status: 'passed', duration: 3200 }, { name: 'Request refund', status: 'failed', duration: 7780, error: 'Expected HTTP 403, received 500' }] },
    { id: 'result-search', phaseId: ids[0], reportId: reports[1].id, automatedTestId: 'global-search', name: 'Global search returns relevant records', status: TestStatus.passed, duration: 6040, lastRunAt: new Date('2025-04-21T14:02:04Z'), steps: [{ name: 'Seed records', status: 'passed', duration: 2110 }, { name: 'Search by email', status: 'passed', duration: 3930, output: 'Found 4 matching records' }] },
    { id: 'result-export', phaseId: ids[0], reportId: reports[1].id, automatedTestId: 'export-csv', name: 'Export results as CSV', status: TestStatus.skipped, duration: 0, lastRunAt: new Date('2025-04-21T14:01:33Z'), steps: [{ name: 'Open export menu', status: 'skipped', duration: 0, output: 'Skipped: feature flag disabled' }] },
    { id: 'result-nightly-login', phaseId: ids[1], reportId: reports[2].id, automatedTestId: 'login-valid', name: 'User can log in with valid credentials', status: TestStatus.running, duration: 0, lastRunAt: new Date('2025-04-17T06:24:01Z'), steps: [{ name: 'Open sign in', status: 'passed', duration: 740 }, { name: 'Submit credentials', status: 'running', duration: 0 }] },
    { id: 'result-payment-prod', phaseId: ids[2], reportId: reports[3].id, automatedTestId: 'checkout-payment', name: 'Checkout payment flow', status: TestStatus.passed, duration: 7340, lastRunAt: new Date('2025-04-13T09:02:51Z'), steps: [{ name: 'Open checkout', status: 'passed', duration: 820 }, { name: 'Confirm payment', status: 'passed', duration: 6520 }] },
  ]
  for (const result of results) {
    const { id, ...data } = result
    await prisma.testResult.upsert({ where: { reportId_automatedTestId: { reportId: data.reportId, automatedTestId: data.automatedTestId } }, create: result, update: data })
  }
}

main().finally(() => prisma.$disconnect())

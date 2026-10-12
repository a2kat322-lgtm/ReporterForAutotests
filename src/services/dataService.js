import dayjs from 'dayjs'

const STORAGE_KEY = 'test-insights-data-v1'

const demoData = {
  phases: [
    {
      id: 'phase-release-24',
      name: 'Release 2.4.0',
      environment: 'stage',
      startedAt: '2025-04-18',
      endedAt: '2025-04-21',
      createdAt: '2025-04-18T08:00:00.000Z',
    },
    {
      id: 'phase-nightly-0417',
      name: 'Nightly regression · 17 Apr',
      environment: 'test',
      startedAt: '2025-04-17',
      endedAt: '2025-04-17',
      createdAt: '2025-04-17T06:00:00.000Z',
    },
    {
      id: 'phase-payments-prod',
      name: 'Payments hotfix',
      environment: 'production',
      startedAt: '2025-04-12',
      endedAt: '2025-04-13',
      createdAt: '2025-04-12T11:00:00.000Z',
    },
  ],
  reports: [
    { id: 'report-smoke-24', phaseId: 'phase-release-24', name: 'Smoke tests', createdAt: '2025-04-21T10:42:00.000Z', author: 'CI pipeline' },
    { id: 'report-regression-24', phaseId: 'phase-release-24', name: 'Full regression', createdAt: '2025-04-21T14:08:00.000Z', author: 'QA team' },
    { id: 'report-nightly', phaseId: 'phase-nightly-0417', name: 'Nightly suite', createdAt: '2025-04-17T06:24:00.000Z', author: 'CI pipeline' },
    { id: 'report-payments', phaseId: 'phase-payments-prod', name: 'Checkout verification', createdAt: '2025-04-13T09:10:00.000Z', author: 'Release bot' },
  ],
  results: [
    { id: 'result-checkout', phaseId: 'phase-release-24', reportId: 'report-smoke-24', automatedTestId: 'checkout-payment', name: 'Checkout payment flow', status: 'passed', duration: 8420, lastRunAt: '2025-04-21T10:38:11.000Z', steps: [{ name: 'Open checkout', status: 'passed', duration: 950, output: 'Checkout loaded in 950 ms' }, { name: 'Enter card details', status: 'passed', duration: 1870, output: '•••• 4242' }, { name: 'Confirm payment', status: 'passed', duration: 5600, output: 'Payment intent succeeded' }] },
    { id: 'result-login', phaseId: 'phase-release-24', reportId: 'report-smoke-24', automatedTestId: 'login-valid', name: 'User can log in with valid credentials', status: 'passed', duration: 3210, lastRunAt: '2025-04-21T10:37:48.000Z', steps: [{ name: 'Open sign in', status: 'passed', duration: 740 }, { name: 'Submit credentials', status: 'passed', duration: 2470, output: 'Redirected to dashboard' }] },
    { id: 'result-refund', phaseId: 'phase-release-24', reportId: 'report-smoke-24', automatedTestId: 'refund-permission', name: 'Refund is restricted by role', status: 'failed', duration: 10980, lastRunAt: '2025-04-21T10:36:22.000Z', errorMessage: 'Expected HTTP 403, received 500 from /api/refunds', steps: [{ name: 'Create viewer account', status: 'passed', duration: 3200 }, { name: 'Request refund', status: 'failed', duration: 7780, error: 'Expected HTTP 403, received 500' }] },
    { id: 'result-search', phaseId: 'phase-release-24', reportId: 'report-regression-24', automatedTestId: 'global-search', name: 'Global search returns relevant records', status: 'passed', duration: 6040, lastRunAt: '2025-04-21T14:02:04.000Z', steps: [{ name: 'Seed records', status: 'passed', duration: 2110 }, { name: 'Search by email', status: 'passed', duration: 3930, output: 'Found 4 matching records' }] },
    { id: 'result-export', phaseId: 'phase-release-24', reportId: 'report-regression-24', automatedTestId: 'export-csv', name: 'Export results as CSV', status: 'skipped', duration: 0, lastRunAt: '2025-04-21T14:01:33.000Z', steps: [{ name: 'Open export menu', status: 'skipped', duration: 0, output: 'Skipped: feature flag disabled' }] },
    { id: 'result-nightly-login', phaseId: 'phase-nightly-0417', reportId: 'report-nightly', automatedTestId: 'login-valid', name: 'User can log in with valid credentials', status: 'running', duration: 0, lastRunAt: '2025-04-17T06:24:01.000Z', steps: [{ name: 'Open sign in', status: 'passed', duration: 740 }, { name: 'Submit credentials', status: 'running', duration: 0 }] },
    { id: 'result-payment-prod', phaseId: 'phase-payments-prod', reportId: 'report-payments', automatedTestId: 'checkout-payment', name: 'Checkout payment flow', status: 'passed', duration: 7340, lastRunAt: '2025-04-13T09:02:51.000Z', steps: [{ name: 'Open checkout', status: 'passed', duration: 820 }, { name: 'Confirm payment', status: 'passed', duration: 6520 }] },
  ],
}

function readData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : demoData
  } catch {
    return demoData
  }
}

function writeData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const wait = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 180))

export async function getData() {
  return wait(readData())
}

export async function createPhase(values) {
  const data = readData()
  const phase = { id: `phase-${crypto.randomUUID()}`, ...values, createdAt: new Date().toISOString() }
  writeData({ ...data, phases: [phase, ...data.phases] })
  return wait(phase)
}

export async function createReport(values) {
  const data = readData()
  const report = { id: `report-${crypto.randomUUID()}`, ...values, createdAt: new Date().toISOString(), author: 'You' }
  writeData({ ...data, reports: [report, ...data.reports] })
  return wait(report)
}

/** Idempotently replace the latest result for phase + report + stable test id. */
export async function upsertTestResult({ phaseId, reportId, automatedTestId, ...result }) {
  const data = readData()
  const index = data.results.findIndex((item) => item.phaseId === phaseId && item.reportId === reportId && item.automatedTestId === automatedTestId)
  const nextResult = { ...result, phaseId, reportId, automatedTestId, id: index >= 0 ? data.results[index].id : `result-${crypto.randomUUID()}` }
  const results = [...data.results]
  if (index >= 0) results[index] = nextResult
  else results.unshift(nextResult)
  writeData({ ...data, results })
  return wait(nextResult)
}

export function formatDate(value, withTime = false) {
  return value ? dayjs(value).format(withTime ? 'DD MMM YYYY, HH:mm' : 'DD MMM YYYY') : '—'
}

export function formatDuration(milliseconds) {
  if (!milliseconds) return '—'
  const seconds = milliseconds / 1000
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s` : `${seconds.toFixed(2)}s`
}

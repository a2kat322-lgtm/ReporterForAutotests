export const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options })
  } catch {
    throw new Error('Backend is unavailable. Start PostgreSQL and the NestJS API, then try again.')
  }
  let payload
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status})`)
  return payload
}

export async function getData(route = { page: 'phases' }) {
  // The help page is static: it must not call the API for data it never shows.
  if (route.page === 'help') return { phases: [], reports: [], results: [] }
  const workspaceId = route.workspaceId
  const params = workspaceId != null ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
  if (route.page === 'phases') {
    const phases = await request(`/phases${params}`)
    return { phases, reports: [], results: [] }
  }
  if (route.page === 'runs') {
    const launches = await getLaunches(workspaceId)
    return { phases: [], reports: [], results: [], launches }
  }
  if (route.page === 'launch') {
    const launch = await getLaunch(route.launchId)
    return { phases: [], reports: [], results: launch.results, launch: launch.launch }
  }
  const phaseId = route.phaseId || route.phase?.id
  if (route.page === 'phaseAnalytics') {
    const [reportList, analytics] = await Promise.all([
      request(`/phases/${phaseId}/reports`),
      getPhaseAnalytics(phaseId),
    ])
    return {
      phases: [analytics.phase],
      reports: reportList,
      analytics,
    }
  }
  if (route.page === 'reports') {
    const [phase, reports, reportSummaries] = await Promise.all([
      request(`/phases/${phaseId}`),
      request(`/phases/${phaseId}/reports`),
      request(`/phases/${phaseId}/reports/results-summary`),
    ])
    return {
      phases: [phase], reports,
      reportSummaries: reportSummaries.reportSummaries || reportSummaries,
      cumulative: reportSummaries.cumulative || null,
      results: [],
    }
  }
  const reportId = route.reportId || route.report?.id
  const [report, results] = await Promise.all([
    request(`/reports/${reportId}`),
    request(`/reports/${reportId}/results`),
  ])
  return { phases: [report.phase], reports: [report], results }
}

export async function getWorkspaces() {
  return request('/workspaces')
}

/** Uploaded allure-results archives of a workspace, newest first. */
export function getLaunches(workspaceId) {
  const params = workspaceId != null ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
  return request(`/launches${params}`)
}

/** One launch with the runs shown on its report page. */
export function getLaunch(launchId) {
  return request(`/launches/${encodeURIComponent(launchId)}`)
}

export function getPhaseAnalytics(phaseId) {
  return request(`/phases/${phaseId}/analytics`)
}

export async function createWorkspace(values) {
  return request('/workspaces', { method: 'POST', body: JSON.stringify(values) })
}

export async function deleteWorkspace(workspaceId) {
  return request(`/workspaces/${workspaceId}`, { method: 'DELETE' })
}

export async function createPhase(values) {
  return request('/phases', { method: 'POST', body: JSON.stringify(values) })
}

export async function deletePhase(phaseId) {
  return request(`/phases/${phaseId}`, { method: 'DELETE' })
}

export async function createReport(values) {
  const { phaseId, ...payload } = values
  return request(`/phases/${phaseId}/reports`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function deleteReport(reportId) {
  return request(`/reports/${reportId}`, { method: 'DELETE' })
}

export async function updateResultFeedback(resultId, values) {
  return request(`/reports/results/${resultId}/feedback`, { method: 'PATCH', body: JSON.stringify(values) })
}

export function getAutomatedTests(environment, workspaceId) {
  const params = new URLSearchParams()
  if (environment) params.set('environment', environment)
  if (workspaceId != null) params.set('workspaceId', workspaceId)
  const query = params.toString()
  return request(`/tests${query ? `?${query}` : ''}`)
}

export async function createAutomatedTest(values) {
  return request('/tests', { method: 'POST', body: JSON.stringify(values) })
}

export async function createAutomatedTestsBulk(tests) {
  return request('/tests/bulk', { method: 'POST', body: JSON.stringify({ tests }) })
}

export async function updateAutomatedTestsVisibility(resultPaths, visible, workspaceId) {
  return request('/tests/visibility', { method: 'POST', body: JSON.stringify({ resultPaths, visible, workspaceId }) })
}

export async function deleteAutomatedTest(testId) {
  return request(`/tests/${testId}`, { method: 'DELETE' })
}

export async function harvestAutomatedTests(startDate, endDate, environment, workspaceId) {
  const params = new URLSearchParams({ startDate, endDate })
  if (environment) params.set('environment', environment)
  if (workspaceId != null) params.set('workspaceId', workspaceId)
  return request(`/tests/harvest?${params}`, { method: 'POST' })
}

export async function importLegacyData(data) {
  return request('/import', { method: 'POST', headers: { 'X-Import-Confirmation': 'yes' }, body: JSON.stringify(data) })
}

/**
 * Uploads an `allure-results` archive (one CI run) as a raw ZIP body.
 * `environment` becomes the run circuit and must match the phase environment,
 * otherwise the imported runs will not appear in that phase's reports.
 */
export async function importAllureResults({ file, environment, workspaceId, projectName, launchId, fileName, origin }) {
  const params = new URLSearchParams({ environment })
  if (workspaceId != null) params.set('workspaceId', workspaceId)
  if (projectName) params.set('projectName', projectName)
  if (launchId) params.set('launchId', launchId)
  if (fileName) params.set('fileName', fileName)
  if (origin) params.set('origin', origin)

  let response
  try {
    response = await fetch(`${API_BASE}/allure/import?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: file,
    })
  } catch {
    throw new Error('Backend is unavailable. Start PostgreSQL and the NestJS API, then try again.')
  }

  let payload = null
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) throw new Error(payload?.message || `Import failed (${response.status})`)
  return payload
}

export function getResultDetails(resultId) {
  return request(`/results/${resultId}/details`)
}

export function getAttachmentUrl(key) {
  return `${API_BASE}/attachments/${encodeURIComponent(key)}`
}

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`

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
  if (route.page === 'phases') {
    const phases = await request('/phases')
    return { phases, reports: [], results: [] }
  }
  const phaseId = route.phaseId || route.phase?.id
  if (route.page === 'reports') {
    const [phase, reports] = await Promise.all([request(`/phases/${phaseId}`), request(`/phases/${phaseId}/reports`)])
    return { phases: [phase], reports, results: [] }
  }
  const reportId = route.reportId || route.report?.id
  const [report, results] = await Promise.all([request(`/reports/${reportId}`), request(`/reports/${reportId}/results`)])
  return { phases: [report.phase], reports: [report], results }
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

export async function upsertTestResult({ phaseId, reportId, automatedTestId, ...result }) {
  return request(`/reports/${reportId}/results`, { method: 'POST', body: JSON.stringify({ phaseId, automatedTestId, ...result }) })
}

export async function importLegacyData(data) {
  return request('/import', { method: 'POST', headers: { 'X-Import-Confirmation': 'yes' }, body: JSON.stringify(data) })
}

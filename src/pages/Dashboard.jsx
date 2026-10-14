import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import Shell from '../components/Shell'
import { getData } from '../services/dataService'
import PhasesPage from './PhasesPage'
import ReportPage from './ReportPage'
import ReportDashboard from './ReportDashboard'
import ReportsPage from './ReportsPage'

const { Text } = Typography

export default function Dashboard({ route, navigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // Bump on every explicit refresh; route changes refetch via the primitive deps below.
  const [loadToken, setLoadToken] = useState(0)
  const { page, phaseId, reportId } = route

  // Reset to the loading state only when the route actually changes;
  // a manual refresh keeps the stale data visible until the new data arrives.
  useEffect(() => {
    setError(null)
    setData(null)
  }, [page, phaseId, reportId])

  useEffect(() => {
    let cancelled = false
    getData({ page, phaseId, reportId })
      .then((loaded) => { if (!cancelled) setData(loaded) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Unable to load test data. Please try again.') })
    return () => { cancelled = true }
  }, [page, phaseId, reportId, loadToken])

  const reload = useCallback(() => setLoadToken((token) => token + 1), [])

  const phase = data ? data.phases.find((item) => item.id === phaseId) || route.phase : null
  const report = data ? data.reports.find((item) => item.id === reportId) || route.report : null

  let content = null
  if (error) {
    content = <Alert type="error" showIcon message={error} action={<Button onClick={() => { setError(null); reload() }}>Retry</Button>} />
  } else if (data) {
    if (page === 'reports' && phase) content = <ReportsPage data={data} phase={phase} navigate={navigate} reload={reload} />
    else if (page === 'report' && phase && report) content = <ReportPage data={data} phase={phase} report={report} navigate={navigate} reload={reload} />
    else if (page === 'analytics' && phase && report) content = <ReportDashboard data={data} phase={phase} report={report} navigate={navigate} />
    else if (page !== 'phases' && !phase) content = <Alert type="warning" showIcon message="Phase not found" description="The requested phase may have been removed." action={<Button onClick={() => navigate({ page: 'phases' })}>Back to phases</Button>} />
    else content = <PhasesPage data={data} navigate={navigate} reload={reload} />
  } else {
    content = <div className="loading-state"><ReloadOutlined spin /><Text type="secondary">Loading workspace…</Text></div>
  }

  const shellRoute = { ...route, phase: phase ?? route.phase, report: report ?? route.report }
  return <Shell route={shellRoute} navigate={navigate}>{content}</Shell>
}

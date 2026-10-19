import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Alert, Button, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import Shell from '../components/Shell'
import { getData, getWorkspaces } from '../services/dataService'
import PhasesPage from './PhasesPage'
import ReportPage from './ReportPage'
import ReportsPage from './ReportsPage'

const PhaseAnalytics = lazy(() => import('./PhaseAnalytics'))
const ReportDashboard = lazy(() => import('./ReportDashboard'))

const { Text } = Typography

export default function Dashboard({ route, navigate, colorMode, onToggleTheme, workspaceId, onSelectWorkspace }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  // Bump on every explicit refresh; route changes refetch via the primitive deps below.
  const [loadToken, setLoadToken] = useState(0)
  // Bump to reload the workspace list after create/delete.
  const [workspacesToken, setWorkspacesToken] = useState(0)
  const { page, phaseId, reportId } = route

  // Load the workspace list once, and whenever the selection changes (so a
  // freshly created workspace from an ingress run appears after refresh).
  useEffect(() => {
    let cancelled = false
    getWorkspaces()
      .then((list) => { if (!cancelled) setWorkspaces(list) })
      .catch(() => { if (!cancelled) setWorkspaces([]) })
    return () => { cancelled = true }
  }, [workspaceId, workspacesToken])

  const reloadWorkspaces = useCallback(() => setWorkspacesToken((token) => token + 1), [])

  // Reset to the loading state only when the route actually changes;
  // a manual refresh keeps the stale data visible until the new data arrives.
  useEffect(() => {
    setError(null)
    setData(null)
  }, [page, phaseId, reportId, workspaceId])

  useEffect(() => {
    let cancelled = false
    getData({ page, phaseId, reportId, workspaceId })
      .then((loaded) => { if (!cancelled) setData(loaded) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Не удалось загрузить данные тестирования. Попробуйте ещё раз.') })
    return () => { cancelled = true }
  }, [page, phaseId, reportId, workspaceId, loadToken])

  const reload = useCallback(() => setLoadToken((token) => token + 1), [])

  const phase = data ? data.phases.find((item) => item.id === phaseId) || route.phase : null
  const report = data ? data.reports.find((item) => item.id === reportId) || route.report : null

  let content = null
  if (error) {
    content = <Alert type="error" showIcon message={error} action={<Button onClick={() => { setError(null); reload() }}>Повторить</Button>} />
  } else if (data) {
    if (page === 'phaseAnalytics' && phase) content = <Suspense fallback={<div className="loading-state"><ReloadOutlined spin /><Text type="secondary">Загрузка аналитики фазы…</Text></div>}><PhaseAnalytics data={data} phase={phase} navigate={navigate} reload={reload} /></Suspense>
    else if (page === 'reports' && phase) content = <ReportsPage data={data} phase={phase} navigate={navigate} reload={reload} workspaceId={workspaceId} />
    else if (page === 'report' && phase && report) content = <ReportPage data={data} phase={phase} report={report} navigate={navigate} reload={reload} />
    else if (page === 'analytics' && phase && report) content = <Suspense fallback={<div className="loading-state"><ReloadOutlined spin /><Text type="secondary">Загрузка аналитики отчёта…</Text></div>}><ReportDashboard data={data} phase={phase} report={report} navigate={navigate} /></Suspense>
    else if (page !== 'phases' && !phase) content = <Alert type="warning" showIcon message="Фаза не найдена" description="Возможно, запрошенная фаза была удалена." action={<Button onClick={() => navigate({ page: 'phases' })}>Назад к фазам</Button>} />
    else content = <PhasesPage data={data} navigate={navigate} reload={reload} workspaceId={workspaceId} />
  } else {
    content = <div className="loading-state"><ReloadOutlined spin /><Text type="secondary">Загрузка рабочего пространства…</Text></div>
  }

  const shellRoute = { ...route, phase: phase ?? route.phase, report: report ?? route.report }
  return <Shell route={shellRoute} navigate={navigate} colorMode={colorMode} onToggleTheme={onToggleTheme} workspaces={workspaces} workspaceId={workspaceId} onSelectWorkspace={onSelectWorkspace} onReloadWorkspaces={reloadWorkspaces}>{content}</Shell>
}

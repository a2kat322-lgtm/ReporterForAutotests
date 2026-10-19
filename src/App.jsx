import { ConfigProvider, theme } from 'antd'
import { App as AntApp } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { useCallback, useEffect, useState } from 'react'
import 'dayjs/locale/ru'
import dayjs from 'dayjs'

dayjs.locale('ru')
import Dashboard from './pages/Dashboard'
import './styles.css'

function getRoute() {
  const match = window.location.pathname.match(/^\/phase\/(\d+)(?:\/analytics|\/report\/(\d+)(?:\/analytics)?)?\/?$/)
  if (!match) return { page: 'phases' }
  if (match[2]) return { page: window.location.pathname.includes('/analytics') ? 'analytics' : 'report', phaseId: Number(match[1]), reportId: Number(match[2]) }
  if (window.location.pathname.includes('/analytics')) return { page: 'phaseAnalytics', phaseId: Number(match[1]) }
  return { page: 'reports', phaseId: Number(match[1]) }
}

function getPath(route) {
  if (route.page === 'phaseAnalytics') return `/phase/${encodeURIComponent(route.phaseId || route.phase.id)}/analytics`
  if (route.page === 'reports') return `/phase/${encodeURIComponent(route.phaseId || route.phase.id)}`
  if (route.page === 'report' || route.page === 'analytics') return `/phase/${encodeURIComponent(route.phaseId || route.phase.id)}/report/${encodeURIComponent(route.reportId || route.report.id)}${route.page === 'analytics' ? '/analytics' : ''}`
  return '/'
}

function getInitialTheme() {
  try { return localStorage.getItem('reporter-for-autotests-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

function getInitialWorkspaceId() {
  try {
    const raw = localStorage.getItem('reporter-for-autotests-workspace')
    return raw ? Number(raw) : null
  } catch { return null }
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [colorMode, setColorMode] = useState(getInitialTheme)
  const [workspaceId, setWorkspaceId] = useState(getInitialWorkspaceId)
  const navigate = useCallback((nextRoute) => {
    window.history.pushState({}, '', getPath(nextRoute))
    setRoute(nextRoute)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(getRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const selectWorkspace = useCallback((id) => {
    setWorkspaceId(id == null ? null : Number(id))
    try { localStorage.setItem('reporter-for-autotests-workspace', id == null ? '' : String(id)) } catch { /* Storage may be unavailable. */ }
    navigate({ page: 'phases' })
  }, [navigate])

  const isLight = colorMode === 'light'
  useEffect(() => {
    document.documentElement.dataset.theme = colorMode
    try { localStorage.setItem('reporter-for-autotests-theme', colorMode) } catch { /* Storage may be unavailable. */ }
  }, [colorMode])

  const tokens = isLight
    ? { colorPrimary: '#7c3aed', colorBgBase: '#f5f6fa', colorBgContainer: '#ffffff', colorBorder: '#e5e7eb', colorText: '#20212a', colorTextSecondary: '#737684', borderRadius: 10, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }
    : { colorPrimary: '#8b5cf6', colorBgBase: '#0f1015', colorBgContainer: '#171820', colorBorder: '#292b38', borderRadius: 10, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }

  return (
    <ConfigProvider locale={ruRU} theme={{ algorithm: isLight ? theme.defaultAlgorithm : theme.darkAlgorithm, token: tokens }}>
      <AntApp>
        <Dashboard route={route} navigate={navigate} colorMode={colorMode} onToggleTheme={() => setColorMode((mode) => mode === 'dark' ? 'light' : 'dark')} workspaceId={workspaceId} onSelectWorkspace={selectWorkspace} />
      </AntApp>
    </ConfigProvider>
  )
}

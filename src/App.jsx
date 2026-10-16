import { ConfigProvider, theme } from 'antd'
import { App as AntApp } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import './styles.css'

function getRoute() {
  const match = window.location.pathname.match(/^\/phase\/(\d+)(?:\/report\/(\d+)(?:\/analytics)?)?\/?$/)
  if (!match) return { page: 'phases' }
  if (match[2]) return { page: window.location.pathname.includes('/analytics') ? 'analytics' : 'report', phaseId: Number(match[1]), reportId: Number(match[2]) }
  return { page: 'reports', phaseId: Number(match[1]) }
}

function getPath(route) {
  if (route.page === 'reports') return `/phase/${encodeURIComponent(route.phaseId || route.phase.id)}`
  if (route.page === 'report' || route.page === 'analytics') return `/phase/${encodeURIComponent(route.phaseId || route.phase.id)}/report/${encodeURIComponent(route.reportId || route.report.id)}${route.page === 'analytics' ? '/analytics' : ''}`
  return '/'
}

function getInitialTheme() {
  try { return localStorage.getItem('test-insights-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [colorMode, setColorMode] = useState(getInitialTheme)
  const navigate = useCallback((nextRoute) => {
    window.history.pushState({}, '', getPath(nextRoute))
    setRoute(nextRoute)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(getRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const isLight = colorMode === 'light'
  useEffect(() => {
    document.documentElement.dataset.theme = colorMode
    try { localStorage.setItem('test-insights-theme', colorMode) } catch { /* Storage may be unavailable. */ }
  }, [colorMode])

  const tokens = isLight
    ? { colorPrimary: '#7c3aed', colorBgBase: '#f5f6fa', colorBgContainer: '#ffffff', colorBorder: '#e5e7eb', colorText: '#20212a', colorTextSecondary: '#737684', borderRadius: 10, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }
    : { colorPrimary: '#8b5cf6', colorBgBase: '#0f1015', colorBgContainer: '#171820', colorBorder: '#292b38', borderRadius: 10, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }

  return (
    <ConfigProvider theme={{ algorithm: isLight ? theme.defaultAlgorithm : theme.darkAlgorithm, token: tokens }}>
      <AntApp>
        <Dashboard route={route} navigate={navigate} colorMode={colorMode} onToggleTheme={() => setColorMode((mode) => mode === 'dark' ? 'light' : 'dark')} />
      </AntApp>
    </ConfigProvider>
  )
}

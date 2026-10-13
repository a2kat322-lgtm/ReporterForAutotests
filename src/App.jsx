import { ConfigProvider, theme } from 'antd'
import { App as AntApp } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import './styles.css'

function getRoute() {
  const match = window.location.pathname.match(/^\/phase\/(\d+)(?:\/report\/([^/]+))?\/?$/)
  if (!match) return { page: 'phases' }
  return match[2]
    ? { page: 'report', phaseId: Number(match[1]), reportId: decodeURIComponent(match[2]) }
    : { page: 'reports', phaseId: Number(match[1]) }
}

function getPath(route) {
  if (route.page === 'reports') return `/phase/${encodeURIComponent(route.phaseId || route.phase.id)}`
  if (route.page === 'report') return `/phase/${encodeURIComponent(route.phaseId || route.phase.id)}/report/${encodeURIComponent(route.reportId || route.report.id)}`
  return '/'
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const navigate = useCallback((nextRoute) => {
    window.history.pushState({}, '', getPath(nextRoute))
    setRoute(nextRoute)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(getRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#8b5cf6', colorBgBase: '#0f1015', colorBgContainer: '#171820', colorBorder: '#292b38', borderRadius: 10, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' } }}>
      <AntApp>
        <Dashboard route={route} navigate={navigate} />
      </AntApp>
    </ConfigProvider>
  )
}

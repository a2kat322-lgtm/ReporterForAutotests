import { ConfigProvider, theme } from 'antd'
import { App as AntApp } from 'antd'
import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import './styles.css'

export default function App() {
  const [route, setRoute] = useState({ page: 'phases' })
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#8b5cf6', colorBgBase: '#0f1015', colorBgContainer: '#171820', colorBorder: '#292b38', borderRadius: 10, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' } }}>
      <AntApp>
        <Dashboard route={route} navigate={setRoute} />
      </AntApp>
    </ConfigProvider>
  )
}

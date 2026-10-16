import { Button, Layout, Space, Switch, Tooltip, Typography } from 'antd'
import { BulbOutlined, ClockCircleOutlined, CodeOutlined, DownOutlined, FolderOpenOutlined, MoonOutlined, RightOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const pageTitles = { phases: 'Тестовые фазы' }

export default function Shell({ children, route, navigate, colorMode, onToggleTheme }) {
  return (
    <Layout className="app-shell">
      <Sider width={232} className="sidebar" breakpoint="lg" collapsedWidth="0">
        <div className="brand"><img src={colorMode === 'light' ? '/reporter-logo-light.svg' : '/reporter-logo.svg'} alt="Репортер автотестов" /></div>
        <div className="workspace"><div className="workspace-avatar">QA</div><div className="workspace-copy"><Text strong>Рабочее пространство качества</Text><Text type="secondary" className="workspace-sub">Инженерия Acme</Text></div><DownOutlined className="workspace-arrow" /></div>
        <div className="nav-section-label">Рабочее пространство</div>
        <nav className="nav-list" aria-label="Навигация по рабочему пространству">
          <button className={route.page === 'phases' ? 'nav-item active' : 'nav-item'} onClick={() => navigate({ page: 'phases' })}><FolderOpenOutlined /> Тестовые фазы</button>
          <button className="nav-item muted" disabled aria-disabled="true"><CodeOutlined /> Тестовые наборы <span className="soon">Скоро</span></button>
          <button className="nav-item muted" disabled aria-disabled="true"><ClockCircleOutlined /> История запусков <span className="soon">Скоро</span></button>
        </nav>
        <div className="sidebar-bottom"><button className="nav-item muted" disabled aria-disabled="true"><SettingOutlined /> Настройки <span className="soon">Скоро</span></button></div>
      </Sider>
      <Layout>
        <Header className="topbar">
          <div className="topbar-left">
            <span className="breadcrumb-muted">Рабочее пространство</span>
            <RightOutlined />
            <span>{pageTitles[route.page] ?? route.phase?.name ?? route.report?.name}</span>
          </div>
          <Space>
            <Tooltip title={colorMode === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}><Switch checked={colorMode === 'light'} onChange={onToggleTheme} checkedChildren={<BulbOutlined />} unCheckedChildren={<MoonOutlined />} aria-label="Переключить тему" /></Tooltip>
            <Button type="text" icon={<SearchOutlined />} />
            <Button type="text" icon={<span className="help-icon">?</span>} />
          </Space>
        </Header>
        <Content className="page-content">{children}</Content>
      </Layout>
    </Layout>
  )
}

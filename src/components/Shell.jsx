import { Avatar, Button, Layout, Space, Switch, Tooltip, Typography } from 'antd'
import { BulbOutlined, ClockCircleOutlined, CodeOutlined, DownOutlined, FolderOpenOutlined, MoonOutlined, RightOutlined, RocketOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const avatarStyle = { background: '#e8b86b', color: '#2a1d0c' }

const pageTitles = { phases: 'Test phases' }

export default function Shell({ children, route, navigate, colorMode, onToggleTheme }) {
  return (
    <Layout className="app-shell">
      <Sider width={232} className="sidebar" breakpoint="lg" collapsedWidth="0">
        <div className="brand"><div className="brand-mark"><RocketOutlined /></div><span>test<span className="brand-accent">insights</span></span></div>
        <div className="workspace"><div className="workspace-avatar">QA</div><div><Text strong>Quality workspace</Text><Text type="secondary" className="workspace-sub">Acme engineering</Text></div><DownOutlined className="workspace-arrow" /></div>
        <nav className="nav-list">
          <button className={route.page === 'phases' ? 'nav-item active' : 'nav-item'} onClick={() => navigate({ page: 'phases' })}><FolderOpenOutlined /> Test phases</button>
          <button className="nav-item muted"><CodeOutlined /> Test suites <span className="soon">Soon</span></button>
          <button className="nav-item muted"><ClockCircleOutlined /> Run history <span className="soon">Soon</span></button>
        </nav>
        <div className="sidebar-bottom"><button className="nav-item muted"><SettingOutlined /> Settings</button><div className="user-card"><Avatar size={30} style={avatarStyle}>AK</Avatar><div><Text strong>Alex Kim</Text><Text type="secondary" className="workspace-sub">Administrator</Text></div><DownOutlined className="workspace-arrow" /></div></div>
      </Sider>
      <Layout>
        <Header className="topbar">
          <div className="topbar-left">
            <span className="breadcrumb-muted">Workspace</span>
            <RightOutlined />
            <span>{pageTitles[route.page] ?? route.phase?.name ?? route.report?.name}</span>
          </div>
          <Space>
            <Tooltip title={colorMode === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}><Switch checked={colorMode === 'light'} onChange={onToggleTheme} checkedChildren={<BulbOutlined />} unCheckedChildren={<MoonOutlined />} aria-label="Переключить тему" /></Tooltip>
            <Button type="text" icon={<SearchOutlined />} />
            <Button type="text" icon={<span className="help-icon">?</span>} />
            <Avatar size={30} style={avatarStyle}>AK</Avatar>
          </Space>
        </Header>
        <Content className="page-content">{children}</Content>
      </Layout>
    </Layout>
  )
}

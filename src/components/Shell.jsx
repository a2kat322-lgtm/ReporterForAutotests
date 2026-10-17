import { useMemo, useState } from 'react'
import { App, Button, Dropdown, Input, Layout, Modal, Space, Switch, Tooltip, Typography } from 'antd'
import { BulbOutlined, ClockCircleOutlined, CodeOutlined, DeleteOutlined, DownOutlined, FolderOpenOutlined, MoonOutlined, PlusOutlined, RightOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { createWorkspace, deleteWorkspace } from '../services/dataService'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const pageTitles = { phases: 'Тестовые фазы' }

export default function Shell({ children, route, navigate, colorMode, onToggleTheme, workspaces, workspaceId, onSelectWorkspace, onReloadWorkspaces }) {
  const { message, modal } = App.useApp()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const current = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaces, workspaceId],
  )

  const confirmRemove = (workspace) => {
    modal.confirm({
      title: `Удалить пространство «${workspace.name}»?`,
      content: 'Все фазы, отчёты, каталог тестов и запуски этого пространства будут удалены безвозвратно.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await deleteWorkspace(workspace.id)
          message.success(`Пространство «${workspace.name}» удалено`)
          if (workspace.id === workspaceId) {
            // Switch to the first remaining workspace (or none) and reload.
            const remaining = workspaces.filter((item) => item.id !== workspace.id)
            onSelectWorkspace(remaining[0]?.id ?? null)
          }
          onReloadWorkspaces()
        } catch (error) {
          message.error(error.message || 'Не удалось удалить пространство')
          throw error
        }
      },
    })
  }

  const items = [
    ...workspaces.map((workspace) => ({
      key: `workspace-${workspace.id}`,
      label: (
        <div className="workspace-menu-item">
          <span className="workspace-menu-name" onClick={() => onSelectWorkspace(workspace.id)}>{workspace.name}</span>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={`Удалить пространство ${workspace.name}`}
            onClick={(event) => { event.stopPropagation(); confirmRemove(workspace) }}
          />
        </div>
      ),
    })),
    { type: 'divider' },
    { key: 'create', label: <span><PlusOutlined /> Новое пространство</span>, onClick: () => setCreating(true) },
  ]

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const created = await createWorkspace({ name })
      setNewName('')
      setCreating(false)
      message.success(`Пространство «${created.name}» создано`)
      onSelectWorkspace(created.id)
      onReloadWorkspaces()
    } catch (error) {
      message.error(error.message || 'Не удалось создать пространство')
    }
  }

  return (
    <Layout className="app-shell">
      <Sider width={232} className="sidebar" breakpoint="lg" collapsedWidth="0">
        <div className="brand"><img src={colorMode === 'light' ? '/reporter-logo-light.svg' : '/reporter-logo.svg'} alt="Репортер автотестов" /></div>
        <Dropdown menu={{ items, selectedKeys: workspaceId != null ? [`workspace-${workspaceId}`] : [] }} trigger={['click']}>
          <div className="workspace">
            <div className="workspace-avatar">{current ? current.name.slice(0, 2).toUpperCase() : '—'}</div>
            <div className="workspace-copy">
              <Text strong>{current ? current.name : 'Выберите пространство'}</Text>
              <Text type="secondary" className="workspace-sub">Проект автотестов</Text>
            </div>
            <DownOutlined className="workspace-arrow" />
          </div>
        </Dropdown>
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
      <Modal title="Новое рабочее пространство" open={creating} onCancel={() => setCreating(false)} onOk={submitCreate} okText="Создать" okButtonProps={{ disabled: !newName.trim() }}>
        <Input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onPressEnter={submitCreate} placeholder="например, myapp" />
      </Modal>
    </Layout>
  )
}

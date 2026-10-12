import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Col, Collapse, DatePicker, Descriptions, Divider, Empty, Form, Input, Layout, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, CheckCircleFilled, CheckOutlined, ClockCircleOutlined, CodeOutlined, DownOutlined, ExclamationCircleFilled, FileTextOutlined, FolderOpenOutlined, PlusOutlined, ReloadOutlined, RightOutlined, RocketOutlined, SearchOutlined, SettingOutlined, WarningFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import { createPhase, createReport, formatDate, formatDuration, getData } from '../services/dataService'

const { Header, Sider, Content } = Layout
const { Title, Text, Paragraph } = Typography
const statusMeta = {
  passed: { label: 'Passed', color: 'success', icon: <CheckCircleFilled /> },
  failed: { label: 'Failed', color: 'error', icon: <ExclamationCircleFilled /> },
  skipped: { label: 'Skipped', color: 'default', icon: <WarningFilled /> },
  running: { label: 'Running', color: 'processing', icon: <ReloadOutlined spin /> },
}
const envColors = { test: 'blue', stage: 'purple', production: 'green' }

function StatusTag({ status }) {
  const meta = statusMeta[status] || statusMeta.skipped
  return <Tag className="status-tag" color={meta.color} icon={meta.icon}>{meta.label}</Tag>
}

function Shell({ children, route, navigate }) {
  return <Layout className="app-shell">
    <Sider width={232} className="sidebar" breakpoint="lg" collapsedWidth="0">
      <div className="brand"><div className="brand-mark"><RocketOutlined /></div><span>test<span className="brand-accent">insights</span></span></div>
      <div className="workspace"><div className="workspace-avatar">QA</div><div><Text strong>Quality workspace</Text><Text type="secondary" className="workspace-sub">Acme engineering</Text></div><DownOutlined className="workspace-arrow" /></div>
      <nav className="nav-list">
        <button className={route.page === 'phases' ? 'nav-item active' : 'nav-item'} onClick={() => navigate({ page: 'phases' })}><FolderOpenOutlined /> Test phases</button>
        <button className="nav-item muted"><CodeOutlined /> Test suites <span className="soon">Soon</span></button>
        <button className="nav-item muted"><ClockCircleOutlined /> Run history <span className="soon">Soon</span></button>
      </nav>
      <div className="sidebar-bottom"><button className="nav-item muted"><SettingOutlined /> Settings</button><div className="user-card"><Avatar size={30} style={{ background: '#e8b86b', color: '#2a1d0c' }}>AK</Avatar><div><Text strong>Alex Kim</Text><Text type="secondary" className="workspace-sub">Administrator</Text></div><DownOutlined className="workspace-arrow" /></div></div>
    </Sider>
    <Layout><Header className="topbar"><div className="topbar-left"><span className="breadcrumb-muted">Workspace</span><RightOutlined /><span>{route.page === 'phases' ? 'Test phases' : route.page === 'reports' ? route.phase?.name : route.report?.name}</span></div><Space><Button type="text" icon={<SearchOutlined />} /><Button type="text" icon={<span className="help-icon">?</span>} /><Avatar size={30} style={{ background: '#e8b86b', color: '#2a1d0c' }}>AK</Avatar></Space></Header><Content className="page-content">{children}</Content></Layout>
  </Layout>
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><Text className="eyebrow">{eyebrow}</Text><Title level={1}>{title}</Title>{description && <Paragraph type="secondary">{description}</Paragraph>}</div>{action}</div>
}

function CreatePhaseModal({ open, onCancel, onCreate }) {
  const [form] = Form.useForm()
  const submit = async () => { const values = await form.validateFields(); await onCreate({ ...values, startedAt: values.period[0].format('YYYY-MM-DD'), endedAt: values.period[1].format('YYYY-MM-DD') }); form.resetFields() }
  return <Modal title="Create test phase" open={open} onCancel={onCancel} onOk={submit} okText="Create phase" destroyOnClose><Form form={form} layout="vertical"><Form.Item name="name" label="Phase name" rules={[{ required: true, message: 'Enter a phase name' }]}><Input placeholder="e.g. Release 2.5.0" /></Form.Item><Form.Item name="environment" label="Environment" rules={[{ required: true, message: 'Select an environment' }]}><Select options={['test', 'stage', 'production'].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} placeholder="Select environment" /></Form.Item><Form.Item name="period" label="Testing period" rules={[{ required: true, message: 'Choose the testing period' }, { validator: (_, value) => value?.[1]?.isBefore(value?.[0], 'day') ? Promise.reject(new Error('End date cannot be before start date')) : Promise.resolve() }]}><DatePicker.RangePicker className="full-width" /></Form.Item></Form></Modal>
}

function CreateReportModal({ open, onCancel, onCreate }) {
  const [form] = Form.useForm()
  const submit = async () => { const values = await form.validateFields(); await onCreate({ name: values.name }); form.resetFields() }
  return <Modal title="Create report" open={open} onCancel={onCancel} onOk={submit} okText="Create report" destroyOnClose><Form form={form} layout="vertical"><Form.Item name="name" label="Report name" rules={[{ required: true, message: 'Enter a report name' }]}><Input placeholder="e.g. Regression run" /></Form.Item><div className="form-hint">The report will be created for the current phase with today's date.</div></Form></Modal>
}

function PhaseSummary({ phase, reports, results }) {
  const passed = results.filter((item) => item.status === 'passed').length
  const failed = results.filter((item) => item.status === 'failed').length
  return <Space size={4}><Tag color={envColors[phase.environment]}>{phase.environment}</Tag><Text type="secondary">{reports.length} report{reports.length !== 1 ? 's' : ''}</Text><span className="dot-separator">·</span><Text className="passed-text">{passed} passed</Text>{failed > 0 && <><span className="dot-separator">·</span><Text className="failed-text">{failed} failed</Text></>}</Space>
}

function PhasesPage({ data, navigate, reload }) {
  const [modalOpen, setModalOpen] = useState(false); const [messageApi, contextHolder] = message.useMessage()
  const columns = [{ title: 'PHASE', dataIndex: 'name', key: 'name', render: (name, phase) => <div className="phase-cell"><div className="phase-icon"><FolderOpenOutlined /></div><div><Text strong>{name}</Text><Text type="secondary" className="phase-id">{phase.id}</Text></div></div> }, { title: 'ENVIRONMENT', dataIndex: 'environment', render: (value) => <Tag color={envColors[value]}>{value}</Tag> }, { title: 'TESTING PERIOD', render: (_, phase) => <Text>{formatDate(phase.startedAt)} <span className="period-arrow">→</span> {formatDate(phase.endedAt)}</Text> }, { title: 'RESULTS', render: (_, phase) => <PhaseSummary phase={phase} reports={data.reports.filter((report) => report.phaseId === phase.id)} results={data.results.filter((result) => result.phaseId === phase.id)} /> }, { title: '', width: 52, render: () => <Button type="text" icon={<RightOutlined />} /> }]
  const create = async (values) => { await createPhase(values); setModalOpen(false); messageApi.success('Phase created'); reload() }
  return <><PageHeading eyebrow="TEST MANAGEMENT" title="Test phases" description="Organize test runs by release, environment, or any testing cycle." action={<Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>New phase</Button>} /><div className="toolbar"><Text type="secondary"><strong className="toolbar-count">{data.phases.length}</strong> phases</Text><Button icon={<ReloadOutlined />} onClick={reload}>Refresh</Button></div><Card className="table-card" bodyStyle={{ padding: 0 }}><Table rowKey="id" columns={columns} dataSource={data.phases} pagination={false} onRow={(phase) => ({ onClick: () => navigate({ page: 'reports', phase }) })} locale={{ emptyText: <Empty description="No test phases yet" /> }} /></Card><CreatePhaseModal open={modalOpen} onCancel={() => setModalOpen(false)} onCreate={create} />{contextHolder}</>
}

function ReportsPage({ data, phase, navigate, reload }) {
  const [modalOpen, setModalOpen] = useState(false); const [messageApi, contextHolder] = message.useMessage(); const reports = data.reports.filter((item) => item.phaseId === phase.id)
  const columns = [{ title: 'REPORT', dataIndex: 'name', render: (name, report) => <div className="report-cell"><div className="report-icon"><FileTextOutlined /></div><div><Text strong>{name}</Text><Text type="secondary" className="phase-id">{report.id}</Text></div></div> }, { title: 'CREATED', dataIndex: 'createdAt', render: (value) => formatDate(value, true) }, { title: 'CREATED BY', dataIndex: 'author', render: (value) => <Text type="secondary">{value}</Text> }, { title: 'RESULTS', render: (_, report) => <Text>{data.results.filter((item) => item.reportId === report.id).length} tests</Text> }, { title: '', width: 52, render: () => <Button type="text" icon={<RightOutlined />} /> }]
  const create = async (values) => { await createReport({ ...values, phaseId: phase.id }); setModalOpen(false); messageApi.success('Report created'); reload() }
  return <><div className="back-link" onClick={() => navigate({ page: 'phases' })}><ArrowLeftOutlined /> Back to phases</div><PageHeading eyebrow={`${phase.environment.toUpperCase()} · ${formatDate(phase.startedAt)} — ${formatDate(phase.endedAt)}`} title={phase.name} description="Reports and automated test runs for this testing phase." action={<Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>New report</Button>} /><div className="toolbar"><Text type="secondary"><strong className="toolbar-count">{reports.length}</strong> reports</Text><Button icon={<ReloadOutlined />} onClick={reload}>Refresh</Button></div><Card className="table-card" bodyStyle={{ padding: 0 }}><Table rowKey="id" columns={columns} dataSource={reports} pagination={false} onRow={(report) => ({ onClick: () => navigate({ page: 'report', phase, report }) })} locale={{ emptyText: <Empty description="No reports yet" /> }} /></Card><CreateReportModal open={modalOpen} onCancel={() => setModalOpen(false)} onCreate={create} />{contextHolder}</>
}

function TestDetails({ test }) {
  const items = test.steps.map((step, index) => ({ key: String(index), label: <div className="step-label"><span className={`step-number ${step.status}`}>{step.status === 'passed' ? <CheckOutlined /> : step.status === 'failed' ? '!' : index + 1}</span><Text>{step.name}</Text><Text type="secondary" className="step-duration">{formatDuration(step.duration)}</Text></div>, children: <div className="step-detail">{step.error && <Alert type="error" showIcon message={step.error} />}{step.output && <pre>{step.output}</pre>}{!step.error && !step.output && <Text type="secondary">No additional output</Text>}</div> }))
  return <Collapse ghost items={items} />
}

function ReportPage({ data, phase, report, navigate, reload }) {
  const [query, setQuery] = useState(''); const tests = data.results.filter((item) => item.phaseId === phase.id && item.reportId === report.id).filter((item) => item.name.toLowerCase().includes(query.toLowerCase()) || item.automatedTestId.toLowerCase().includes(query.toLowerCase())); const passed = tests.filter((item) => item.status === 'passed').length; const failed = tests.filter((item) => item.status === 'failed').length; const running = tests.filter((item) => item.status === 'running').length
  const columns = [{ title: 'AUTOMATED TEST', dataIndex: 'name', render: (name, test) => <div className="test-name"><span className="test-status-dot" data-status={test.status}></span><div><Text strong>{name}</Text><Text type="secondary" className="phase-id">{test.automatedTestId}</Text></div></div> }, { title: 'STATUS', dataIndex: 'status', render: (status) => <StatusTag status={status} /> }, { title: 'DURATION', dataIndex: 'duration', render: (value) => <Text type="secondary">{formatDuration(value)}</Text> }, { title: 'LAST RUN', dataIndex: 'lastRunAt', render: (value) => <Text type="secondary">{formatDate(value, true)}</Text> }, { title: '', width: 50, render: () => <DownOutlined className="expand-icon" /> }]
  return <><div className="back-link" onClick={() => navigate({ page: 'reports', phase })}><ArrowLeftOutlined /> Back to {phase.name}</div><div className="report-header"><div><Text className="eyebrow">REPORT · {formatDate(report.createdAt, true).toUpperCase()}</Text><Title level={1}>{report.name}</Title><Space><Tag color={envColors[phase.environment]}>{phase.environment}</Tag><Text type="secondary">{phase.name}</Text><span className="dot-separator">·</span><Text type="secondary">Created by {report.author}</Text></Space></div><Button icon={<ReloadOutlined />} onClick={reload}>Refresh results</Button></div><Row gutter={[12, 12]} className="stats-row"><Col xs={12} sm={6}><Card><Statistic title="Total tests" value={tests.length} prefix={<FileTextOutlined />} /></Card></Col><Col xs={12} sm={6}><Card><Statistic title="Passed" value={passed} valueStyle={{ color: '#4ade80' }} prefix={<CheckCircleFilled />} /></Card></Col><Col xs={12} sm={6}><Card><Statistic title="Failed" value={failed} valueStyle={{ color: '#fb7185' }} prefix={<ExclamationCircleFilled />} /></Card></Col><Col xs={12} sm={6}><Card><Statistic title="Running" value={running} valueStyle={{ color: '#60a5fa' }} prefix={<ReloadOutlined />} /></Card></Col></Row><div className="toolbar report-toolbar"><Input prefix={<SearchOutlined />} placeholder="Search tests" value={query} onChange={(event) => setQuery(event.target.value)} allowClear /><Text type="secondary">Showing <strong>{tests.length}</strong> results</Text></div><Card className="table-card test-table-card" bodyStyle={{ padding: 0 }}><Table rowKey="id" columns={columns} dataSource={tests} pagination={false} expandable={{ expandedRowRender: (test) => <TestDetails test={test} />, expandIcon: () => null }} locale={{ emptyText: <Empty description="No matching tests" /> }} /></Card></>
}

export default function Dashboard({ route, navigate }) {
  const [data, setData] = useState(null); const [error, setError] = useState(null)
  const reload = () => getData().then(setData).catch(() => setError('Unable to load test data. Please try again.'))
  useEffect(() => { reload() }, [])
  const content = useMemo(() => { if (route.page === 'reports' && route.phase) return <ReportsPage data={data} phase={route.phase} navigate={navigate} reload={reload} />; if (route.page === 'report' && route.phase && route.report) return <ReportPage data={data} phase={route.phase} report={route.report} navigate={navigate} reload={reload} />; return <PhasesPage data={data} navigate={navigate} reload={reload} /> }, [data, route])
  return <Shell route={route} navigate={navigate}>{error ? <Alert type="error" showIcon message={error} action={<Button onClick={() => { setError(null); reload() }}>Retry</Button>} /> : data ? content : <div className="loading-state"><ReloadOutlined spin /><Text type="secondary">Loading workspace…</Text></div>}</Shell>
}

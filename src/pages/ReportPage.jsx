import { useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Input, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CheckCircleFilled, DownOutlined, ExclamationCircleFilled, FileTextOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import StatusTag from '../components/StatusTag'
import TestDetails from '../components/TestDetails'
import { envColors } from '../constants'
import { formatDate, formatDuration } from '../utils/format'

const { Title, Text } = Typography

const cardBody = { padding: 0 }
const emptyText = <Empty description="No matching tests" />
const expandIcon = () => null
const expandedRowRender = (test) => <TestDetails test={test} />

const columns = [
  {
    title: 'AUTOMATED TEST',
    dataIndex: 'name',
    render: (name, test) => (
      <div className="test-name">
        <span className="test-status-dot" data-status={test.status}></span>
        <div><Text strong>{name}</Text><Text type="secondary" className="phase-id">{test.automatedTestId}</Text></div>
      </div>
    ),
  },
  { title: 'STATUS', dataIndex: 'status', render: (status) => <StatusTag status={status} /> },
  { title: 'DURATION', dataIndex: 'duration', render: (value) => <Text type="secondary">{formatDuration(value)}</Text> },
  { title: 'LAST RUN', dataIndex: 'lastRunAt', render: (value) => <Text type="secondary">{formatDate(value, true)}</Text> },
  { title: '', width: 50, render: () => <DownOutlined className="expand-icon" /> },
]

const statValueStyles = {
  passed: { color: '#4ade80' },
  failed: { color: '#fb7185' },
  running: { color: '#60a5fa' },
}

export default function ReportPage({ data, phase, report, navigate, reload }) {
  const [query, setQuery] = useState('')

  // One pass over the results: filter by phase/report/search and count statuses together.
  const { tests, passed, failed, running } = useMemo(() => {
    const normalized = query.toLowerCase()
    const matched = []
    let passedCount = 0
    let failedCount = 0
    let runningCount = 0
    for (const item of data.results) {
      if (item.phaseId !== phase.id || item.reportId !== report.id) continue
      if (normalized && !item.name.toLowerCase().includes(normalized) && !item.automatedTestId.toLowerCase().includes(normalized)) continue
      matched.push(item)
      if (item.status === 'passed') passedCount += 1
      else if (item.status === 'failed') failedCount += 1
      else if (item.status === 'running') runningCount += 1
    }
    return { tests: matched, passed: passedCount, failed: failedCount, running: runningCount }
  }, [data.results, phase.id, report.id, query])

  return (
    <>
      <div className="back-link" onClick={() => navigate({ page: 'reports', phaseId: phase.id, phase })}><ArrowLeftOutlined /> Back to {phase.name}</div>
      <div className="report-header">
        <div>
          <Text className="eyebrow">REPORT · {formatDate(report.createdAt, true).toUpperCase()}</Text>
          <Title level={1}>{report.name}</Title>
          <Space>
            <Tag color={envColors[phase.environment]}>{phase.environment}</Tag>
            <Text type="secondary">{phase.name}</Text>
            <span className="dot-separator">·</span>
            <Text type="secondary">Created by {report.author}</Text>
          </Space>
        </div>
        <Button icon={<ReloadOutlined />} onClick={reload}>Refresh results</Button>
      </div>
      <Row gutter={[12, 12]} className="stats-row">
        <Col xs={12} sm={6}><Card><Statistic title="Total tests" value={tests.length} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Passed" value={passed} valueStyle={statValueStyles.passed} prefix={<CheckCircleFilled />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Failed" value={failed} valueStyle={statValueStyles.failed} prefix={<ExclamationCircleFilled />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Running" value={running} valueStyle={statValueStyles.running} prefix={<ReloadOutlined />} /></Card></Col>
      </Row>
      <div className="toolbar report-toolbar">
        <Input prefix={<SearchOutlined />} placeholder="Search tests" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Text type="secondary">Showing <strong>{tests.length}</strong> results</Text>
      </div>
      <Card className="table-card test-table-card" styles={{ body: cardBody }}>
        <Table rowKey="id" columns={columns} dataSource={tests} pagination={false} expandable={{ expandedRowRender, expandIcon }} locale={{ emptyText }} />
      </Card>
    </>
  )
}

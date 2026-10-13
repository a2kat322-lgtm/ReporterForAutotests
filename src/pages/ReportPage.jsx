import { useMemo, useState } from 'react'
import { Button, Card, Col, Descriptions, Empty, Input, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CheckCircleFilled, ClockCircleOutlined, DownOutlined, ExclamationCircleFilled, FileTextOutlined, ReloadOutlined, SearchOutlined, StopFilled, WarningFilled } from '@ant-design/icons'
import StatusTag from '../components/StatusTag'
import { envColors } from '../constants'
import { formatDate, formatDuration } from '../utils/format'

const { Title, Text } = Typography

const cardBody = { padding: 0 }
const emptyText = <Empty description="No matching tests" />
const expandIcon = () => null

function RunDetails({ test }) {
  return (
    <Descriptions size="small" column={2} className="run-details">
      <Descriptions.Item label="Result path"><Text code>{test.path}</Text></Descriptions.Item>
      <Descriptions.Item label="Owner">{test.owner || '—'}</Descriptions.Item>
      <Descriptions.Item label="Circuit">{test.circuit || '—'}</Descriptions.Item>
      <Descriptions.Item label="Responsibility">{test.fullResponsibility || '—'}</Descriptions.Item>
      <Descriptions.Item label="Window">{formatDate(test.startDate, true)} → {formatDate(test.endDate, true)}</Descriptions.Item>
      <Descriptions.Item label="Tags">
        {test.tags?.length ? <Space size={4} wrap>{test.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> : '—'}
      </Descriptions.Item>
      {test.message ? (
        <Descriptions.Item label="Message" span={2}>
          <Text type={test.status === 'passed' ? 'secondary' : 'danger'}>{test.message}</Text>
        </Descriptions.Item>
      ) : null}
    </Descriptions>
  )
}

const expandedRowRender = (test) => (test.status === 'no_run'
  ? <Text type="secondary">No run covers this report date yet.</Text>
  : <RunDetails test={test} />)

const columns = [
  {
    title: 'AUTOMATED TEST',
    dataIndex: 'name',
    render: (name, test) => (
      <div className="test-name">
        <span className="test-status-dot" data-status={test.status}></span>
        <div>
          <Text strong>{name}</Text>
          {test.suiteName ? <Tag style={{ marginLeft: 8 }}>{test.suiteName}</Tag> : null}
          {!test.inCatalog ? <Tag color="orange" style={{ marginLeft: 8 }}>unregistered</Tag> : null}
          <div><Text type="secondary" className="phase-id">{test.path}</Text></div>
        </div>
      </div>
    ),
  },
  { title: 'STATUS', dataIndex: 'status', width: 110, render: (status) => <StatusTag status={status} /> },
  { title: 'OWNER', dataIndex: 'owner', width: 130, render: (value) => <Text type="secondary">{value || '—'}</Text> },
  { title: 'DURATION', dataIndex: 'durationMs', width: 110, render: (value) => <Text type="secondary">{formatDuration(value)}</Text> },
  { title: 'START', dataIndex: 'startDate', width: 160, render: (value) => <Text type="secondary">{formatDate(value, true)}</Text> },
  { title: '', width: 50, render: () => <DownOutlined className="expand-icon" /> },
]

const statValueStyles = {
  passed: { color: '#4ade80' },
  failed: { color: '#fb7185' },
  broken: { color: '#fbbf24' },
  skipped: { color: '#9ca0af' },
  no_run: { color: '#9ca0af' },
}

export default function ReportPage({ data, phase, report, navigate, reload }) {
  const [query, setQuery] = useState('')

  // GET /reports/:id/results already returns the merged view: every catalog
  // test plus the latest run covering the report date (`no_run` otherwise),
  // and unregistered runs tagged with inCatalog = false.
  const { tests, counts } = useMemo(() => {
    const normalized = query.toLowerCase()
    const matched = []
    const tally = { passed: 0, failed: 0, broken: 0, skipped: 0, no_run: 0 }
    for (const row of data.results) {
      if (normalized
        && !row.name.toLowerCase().includes(normalized)
        && !row.path.toLowerCase().includes(normalized)) continue
      matched.push(row)
      if (tally[row.status] !== undefined) tally[row.status] += 1
    }
    return { tests: matched, counts: tally }
  }, [data.results, query])

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
        <Col xs={12} sm={8}><Card><Statistic title="Total tests" value={tests.length} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Passed" value={counts.passed} valueStyle={statValueStyles.passed} prefix={<CheckCircleFilled />} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Failed" value={counts.failed} valueStyle={statValueStyles.failed} prefix={<ExclamationCircleFilled />} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Broken" value={counts.broken} valueStyle={statValueStyles.broken} prefix={<StopFilled />} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Skipped" value={counts.skipped} valueStyle={statValueStyles.skipped} prefix={<WarningFilled />} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="No run" value={counts.no_run} valueStyle={statValueStyles.no_run} prefix={<ClockCircleOutlined />} /></Card></Col>
      </Row>
      <div className="toolbar report-toolbar">
        <Input prefix={<SearchOutlined />} placeholder="Search tests by name or result path" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Text type="secondary">Showing <strong>{tests.length}</strong> results</Text>
      </div>
      <Card className="table-card test-table-card" styles={{ body: cardBody }}>
        <Table rowKey="rowKey" columns={columns} dataSource={tests} pagination={false} expandable={{ expandedRowRender, expandIcon }} locale={{ emptyText }} />
      </Card>
    </>
  )
}

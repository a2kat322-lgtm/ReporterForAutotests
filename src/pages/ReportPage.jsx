import { useMemo, useState } from 'react'
import { Button, Card, Descriptions, Empty, Input, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, BarChartOutlined, DownOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import StatusTag from '../components/StatusTag'
import { envColors } from '../constants'
import { formatDate, formatDuration } from '../utils/format'

const { Title, Text } = Typography

const cardBody = { padding: 0 }
const emptyText = <Empty description="No matching tests" />
const suiteFallback = 'Unassigned suite'

const statusOrder = ['passed', 'failed', 'broken', 'skipped', 'no_run']

const suiteStatusColors = {
  passed: '#4ade80',
  failed: '#fb7185',
  broken: '#fbbf24',
  skipped: '#818596',
  no_run: '#3a3d4d',
}

function SuiteStatusBadges({ tests }) {
  const counts = new Map()
  for (const test of tests) counts.set(test.status, (counts.get(test.status) || 0) + 1)
  return (
    <Space size={6} wrap>
      {statusOrder
        .filter((status) => counts.has(status))
        .map((status) => (
          <Tooltip key={status} title={countLabel(counts.get(status), statusLabel(status))}>
            <span className="suite-status-badge" style={{ backgroundColor: suiteStatusColors[status] }} data-status={status}>
              {counts.get(status)}
            </span>
          </Tooltip>
        ))}
    </Space>
  )
}

function statusLabel(status) {
  return status.replace('_', ' ')
}

function countLabel(count, label) {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function getDurationMs(test) {
  if (Number.isFinite(test.durationMs)) return test.durationMs
  if (!test.startDate || !test.endDate) return null

  const start = new Date(test.startDate).getTime()
  const end = new Date(test.endDate).getTime()
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null
}

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

const caseColumns = [
  {
    title: 'CASE NAME',
    dataIndex: 'caseName',
    render: (caseName, test) => (
      <div className="test-name">
        <span className="test-status-dot" data-status={test.status}></span>
        <div>
          <Text strong>{caseName || test.name}</Text>
          {!test.inCatalog ? <Tag color="orange" style={{ marginLeft: 8 }}>unregistered</Tag> : null}
          <div><Text type="secondary" className="phase-id">{test.path}</Text></div>
        </div>
      </div>
    ),
  },
  { title: 'STATUS', dataIndex: 'status', width: 110, render: (status) => <StatusTag status={status} /> },
  { title: 'OWNER', dataIndex: 'owner', width: 130, render: (value) => <Text type="secondary">{value || '—'}</Text> },
  { title: 'DURATION', dataIndex: 'durationMs', width: 110, render: (value, test) => <Text type="secondary">{formatDuration(getDurationMs(test))}</Text> },
  { title: '', width: 50, render: () => <DownOutlined className="expand-icon" /> },
]

const suiteColumns = [
  {
    title: 'SUITE',
    dataIndex: 'suiteName',
    render: (suiteName, suite) => (
      <Space size={12} wrap>
        <Text strong>{suiteName || suiteFallback} <Text type="secondary">({suite.tests.length})</Text></Text>
        <SuiteStatusBadges tests={suite.tests} />
      </Space>
    ),
  },
]

const resultSegments = [
  { key: 'passed', label: 'Passed', color: '#4ade80' },
  { key: 'failed', label: 'Failed', color: '#fb7185' },
  { key: 'broken', label: 'Broken', color: '#fbbf24' },
  { key: 'skipped', label: 'Skipped', color: '#9ca0af' },
  { key: 'no_run', label: 'No run', color: '#525565' },
]

function ResultsChart({ counts, total }) {
  let offset = 0
  const segments = resultSegments.map((segment) => {
    const value = counts[segment.key]
    const dash = total ? `${(value / total) * 100} ${100 - (value / total) * 100}` : '0 100'
    const currentOffset = offset
    offset += total ? (value / total) * 100 : 0
    return { ...segment, value, dash, offset: -currentOffset }
  })
  const passedRate = total ? Math.round((counts.passed / total) * 100) : 0

  return (
    <Card className="results-chart-card">
      <div className="results-chart">
        <div className="results-donut" role="img" aria-label={`Test results: ${resultSegments.map(({ label, key }) => `${label} ${counts[key]}`).join(', ')}`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="results-donut-track" cx="60" cy="60" r="48" />
            {segments.map(({ key, color, dash, offset: dashOffset }) => (
              <circle key={key} cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="12" strokeDasharray={dash} strokeDashoffset={dashOffset} pathLength="100" />
            ))}
          </svg>
          <div className="results-donut-center"><strong>{passedRate}%</strong><span>passed</span></div>
        </div>
        <div className="results-legend">
          <div className="results-legend-title">Test results <span>{total} total</span></div>
          {segments.map(({ key, label, color, value }) => (
            <div className="results-legend-row" key={key}>
              <span className="results-legend-label"><i style={{ backgroundColor: color }} />{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function ReportPage({ data, phase, report, navigate, reload }) {
  const [query, setQuery] = useState('')

  // GET /reports/:id/results returns the merged view: every catalog test plus
  // the latest run overlapping the report date range (`no_run` otherwise),
  // and unregistered runs tagged with inCatalog = false.
  const { tests, suites, counts } = useMemo(() => {
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
    const suites = []
    const suitesByName = new Map()
    for (const test of matched) {
      const suiteName = test.suiteName || suiteFallback
      let suite = suitesByName.get(suiteName)
      if (!suite) {
        suite = { key: `suite-${suites.length}`, suiteName, tests: [] }
        suitesByName.set(suiteName, suite)
        suites.push(suite)
      }
      suite.tests.push(test)
    }
    return { tests: matched, suites, counts: tally }
  }, [data.results, query])

  return (
    <>
      <div className="back-link" onClick={() => navigate({ page: 'reports', phaseId: phase.id, phase })}><ArrowLeftOutlined /> Back to {phase.name}</div>
      <div className="report-header">
        <div>
          <Text className="eyebrow">REPORT · {formatDate(report.startDate)} — {formatDate(report.endDate)}</Text>
          <Title level={1}>{report.name}</Title>
          <Space>
            <Tag color={envColors[phase.environment]}>{phase.environment}</Tag>
            <Text type="secondary">{phase.name}</Text>
            <span className="dot-separator">·</span>
            <Text type="secondary">Created by {report.author}</Text>
          </Space>
        </div>
        <Space>
          <Button icon={<BarChartOutlined />} onClick={() => navigate({ page: 'analytics', phaseId: phase.id, reportId: report.id, phase, report })}>Open analytics</Button>
          <Button icon={<ReloadOutlined />} onClick={reload}>Refresh results</Button>
        </Space>
      </div>
      <ResultsChart counts={counts} total={tests.length} />
      <div className="toolbar report-toolbar">
        <Input prefix={<SearchOutlined />} placeholder="Search tests by name or result path" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Text type="secondary">Showing <strong>{tests.length}</strong> cases in <strong>{suites.length}</strong> suites</Text>
      </div>
      <Card className="table-card test-table-card" styles={{ body: cardBody }}>
        <Table
          rowKey="key"
          columns={suiteColumns}
          dataSource={suites}
          pagination={false}
          expandable={{
            expandedRowRender: (suite) => (
              <Table
                className="suite-cases-table"
                rowKey="rowKey"
                columns={caseColumns}
                dataSource={suite.tests}
                pagination={false}
                expandable={{ expandedRowRender }}
                locale={{ emptyText }}
              />
            ),
          }}
          locale={{ emptyText }}
        />
      </Card>
    </>
  )
}

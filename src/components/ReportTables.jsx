import { useState } from 'react'
import { Empty, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import StatusTag from './StatusTag'
import RunDetails from './RunDetails'
import { FailureFeedbackFields } from './RunDetails'
import { formatDuration } from '../utils/format'

const { Text } = Typography

const emptyText = <Empty description="Нет подходящих тестов" />
const suiteFallback = 'Без набора'

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

const expandedRowRender = (test, reload) => (test.status === 'no_run'
  ? <Text type="secondary">Этот отчёт пока не покрыт ни одним запуском.</Text>
  : <RunDetails test={test} reload={reload} />)

const getCaseColumns = (reload) => [
  {
    title: 'НАЗВАНИЕ КЕЙСА',
    dataIndex: 'caseName',
    render: (caseName, test) => (
      <div className="test-name">
        <span className="test-status-dot" data-status={test.status}></span>
        <div>
          <Text strong>{caseName || test.name}</Text>
          {!test.inCatalog ? <Tag color="orange" style={{ marginLeft: 8 }}>не зарегистрирован</Tag> : null}
          <div><Text type="secondary" className="phase-id">{test.path}</Text></div>
        </div>
      </div>
    ),
  },
  { title: 'СТАТУС', dataIndex: 'status', width: 110, render: (status) => <StatusTag status={status} /> },
  { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: 130, render: (value) => <Text type="secondary">{value || '—'}</Text> },
  { title: 'ДЛИТЕЛЬНОСТЬ', dataIndex: 'durationMs', width: 110, render: (value, test) => <Text type="secondary">{formatDuration(getDurationMs(test))}</Text> },
  {
    title: 'ОБРАТНАЯ СВЯЗЬ ПО ПАДЕНИЮ',
    width: 390,
    render: (_, test) => (test.status === 'failed' || test.status === 'broken'
      ? <FailureFeedbackFields test={test} reload={reload} compact />
      : null),
  },
  { title: '', width: 50, render: () => <DownOutlined className="expand-icon" /> },
]

const suiteColumns = [
  {
    title: 'НАБОР',
    dataIndex: 'suiteName',
    render: (suiteName, suite) => (
      <Space size={12} wrap>
        <Text strong>{suiteName || suiteFallback} <Text type="secondary">({suite.tests.length})</Text></Text>
        <SuiteStatusBadges tests={suite.tests} />
      </Space>
    ),
  },
]

export function CaseTable({ tests, reload }) {
  const [expandedKeys, setExpandedKeys] = useState([])

  return (
    <Table
      className="suite-cases-table"
      rowKey="rowKey"
      columns={getCaseColumns(reload)}
      dataSource={tests}
      pagination={false}
      onRow={(test) => ({
        onClick: (event) => {
          if (event.target.closest('.ant-table-row-expand-icon')) return
          setExpandedKeys((keys) => keys.includes(test.rowKey)
            ? keys.filter((key) => key !== test.rowKey)
            : [...keys, test.rowKey])
        },
        style: { cursor: 'pointer' },
      })}
      expandable={{ expandedRowKeys: expandedKeys, onExpandedRowsChange: setExpandedKeys, expandedRowRender: (test) => expandedRowRender(test, reload) }}
      locale={{ emptyText }}
    />
  )
}

export function SuiteTable({ suites, reload }) {
  const [expandedKeys, setExpandedKeys] = useState([])

  return (
    <Table
      rowKey="key"
      columns={suiteColumns}
      dataSource={suites}
      pagination={false}
      onRow={(suite) => ({
        onClick: (event) => {
          // Let the built-in expand control handle its own click.
          if (event.target.closest('.ant-table-row-expand-icon')) return
          setExpandedKeys((keys) => keys.includes(suite.key)
            ? keys.filter((key) => key !== suite.key)
            : [...keys, suite.key])
        },
        style: { cursor: 'pointer' },
      })}
      expandable={{
        expandedRowKeys: expandedKeys,
        onExpandedRowsChange: setExpandedKeys,
        expandedRowRender: (suite) => <CaseTable tests={suite.tests} reload={reload} />,
      }}
      locale={{ emptyText }}
    />
  )
}

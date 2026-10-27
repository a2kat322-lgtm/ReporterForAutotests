import { useMemo, useState } from 'react'
import { Empty, Popover, Space, Table, Tag, Tooltip, Typography } from 'antd'
import StatusTag from './StatusTag'
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
    <Space size={10} wrap>
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

const INLINE_MESSAGE_LINE_LENGTH = 40
const INLINE_MESSAGE_MAX_LENGTH = INLINE_MESSAGE_LINE_LENGTH * 3
// Above this many cases the nested table virtualizes its rows; below it the
// plain table keeps its natural height.
const CASE_VIRTUAL_THRESHOLD = 150
const CASE_SCROLL = { x: 1210, y: 520 }

function splitFixedLength(text, length) {
  const lines = []
  for (let index = 0; index < text.length; index += length) lines.push(text.slice(index, index + length))
  return lines
}

function formatInlineErrorMessage(message) {
  const truncated = message.length > INLINE_MESSAGE_MAX_LENGTH
    ? `${message.slice(0, INLINE_MESSAGE_MAX_LENGTH).trimEnd()}...`
    : message

  return splitFixedLength(truncated, INLINE_MESSAGE_LINE_LENGTH)
}

const getCaseColumns = (reload) => [
  {
    title: 'НАЗВАНИЕ КЕЙСА',
    dataIndex: 'caseName',
    width: 280,
    render: (caseName, test) => (
      <div className="test-name">
        <div>
          <Text strong>{caseName || test.name}</Text>
          {!test.inCatalog ? <Tag color="orange" style={{ marginLeft: 8 }}>не зарегистрирован</Tag> : null}
          <div><Text type="secondary" className="phase-id">{test.path}</Text></div>
          {test.message ? (
            <Popover
              title="Сообщение об ошибке"
              content={<div className="test-message-popover">{test.message}</div>}
              trigger="click"
              placement="bottomLeft"
            >
              <span className="test-inline-message" title="Нажмите, чтобы посмотреть сообщение целиком">
                {formatInlineErrorMessage(test.message).map((line, index) => (
                  <span key={`${line}-${index}`} className="test-inline-message-line">{line}</span>
                ))}
              </span>
            </Popover>
          ) : null}
        </div>
      </div>
    ),
  },
  { title: 'СТАТУС', dataIndex: 'status', width: 110, render: (status) => <StatusTag status={status} /> },
  { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: 130, render: (value) => <Text type="secondary">{value || '—'}</Text> },
  { title: 'ДЛИТЕЛЬНОСТЬ', dataIndex: 'durationMs', width: 110, render: (value, test) => <Text type="secondary">{formatDuration(getDurationMs(test))}</Text> },
  {
    title: 'ТЕГИ',
    dataIndex: 'tags',
    width: 190,
    render: (tags = []) => {
      if (!tags.length) return <Text type="secondary">—</Text>
      const visibleTags = tags.slice(0, 2)
      const hiddenCount = tags.length - visibleTags.length
      return (
        <Space size={4} wrap>
          {visibleTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
          {hiddenCount > 0 ? <Tooltip title={tags.slice(2).join(', ')}><Tag>+{hiddenCount}</Tag></Tooltip> : null}
        </Space>
      )
    },
  },
  {
    title: 'ОБРАТНАЯ СВЯЗЬ ПО ПАДЕНИЮ',
    width: 390,
    render: (_, test) => (test.status === 'failed' || test.status === 'broken'
      ? <div className="failure-feedback-cell"><FailureFeedbackFields test={test} reload={reload} compact /></div>
      : null),
  },
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
  // `getCaseColumns` closes over `reload`; without the memo antd Table gets a
  // brand-new column set (and re-renders every row) on each parent render.
  const columns = useMemo(() => getCaseColumns(reload), [reload])
  const virtual = tests.length > CASE_VIRTUAL_THRESHOLD

  return (
    <Table
      className="suite-cases-table"
      rowKey="rowKey"
      columns={columns}
      dataSource={tests}
      pagination={false}
      virtual={virtual}
      scroll={virtual ? CASE_SCROLL : undefined}
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

import { Table, Typography } from 'antd'
import { formatDuration } from '../../../utils/format'
import { STATUS_COLORS } from '../constants'
import { pct } from '../utils'

const { Text } = Typography

// Static column set: rebuilt columns make antd Table re-render every row.
const columns = [
  { title: 'НАБОР', dataIndex: 'suiteName', width: 220, render: (name) => <Text ellipsis={{ tooltip: name }}>{name}</Text> },
  { title: 'ВСЕГО', dataIndex: 'total', width: 74, align: 'right', sorter: (a, b) => a.total - b.total },
  { title: 'FAIL+BROKEN', key: 'failed', width: 112, align: 'right', sorter: (a, b) => (a.failed + a.broken) - (b.failed + b.broken), render: (_, row) => <span style={{ color: STATUS_COLORS.failed }}>{row.failed + row.broken}</span> },
  { title: 'NO RUN', dataIndex: 'no_run', width: 82, align: 'right', sorter: (a, b) => a.no_run - b.no_run },
  { title: 'PASS RATE', dataIndex: 'passRate', width: 100, align: 'right', sorter: (a, b) => a.passRate - b.passRate, render: pct },
  { title: 'P90', dataIndex: 'p90', width: 100, align: 'right', sorter: (a, b) => (a.p90 || 0) - (b.p90 || 0), render: formatDuration },
]

const scroll = { x: 720, y: 300 }

export default function SuiteTable({ suites }) {
  return <Table rowKey="suiteName" size="small" columns={columns} dataSource={suites} pagination={false} scroll={scroll} />
}

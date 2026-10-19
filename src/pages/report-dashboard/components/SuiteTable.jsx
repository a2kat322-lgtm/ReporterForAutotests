import { Table, Typography } from 'antd'
import { formatDuration } from '../../../utils/format'
import { showRate } from '../utils'

const { Text } = Typography

export default function SuiteTable({ suites }) {
  const columns = [
    { title: 'НАБОР', dataIndex: 'name', width: 128, render: (name) => <Text ellipsis={{ tooltip: name }}>{name}</Text> },
    { title: 'ВСЕГО', dataIndex: 'total', width: 56, align: 'right', sorter: (a, b) => a.total - b.total },
    { title: 'PASS RATE', dataIndex: 'passRate', width: 78, align: 'right', sorter: (a, b) => (a.passRate || 0) - (b.passRate || 0), render: showRate },
    { title: 'FAIL+BROKEN', key: 'failed', width: 90, align: 'right', sorter: (a, b) => (a.failed + a.broken) - (b.failed + b.broken), render: (_, row) => <span style={{ color: '#fb7185' }}>{row.failed + row.broken}</span> },
    { title: 'NO RUN', dataIndex: 'noRun', width: 68, align: 'right', sorter: (a, b) => a.noRun - b.noRun },
    { title: 'P90', dataIndex: 'p90', width: 100, align: 'right', sorter: (a, b) => (a.p90 || 0) - (b.p90 || 0), render: formatDuration },
  ]
  return <Table rowKey="name" size="small" tableLayout="fixed" columns={columns} dataSource={suites} pagination={false} scroll={{ x: 520, y: 420 }} />
}

import { Table, Typography } from 'antd'
import { STATUS_COLORS } from '../constants'
import { pct } from '../utils'

const { Text } = Typography

export default function OwnerTable({ owners }) {
  const columns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: 170, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    { title: 'ВСЕГО', dataIndex: 'total', width: 74, align: 'right', sorter: (a, b) => a.total - b.total },
    { title: 'PASS', dataIndex: 'passed', width: 70, align: 'right', sorter: (a, b) => a.passed - b.passed, render: (value) => <span style={{ color: STATUS_COLORS.passed }}>{value}</span> },
    { title: 'FAIL+BROKEN', key: 'failed', width: 112, align: 'right', sorter: (a, b) => (a.failed + a.broken) - (b.failed + b.broken), render: (_, row) => <span style={{ color: STATUS_COLORS.failed }}>{row.failed + row.broken}</span> },
    { title: 'NO RUN', dataIndex: 'no_run', width: 82, align: 'right', sorter: (a, b) => a.no_run - b.no_run },
    { title: 'PASS RATE', dataIndex: 'passRate', width: 100, align: 'right', sorter: (a, b) => a.passRate - b.passRate, render: pct },
    { title: 'FLAKY', dataIndex: 'flaky', width: 76, align: 'right', sorter: (a, b) => a.flaky - b.flaky },
    { title: 'АНАЛИЗ', dataIndex: 'analysisRate', width: 86, align: 'right', sorter: (a, b) => a.analysisRate - b.analysisRate, render: pct },
  ]

  return <Table rowKey="owner" size="small" columns={columns} dataSource={owners} pagination={false} scroll={{ x: 800, y: 300 }} />
}

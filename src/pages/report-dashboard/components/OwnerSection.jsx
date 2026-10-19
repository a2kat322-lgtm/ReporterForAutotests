import { Card, Table, Tag, Typography } from 'antd'
import { formatDuration } from '../../../utils/format'
import OwnerStackedBar from './OwnerStackedBar'

const { Text } = Typography

export default function OwnerSection({ owners, ownerStackData }) {
  const ownerColWidth = Math.min(Math.max(8, ...owners.map((row) => row.owner.length)) * 8 + 48, 300)
  const columns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: ownerColWidth, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    {
      title: 'PASSED',
      key: 'passed',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.counts.passed - b.counts.passed,
      render: (_, row) => {
        const percent = row.total ? Math.round(row.counts.passed / row.total * 100) : 0
        return row.counts.passed ? <Tag color="green">{row.counts.passed} · {percent}%</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'FAIL+BROKEN',
      key: 'failed',
      width: 124,
      align: 'right',
      sorter: (a, b) => (a.counts.failed + a.counts.broken) - (b.counts.failed + b.counts.broken),
      render: (_, row) => {
        const failed = row.counts.failed + row.counts.broken
        const percent = row.total ? Math.round(failed / row.total * 100) : 0
        return failed ? <Tag color="red">{failed} · {percent}%</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'SKIPPED',
      key: 'skipped',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.counts.skipped - b.counts.skipped,
      render: (_, row) => row.counts.skipped ? <Tag>{row.counts.skipped}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'NO RUN',
      key: 'no_run',
      width: 88,
      align: 'right',
      sorter: (a, b) => a.counts.no_run - b.counts.no_run,
      render: (_, row) => row.counts.no_run ? <Tag>{row.counts.no_run}</Tag> : <Text type="secondary">—</Text>,
    },
    { title: 'ВСЕГО', dataIndex: 'total', width: 76, align: 'right', render: (total) => <Tag>{total}</Tag> },
    { title: 'P90', dataIndex: 'p90', width: 92, align: 'right', render: formatDuration },
    { title: 'FLAKY', dataIndex: 'flaky', width: 78, align: 'right', render: (value) => value ? <Tag color="orange">{value}</Tag> : <Text type="secondary">—</Text> },
  ]

  return (
    <Card title="Тесты по владельцам" className="analytics-card" extra={<Text type="secondary">доля статусов на владельца</Text>}>
      <OwnerStackedBar data={ownerStackData} />
      <Table rowKey="owner" tableLayout="fixed" columns={columns} dataSource={owners} pagination={false} size="small" scroll={{ x: 900 }} />
    </Card>
  )
}

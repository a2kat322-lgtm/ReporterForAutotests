import { Card, Empty, Table, Typography } from 'antd'
import RunHistory from './RunHistory'
import StatusBadge from './StatusBadge'
import { showRate, stability } from '../utils'

const { Text } = Typography

export default function FlakyTable({ tests, retryFixed, regressed }) {
  const columns = [
    {
      title: 'ТЕСТ',
      dataIndex: 'name',
      render: (name, test) => (
        <div className="analytics-test-cell">
          <Text strong ellipsis={{ tooltip: test.path }}>{name || test.caseName}</Text>
          <Text type="secondary" ellipsis={{ tooltip: test.path }}>{test.path}</Text>
        </div>
      ),
    },
    { title: 'ЗАПУСКОВ', dataIndex: 'runCount', width: 96, align: 'right', sorter: (a, b) => (a.runCount || 0) - (b.runCount || 0), render: (value) => value ?? 0 },
    { title: 'СТАБИЛЬНОСТЬ', key: 'stability', width: 120, align: 'right', sorter: (a, b) => (stability(a) || 0) - (stability(b) || 0), render: (_, test) => showRate(stability(test)) },
    { title: 'ПОСЛЕДНИЕ ЗАПУСКИ', key: 'history', width: 150, render: (_, test) => <RunHistory statuses={test.recentStatuses || []} /> },
    { title: 'ПОСЛЕДНИЙ', dataIndex: 'latestStatus', width: 120, render: (status) => <StatusBadge status={status} /> },
  ]
  return (
    <Card
      title="Флаки и ретраи"
      className="analytics-card"
      extra={<Text type="secondary">исправлено ретраем: {retryFixed} · регресс: {regressed}</Text>}
    >
      {tests.length ? <Table rowKey="path" size="small" tableLayout="fixed" columns={columns} dataSource={tests} pagination={false} scroll={{ x: 820, y: 320 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Флаки не обнаружены" />}
    </Card>
  )
}

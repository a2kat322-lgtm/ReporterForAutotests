import { Card, Table, Typography } from 'antd'
import { formatDuration } from '../../../utils/format'
import StatusBadge from './StatusBadge'

const { Text } = Typography

export default function SlowTests({ tests }) {
  const columns = [
    { title: 'ТЕСТ', dataIndex: 'name', render: (name, test) => <div><Text strong>{name || test.caseName}</Text><div><Text type="secondary">{test.path}</Text></div></div> },
    { title: 'СТАТУС', dataIndex: 'status', width: 110, render: (status) => <StatusBadge status={status} /> },
    { title: 'ДЛИТЕЛЬНОСТЬ', dataIndex: 'durationMs', width: 120, render: formatDuration },
  ]

  return (
    <Card title="Самые медленные тест-кейсы" className="analytics-card">
      <Table rowKey={(test) => test.rowKey || test.path} tableLayout="fixed" columns={columns} dataSource={tests} pagination={false} size="small" locale={{ emptyText: 'Нет данных о времени' }} />
    </Card>
  )
}

import { Card, Empty, Table, Tag, Typography } from 'antd'
import { formatDate } from '../../../utils/format'
import StatusBadge from './StatusBadge'

const { Text } = Typography

export default function StaleGreenTable({ tests }) {
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
    { title: 'ПОСЛЕДНИЙ СТАТУС', dataIndex: 'latestStatus', width: 120, render: (status) => <StatusBadge status={status} /> },
    { title: 'ПОСЛЕДНИЙ ЗАПУСК', dataIndex: 'latestStartDate', width: 150, render: (value) => formatDate(value, true) },
    { title: 'ПРИЧИНА', dataIndex: 'latestFailureReason', width: 140, render: (reason) => reason ? <Tag color="orange">{reason}</Tag> : <Text type="secondary">—</Text> },
    { title: 'СООБЩЕНИЕ', dataIndex: 'latestMessage', render: (message) => message ? <Text ellipsis={{ tooltip: message }}>{message}</Text> : <Text type="secondary">—</Text> },
    { title: 'ЗАПУСКОВ', dataIndex: 'runCount', width: 90, align: 'right', render: (value) => value ?? 0 },
  ]
  return (
    <Card
      title="Stale green"
      className="analytics-card"
      extra={<Text type="secondary">отчёт показывает passed, но последний запуск — failed/broken</Text>}
    >
      {tests.length ? <Table rowKey="path" size="small" tableLayout="fixed" columns={columns} dataSource={tests} pagination={false} scroll={{ x: 980 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Все зелёные результаты подтверждены последним запуском" />}
    </Card>
  )
}

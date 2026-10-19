import { Empty, Table, Tag, Typography } from 'antd'
import { pct } from '../utils'

const { Text } = Typography

export default function FailureReasons({ failures }) {
  if (!failures.totalFailures) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе нет упавших запусков" />
  }

  const columns = [
    { title: 'РЕЗУЛЬТАТ АНАЛИЗА', dataIndex: 'reason', render: (reason) => reason === '(null)' ? <Text type="secondary">null (не указано)</Text> : reason },
    { title: 'КОЛ-ВО', dataIndex: 'count', width: 84, align: 'right', sorter: (a, b) => a.count - b.count, render: (value) => <Tag color="red">{value}</Tag> },
    { title: 'ДОЛЯ', dataIndex: 'share', width: 76, align: 'right', sorter: (a, b) => a.share - b.share, render: pct },
  ]

  return <Table rowKey="reason" size="small" columns={columns} dataSource={failures.reasons} pagination={false} scroll={{ y: 300 }} />
}

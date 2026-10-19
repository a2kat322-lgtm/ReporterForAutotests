import { Empty, Table, Tag, Typography } from 'antd'
import { pct } from '../utils'

const { Text } = Typography

export default function FailureSignatures({ failures }) {
  if (!failures.totalFailures) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе нет упавших запусков" />
  }

  const columns = [
    {
      title: 'ПОДПИСЬ ОШИБКИ',
      dataIndex: 'signature',
      render: (signature, row) => (
        <div className="phase-failure-signature">
          <Text ellipsis={{ tooltip: row.message }}>{signature}</Text>
          <Text type="secondary" ellipsis={{ tooltip: row.message }}>{row.message}</Text>
        </div>
      ),
    },
    { title: 'КОЛ-ВО', dataIndex: 'count', width: 84, align: 'right', sorter: (a, b) => a.count - b.count, render: (value) => <Tag color="red">{value}</Tag> },
    { title: 'ДОЛЯ', dataIndex: 'share', width: 76, align: 'right', sorter: (a, b) => a.share - b.share, render: pct },
  ]

  return <Table rowKey="signature" size="small" columns={columns} dataSource={failures.signatures} pagination={false} scroll={{ y: 300 }} />
}

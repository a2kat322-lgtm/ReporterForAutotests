import { Card, Empty, Table, Tag, Typography } from 'antd'
import ErrorPareto from './ErrorPareto'
import { showRate } from '../utils'

const { Text } = Typography

export default function SignatureSection({ signatures, failedTotal }) {
  const columns = [
    {
      title: 'ПОДПИСЬ ОШИБКИ',
      dataIndex: 'signature',
      render: (signature, row) => (
        <div className="signature-cell">
          <Text ellipsis={{ tooltip: row.message }}>{signature}</Text>
          <Text type="secondary" ellipsis={{ tooltip: row.message }}>{row.message}</Text>
        </div>
      ),
    },
    { title: 'КОЛ-ВО', dataIndex: 'count', width: 84, align: 'right', sorter: (a, b) => a.count - b.count, render: (value) => <Tag color="red">{value}</Tag> },
    { title: 'ДОЛЯ', dataIndex: 'share', width: 76, align: 'right', sorter: (a, b) => a.share - b.share, render: (value) => showRate(Math.round(value * 100)) },
  ]
  return (
    <Card
      title="Подписи ошибок"
      className="analytics-card"
      extra={<Text type="secondary">Парето: столбцы — частота, линия — накопленная доля</Text>}
    >
      {failedTotal ? (
        <>
          <ErrorPareto data={signatures} />
          <Table rowKey="signature" size="small" tableLayout="fixed" columns={columns} dataSource={signatures} pagination={false} scroll={{ y: 240 }} />
        </>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В отчёте нет падений" />}
    </Card>
  )
}

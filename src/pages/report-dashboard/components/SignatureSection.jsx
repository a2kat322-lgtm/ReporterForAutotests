import { useState } from 'react'
import { Card, Empty, Table, Tag, Typography } from 'antd'
import ErrorPareto from './ErrorPareto'
import StatusBadge from './StatusBadge'
import { showRate } from '../utils'

const { Text } = Typography

// Collapsed the table is short; expanding a row removes the inner scroll so the
// tests list is fully visible without a nested scrollbar.
const COLLAPSED_HEIGHT = 148

function SignatureTests({ tests }) {
  const columns = [
    {
      title: 'ТЕСТ',
      dataIndex: 'name',
      render: (name, test) => (
        <div className="analytics-test-cell">
          <Text strong ellipsis={{ tooltip: test.name }}>{name}</Text>
          <Text type="secondary" ellipsis={{ tooltip: test.path }}>{test.path}</Text>
        </div>
      ),
    },
    { title: 'СТАТУС', dataIndex: 'status', width: 96, render: (status) => <StatusBadge status={status} /> },
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: 140, ellipsis: true },
  ]
  return (
    <Table
      className="signature-tests-table"
      rowKey="path"
      size="small"
      tableLayout="fixed"
      columns={columns}
      dataSource={tests}
      pagination={false}
    />
  )
}

export default function SignatureSection({ signatures, failedTotal }) {
  const [expandedKeys, setExpandedKeys] = useState([])
  const expanded = expandedKeys.length > 0

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
      extra={<Text type="secondary">Парето: столбцы — частота, линия — накопленная доля · клик по строке — тесты</Text>}
    >
      {failedTotal ? (
        <>
          <ErrorPareto data={signatures} />
          <Table
            className="signature-table"
            rowKey="signature"
            size="small"
            tableLayout="fixed"
            columns={columns}
            dataSource={signatures}
            pagination={false}
            scroll={expanded ? undefined : { y: COLLAPSED_HEIGHT }}
            expandable={{
              expandedRowKeys: expandedKeys,
              onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
              expandedRowRender: (row) => <SignatureTests tests={row.tests || []} />,
              rowExpandable: (row) => (row.tests?.length || 0) > 0,
              expandRowByClick: true,
            }}
          />
        </>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В отчёте нет падений" />}
    </Card>
  )
}

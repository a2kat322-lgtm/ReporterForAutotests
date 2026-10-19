import { Card, Col, Progress, Row, Table, Tag, Typography } from 'antd'

const { Text } = Typography

export default function AnalysisSection({ metrics }) {
  const needsAnalysis = metrics.owners.filter((row) => row.needsAnalysis > 0).map((row) => ({ ...row, key: row.owner }))
  const ownerColWidth = Math.min(Math.max(8, ...metrics.owners.map((row) => row.owner.length)) * 8 + 48, 300)
  const reasonColumns = [
    { title: 'РЕЗУЛЬТАТ АНАЛИЗА', dataIndex: 'reason', render: (reason) => reason === '(null)' ? <Text type="secondary">null (не указано)</Text> : <Text>{reason}</Text> },
    { title: 'КОЛ-ВО / %', key: 'countPercent', align: 'right', width: 130, render: (_, row) => {
      const percent = metrics.reasonTotal ? Math.round(row.count / metrics.reasonTotal * 100) : 0
      return <Tag color="red">{row.count} · {percent}%</Tag>
    } },
  ]
  const needsAnalysisColumns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: ownerColWidth, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    { title: 'НУЖЕН АНАЛИЗ', key: 'needsAnalysis', align: 'right', width: 150, render: (_, row) => {
      const percent = row.failed ? Math.round(row.needsAnalysis / row.failed * 100) : 0
      return <Tag color="orange">{row.needsAnalysis} · {percent}%</Tag>
    } },
  ]
  const feedbackColumns = [
    { title: 'ПРИЧИНА ПАДЕНИЯ', dataIndex: 'reason', width: 200, render: (reason) => reason || <Text type="secondary">Не указано</Text> },
    { title: 'КОММЕНТАРИЙ', dataIndex: 'comment', render: (comment) => comment || <Text type="secondary">Нет комментария</Text> },
    { title: 'КОЛИЧЕСТВО', dataIndex: 'count', width: 100, align: 'right', render: (count) => <Tag color="red">{count}</Tag> },
  ]

  return (
    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24} lg={8}>
        <Card
          title="Результаты анализа"
          className="analytics-card"
          extra={<Text type="secondary">разобрано {metrics.analysisDone} из {metrics.analysisTotal}</Text>}
        >
          <Progress
            percent={metrics.analysisTotal ? Math.round(metrics.analysisDone / metrics.analysisTotal * 100) : 0}
            strokeColor="#4ade80"
            trailColor="var(--track)"
          />
          <Table rowKey="reason" columns={reasonColumns} dataSource={metrics.reasons} pagination={false} size="small" locale={{ emptyText: 'Нет результатов анализа в упавших тестах' }} />
        </Card>
      </Col>
      <Col xs={24} lg={8}><Card title="Требует анализа" className="analytics-card"><Table rowKey="key" columns={needsAnalysisColumns} dataSource={needsAnalysis} pagination={false} size="small" locale={{ emptyText: 'Все упавшие тесты проанализированы' }} /></Card></Col>
      <Col xs={24} lg={8}><Card title="Обратная связь по падениям" className="analytics-card"><Table rowKey="key" columns={feedbackColumns} dataSource={metrics.failureFeedback} pagination={false} size="small" locale={{ emptyText: 'Нет причин падения или комментариев' }} /></Card></Col>
    </Row>
  )
}

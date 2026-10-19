import { Card, Empty, Typography } from 'antd'
import { ColumnChart } from '../../../components/charts'
import { formatDuration } from '../../../utils/format'

const { Text } = Typography

export default function FailureAgingChart({ aging }) {
  const data = aging.buckets || []
  return (
    <Card
      title="Возраст текущих падений"
      className="analytics-card"
      extra={<Text type="secondary">MTTR {formatDuration(aging.mttrMedianMs)} · n={aging.mttrCount}</Text>}
    >
      {aging.totalCurrentFailures ? (
        <ColumnChart rows={data} labelKey="label" valueKey="count" color="#fb7185" height={280} />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет текущих падений" />}
    </Card>
  )
}

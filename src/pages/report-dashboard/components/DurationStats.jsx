import { Card, Empty, Typography } from 'antd'
import { StackedBarChart } from '../../../components/charts'
import { formatDuration } from '../../../utils/format'
import { STATUS_SERIES } from '../constants'

const { Text } = Typography

export default function DurationStats({ metrics }) {
  return (
    <Card
      title="Длительность"
      className="analytics-card"
      extra={<Text type="secondary">{metrics.timed ? `${metrics.timed} запусков с временем` : 'нет данных'}</Text>}
    >
      {metrics.timed ? (
        <>
          <div className="duration-percentiles">
            {[['p50', metrics.p50], ['p90', metrics.p90], ['p95', metrics.p95], ['p99', metrics.p99]].map(([label, value]) => (
              <div className="duration-percentile" key={label}>
                <Text type="secondary">{label}</Text>
                <strong>{formatDuration(value)}</strong>
              </div>
            ))}
          </div>
          <StackedBarChart
            rows={metrics.durationBandData}
            labelKey="bucket"
            seriesKey="status"
            valueKey="count"
            series={STATUS_SERIES}
            height={240}
            labelLimit={6}
          />
        </>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных о длительности" />}
    </Card>
  )
}

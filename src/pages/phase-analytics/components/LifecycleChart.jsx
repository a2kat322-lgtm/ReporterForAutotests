import { Card, Empty, Typography } from 'antd'
import { DonutChart } from '../../../components/charts'
import { LIFECYCLE_META } from '../constants'

const { Text } = Typography

export default function LifecycleChart({ lifecycle, total }) {
  const data = LIFECYCLE_META.map((item) => ({ type: item.label, value: lifecycle[item.key] || 0 })).filter((item) => item.value > 0)
  return (
    <Card title="Lifecycle тестов" className="analytics-card" extra={<Text type="secondary">тестов в каталоге: {total}</Text>}>
      {data.length ? (
        <DonutChart
          rows={data}
          labelKey="type"
          valueKey="value"
          colors={LIFECYCLE_META.map((item) => item.color)}
          height={280}
          centerLabel="Тестов"
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных о lifecycle" />}
    </Card>
  )
}

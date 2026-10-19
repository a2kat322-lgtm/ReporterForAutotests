import { Card, Empty, Typography } from 'antd'
import { ColumnChart } from '../../../components/charts'

const { Text } = Typography

export default function StabilityChart({ data }) {
  return (
    <Card title="Стабильность тестов" className="analytics-card" extra={<Text type="secondary">по executed runs</Text>}>
      {data.some((item) => item.count > 0) ? (
        <ColumnChart rows={data} labelKey="band" valueKey="count" color="#8b5cf6" height={280} />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет запусков для оценки стабильности" />}
    </Card>
  )
}

import { Card, Empty, Typography } from 'antd'
import { ColumnChart } from '../../../components/charts'

const { Text } = Typography

export default function RetryChart({ data }) {
  return (
    <Card title="Запуски на тест" className="analytics-card" extra={<Text type="secondary">ретраи</Text>}>
      {data.some((item) => item.count > 0) ? (
        <ColumnChart rows={data} labelKey="band" valueKey="count" color="#38bdf8" height={280} />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет запусков" />}
    </Card>
  )
}

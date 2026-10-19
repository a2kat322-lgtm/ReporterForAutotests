import { Card, Empty, Typography } from 'antd'
import { LineChart } from '../../../components/charts'

const { Text } = Typography

export default function PhaseTrendChart({ reports }) {
  const data = reports.flatMap((report) => [
    { report: report.name, metric: 'Pass rate', value: Math.round(report.passRate * 100) },
    { report: report.name, metric: 'Coverage', value: Math.round(report.coverage * 100) },
  ])

  return (
    <Card title="Динамика прохождения и покрытия" className="analytics-card" extra={<Text type="secondary">по отчётам в хронологии</Text>}>
      {reports.length ? (
        <LineChart
          rows={data}
          labelKey="report"
          seriesKey="metric"
          valueKey="value"
          series={[
            { key: 'Pass rate', label: 'Pass rate', color: '#4ade80' },
            { key: 'Coverage', label: 'Coverage', color: '#a78bfa' },
          ]}
          height={300}
          yMax={100}
          valueFormatter={(value) => `${value}%`}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе ещё нет отчётов" />}
    </Card>
  )
}

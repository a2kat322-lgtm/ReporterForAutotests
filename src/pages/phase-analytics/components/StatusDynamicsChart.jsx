import { Card, Empty, Typography } from 'antd'
import { StackedBarChart } from '../../../components/charts'
import { CHART_STATUSES } from '../constants'

const { Text } = Typography

export default function StatusDynamicsChart({ reports }) {
  const data = reports.flatMap((report) => CHART_STATUSES.map((status) => ({
    report: report.name,
    status: status.label,
    count: report.counts[status.key] || 0,
  }))).filter((item) => item.count > 0)

  return (
    <Card title="Статусы по отчётам" className="analytics-card" extra={<Text type="secondary">стек по каждому отчёту</Text>}>
      {reports.length ? (
        <StackedBarChart
          rows={data}
          labelKey="report"
          seriesKey="status"
          valueKey="count"
          series={CHART_STATUSES.map((status) => ({ key: status.label, label: status.label, color: status.color }))}
          height={300}
          labelLimit={12}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе ещё нет отчётов" />}
    </Card>
  )
}

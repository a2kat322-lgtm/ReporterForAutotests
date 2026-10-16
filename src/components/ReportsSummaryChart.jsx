import { Card, Empty, Typography } from 'antd'

const segments = [
  { key: 'passed', label: 'Passed', color: '#4ade80' },
  { key: 'failed', label: 'Failed', color: '#fb7185' },
  { key: 'broken', label: 'Broken', color: '#fbbf24' },
  { key: 'skipped', label: 'Skipped', color: '#9ca0af' },
  { key: 'no_run', label: 'No run', color: '#525565' },
]

const { Text } = Typography

export default function ReportsSummaryChart({ reports, summaries }) {
  if (!reports.length) return null

  const summaryById = new Map(summaries.map((item) => [String(item.reportId), item]))
  const orderedReports = [...reports].sort((a, b) => {
    const dateOrder = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    if (dateOrder !== 0) return dateOrder
    const createdOrder = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (createdOrder !== 0) return createdOrder
    return Number(a.id) - Number(b.id)
  })
  const maxTotal = Math.max(...orderedReports.map((report) => summaryById.get(String(report.id))?.total || 0), 1)

  return (
    <Card title="Результаты по отчётам" className="reports-summary-card">
      {summaries.length ? (
        <div className="reports-summary-chart" role="img" aria-label="Количество результатов тестов по каждому отчёту">
          {orderedReports.map((report) => {
            const summary = summaryById.get(String(report.id)) || { counts: {}, total: 0 }
            return (
              <div className="reports-summary-row" key={report.id}>
                <div className="reports-summary-label" title={report.name}>{report.name}</div>
                <div className="reports-summary-bar" title={`${summary.total} тестов всего`}>
                  {segments.map(({ key, color, label }) => {
                    const value = summary.counts[key] || 0
                    if (!value) return null
                    const percentage = summary.total ? Math.round((value / summary.total) * 100) : 0
                    return (
                      <span
                        key={key}
                        className="reports-summary-segment"
                        style={{ width: `${(value / maxTotal) * 100}%`, backgroundColor: color }}
                        title={`${label}: ${value} (${percentage}%)`}
                      >
                        <span>{value} · {percentage}%</span>
                      </span>
                    )
                  })}
                </div>
                <Text type="secondary" className="reports-summary-total">{summary.total}</Text>
              </div>
            )
          })}
        </div>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока нет данных о результатах" />}
      <div className="reports-summary-legend">
        {segments.map(({ label, color }) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}
      </div>
    </Card>
  )
}

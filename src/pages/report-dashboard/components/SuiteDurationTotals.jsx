import { useMemo } from 'react'
import { Card, Empty, Typography } from 'antd'
import { formatDuration } from '../../../utils/format'

const { Text } = Typography

/**
 * One bar per suite: its length is the summed duration of every timed test in
 * the suite, so suites can be compared by the time they consume in a run.
 */
export default function SuiteDurationTotals({ suites }) {
  const rows = useMemo(
    () => [...suites].filter((suite) => suite.durationMs > 0).sort((left, right) => right.durationMs - left.durationMs),
    [suites],
  )
  const total = rows.reduce((sum, row) => sum + row.durationMs, 0)
  const max = rows.length ? rows[0].durationMs : 0

  return (
    <Card
      title="Суммарная длительность по наборам"
      className="analytics-card"
      extra={<Text type="secondary">{rows.length ? `всего ${formatDuration(total)}` : 'нет данных'}</Text>}
    >
      {rows.length ? (
        <div className="suite-totals" role="img" aria-label="Суммарная длительность тестов по наборам">
          {rows.map((row) => {
            const share = total ? Math.round((row.durationMs / total) * 100) : 0
            return (
              <div className="suite-totals-row" key={row.name}>
                <div className="suite-totals-label" title={row.name}>{row.name}</div>
                <div
                  className="suite-totals-track"
                  title={`${row.name}: ${formatDuration(row.durationMs)} · ${share}% времени отчёта · тестов с временем: ${row.timed} из ${row.total}`}
                >
                  <span className="suite-totals-bar" style={{ width: `${(row.durationMs / max) * 100}%` }} />
                </div>
                <div className="suite-totals-value">
                  <strong>{formatDuration(row.durationMs)}</strong>
                  <span>{row.timed} из {row.total} тестов</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных о длительности" />}
    </Card>
  )
}

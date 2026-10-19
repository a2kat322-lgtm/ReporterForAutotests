import { useMemo } from 'react'
import { EmptyChart, Legend } from './ChartPrimitives'
import { WIDTH, seriesFrom, truncate } from './chartUtils'

export function LineChart({ rows, labelKey = 'label', seriesKey = 'series', valueKey = 'value', series: providedSeries, height = 300, yMax = 100, valueFormatter = (value) => value }) {
  const series = useMemo(() => seriesFrom(rows, seriesKey, providedSeries), [rows, seriesKey, providedSeries])
  const labels = useMemo(() => [...new Set(rows.map((row) => row[labelKey]))], [rows, labelKey])
  const values = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const label = row[labelKey]
      const current = map.get(label) || new Map()
      current.set(row[seriesKey], Number(row[valueKey]) || 0)
      map.set(label, current)
    }
    return map
  }, [rows, labelKey, seriesKey, valueKey])

  if (!rows.length || !labels.length) return <EmptyChart label="Нет данных" />

  const margin = { top: 18, right: 18, bottom: 48, left: 44 }
  const plotWidth = WIDTH - margin.left - margin.right
  const plotHeight = Math.max(height - margin.top - margin.bottom, 40)
  const x = (index) => margin.left + (labels.length === 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth)
  const y = (value) => margin.top + plotHeight - (Math.max(0, Math.min(yMax, value)) / yMax) * plotHeight
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((part) => part * yMax)
  const labelStep = Math.max(1, Math.ceil(labels.length / 10))

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Линейный график">
        {ticks.map((tick) => {
          const py = y(tick)
          return (
            <g key={tick}>
              <line x1={margin.left} x2={WIDTH - margin.right} y1={py} y2={py} className="chart-grid" />
              <text x={margin.left - 8} y={py + 3} textAnchor="end" className="chart-axis">{valueFormatter(tick)}</text>
            </g>
          )
        })}
        {series.map((item) => {
          const points = labels.map((label, index) => {
            const value = values.get(label)?.get(item.key) ?? 0
            return { x: x(index), y: y(value), value, label }
          })
          const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
          const area = `${path} L ${points[points.length - 1].x} ${margin.top + plotHeight} L ${points[0].x} ${margin.top + plotHeight} Z`
          return (
            <g key={item.key}>
              {series.length === 1 && <path d={area} fill={item.color} opacity="0.08" />}
              <path d={path} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point) => (
                <circle key={`${item.key}-${point.label}`} cx={point.x} cy={point.y} r="3.5" fill="var(--surface)" stroke={item.color} strokeWidth="2">
                  <title>{`${point.label} · ${item.label}: ${valueFormatter(point.value)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        {labels.map((label, index) => (
          index % labelStep === 0 || index === labels.length - 1 ? (
            <text
              key={label}
              x={x(index)}
              y={margin.top + plotHeight + 15}
              textAnchor="end"
              transform={`rotate(-28 ${x(index)} ${margin.top + plotHeight + 15})`}
              className="chart-axis"
            >
              {truncate(label, 15)}
            </text>
          ) : null
        ))}
      </svg>
      <Legend series={series} />
    </div>
  )
}

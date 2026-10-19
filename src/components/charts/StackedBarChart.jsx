import { useMemo } from 'react'
import { EmptyChart, Legend } from './ChartPrimitives'
import { WIDTH, axisTicks, groupRows, seriesFrom, truncate } from './chartUtils'

export function StackedBarChart({
  rows,
  labelKey = 'label',
  seriesKey = 'series',
  valueKey = 'value',
  series: providedSeries,
  height = 280,
  horizontal = false,
  normalize = false,
  valueFormatter = (value) => value,
  labelLimit = 14,
}) {
  const series = useMemo(() => seriesFrom(rows, seriesKey, providedSeries), [rows, seriesKey, providedSeries])
  const groups = useMemo(() => groupRows(rows, labelKey, seriesKey, valueKey), [rows, labelKey, seriesKey, valueKey])

  if (!rows.length || !groups.length) return <EmptyChart label="Нет данных" />

  const margin = horizontal
    ? { top: 10, right: 18, bottom: 30, left: 116 }
    : { top: 14, right: 16, bottom: 54, left: 42 }
  const plotWidth = WIDTH - margin.left - margin.right
  const plotHeight = Math.max(height - margin.top - margin.bottom, 40)
  const maxTotal = normalize ? 1 : Math.max(...groups.map((group) => group.total), 1)
  const ticks = axisTicks(normalize ? 1 : maxTotal)

  if (horizontal) {
    const rowHeight = plotHeight / groups.length
    const barHeight = Math.min(22, Math.max(10, rowHeight * 0.52))
    return (
      <div className="simple-chart">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Стековая диаграмма">
          {ticks.map((tick) => {
            const x = margin.left + (tick / (normalize ? 1 : maxTotal)) * plotWidth
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={margin.top} y2={margin.top + plotHeight} className="chart-grid" />
                <text x={x} y={height - 10} textAnchor="middle" className="chart-axis">
                  {normalize ? `${Math.round(tick * 100)}%` : valueFormatter(tick)}
                </text>
              </g>
            )
          })}
          {groups.map((group, groupIndex) => {
            const y = margin.top + groupIndex * rowHeight + (rowHeight - barHeight) / 2
            let offset = 0
            return (
              <g key={group.label}>
                <text x={margin.left - 10} y={y + barHeight / 2 + 3} textAnchor="end" className="chart-axis">{truncate(group.label, 15)}</text>
                {series.map((item) => {
                  const value = group.values.get(item.key) || 0
                  if (!value) return null
                  const denominator = normalize ? group.total : maxTotal
                  const width = denominator ? (value / denominator) * plotWidth : 0
                  const x = margin.left + (offset / denominator) * plotWidth
                  offset += value
                  return (
                    <rect
                      key={item.key}
                      x={x}
                      y={y}
                      width={Math.max(width - 1, 1)}
                      height={barHeight}
                      rx={3}
                      fill={item.color}
                      className="chart-bar"
                    >
                      <title>{`${group.label} · ${item.label}: ${value}`}</title>
                    </rect>
                  )
                })}
              </g>
            )
          })}
        </svg>
        <Legend series={series} />
      </div>
    )
  }

  const slot = plotWidth / groups.length
  const barWidth = Math.min(46, Math.max(8, slot * 0.56))
  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Стековая диаграмма по категориям">
        {ticks.map((tick) => {
          const y = margin.top + plotHeight - (tick / (normalize ? 1 : maxTotal)) * plotHeight
          return (
            <g key={tick}>
              <line x1={margin.left} x2={WIDTH - margin.right} y1={y} y2={y} className="chart-grid" />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" className="chart-axis">
                {normalize ? `${Math.round(tick * 100)}%` : valueFormatter(tick)}
              </text>
            </g>
          )
        })}
        {groups.map((group, groupIndex) => {
          const x = margin.left + slot * groupIndex + (slot - barWidth) / 2
          let used = 0
          return (
            <g key={group.label}>
              {series.map((item) => {
                const value = group.values.get(item.key) || 0
                if (!value) return null
                const denominator = normalize ? group.total : maxTotal
                const barHeight = denominator ? (value / denominator) * plotHeight : 0
                const y = margin.top + plotHeight - used - barHeight
                used += barHeight
                return (
                  <rect
                    key={item.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight - 1, 1)}
                    rx={3}
                    fill={item.color}
                    className="chart-bar"
                  >
                    <title>{`${group.label} · ${item.label}: ${value}`}</title>
                  </rect>
                )
              })}
              <text
                x={x + barWidth / 2}
                y={margin.top + plotHeight + 14}
                textAnchor="end"
                transform={`rotate(-28 ${x + barWidth / 2} ${margin.top + plotHeight + 14})`}
                className="chart-axis"
              >
                {truncate(group.label, labelLimit)}
              </text>
              {!normalize && <text x={x + barWidth / 2} y={Math.max(margin.top + 9, margin.top + plotHeight - (group.total / maxTotal) * plotHeight - 4)} textAnchor="middle" className="chart-value">{valueFormatter(group.total)}</text>}
            </g>
          )
        })}
      </svg>
      <Legend series={series} />
    </div>
  )
}

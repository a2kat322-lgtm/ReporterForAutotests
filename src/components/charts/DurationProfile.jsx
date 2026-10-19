import { useMemo } from 'react'
import { EmptyChart } from './ChartPrimitives'
import { PALETTE, WIDTH, formatSeconds, quantile, truncate } from './chartUtils'

export function DurationProfile({ groups, height = 300, logScale = true }) {
  const rows = useMemo(() => groups
    .filter((group) => group.values?.length)
    .map((group) => {
      const sorted = [...group.values].sort((left, right) => left - right)
      const q1 = quantile(sorted, 0.25)
      const median = quantile(sorted, 0.5)
      const q3 = quantile(sorted, 0.75)
      const p90 = quantile(sorted, 0.9)
      return {
        label: group.label,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        q1,
        median,
        q3,
        p90,
        count: sorted.length,
      }
    })
    .sort((left, right) => right.p90 - left.p90), [groups])

  if (!rows.length) return <EmptyChart label="Нет данных о длительности" />

  const margin = { top: 16, right: 104, bottom: 38, left: 136 }
  const plotWidth = WIDTH - margin.left - margin.right
  const plotHeight = Math.max(height - margin.top - margin.bottom, 40)
  const all = rows.flatMap((row) => [row.min, row.max])
  const domainMin = Math.max(0.1, Math.min(...all) * 0.75)
  const domainMax = Math.max(...all) * 1.3
  const useLog = logScale && domainMin > 0 && domainMax / domainMin > 8
  const transform = (value) => {
    if (!useLog) return (value - domainMin) / (domainMax - domainMin || 1)
    return (Math.log10(value) - Math.log10(domainMin)) / (Math.log10(domainMax) - Math.log10(domainMin) || 1)
  }
  const x = (value) => margin.left + transform(value) * plotWidth
  const ticks = useLog
    ? [1, 2, 5, 10, 20, 50, 100, 200].filter((value) => value >= domainMin && value <= domainMax)
    : [0, 0.25, 0.5, 0.75, 1].map((part) => domainMin + (domainMax - domainMin) * part)
  const rowHeight = plotHeight / rows.length

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Профиль длительности по наборам">
        {ticks.map((tick) => {
          const px = x(tick)
          return (
            <g key={tick}>
              <line x1={px} x2={px} y1={margin.top} y2={margin.top + plotHeight} className="chart-grid" />
              <text x={px} y={height - 12} textAnchor="middle" className="chart-axis">{tick}s</text>
            </g>
          )
        })}
        {rows.map((row, index) => {
          const cy = margin.top + rowHeight * index + rowHeight / 2
          const color = PALETTE[index % PALETTE.length]
          return (
            <g key={row.label}>
              <text x={margin.left - 12} y={cy + 4} textAnchor="end" className="chart-axis">{truncate(row.label, 17)}</text>
              <line x1={x(row.min)} x2={x(row.max)} y1={cy} y2={cy} stroke={color} strokeWidth="1.5" opacity="0.45" />
              <rect
                x={x(row.min)}
                y={cy - 7}
                width={Math.max(x(row.max) - x(row.min), 2)}
                height="14"
                rx="7"
                fill={color}
                fillOpacity="0.12"
              />
              <rect
                x={x(row.q1)}
                y={cy - 8}
                width={Math.max(x(row.q3) - x(row.q1), 6)}
                height="16"
                rx="6"
                fill={color}
                fillOpacity="0.7"
              >
                <title>{`${row.label}: p25 ${formatSeconds(row.q1)}, median ${formatSeconds(row.median)}, p75 ${formatSeconds(row.q3)}, p90 ${formatSeconds(row.p90)}, n=${row.count}`}</title>
              </rect>
              <circle cx={x(row.median)} cy={cy} r="3.2" fill="var(--surface)" stroke={color} strokeWidth="1.5" />
              <line x1={x(row.p90)} x2={x(row.p90)} y1={cy - 9} y2={cy + 9} stroke={color} strokeWidth="1.5" opacity="0.9" />
              <text x={WIDTH - margin.right + 10} y={cy + 4} className="chart-axis">p90 {formatSeconds(row.p90)} · n={row.count}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

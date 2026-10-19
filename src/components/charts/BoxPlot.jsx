import { useMemo } from 'react'
import { EmptyChart } from './ChartPrimitives'
import { PALETTE, WIDTH, quantile, truncate } from './chartUtils'

export function BoxPlot({ groups, height = 300, logScale = true }) {
  const stats = useMemo(() => groups
    .filter((group) => group.values?.length)
    .map((group) => {
      const sorted = [...group.values].sort((left, right) => left - right)
      const q1 = quantile(sorted, 0.25)
      const median = quantile(sorted, 0.5)
      const q3 = quantile(sorted, 0.75)
      const iqr = q3 - q1
      const lower = Math.min(...sorted.filter((value) => value >= q1 - 1.5 * iqr))
      const upper = Math.max(...sorted.filter((value) => value <= q3 + 1.5 * iqr))
      const outliers = sorted.filter((value) => value < lower || value > upper)
      return { label: group.label, q1, median, q3, lower, upper, outliers, count: sorted.length }
    }), [groups])

  if (!stats.length) return <EmptyChart label="Нет данных о длительности" />

  const margin = { top: 18, right: 20, bottom: 58, left: 48 }
  const plotWidth = WIDTH - margin.left - margin.right
  const plotHeight = Math.max(height - margin.top - margin.bottom, 40)
  const allValues = stats.flatMap((item) => [item.lower, item.upper, ...item.outliers])
  const domainMin = Math.max(0.1, Math.min(...allValues) * 0.8)
  const domainMax = Math.max(...allValues) * 1.2
  const useLog = logScale && domainMin > 0 && domainMax / domainMin > 8
  const transform = (value) => {
    if (!useLog) return (value - domainMin) / (domainMax - domainMin || 1)
    return (Math.log10(value) - Math.log10(domainMin)) / (Math.log10(domainMax) - Math.log10(domainMin) || 1)
  }
  const y = (value) => margin.top + plotHeight - transform(value) * plotHeight
  const ticks = useLog
    ? [1, 2, 5, 10, 20, 50, 100, 200, 500].filter((value) => value >= domainMin && value <= domainMax)
    : [0, 0.25, 0.5, 0.75, 1].map((part) => domainMin + (domainMax - domainMin) * part)
  const slot = plotWidth / stats.length
  const boxWidth = Math.min(34, Math.max(16, slot * 0.46))

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Диаграмма размаха длительностей">
        {ticks.map((tick) => {
          const py = y(tick)
          return (
            <g key={tick}>
              <line x1={margin.left} x2={WIDTH - margin.right} y1={py} y2={py} className="chart-grid" />
              <text x={margin.left - 8} y={py + 3} textAnchor="end" className="chart-axis">{tick}</text>
            </g>
          )
        })}
        {stats.map((item, index) => {
          const cx = margin.left + slot * index + slot / 2
          const color = PALETTE[index % PALETTE.length]
          const topY = Math.min(y(item.q1), y(item.q3))
          const bottomY = Math.max(y(item.q1), y(item.q3))
          const boxHeight = Math.max(bottomY - topY, 10)
          const boxY = topY - (boxHeight - (bottomY - topY)) / 2
          return (
            <g key={item.label}>
              <line x1={cx} x2={cx} y1={y(item.upper)} y2={y(item.lower)} stroke={color} strokeWidth="1.5" opacity="0.8" />
              <line x1={cx - boxWidth / 2} x2={cx + boxWidth / 2} y1={y(item.upper)} y2={y(item.upper)} stroke={color} strokeWidth="1.5" />
              <line x1={cx - boxWidth / 2} x2={cx + boxWidth / 2} y1={y(item.lower)} y2={y(item.lower)} stroke={color} strokeWidth="1.5" />
              <rect
                x={cx - boxWidth / 2}
                y={boxY}
                width={boxWidth}
                height={boxHeight}
                rx="5"
                fill={color}
                fillOpacity="0.25"
                stroke={color}
                strokeWidth="1.5"
              >
                <title>{`${item.label}: p25 ${item.q1}, median ${item.median}, p75 ${item.q3}, n=${item.count}`}</title>
              </rect>
              <line x1={cx - boxWidth / 2} x2={cx + boxWidth / 2} y1={y(item.median)} y2={y(item.median)} stroke={color} strokeWidth="2.5" />
              {item.outliers.map((value, outlierIndex) => (
                <circle key={`${item.label}-${outlierIndex}`} cx={cx} cy={y(value)} r="2.5" fill={color} opacity="0.7">
                  <title>{`${item.label}: ${value} с`}</title>
                </circle>
              ))}
              <text
                x={cx}
                y={margin.top + plotHeight + 18}
                textAnchor="end"
                transform={`rotate(-26 ${cx} ${margin.top + plotHeight + 18})`}
                className="chart-axis"
              >
                {truncate(item.label, 15)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

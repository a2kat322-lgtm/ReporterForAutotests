import { EmptyChart } from './ChartPrimitives'
import { WIDTH, axisTicks, truncate } from './chartUtils'

export function ColumnChart({ rows, labelKey = 'label', valueKey = 'value', height = 260, color = '#8b5cf6', valueFormatter = (value) => value }) {
  if (!rows.length) return <EmptyChart label="Нет данных" />

  const margin = { top: 22, right: 16, bottom: 46, left: 42 }
  const plotWidth = WIDTH - margin.left - margin.right
  const plotHeight = Math.max(height - margin.top - margin.bottom, 40)
  const maxValue = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1)
  const top = Math.max(1, Math.ceil(maxValue / 4) * 4)
  const ticks = axisTicks(top)
  const slot = plotWidth / rows.length
  const barWidth = Math.min(44, Math.max(10, slot * 0.58))

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Столбчатая диаграмма">
        {ticks.map((tick) => {
          const y = margin.top + plotHeight - (tick / top) * plotHeight
          return (
            <g key={tick}>
              <line x1={margin.left} x2={WIDTH - margin.right} y1={y} y2={y} className="chart-grid" />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" className="chart-axis">{valueFormatter(tick)}</text>
            </g>
          )
        })}
        {rows.map((row, index) => {
          const value = Number(row[valueKey]) || 0
          const barHeight = (value / top) * plotHeight
          const x = margin.left + slot * index + (slot - barWidth) / 2
          return (
            <g key={`${row[labelKey]}-${index}`}>
              <rect x={x} y={margin.top + plotHeight - barHeight} width={barWidth} height={Math.max(barHeight, 2)} rx={4} fill={color} className="chart-bar">
                <title>{`${row[labelKey]}: ${valueFormatter(value)}`}</title>
              </rect>
              {value > 0 && <text x={x + barWidth / 2} y={margin.top + plotHeight - barHeight - 6} textAnchor="middle" className="chart-value">{valueFormatter(value)}</text>}
              <text
                x={x + barWidth / 2}
                y={margin.top + plotHeight + 15}
                textAnchor="end"
                transform={`rotate(-28 ${x + barWidth / 2} ${margin.top + plotHeight + 15})`}
                className="chart-axis"
              >
                {truncate(row[labelKey], 12)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

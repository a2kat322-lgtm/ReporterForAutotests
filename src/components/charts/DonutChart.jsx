import { EmptyChart } from './ChartPrimitives'
import { PALETTE, WIDTH, truncate } from './chartUtils'

export function DonutChart({ rows, labelKey = 'label', valueKey = 'value', colors = PALETTE, height = 260, centerLabel = 'Всего' }) {
  const total = rows.reduce((sum, row) => sum + (Number(row[valueKey]) || 0), 0)
  if (!rows.length || !total) return <EmptyChart label="Нет данных" />

  const cx = 152
  const cy = height / 2
  const radius = Math.min(84, height / 2 - 22)
  const stroke = 26
  let offset = 0
  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Кольцевая диаграмма">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {rows.map((row, index) => {
            const value = Number(row[valueKey]) || 0
            if (!value) return null
            const percent = value / total * 100
            const segment = (
              <circle
                key={row[labelKey]}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth={stroke}
                pathLength="100"
                strokeDasharray={`${percent} ${100 - percent}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              >
                <title>{`${row[labelKey]}: ${value} (${Math.round(percent)}%)`}</title>
              </circle>
            )
            offset += percent
            return segment
          })}
        </g>
        <text x={cx} y={cy - 4} textAnchor="middle" className="donut-total">{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" className="chart-axis">{centerLabel}</text>
        {rows.map((row, index) => {
          const value = Number(row[valueKey]) || 0
          const percent = total ? Math.round(value / total * 100) : 0
          const y = 28 + index * 30
          return (
            <g key={`legend-${row[labelKey]}`}>
              <circle cx={310} cy={y} r="4" fill={colors[index % colors.length]} />
              <text x={322} y={y + 4} className="chart-axis">{truncate(row[labelKey], 26)}</text>
              <text x={WIDTH - 18} y={y + 4} textAnchor="end" className="chart-value">{value} · {percent}%</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

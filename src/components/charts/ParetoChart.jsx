import { EmptyChart } from './ChartPrimitives'
import { WIDTH } from './chartUtils'

export function ParetoChart({ rows, height = 280, barColor = '#fb7185', lineColor = '#fbbf24' }) {  if (!rows.length) return <EmptyChart label="Нет данных" />

  const margin = { top: 22, right: 44, bottom: 42, left: 40 }
  const plotWidth = WIDTH - margin.left - margin.right
  const plotHeight = Math.max(height - margin.top - margin.bottom, 40)
  const maxCount = Math.max(...rows.map((row) => row.count), 1)
  const step = Math.max(1, Math.ceil(maxCount / 4))
  const top = step * 4
  const slot = plotWidth / rows.length
  const barWidth = Math.min(44, Math.max(10, slot * 0.58))
  const x = (index) => margin.left + slot * index + slot / 2
  const yCount = (value) => margin.top + plotHeight - (value / top) * plotHeight
  const yPercent = (value) => margin.top + plotHeight - (value / 100) * plotHeight
  const line = rows.map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${yPercent(row.cumulative)}`).join(' ')

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Диаграмма Парето">
        {[0, 0.25, 0.5, 0.75, 1].map((part) => {
          const value = top * part
          const py = yCount(value)
          return (
            <g key={part}>
              <line x1={margin.left} x2={WIDTH - margin.right} y1={py} y2={py} className="chart-grid" />
              <text x={margin.left - 8} y={py + 3} textAnchor="end" className="chart-axis">{Math.round(value)}</text>
            </g>
          )
        })}
        {rows.map((row, index) => {
          const barHeight = (row.count / top) * plotHeight
          return (
            <g key={`${row.index}-${index}`}>
              <rect x={x(index) - barWidth / 2} y={margin.top + plotHeight - barHeight} width={barWidth} height={Math.max(barHeight, 2)} rx="4" fill={barColor} className="chart-bar">
                <title>{`${row.label || row.signature}: ${row.count} (${Math.round(row.share * 100)}%)`}</title>
              </rect>
              <text x={x(index)} y={margin.top + plotHeight - barHeight - 6} textAnchor="middle" className="chart-value">{row.count}</text>
              <text x={x(index)} y={margin.top + plotHeight + 16} textAnchor="middle" className="chart-axis">{row.index}</text>
            </g>
          )
        })}
        <path d={line} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {rows.map((row, index) => (
          <circle key={`point-${index}`} cx={x(index)} cy={yPercent(row.cumulative)} r="3" fill="var(--surface)" stroke={lineColor} strokeWidth="1.8">
            <title>{`Накопленная доля: ${row.cumulative}%`}</title>
          </circle>
        ))}
        {[0, 25, 50, 75, 100].map((value) => (
          <text key={value} x={WIDTH - margin.right + 8} y={yPercent(value) + 3} className="chart-axis">{value}%</text>
        ))}
      </svg>
      <div className="simple-chart-legend">
        <span><i style={{ background: barColor }} />частота</span>
        <span><i style={{ background: lineColor }} />накопленная доля</span>
      </div>
    </div>
  )
}

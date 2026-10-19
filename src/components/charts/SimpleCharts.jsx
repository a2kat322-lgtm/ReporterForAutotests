import { useMemo } from 'react'

const WIDTH = 720
const PALETTE = ['#8b5cf6', '#4ade80', '#fb7185', '#fbbf24', '#38bdf8', '#9ca0af', '#a78bfa']

function truncate(value, limit = 16) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function seriesFrom(rows, seriesKey, provided) {
  if (provided?.length) return provided
  const keys = [...new Set(rows.map((row) => row[seriesKey]))]
  return keys.map((key, index) => ({ key, label: key, color: PALETTE[index % PALETTE.length] }))
}

function groupRows(rows, labelKey, seriesKey, valueKey) {
  const groups = new Map()
  for (const row of rows) {
    const label = row[labelKey]
    const group = groups.get(label) || { label, values: new Map(), total: 0 }
    const value = Number(row[valueKey]) || 0
    group.values.set(row[seriesKey], value)
    group.total += value
    groups.set(label, group)
  }
  return [...groups.values()]
}

function axisTicks(max, count = 4) {
  const step = max > 0 ? max / count : 1
  return Array.from({ length: count + 1 }, (_, index) => step * index)
}

function Legend({ series }) {
  return (
    <div className="simple-chart-legend">
      {series.map((item) => (
        <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
      ))}
    </div>
  )
}

function EmptyChart({ label }) {
  return <div className="simple-chart-empty">{label}</div>
}

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

function quantile(sorted, rank) {
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * rank
  const base = Math.floor(position)
  const rest = position - base
  return sorted[base] + (sorted[base + 1] !== undefined ? (sorted[base + 1] - sorted[base]) * rest : 0)
}

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

function formatSeconds(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 60) return `${Math.floor(value / 60)}m ${(value % 60).toFixed(1)}s`
  return `${value.toFixed(2)}s`
}

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

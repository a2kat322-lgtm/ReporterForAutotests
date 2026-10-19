export const WIDTH = 720
export const PALETTE = ['#8b5cf6', '#4ade80', '#fb7185', '#fbbf24', '#38bdf8', '#9ca0af', '#a78bfa']

export function truncate(value, limit = 16) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

export function seriesFrom(rows, seriesKey, provided) {
  if (provided?.length) return provided
  const keys = [...new Set(rows.map((row) => row[seriesKey]))]
  return keys.map((key, index) => ({ key, label: key, color: PALETTE[index % PALETTE.length] }))
}

export function groupRows(rows, labelKey, seriesKey, valueKey) {
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

export function axisTicks(max, count = 4) {
  const step = max > 0 ? max / count : 1
  return Array.from({ length: count + 1 }, (_, index) => step * index)
}

export function quantile(sorted, rank) {
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * rank
  const base = Math.floor(position)
  const rest = position - base
  return sorted[base] + (sorted[base + 1] !== undefined ? (sorted[base + 1] - sorted[base]) * rest : 0)
}

export function formatSeconds(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 60) return `${Math.floor(value / 60)}m ${(value % 60).toFixed(1)}s`
  return `${value.toFixed(2)}s`
}

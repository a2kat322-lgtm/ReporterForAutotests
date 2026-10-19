export function pct(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

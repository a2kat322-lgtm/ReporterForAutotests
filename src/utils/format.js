import dayjs from 'dayjs'

export function formatDate(value, withTime = false) {
  return value ? dayjs(value).format(withTime ? 'DD MMM YYYY, HH:mm' : 'DD MMM YYYY') : '—'
}

export function formatDuration(milliseconds) {
  if (milliseconds == null || !Number.isFinite(milliseconds)) return '—'
  const seconds = milliseconds / 1000
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s` : `${seconds.toFixed(2)}s`
}

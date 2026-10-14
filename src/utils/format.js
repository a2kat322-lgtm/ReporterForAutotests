import dayjs from 'dayjs'

export function formatDate(value, withTime = false) {
  return value ? dayjs(value).format(withTime ? 'DD MMM YYYY, HH:mm:ss' : 'DD MMM YYYY') : '—'
}

export function formatDuration(milliseconds) {
  if (milliseconds == null || !Number.isFinite(milliseconds)) return '—'
  const seconds = milliseconds / 1000
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = (seconds % 60).toFixed(2)
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds.toFixed(2)}s`
}

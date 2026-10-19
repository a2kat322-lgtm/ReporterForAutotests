const MS_PER_DAY = 86_400_000

/** Parses an API date-only value (`YYYY-MM-DD`) as UTC midnight. */
export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Number.NaN)
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    ? date
    : new Date(Number.NaN)
}

/** Start of the UTC day containing `date`. */
export function dayStart(date: Date): Date {
  const day = new Date(date)
  day.setUTCHours(0, 0, 0, 0)
  return day
}

/** Last millisecond of the UTC day containing `date`. */
export function dayEnd(date: Date): Date {
  return new Date(dayStart(date).valueOf() + MS_PER_DAY - 1)
}

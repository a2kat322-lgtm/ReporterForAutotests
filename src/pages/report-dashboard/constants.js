export const statuses = [
  { key: 'passed', label: 'Passed', color: '#4ade80' },
  { key: 'failed', label: 'Failed', color: '#fb7185' },
  { key: 'broken', label: 'Broken', color: '#fbbf24' },
  { key: 'skipped', label: 'Skipped', color: '#9ca0af' },
  { key: 'no_run', label: 'No run', color: 'var(--result-no-run)' },
]

export const STATUS_META = {
  passed: { label: 'Passed', tag: 'green', symbol: '✓' },
  failed: { label: 'Failed', tag: 'red', symbol: '✕' },
  broken: { label: 'Broken', tag: 'orange', symbol: '!' },
  skipped: { label: 'Skipped', tag: 'default', symbol: '–' },
  no_run: { label: 'No run', tag: 'default', symbol: '·' },
}

export const FAILURE_STATUSES = new Set(['failed', 'broken'])

export const DURATION_BUCKETS = [
  { label: '<1с', max: 1000 },
  { label: '1–5с', max: 5000 },
  { label: '5–15с', max: 15000 },
  { label: '15–60с', max: 60000 },
  { label: '>60с', max: Number.POSITIVE_INFINITY },
]

export const STATUS_COLORS = {
  Passed: '#4ade80',
  Failed: '#fb7185',
  Broken: '#fbbf24',
  Skipped: '#9ca0af',
  'No run': '#737684',
}

export const STATUS_SERIES = Object.entries(STATUS_COLORS).map(([label, color]) => ({ key: label, label, color }))

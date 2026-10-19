export const CELL_META = {
  p: { label: 'Passed', symbol: '✓', className: 'passed' },
  f: { label: 'Failed', symbol: '✕', className: 'failed' },
  b: { label: 'Broken', symbol: '!', className: 'broken' },
  s: { label: 'Skipped', symbol: '–', className: 'skipped' },
  n: { label: 'No run', symbol: '·', className: 'no-run' },
}

export const STATUS_COLORS = {
  passed: '#4ade80',
  failed: '#fb7185',
  broken: '#fbbf24',
  skipped: '#9ca0af',
  no_run: '#737684',
}

export const CHART_STATUSES = [
  { key: 'passed', label: 'Passed', color: STATUS_COLORS.passed },
  { key: 'failed', label: 'Failed', color: STATUS_COLORS.failed },
  { key: 'broken', label: 'Broken', color: STATUS_COLORS.broken },
  { key: 'skipped', label: 'Skipped', color: STATUS_COLORS.skipped },
  { key: 'no_run', label: 'No run', color: STATUS_COLORS.no_run },
]

export const LIFECYCLE_META = [
  { key: 'stableGreen', label: 'Стабильно зелёные', color: '#4ade80' },
  { key: 'recovered', label: 'Исправлены', color: '#38bdf8' },
  { key: 'regressed', label: 'Регрессы', color: '#fb7185' },
  { key: 'stableRed', label: 'Стабильно красные', color: '#ef4444' },
  { key: 'neverRun', label: 'Никогда не запускались', color: '#737684' },
  { key: 'other', label: 'Прочее', color: '#9ca0af' },
]

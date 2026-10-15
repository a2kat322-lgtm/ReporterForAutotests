import { Card } from 'antd'

const resultSegments = [
  { key: 'passed', label: 'Passed', color: '#4ade80' },
  { key: 'failed', label: 'Failed', color: '#fb7185' },
  { key: 'broken', label: 'Broken', color: '#fbbf24' },
  { key: 'skipped', label: 'Skipped', color: '#9ca0af' },
  { key: 'no_run', label: 'No run', color: '#525565' },
]

export default function ResultsChart({ counts, total }) {
  let offset = 0
  const segments = resultSegments.map((segment) => {
    const value = counts[segment.key]
    const dash = total ? `${(value / total) * 100} ${100 - (value / total) * 100}` : '0 100'
    const currentOffset = offset
    offset += total ? (value / total) * 100 : 0
    return { ...segment, value, dash, offset: -currentOffset }
  })
  const passedRate = total ? Math.round((counts.passed / total) * 100) : 0

  return (
    <Card className="results-chart-card">
      <div className="results-chart">
        <div className="results-donut" role="img" aria-label={`Test results: ${resultSegments.map(({ label, key }) => `${label} ${counts[key]}`).join(', ')}`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="results-donut-track" cx="60" cy="60" r="48" />
            {segments.map(({ key, color, dash, offset: dashOffset }) => (
              <circle key={key} cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="12" strokeDasharray={dash} strokeDashoffset={dashOffset} pathLength="100" />
            ))}
          </svg>
          <div className="results-donut-center"><strong>{passedRate}%</strong><span>passed</span></div>
        </div>
        <div className="results-legend">
          <div className="results-legend-title">Test results <span>{total} total</span></div>
          {segments.map(({ key, label, color, value }) => (
            <div className="results-legend-row" key={key}>
              <span className="results-legend-label"><i style={{ backgroundColor: color }} />{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

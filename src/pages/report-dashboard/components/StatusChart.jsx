import { Card, Progress } from 'antd'
import { statuses } from '../constants'

export default function StatusChart({ counts, total }) {
  return <Card title="Обзор результатов" className="analytics-card"><div className="analytics-status-list">
    {statuses.map(({ key, label, color }) => {
      const count = counts[key] || 0
      return <div className="analytics-status-row" key={key}><div className="analytics-status-label"><i style={{ background: color }} />{label}</div><Progress percent={total ? Math.round(count / total * 100) : 0} showInfo={false} strokeColor={color} trailColor="var(--result-track)"/><strong>{count}</strong></div>
    })}
  </div></Card>
}

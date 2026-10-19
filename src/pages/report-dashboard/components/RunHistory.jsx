import { Typography } from 'antd'
import { STATUS_META } from '../constants'

const { Text } = Typography

export default function RunHistory({ statuses: recent = [] }) {
  if (!recent.length) return <Text type="secondary">—</Text>
  return (
    <span className="run-history" aria-label={`Последние запуски: ${recent.map((status) => STATUS_META[status]?.label || status).join(', ')}`}>
      {recent.map((status, index) => {
        const meta = STATUS_META[status] || STATUS_META.no_run
        return <i key={`${status}-${index}`} className={`run-history-dot ${status}`} title={`${index === 0 ? 'последний' : `${index + 1}-й с конца`}: ${meta.label}`}>{meta.symbol}</i>
      })}
    </span>
  )
}

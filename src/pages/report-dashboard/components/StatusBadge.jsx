import { Tag } from 'antd'
import { STATUS_META } from '../constants'

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.no_run
  return <Tag color={meta.tag}>{meta.label}</Tag>
}

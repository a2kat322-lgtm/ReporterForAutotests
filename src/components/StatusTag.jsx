import { Tag } from 'antd'
import { CheckCircleFilled, ClockCircleOutlined, ExclamationCircleFilled, StopFilled, WarningFilled } from '@ant-design/icons'

const statusMeta = {
  passed: { label: 'Passed', color: 'success', icon: <CheckCircleFilled /> },
  failed: { label: 'Failed', color: 'error', icon: <ExclamationCircleFilled /> },
  broken: { label: 'Broken', color: 'warning', icon: <StopFilled /> },
  skipped: { label: 'Skipped', color: 'default', icon: <WarningFilled /> },
  no_run: { label: 'No run', color: 'default', icon: <ClockCircleOutlined /> },
}

export default function StatusTag({ status }) {
  const meta = statusMeta[status] || statusMeta.skipped
  return <Tag className="status-tag" color={meta.color} icon={meta.icon}>{meta.label}</Tag>
}

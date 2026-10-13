import { Tag } from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled, ReloadOutlined, WarningFilled } from '@ant-design/icons'

const statusMeta = {
  passed: { label: 'Passed', color: 'success', icon: <CheckCircleFilled /> },
  failed: { label: 'Failed', color: 'error', icon: <ExclamationCircleFilled /> },
  skipped: { label: 'Skipped', color: 'default', icon: <WarningFilled /> },
  running: { label: 'Running', color: 'processing', icon: <ReloadOutlined spin /> },
}

export default function StatusTag({ status }) {
  const meta = statusMeta[status] || statusMeta.skipped
  return <Tag className="status-tag" color={meta.color} icon={meta.icon}>{meta.label}</Tag>
}

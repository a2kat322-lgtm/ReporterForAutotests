import { useState } from 'react'
import { Descriptions, Input, Select, Space, Tag, Typography, message } from 'antd'
import { updateResultFeedback } from '../services/dataService'
import { formatDate } from '../utils/format'

const { Text } = Typography

export const failureReasons = [
  { value: 'Assertion failed', label: 'Assertion failed' },
  { value: 'Timeout', label: 'Timeout' },
  { value: 'Environment issue', label: 'Environment issue' },
  { value: 'Test data issue', label: 'Test data issue' },
  { value: 'Application error', label: 'Application error' },
  { value: 'Other', label: 'Other' },
]

export function FailureFeedbackFields({ test, reload, compact = false }) {
  const [comment, setComment] = useState(test.failureComment || '')
  const [saving, setSaving] = useState(false)

  async function save(values) {
    if (!test.resultId) return
    setSaving(true)
    try {
      await updateResultFeedback(test.resultId, values)
      message.success('Failure feedback saved')
      reload()
    } catch (error) {
      message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Space direction={compact ? 'horizontal' : 'vertical'} size={compact ? 6 : 8} style={{ width: '100%' }} onClick={(event) => event.stopPropagation()}>
      <Select
        size={compact ? 'small' : 'middle'}
        style={{ minWidth: compact ? 150 : 220 }}
        placeholder="Failure reason"
        value={test.failureReason || undefined}
        options={failureReasons}
        loading={saving}
        onChange={(failureReason) => save({ failureReason, failureComment: comment })}
        allowClear
      />
      <Input
        size={compact ? 'small' : 'middle'}
        style={{ minWidth: compact ? 180 : 260 }}
        placeholder="Failure comment"
        maxLength={5000}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        onBlur={() => {
          if (comment !== (test.failureComment || '')) save({ failureReason: test.failureReason, failureComment: comment })
        }}
      />
    </Space>
  )
}

function FailureFeedback({ test, reload }) {
  return (
    <Descriptions.Item label="Failure feedback" span={2}>
      <FailureFeedbackFields test={test} reload={reload} />
    </Descriptions.Item>
  )
}

export default function RunDetails({ test, reload }) {
  return (
    <Descriptions size="small" column={2} className="run-details">
      <Descriptions.Item label="Result path"><Text code>{test.path}</Text></Descriptions.Item>
      <Descriptions.Item label="Owner">{test.owner || '—'}</Descriptions.Item>
      <Descriptions.Item label="Circuit">{test.circuit || '—'}</Descriptions.Item>
      <Descriptions.Item label="Responsibility">{test.fullResponsibility || '—'}</Descriptions.Item>
      <Descriptions.Item label="Window">{formatDate(test.startDate, true)} → {formatDate(test.endDate, true)}</Descriptions.Item>
      <Descriptions.Item label="Tags">
        {test.tags?.length ? <Space size={4} wrap>{test.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> : '—'}
      </Descriptions.Item>
      {test.message ? (
        <Descriptions.Item label="Message" span={2}>
          <Text type={test.status === 'passed' ? 'secondary' : 'danger'}>{test.message}</Text>
        </Descriptions.Item>
      ) : null}
      {test.status === 'failed' || test.status === 'broken' ? <FailureFeedback test={test} reload={reload} /> : null}
    </Descriptions>
  )
}

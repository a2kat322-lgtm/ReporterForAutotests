import { useState } from 'react'
import { Descriptions, Input, Select, Space, Tag, Typography, message } from 'antd'
import { updateResultFeedback } from '../services/dataService'
import { formatDate } from '../utils/format'

const { Text } = Typography

export const failureReasons = [
  { value: 'Сбой проверки', label: 'Сбой проверки' },
  { value: 'Таймаут', label: 'Таймаут' },
  { value: 'Проблема окружения', label: 'Проблема окружения' },
  { value: 'Проблема тестовых данных', label: 'Проблема тестовых данных' },
  { value: 'Ошибка приложения', label: 'Ошибка приложения' },
  { value: 'Другое', label: 'Другое' },
]

export function FailureFeedbackFields({ test, reload, compact = false }) {
  const [comment, setComment] = useState(test.failureComment || '')
  const [saving, setSaving] = useState(false)

  async function save(values) {
    if (!test.resultId) return
    setSaving(true)
    try {
      await updateResultFeedback(test.resultId, values)
      message.success('Обратная связь по падению сохранена')
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
        placeholder="Причина падения"
        className="failure-reason-select"
        value={test.failureReason || undefined}
        options={failureReasons}
        loading={saving}
        onChange={(failureReason) => save({ failureReason, failureComment: comment })}
        allowClear
      />
      <Input
        size={compact ? 'small' : 'middle'}
        style={{ minWidth: compact ? 180 : 260 }}
        placeholder="Комментарий к падению"
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
    <Descriptions.Item label="Обратная связь по падению" span={2}>
      <FailureFeedbackFields test={test} reload={reload} />
    </Descriptions.Item>
  )
}

export default function RunDetails({ test, reload }) {
  return (
    <Descriptions size="small" column={2} className="run-details">
      <Descriptions.Item label="Путь результата"><Text code>{test.path}</Text></Descriptions.Item>
      <Descriptions.Item label="Владелец">{test.owner || '—'}</Descriptions.Item>
      <Descriptions.Item label="Circuit">{test.circuit || '—'}</Descriptions.Item>
      <Descriptions.Item label="Ответственность">{test.fullResponsibility || '—'}</Descriptions.Item>
      <Descriptions.Item label="Окно">{formatDate(test.startDate, true)} → {formatDate(test.endDate, true)}</Descriptions.Item>
      <Descriptions.Item label="Теги">
        {test.tags?.length ? <Space size={4} wrap>{test.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> : '—'}
      </Descriptions.Item>
      {test.message ? (
        <Descriptions.Item label="Сообщение" span={2}>
          <Text type={test.status === 'passed' ? 'secondary' : 'danger'}>{test.message}</Text>
        </Descriptions.Item>
      ) : null}
      {test.status === 'failed' || test.status === 'broken' ? <FailureFeedback test={test} reload={reload} /> : null}
    </Descriptions>
  )
}

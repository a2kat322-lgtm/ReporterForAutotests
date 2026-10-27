import { useState } from 'react'
import { Input, Select, Space, message } from 'antd'
import { updateResultFeedback } from '../services/dataService'

const failureReasons = [
  { value: 'Неисправность АТ', label: 'Неисправность АТ' },
  { value: 'Недоступность контура', label: 'Недоступность контура' },
  { value: 'Дефект', label: 'Дефект' },
  { value: 'Ошибка интеграции', label: 'Ошибка интеграции' },
  { value: 'Ошибка тд', label: 'Ошибка тд' },
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


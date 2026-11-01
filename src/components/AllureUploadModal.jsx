import { useEffect, useState } from 'react'
import { Alert, App, Input, Modal, Typography, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { importAllureResults } from '../services/dataService'

const { Text } = Typography

/**
 * Uploads a ZIP of the `allure-results` directory. The archive is one CI run:
 * it brings steps, screenshots and parameters for every test it contains.
 */
export default function AllureUploadModal({ open, workspaceId, environment, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [environmentValue, setEnvironmentValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { message } = App.useApp()

  useEffect(() => {
    if (!open) return
    setFile(null)
    setEnvironmentValue(environment || '')
    setBusy(false)
    setError(null)
  }, [open, environment])

  async function submit() {
    if (!file) {
      setError('Выберите zip-архив allure-results')
      return
    }
    if (!environmentValue.trim()) {
      setError('Укажите окружение: оно записывается в circuit запусков и сравнивается с окружением фазы')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await importAllureResults({
        file,
        environment: environmentValue.trim(),
        workspaceId,
      })
      const parts = [`Импортировано ${result.imported}`]
      if (result.enriched) parts.push(`дополнено уже отправленных: ${result.enriched}`)
      if (result.duplicates) parts.push(`дубликатов пропущено: ${result.duplicates}`)
      if (result.attachments) parts.push(`вложений: ${result.attachments}`)
      if (result.catalogCreated) parts.push(`новых тестов в каталоге: ${result.catalogCreated}`)
      message.success(parts.join(', '))
      if (result.warnings?.length) {
        message.warning(`Предупреждений: ${result.warnings.length}. Первое: ${result.warnings[0]}`)
      }
      onImported?.(result)
      onClose()
    } catch (importError) {
      setError(importError.message || 'Не удалось импортировать архив')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Импорт allure-results"
      okText="Импортировать"
      cancelText="Отмена"
      confirmLoading={busy}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      <Upload.Dragger
        accept=".zip,application/zip"
        maxCount={1}
        beforeUpload={(picked) => {
          setFile(picked)
          return false
        }}
        onRemove={() => setFile(null)}
        fileList={file ? [file] : []}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Перетащите zip-архив или нажмите, чтобы выбрать</p>
        <p className="ant-upload-hint">Архив папки allure-results: один архив — один прогон CI</p>
      </Upload.Dragger>

      <div className="allure-upload-field">
        <Text type="secondary">Окружение (circuit)</Text>
        <Input
          value={environmentValue}
          onChange={(event) => setEnvironmentValue(event.target.value)}
          placeholder="например, dso"
        />
      </div>

      <Alert
        type="info"
        showIcon
        className="allure-upload-note"
        message="Запуски появятся в отчёте, окно дат которого покрывает время прогона."
      />

      {error ? <Alert type="error" showIcon message={error} className="allure-upload-note" /> : null}
    </Modal>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Modal, Space, Table, Tooltip, Typography, Upload } from 'antd'
import { FileAddOutlined, ImportOutlined, UploadOutlined } from '@ant-design/icons'
import { createAutomatedTest, createAutomatedTestsBulk, deleteAutomatedTest, getAutomatedTests, harvestAutomatedTests, updateAutomatedTestsVisibility } from '../services/dataService'
import { parseTestsFile } from '../utils/testFileParser'
import HarvestModal from './HarvestModal'
import { getCaseColumns, getSuiteColumns, caseEmptyText, catalogEmptyText, toDtoPayload } from './CatalogTableParts'

const { Text, Paragraph } = Typography

const compareCatalogNames = (left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })

export default function TestCatalogModal({ open, onClose, environment, workspaceId }) {
  const [form] = Form.useForm()
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [harvesting, setHarvesting] = useState(false)
  const [harvestOpen, setHarvestOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [preview, setPreview] = useState(null) // { tests, skipped, filename }
  const { message } = App.useApp()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setCatalog(await getAutomatedTests(environment, workspaceId))
    } catch (error) {
      message.error(error.message || 'Не удалось загрузить каталог тестов')
    } finally {
      setLoading(false)
    }
  }, [environment, workspaceId])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  useEffect(() => {
    const catalogIds = new Set(catalog.map((test) => test.id))
    setSelectedRowKeys((keys) => keys.filter((key) => catalogIds.has(key)))
  }, [catalog])

  const harvest = async () => {
    let period
    try {
      period = await form.validateFields(['harvestPeriod'])
    } catch {
      return
    }
    const [startDate, endDate] = period.harvestPeriod
    setHarvesting(true)
    try {
      const result = await harvestAutomatedTests(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), environment, workspaceId)
      message.success(`Собрано из запусков: добавлено ${result.created}, уже в каталоге ${result.skipped}`)
      setHarvestOpen(false)
      form.resetFields(['harvestPeriod'])
      refresh()
    } catch (error) {
      message.error(error.message || 'Сбор не удался')
    } finally {
      setHarvesting(false)
    }
  }

  const handleFile = async (file) => {
    setImporting(true)
    try {
      const text = await file.text()
      const parsed = parseTestsFile(file.name, text)
      if (parsed.tests.length === 0) {
        message.warning(`В файле ${file.name} тесты не найдены`)
        return
      }
      setPreview({ ...parsed, filename: file.name })
    } catch (error) {
      message.error(`Не удалось прочитать ${file.name}: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const result = await createAutomatedTestsBulk(preview.tests.map((test) => ({ ...test, workspaceId })))
      message.success(`Импортировано тестов: ${result.created}${result.updated ? `, обновлено ${result.updated}` : ''}`)
      setPreview(null)
      refresh()
    } catch (error) {
      message.error(error.message || 'Импорт не удался')
    } finally {
      setImporting(false)
    }
  }

  const remove = async (test) => {
    setDeletingId(test.id)
    try {
      await deleteAutomatedTest(test.id)
      message.success(`Тест «${(test.defaultCaseName || test.resultPath)}» удалён из каталога`)
      refresh()
    } catch (error) {
      message.error(error.message || 'Не удалось удалить тест')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleVisible = async (test, visible) => {
    setTogglingId(test.id)
    try {
      await createAutomatedTest({ ...toDtoPayload(test), visible, workspaceId })
      message.success(visible ? `«${(test.defaultCaseName || test.resultPath)}» отображается в отчётах` : `«${(test.defaultCaseName || test.resultPath)}» скрыт из отчётов`)
      await refresh()
    } catch (error) {
      message.error(error.message || 'Не удалось обновить видимость')
    } finally {
      setTogglingId(null)
    }
  }

  const toggleSelectedVisibility = async (visible) => {
    const selectedTests = catalog.filter((test) => selectedRowKeys.includes(test.id))
    if (!selectedTests.length) return
    setBulkUpdating(true)
    try {
      await updateAutomatedTestsVisibility(selectedTests.map((test) => test.resultPath), visible, workspaceId)
      message.success(`${selectedTests.length} тестов ${visible ? 'включено' : 'скрыто'} в отчётах`)
      setSelectedRowKeys([])
      await refresh()
    } catch (error) {
      message.error(error.message || 'Не удалось обновить видимость')
    } finally {
      setBulkUpdating(false)
    }
  }

  const groupedCatalog = useMemo(() => {
    const groups = new Map()
    for (const test of catalog) {
      const suiteName = test.defaultSuiteName || 'Без набора'
      if (!groups.has(suiteName)) groups.set(suiteName, [])
      groups.get(suiteName).push(test)
    }
    return Array.from(groups, ([suiteName, tests], index) => ({
      key: `suite-${index}`,
      suiteName,
      tests: tests.sort((a, b) => compareCatalogNames(
        a.defaultCaseName || a.resultPath,
        b.defaultCaseName || b.resultPath,
      )),
    })).sort((a, b) => compareCatalogNames(a.suiteName, b.suiteName))
  }, [catalog])

  const toggleSuiteVisibility = async (suite, visible) => {
    setBulkUpdating(true)
    try {
      await updateAutomatedTestsVisibility(suite.tests.map((test) => test.resultPath), visible, workspaceId)
      message.success(`${suite.tests.length} тестов в наборе ${suite.suiteName} ${visible ? 'включено' : 'скрыто'} в отчётах`)
      setSelectedRowKeys((keys) => keys.filter((key) => !suite.tests.some((test) => test.id === key)))
      await refresh()
    } catch (error) {
      message.error(error.message || 'Failed to update visibility')
    } finally {
      setBulkUpdating(false)
    }
  }

  const suiteIsVisible = (suite) => suite.tests.some((test) => test.visible !== false)

  const caseColumns = getCaseColumns({ togglingId, deletingId, onToggleVisible: toggleVisible, onRemove: remove })
  const suiteColumns = getSuiteColumns({ bulkUpdating, suiteIsVisible, onToggleSuiteVisibility: toggleSuiteVisibility })

  return (
    <Modal
      title="Каталог автоматических тестов"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Закрыть</Button>}
      width="min(1100px, calc(100vw - 32px))"
      destroyOnHidden
    >
      <Paragraph type="secondary">
        Тесты каталога появляются в каждом отчёте со статусом <Text code>No run</Text>, пока автоматизация
        не отправит запуск для их <Text code>resultPath</Text> через <Text code>POST /api/results</Text>.
        Запуски сопоставляются с отчётами по окну дат и окружению фазы: здесь и в отчётах этой фазы
        отображаются только те тесты, чьи запуски были отправлены с совпадающим <Text code>Circuit</Text> (<Text code>{environment}</Text>).
      </Paragraph>

      <Space style={{ marginBottom: 12 }} wrap>
        <Upload accept=".json" showUploadList={false} beforeUpload={(file) => { handleFile(file); return false }}>
          <Button icon={<UploadOutlined />} loading={importing && !preview}>Импортировать JSON</Button>
        </Upload>
        <Tooltip title="Зарегистрировать уникальные пути тестов из сохранённых запусков">
          <Button icon={<ImportOutlined />} onClick={() => setHarvestOpen(true)}>Собрать из запусков</Button>
        </Tooltip>
      </Space>

      <HarvestModal
        open={harvestOpen}
        form={form}
        environment={environment}
        onClose={() => setHarvestOpen(false)}
        onHarvest={harvest}
        harvesting={harvesting}
      />

      <div className="form-hint" style={{ marginBottom: 12 }}>
        Контракт файла <Text code>.json</Text>: массив из{' '}
        <Text code>{'{ resultPath, defaultCaseName, fullResponsibility?, defaultSuiteName?, defaultOwner?, tags?, visible? }'}</Text>.
        Записи, у которых <Text code>resultPath</Text> уже существует, обновляются, а не дублируются.
        Тесты с выключенным флагом <Text code>ПОКАЗ В ОТЧЁТЕ</Text> скрыты из просмотра отчётов.
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">Выбрано: <strong>{selectedRowKeys.length}</strong></Text>
        <Button size="small" danger disabled={!selectedRowKeys.length} loading={bulkUpdating} onClick={() => toggleSelectedVisibility(false)}>Скрыть выбранные</Button>
        <Button size="small" disabled={!selectedRowKeys.length} loading={bulkUpdating} onClick={() => toggleSelectedVisibility(true)}>Показать выбранные</Button>
        {selectedRowKeys.length ? <Button size="small" type="link" onClick={() => setSelectedRowKeys([])}>Снять выбор</Button> : null}
      </Space>

      {preview ? (
        <Space style={{ marginBottom: 12 }} wrap>
          <Text>
            <FileAddOutlined /> Разобрано <strong>{preview.tests.length}</strong> тестов из{' '}
            <Text code>{preview.filename}</Text>{preview.skipped ? ` (пропущено строк: ${preview.skipped})` : ''}
          </Text>
          <Button type="primary" loading={importing} onClick={confirmImport}>Импортировать в каталог</Button>
          <Button onClick={() => setPreview(null)}>Отмена</Button>
        </Space>
      ) : null}

      <CatalogTable
        loading={loading}
        groupedCatalog={groupedCatalog}
        suiteColumns={suiteColumns}
        caseColumns={caseColumns}
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={setSelectedRowKeys}
      />
    </Modal>
  )
}

function CatalogTable({ loading, groupedCatalog, suiteColumns, caseColumns, selectedRowKeys, onSelectionChange }) {
  const [expandedKeys, setExpandedKeys] = useState([])

  return (
    <Table
      rowKey="key"
      size="small"
      loading={loading}
      columns={suiteColumns}
      dataSource={groupedCatalog}
      pagination={false}
      onRow={(suite) => ({
        // Toggle from anywhere in the row except the built-in expand control
        // (it toggles itself) and interactive children (the visibility switch).
        onClick: (event) => {
          if (event.target.closest('.ant-table-row-expand-icon')) return
          setExpandedKeys((keys) => keys.includes(suite.key)
            ? keys.filter((key) => key !== suite.key)
            : [...keys, suite.key])
        },
        style: { cursor: 'pointer' },
      })}
      expandable={{
        expandedRowKeys: expandedKeys,
        onExpandedRowsChange: setExpandedKeys,
        expandedRowRender: (suite) => (
          <Table
            className="suite-cases-table"
            rowKey="id"
            size="small"
            columns={caseColumns}
            dataSource={suite.tests}
            pagination={false}
            rowSelection={{
              selectedRowKeys,
              onChange: onSelectionChange,
            }}
            locale={{ emptyText: caseEmptyText }}
          />
        ),
      }}
      locale={{ emptyText: catalogEmptyText }}
    />
  )
}

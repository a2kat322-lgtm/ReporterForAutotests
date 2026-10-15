import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Modal, Space, Table, Tooltip, Typography, Upload } from 'antd'
import { FileAddOutlined, ImportOutlined, UploadOutlined } from '@ant-design/icons'
import { createAutomatedTest, createAutomatedTestsBulk, deleteAutomatedTest, getAutomatedTests, harvestAutomatedTests, updateAutomatedTestsVisibility } from '../services/dataService'
import { parseTestsFile } from '../utils/testFileParser'
import HarvestModal from './HarvestModal'
import { getCaseColumns, getSuiteColumns, caseEmptyText, catalogEmptyText, toDtoPayload } from './CatalogTableParts'

const { Text, Paragraph } = Typography

export default function TestCatalogModal({ open, onClose, environment }) {
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
      setCatalog(await getAutomatedTests(environment))
    } catch (error) {
      message.error(error.message || 'Failed to load test catalog')
    } finally {
      setLoading(false)
    }
  }, [environment])

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
      const result = await harvestAutomatedTests(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), environment)
      message.success(`Harvested from runs: ${result.created} added, ${result.skipped} already in catalog`)
      setHarvestOpen(false)
      form.resetFields(['harvestPeriod'])
      refresh()
    } catch (error) {
      message.error(error.message || 'Harvest failed')
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
        message.warning(`No tests found in ${file.name}`)
        return
      }
      setPreview({ ...parsed, filename: file.name })
    } catch (error) {
      message.error(`Could not read ${file.name}: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const result = await createAutomatedTestsBulk(preview.tests)
      message.success(`Imported ${result.created} tests${result.updated ? `, ${result.updated} updated` : ''}`)
      setPreview(null)
      refresh()
    } catch (error) {
      message.error(error.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const remove = async (test) => {
    setDeletingId(test.id)
    try {
      await deleteAutomatedTest(test.id)
      message.success(`Test "${(test.defaultCaseName || test.resultPath)}" removed from catalog`)
      refresh()
    } catch (error) {
      message.error(error.message || 'Failed to delete test')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleVisible = async (test, visible) => {
    setTogglingId(test.id)
    try {
      await createAutomatedTest({ ...toDtoPayload(test), visible })
      message.success(visible ? `"${(test.defaultCaseName || test.resultPath)}" shows in reports` : `"${(test.defaultCaseName || test.resultPath)}" hidden from reports`)
      await refresh()
    } catch (error) {
      message.error(error.message || 'Failed to update visibility')
    } finally {
      setTogglingId(null)
    }
  }

  const toggleSelectedVisibility = async (visible) => {
    const selectedTests = catalog.filter((test) => selectedRowKeys.includes(test.id))
    if (!selectedTests.length) return
    setBulkUpdating(true)
    try {
      await updateAutomatedTestsVisibility(selectedTests.map((test) => test.resultPath), visible)
      message.success(`${selectedTests.length} tests ${visible ? 'enabled' : 'hidden'} in reports`)
      setSelectedRowKeys([])
      await refresh()
    } catch (error) {
      message.error(error.message || 'Failed to update visibility')
    } finally {
      setBulkUpdating(false)
    }
  }

  const groupedCatalog = useMemo(() => {
    const groups = new Map()
    for (const test of catalog) {
      const suiteName = test.defaultSuiteName || 'Unassigned suite'
      if (!groups.has(suiteName)) groups.set(suiteName, [])
      groups.get(suiteName).push(test)
    }
    return Array.from(groups, ([suiteName, tests], index) => ({ key: `suite-${index}`, suiteName, tests }))
  }, [catalog])

  const toggleSuiteVisibility = async (suite, visible) => {
    setBulkUpdating(true)
    try {
      await updateAutomatedTestsVisibility(suite.tests.map((test) => test.resultPath), visible)
      message.success(`${suite.tests.length} tests in ${suite.suiteName} ${visible ? 'enabled' : 'hidden'} in reports`)
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
      title="Automated test catalog"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width="min(1100px, calc(100vw - 32px))"
      destroyOnHidden
    >
      <Paragraph type="secondary">
        Catalog tests appear in every report with status <Text code>No run</Text> until the automation
        posts a run for their <Text code>resultPath</Text> via <Text code>POST /api/results</Text>.
        Runs are matched to reports by date window and by the phase environment: only tests whose
        runs were posted with a matching <Text code>Circuit</Text> (<Text code>{environment}</Text>)
        are shown here and in this phase's reports.
      </Paragraph>

      <Space style={{ marginBottom: 12 }} wrap>
        <Upload accept=".json" showUploadList={false} beforeUpload={(file) => { handleFile(file); return false }}>
          <Button icon={<UploadOutlined />} loading={importing && !preview}>Import JSON</Button>
        </Upload>
        <Tooltip title="Register distinct test paths from stored runs">
          <Button icon={<ImportOutlined />} onClick={() => setHarvestOpen(true)}>Harvest from runs</Button>
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
        <Text code>.json</Text> file contract: an array of{' '}
        <Text code>{'{ resultPath, defaultCaseName, fullResponsibility?, defaultSuiteName?, defaultOwner?, tags?, visible? }'}</Text>.
        Entries whose <Text code>resultPath</Text> already exists are updated, not duplicated.
        Tests with the <Text code>SHOW IN REPORT</Text> flag off are hidden from report views.
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">Selected: <strong>{selectedRowKeys.length}</strong></Text>
        <Button size="small" danger disabled={!selectedRowKeys.length} loading={bulkUpdating} onClick={() => toggleSelectedVisibility(false)}>Hide selected</Button>
        <Button size="small" disabled={!selectedRowKeys.length} loading={bulkUpdating} onClick={() => toggleSelectedVisibility(true)}>Show selected</Button>
        {selectedRowKeys.length ? <Button size="small" type="link" onClick={() => setSelectedRowKeys([])}>Clear selection</Button> : null}
      </Space>

      {preview ? (
        <Space style={{ marginBottom: 12 }} wrap>
          <Text>
            <FileAddOutlined /> Parsed <strong>{preview.tests.length}</strong> tests from{' '}
            <Text code>{preview.filename}</Text>{preview.skipped ? ` (${preview.skipped} rows skipped)` : ''}
          </Text>
          <Button type="primary" loading={importing} onClick={confirmImport}>Import into catalog</Button>
          <Button onClick={() => setPreview(null)}>Cancel</Button>
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

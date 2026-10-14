import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, DatePicker, Empty, Form, Modal, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography, Upload } from 'antd'
import { DeleteOutlined, FileAddOutlined, ImportOutlined, UploadOutlined } from '@ant-design/icons'
import { createAutomatedTest, createAutomatedTestsBulk, deleteAutomatedTest, getAutomatedTests, harvestAutomatedTests } from '../services/dataService'
import { parseTestsFile } from '../utils/testFileParser'

const { Text, Paragraph } = Typography

const sourceColors = { file: 'blue', harvested: 'green', manual: 'purple' }

// The API upserts by resultPath and forbids non-whitelisted fields, so only
// DTO fields are sent when toggling the visibility flag.
function toDtoPayload(test) {
  const payload = { resultPath: test.resultPath, defaultCaseName: test.defaultCaseName || test.resultPath }
  for (const field of ['fullResponsibility', 'defaultSuiteName', 'defaultCaseName', 'defaultOwner']) {
    if (test[field] != null) payload[field] = test[field]
  }
  if (Array.isArray(test.tags)) payload.tags = test.tags
  return payload
}

const staticColumns = [
  {
    title: 'TEST',
    dataIndex: 'defaultCaseName',
    render: (caseName, test) => (
      <div className="catalog-test-cell">
        <Text strong>{caseName || test.resultPath}</Text>
        <div><Text type="secondary" className="phase-id">{test.resultPath}</Text></div>
      </div>
    ),
  },
  { title: 'OWNER', dataIndex: 'defaultOwner', width: 110, ellipsis: true, render: (value) => (value ? <Text type="secondary">{value}</Text> : <Text type="secondary">—</Text>) },
  {
    title: 'TAGS',
    dataIndex: 'tags',
    width: 140,
    render: (tags) => (Array.isArray(tags) && tags.length
      ? <Space size={4} wrap>{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>
      : <Text type="secondary">—</Text>),
  },
  {
    title: 'SOURCE',
    dataIndex: 'source',
    width: 90,
    render: (value) => <Tag color={sourceColors[value] ?? 'default'}>{value}</Tag>,
  },
]

const paginationConfig = { pageSize: 10, size: 'small' }
const emptyText = <Empty description="No tests in this suite" />
const emptyCatalog = <Empty description="Catalog is empty — import a JSON file or harvest from stored runs" />

export default function TestCatalogModal({ open, onClose }) {
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
      setCatalog(await getAutomatedTests())
    } catch (error) {
      message.error(error.message || 'Failed to load test catalog')
    } finally {
      setLoading(false)
    }
  }, [])

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
      const result = await harvestAutomatedTests(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'))
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
      const results = await Promise.allSettled(selectedTests.map((test) => createAutomatedTest({ ...toDtoPayload(test), visible })))
      const failed = results.filter((result) => result.status === 'rejected').length
      if (failed) message.error(`Failed to update ${failed} test${failed === 1 ? '' : 's'}`)
      else message.success(`${selectedTests.length} tests ${visible ? 'enabled' : 'hidden'} in reports`)
      setSelectedRowKeys([])
      await refresh()
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
      const results = await Promise.allSettled(suite.tests.map((test) => createAutomatedTest({ ...toDtoPayload(test), visible })))
      const failed = results.filter((result) => result.status === 'rejected').length
      if (failed) message.error(`Failed to update ${failed} test${failed === 1 ? '' : 's'} in ${suite.suiteName}`)
      else message.success(`${suite.tests.length} tests in ${suite.suiteName} ${visible ? 'enabled' : 'hidden'} in reports`)
      setSelectedRowKeys((keys) => keys.filter((key) => !suite.tests.some((test) => test.id === key)))
      await refresh()
    } finally {
      setBulkUpdating(false)
    }
  }

  const suiteIsVisible = (suite) => suite.tests.some((test) => test.visible !== false)

  const caseColumns = [
    ...staticColumns,
    {
      title: <Tooltip title="Off — the test is hidden from reports"><span>SHOW</span></Tooltip>,
      dataIndex: 'visible',
      width: 70,
      align: 'center',
      render: (visible, test) => (
        <Switch
          size="small"
          checked={visible !== false}
          checkedChildren="Y"
          unCheckedChildren="N"
          loading={togglingId === test.id}
          onChange={(checked) => toggleVisible(test, checked)}
          aria-label={`Show ${(test.defaultCaseName || test.resultPath)} in reports`}
        />
      ),
    },
    {
      title: '',
      width: 52,
      render: (_, test) => (
        <Popconfirm
          title="Remove from catalog?"
          description="Stored run results are kept; the test just stops appearing as 'No run'."
          okText="Remove"
          okButtonProps={{ danger: true, loading: deletingId === test.id }}
          cancelText="Cancel"
          onConfirm={() => remove(test)}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`Remove ${(test.defaultCaseName || test.resultPath)}`} />
        </Popconfirm>
      ),
    },
  ]

  const suiteColumns = [{
    title: 'SUITE',
    dataIndex: 'suiteName',
    render: (suiteName, suite) => (
      <Space>
        <Text strong>{suiteName} <Text type="secondary">({suite.tests.length})</Text></Text>
        <Switch
          size="small"
          checked={suiteIsVisible(suite)}
          checkedChildren="Y"
          unCheckedChildren="N"
          loading={bulkUpdating}
          onClick={(_, event) => event.stopPropagation()}
          onChange={(visible) => toggleSuiteVisibility(suite, visible)}
          aria-label={`Show ${suiteName} suite in reports`}
        />
      </Space>
    ),
  }]

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
        Runs are matched to reports by date window, not by an explicit link.
      </Paragraph>

      <Space style={{ marginBottom: 12 }} wrap>
        <Upload accept=".json" showUploadList={false} beforeUpload={(file) => { handleFile(file); return false }}>
          <Button icon={<UploadOutlined />} loading={importing && !preview}>Import JSON</Button>
        </Upload>
        <Tooltip title="Register distinct test paths from stored runs">
          <Button icon={<ImportOutlined />} onClick={() => setHarvestOpen(true)}>Harvest from runs</Button>
        </Tooltip>
      </Space>

      <Modal
        title="Harvest tests from runs"
        open={harvestOpen}
        onCancel={() => setHarvestOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Paragraph type="secondary">Choose the run date range. Distinct test paths found in overlapping runs will be added to the catalog.</Paragraph>
        <Form form={form} layout="vertical" onFinish={harvest}>
          <Form.Item
            name="harvestPeriod"
            label="Run date range"
            rules={[{ required: true, message: 'Choose the run date range to harvest' }]}
          >
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              aria-label="Run date range for harvesting tests"
              placeholder={['From date', 'To date']}
            />
          </Form.Item>
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setHarvestOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" icon={<ImportOutlined />} loading={harvesting}>Start harvest</Button>
          </Space>
        </Form>
      </Modal>

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

      <Table
        rowKey="key"
        size="small"
        loading={loading}
        columns={suiteColumns}
        dataSource={groupedCatalog}
        pagination={false}
        expandable={{
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
                onChange: setSelectedRowKeys,
              }}
              locale={{ emptyText }}
            />
          ),
        }}
        locale={{ emptyText: emptyCatalog }}
      />
    </Modal>
  )
}

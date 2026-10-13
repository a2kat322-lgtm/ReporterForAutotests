import { useCallback, useEffect, useState } from 'react'
import { App, Button, Empty, Form, Input, Modal, Popconfirm, Space, Table, Tag, Tooltip, Typography, Upload } from 'antd'
import { DeleteOutlined, FileAddOutlined, ImportOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { createAutomatedTest, createAutomatedTestsBulk, deleteAutomatedTest, getAutomatedTests, harvestAutomatedTests } from '../services/dataService'
import { parseTestsFile } from '../utils/testFileParser'

const { Text, Paragraph } = Typography

const sourceColors = { file: 'blue', harvested: 'green', manual: 'purple' }

const staticColumns = [
  {
    title: 'TEST',
    dataIndex: 'display',
    render: (display, test) => (
      <div>
        <Text strong>{display}</Text>
        <div><Text type="secondary" className="phase-id">{test.resultPath}</Text></div>
      </div>
    ),
  },
  { title: 'SUITE', dataIndex: 'defaultSuiteName', width: 140, render: (value) => (value ? <Tag>{value}</Tag> : <Text type="secondary">—</Text>) },
  { title: 'OWNER', dataIndex: 'defaultOwner', width: 120, render: (value) => (value ? <Text type="secondary">{value}</Text> : <Text type="secondary">—</Text>) },
  {
    title: 'TAGS',
    dataIndex: 'tags',
    width: 160,
    render: (tags) => (Array.isArray(tags) && tags.length
      ? <Space size={4} wrap>{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>
      : <Text type="secondary">—</Text>),
  },
  {
    title: 'SOURCE',
    dataIndex: 'source',
    width: 100,
    render: (value) => <Tag color={sourceColors[value] ?? 'default'}>{value}</Tag>,
  },
]

const paginationConfig = { pageSize: 10, size: 'small' }
const emptyCatalog = <Empty description="Catalog is empty — add tests manually, import a JSON file, or harvest from stored runs" />

export default function TestCatalogModal({ open, onClose }) {
  const [form] = Form.useForm()
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [harvesting, setHarvesting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
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

  const addManual = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // keep the form for the user to fix
    }
    setAdding(true)
    try {
      await createAutomatedTest(values)
      form.resetFields()
      message.success('Test added to catalog')
      refresh()
    } catch (error) {
      message.error(error.message || 'Failed to add test')
    } finally {
      setAdding(false)
    }
  }

  const harvest = async () => {
    setHarvesting(true)
    try {
      const result = await harvestAutomatedTests()
      message.success(`Harvested from runs: ${result.created} added, ${result.skipped} already in catalog`)
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
      message.success(`Test "${test.display}" removed from catalog`)
      refresh()
    } catch (error) {
      message.error(error.message || 'Failed to delete test')
    } finally {
      setDeletingId(null)
    }
  }

  const columns = [
    ...staticColumns,
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
          <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`Remove ${test.display}`} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Modal
      title="Automated test catalog"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={860}
      destroyOnHidden
    >
      <Paragraph type="secondary">
        Catalog tests appear in every report with status <Text code>No run</Text> until the automation
        posts a run for their <Text code>resultPath</Text> via <Text code>POST /api/results</Text>.
        Runs are matched to reports by date window, not by an explicit link.
      </Paragraph>

      <Form form={form} layout="inline" style={{ marginBottom: 12, rowGap: 8 }}>
        <Form.Item name="resultPath" rules={[{ required: true, message: 'Enter the result path' }]} style={{ flex: 1.6 }}>
          <Input placeholder="resultPath — Java test class (e.g. com.acme.shop.checkout.PaymentFlowTest)" maxLength={300} />
        </Form.Item>
        <Form.Item name="display" rules={[{ required: true, message: 'Enter a display name' }]} style={{ flex: 1.6 }}>
          <Input placeholder="Display name (e.g. Checkout payment flow)" maxLength={300} />
        </Form.Item>
        <Form.Item name="defaultSuiteName" style={{ flex: 1 }}>
          <Input placeholder="Suite (optional)" maxLength={200} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} loading={adding} onClick={addManual}>Add</Button>
            <Upload accept=".json" showUploadList={false} beforeUpload={(file) => { handleFile(file); return false }}>
              <Button icon={<UploadOutlined />} loading={importing && !preview}>From JSON file</Button>
            </Upload>
            <Tooltip title="Register every distinct path seen in stored runs">
              <Button icon={<ImportOutlined />} loading={harvesting} onClick={harvest}>Harvest from runs</Button>
            </Tooltip>
          </Space>
        </Form.Item>
      </Form>

      <div className="form-hint" style={{ marginBottom: 12 }}>
        <Text code>.json</Text> file contract: an array of{' '}
        <Text code>{'{ resultPath, display, fullResponsibility?, defaultSuiteName?, defaultCaseName?, defaultOwner?, tags? }'}</Text>.
        Entries whose <Text code>resultPath</Text> already exists are updated, not duplicated.
      </div>

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
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={catalog}
        pagination={catalog.length > 10 ? paginationConfig : false}
        locale={{ emptyText: emptyCatalog }}
      />
    </Modal>
  )
}

import { Button, Empty, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'

const { Text } = Typography

const sourceColors = { file: 'blue', harvested: 'green', manual: 'purple' }

// The API upserts by resultPath and forbids non-whitelisted fields, so only
// DTO fields are sent when toggling the visibility flag.
export function toDtoPayload(test) {
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

export const caseEmptyText = <Empty description="No tests in this suite" />
export const catalogEmptyText = <Empty description="Catalog is empty — import a JSON file or harvest from stored runs" />

export function getCaseColumns({ togglingId, deletingId, onToggleVisible, onRemove }) {
  return [
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
          onChange={(checked) => onToggleVisible(test, checked)}
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
          onConfirm={() => onRemove(test)}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`Remove ${(test.defaultCaseName || test.resultPath)}`} />
        </Popconfirm>
      ),
    },
  ]
}

export function getSuiteColumns({ bulkUpdating, suiteIsVisible, onToggleSuiteVisibility }) {
  return [{
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
          onChange={(visible) => onToggleSuiteVisibility(suite, visible)}
          aria-label={`Show ${suiteName} suite in reports`}
        />
      </Space>
    ),
  }]
}

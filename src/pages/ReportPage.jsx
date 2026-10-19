import { useMemo, useState } from 'react'
import { Button, Card, Select, Space, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, BarChartOutlined, ReloadOutlined } from '@ant-design/icons'
import ResultsChart from '../components/ResultsChart'
import { SuiteTable } from '../components/ReportTables'
import { envColors } from '../constants'
import { formatDate } from '../utils/format'

const { Title, Text } = Typography

const cardBody = { padding: 0 }
const suiteFallback = 'Без набора'

// GET /reports/:id/results returns visible catalog tests plus the latest run
// overlapping the report date range (`no_run` otherwise). A run is shown only
// after its path has been registered in the catalog through Harvest.
function buildReportView(results, filters) {
  const matched = []
  const tally = { passed: 0, failed: 0, broken: 0, skipped: 0, no_run: 0 }
  for (const row of results) {
    const owner = row.owner || 'Не назначен'
    const tags = Array.isArray(row.tags) ? row.tags : []
    if (filters.statuses.length && !filters.statuses.includes(row.status)) continue
    if (filters.owners.length && !filters.owners.includes(owner)) continue
    if (filters.tags.length && !filters.tags.some((tag) => tags.includes(tag))) continue
    matched.push(row)
    if (tally[row.status] !== undefined) tally[row.status] += 1
  }
  const suites = []
  const suitesByName = new Map()
  for (const test of matched) {
    const suiteName = test.suiteName || suiteFallback
    let suite = suitesByName.get(suiteName)
    if (!suite) {
      suite = { key: `suite-${suites.length}`, suiteName, tests: [] }
      suitesByName.set(suiteName, suite)
      suites.push(suite)
    }
    suite.tests.push(test)
  }
  for (const suite of suites) {
    suite.tests.sort((a, b) => (a.caseName || a.name || '').localeCompare(b.caseName || b.name || '', undefined, { sensitivity: 'base' }))
  }
  suites.sort((a, b) => a.suiteName.localeCompare(b.suiteName, undefined, { sensitivity: 'base' }))
  return { tests: matched, suites, counts: tally }
}

const statusOptions = [
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'broken', label: 'Broken' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'no_run', label: 'No run' },
]

export default function ReportPage({ data, phase, report, navigate, reload }) {
  const [statuses, setStatuses] = useState([])
  const [owners, setOwners] = useState([])
  const [tags, setTags] = useState([])
  const filters = { statuses, owners, tags }

  const { tests, suites, counts } = useMemo(
    () => buildReportView(data.results, filters),
    [data.results, statuses, owners, tags],
  )

  const ownerOptions = useMemo(() => [...new Set(data.results.map((row) => row.owner || 'Не назначен'))]
    .sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })), [data.results])
  const tagOptions = useMemo(() => [...new Set(data.results.flatMap((row) => Array.isArray(row.tags) ? row.tags : []))]
    .sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })), [data.results])

  return (
    <>
      <div className="back-link" onClick={() => navigate({ page: 'reports', phaseId: phase.id, phase })}><ArrowLeftOutlined /> Назад к {phase.name}</div>
      <div className="report-header">
        <div>
          <Text className="eyebrow">ОТЧЁТ · {formatDate(report.startDate)} — {formatDate(report.endDate)}</Text>
          <Title level={1}>{report.name}</Title>
          <Space>
            <Tag color={envColors[phase.environment]}>{phase.environment}</Tag>
            <Text type="secondary">{phase.name}</Text>
            <span className="dot-separator">·</span>
            <Text type="secondary">Создал {report.author}</Text>
          </Space>
        </div>
        <Space>
          <Button icon={<BarChartOutlined />} onClick={() => navigate({ page: 'analytics', phaseId: phase.id, reportId: report.id, phase, report })}>Открыть аналитику</Button>
          <Button icon={<ReloadOutlined />} onClick={reload}>Обновить результаты</Button>
        </Space>
      </div>
      <ResultsChart counts={counts} total={tests.length} />
      <div className="toolbar report-toolbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto', width: '100%' }}>
        <Select
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder="Результат прохождения"
          options={statusOptions}
          value={statuses}
          onChange={setStatuses}
           className="report-filter-select"
          style={{ width: '100%', minWidth: 0 }}
        />
        <Select
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder="Владелец теста"
          options={ownerOptions}
          value={owners}
          onChange={setOwners}
           className="report-filter-select"
          style={{ width: '100%', minWidth: 0 }}
        />
        <Select
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder="Теги теста"
          options={tagOptions}
          value={tags}
          onChange={setTags}
           className="report-filter-select"
          style={{ width: '100%', minWidth: 0 }}
        />
        <Text type="secondary">Показано <strong>{tests.length}</strong> кейсов в <strong>{suites.length}</strong> наборах</Text>
      </div>
      <Card className="table-card test-table-card" styles={{ body: cardBody }}>
        <SuiteTable suites={suites} reload={reload} />
      </Card>
    </>
  )
}

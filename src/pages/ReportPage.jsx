import { useMemo, useState } from 'react'
import { Button, Card, Input, Space, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, BarChartOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import ResultsChart from '../components/ResultsChart'
import { SuiteTable } from '../components/ReportTables'
import { envColors } from '../constants'
import { formatDate } from '../utils/format'

const { Title, Text } = Typography

const cardBody = { padding: 0 }
const suiteFallback = 'Unassigned suite'

// GET /reports/:id/results returns visible catalog tests plus the latest run
// overlapping the report date range (`no_run` otherwise). A run is shown only
// after its path has been registered in the catalog through Harvest.
function buildReportView(results, query) {
  const normalized = query.toLowerCase()
  const matched = []
  const tally = { passed: 0, failed: 0, broken: 0, skipped: 0, no_run: 0 }
  for (const row of results) {
    if (normalized
      && !row.name.toLowerCase().includes(normalized)
      && !row.path.toLowerCase().includes(normalized)) continue
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

export default function ReportPage({ data, phase, report, navigate, reload }) {
  const [query, setQuery] = useState('')

  const { tests, suites, counts } = useMemo(
    () => buildReportView(data.results, query),
    [data.results, query],
  )

  return (
    <>
      <div className="back-link" onClick={() => navigate({ page: 'reports', phaseId: phase.id, phase })}><ArrowLeftOutlined /> Back to {phase.name}</div>
      <div className="report-header">
        <div>
          <Text className="eyebrow">REPORT · {formatDate(report.startDate)} — {formatDate(report.endDate)}</Text>
          <Title level={1}>{report.name}</Title>
          <Space>
            <Tag color={envColors[phase.environment]}>{phase.environment}</Tag>
            <Text type="secondary">{phase.name}</Text>
            <span className="dot-separator">·</span>
            <Text type="secondary">Created by {report.author}</Text>
          </Space>
        </div>
        <Space>
          <Button icon={<BarChartOutlined />} onClick={() => navigate({ page: 'analytics', phaseId: phase.id, reportId: report.id, phase, report })}>Open analytics</Button>
          <Button icon={<ReloadOutlined />} onClick={reload}>Refresh results</Button>
        </Space>
      </div>
      <ResultsChart counts={counts} total={tests.length} />
      <div className="toolbar report-toolbar">
        <Input prefix={<SearchOutlined />} placeholder="Search tests by name or result path" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Text type="secondary">Showing <strong>{tests.length}</strong> cases in <strong>{suites.length}</strong> suites</Text>
      </div>
      <Card className="table-card test-table-card" styles={{ body: cardBody }}>
        <SuiteTable suites={suites} reload={reload} />
      </Card>
    </>
  )
}

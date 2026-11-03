import { useMemo, useState } from 'react'
import { Card, Select, Typography } from 'antd'
import ResultsChart from './ResultsChart'
import { SuiteTable } from './ReportTables'
import { buildReportView } from '../utils/reportView'

const { Text } = Typography

const cardBody = { padding: 0 }

const statusOptions = [
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'broken', label: 'Broken' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'no_run', label: 'No run' },
]

/**
 * The chart, filters and suite table shared by the report page and the launch
 * report page. Filters are local to the explorer so both pages get the same
 * behaviour without duplicating the wiring.
 */
export default function ResultsExplorer({ results, reload, onOpenDetails }) {
  const [statuses, setStatuses] = useState([])
  const [epics, setEpics] = useState([])
  const [owners, setOwners] = useState([])
  const [tags, setTags] = useState([])

  const filters = useMemo(() => ({ statuses, epics, owners, tags }), [statuses, epics, owners, tags])
  const { tests, suites, counts } = useMemo(() => buildReportView(results, filters), [results, filters])

  const ownerOptions = useMemo(() => [...new Set(results.map((row) => row.owner || 'Не назначен'))]
    .sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })), [results])
  const epicOptions = useMemo(() => [...new Set(results.map((row) => row.epic).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })), [results])
  const tagOptions = useMemo(() => [...new Set(results.flatMap((row) => Array.isArray(row.tags) ? row.tags : []))]
    .sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })), [results])

  return (
    <>
      <ResultsChart counts={counts} total={tests.length} />
      <div className="toolbar report-toolbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) auto', width: '100%' }}>
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
          placeholder="Эпик"
          options={epicOptions}
          value={epics}
          onChange={setEpics}
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
        <SuiteTable suites={suites} reload={reload} onOpenDetails={onOpenDetails} />
      </Card>
    </>
  )
}

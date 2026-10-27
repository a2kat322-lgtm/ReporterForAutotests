import { Table, Tag, Typography } from 'antd'
import { formatDate, formatDuration } from '../../../utils/format'
import { STATUS_COLORS } from '../constants'
import { pct } from '../utils'

const { Text } = Typography

// Static column set: rebuilt columns make antd Table re-render every row.
const columns = [
  {
    title: 'ОТЧЁТ',
    key: 'name',
    width: 180,
    fixed: 'left',
    render: (_, row) => (
      <div className="phase-report-cell">
        <Text strong>{row.name}</Text>
        <Text type="secondary">{formatDate(row.startDate)} — {formatDate(row.endDate)}</Text>
      </div>
    ),
  },
  { title: 'ВСЕГО', dataIndex: 'total', key: 'total', width: 60, align: 'right', sorter: (a, b) => a.total - b.total },
  { title: 'PASSED', dataIndex: ['counts', 'passed'], key: 'passed', width: 64, align: 'right', sorter: (a, b) => a.counts.passed - b.counts.passed, render: (value) => <span style={{ color: STATUS_COLORS.passed }}>{value}</span> },
  { title: 'FAILED', dataIndex: ['counts', 'failed'], key: 'failed', width: 62, align: 'right', sorter: (a, b) => a.counts.failed - b.counts.failed, render: (value) => <span style={{ color: STATUS_COLORS.failed }}>{value}</span> },
  { title: 'BROKEN', dataIndex: ['counts', 'broken'], key: 'broken', width: 66, align: 'right', sorter: (a, b) => a.counts.broken - b.counts.broken, render: (value) => <span style={{ color: STATUS_COLORS.broken }}>{value}</span> },
  { title: 'SKIPPED', dataIndex: ['counts', 'skipped'], key: 'skipped', width: 68, align: 'right', sorter: (a, b) => a.counts.skipped - b.counts.skipped },
  { title: 'NO RUN', dataIndex: ['counts', 'no_run'], key: 'no_run', width: 64, align: 'right', sorter: (a, b) => a.counts.no_run - b.counts.no_run },
  { title: 'PASS RATE', dataIndex: 'passRate', key: 'passRate', width: 84, align: 'right', sorter: (a, b) => a.passRate - b.passRate, render: pct },
  { title: 'COVERAGE', dataIndex: 'coverage', key: 'coverage', width: 84, align: 'right', sorter: (a, b) => a.coverage - b.coverage, render: pct },
  { title: 'P90', dataIndex: 'p90', key: 'p90', width: 80, align: 'right', sorter: (a, b) => (a.p90 || 0) - (b.p90 || 0), render: formatDuration },
  { title: 'FLAKY', dataIndex: 'flaky', key: 'flaky', width: 60, align: 'right', sorter: (a, b) => a.flaky - b.flaky, render: (value) => value ? <Tag color="orange">{value}</Tag> : <Text type="secondary">—</Text> },
  { title: 'РЕГРЕССЫ', dataIndex: 'newFailures', key: 'newFailures', width: 88, align: 'right', sorter: (a, b) => a.newFailures - b.newFailures, render: (value) => value ? <Tag color="red">{value}</Tag> : <Text type="secondary">—</Text> },
  { title: 'FIXED', dataIndex: 'fixed', key: 'fixed', width: 72, align: 'right', sorter: (a, b) => a.fixed - b.fixed, render: (value) => value ? <Tag color="green">{value}</Tag> : <Text type="secondary">—</Text> },
  { title: 'АНАЛИЗ', dataIndex: 'analysisRate', key: 'analysisRate', width: 76, align: 'right', sorter: (a, b) => a.analysisRate - b.analysisRate, render: pct },
]

const scroll = { x: 1120 }

export default function ReportComparison({ reports, phase, navigate }) {
  return (
    <Table
      className="phase-comparison-table"
      rowKey="reportId"
      size="small"
      columns={columns}
      dataSource={reports}
      pagination={false}
      scroll={scroll}
      onRow={(row) => ({
        onClick: () => navigate({
          page: 'analytics',
          phaseId: phase.id,
          reportId: row.reportId,
          phase,
          report: { id: row.reportId, name: row.name, startDate: row.startDate, endDate: row.endDate },
        }),
      })}
    />
  )
}

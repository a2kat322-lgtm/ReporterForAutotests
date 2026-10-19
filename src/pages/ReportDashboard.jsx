import { useMemo } from 'react'
import { Button, Card, Col, Empty, Progress, Row, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, BarChartOutlined } from '@ant-design/icons'
import { DurationProfile, ColumnChart, ParetoChart, StackedBarChart } from '../components/charts/SimpleCharts'
import { formatDate, formatDuration } from '../utils/format'
import { normalizeErrorMessage } from '../utils/errorSignature'

const { Title, Text } = Typography

const statuses = [
  { key: 'passed', label: 'Passed', color: '#4ade80' },
  { key: 'failed', label: 'Failed', color: '#fb7185' },
  { key: 'broken', label: 'Broken', color: '#fbbf24' },
  { key: 'skipped', label: 'Skipped', color: '#9ca0af' },
  { key: 'no_run', label: 'No run', color: 'var(--result-no-run)' },
]

const STATUS_META = {
  passed: { label: 'Passed', tag: 'green', symbol: '✓' },
  failed: { label: 'Failed', tag: 'red', symbol: '✕' },
  broken: { label: 'Broken', tag: 'orange', symbol: '!' },
  skipped: { label: 'Skipped', tag: 'default', symbol: '–' },
  no_run: { label: 'No run', tag: 'default', symbol: '·' },
}

const FAILURE_STATUSES = new Set(['failed', 'broken'])
const DURATION_BUCKETS = [
  { label: '<1с', max: 1000 },
  { label: '1–5с', max: 5000 },
  { label: '5–15с', max: 15000 },
  { label: '15–60с', max: 60000 },
  { label: '>60с', max: Number.POSITIVE_INFINITY },
]
const STABILITY_BANDS = [
  { label: '0–20%', min: 0, max: 20 },
  { label: '21–40%', min: 21, max: 40 },
  { label: '41–60%', min: 41, max: 60 },
  { label: '61–80%', min: 61, max: 80 },
  { label: '81–100%', min: 81, max: 100 },
]
const STATUS_COLORS = {
  Passed: '#4ade80',
  Failed: '#fb7185',
  Broken: '#fbbf24',
  Skipped: '#9ca0af',
  'No run': '#737684',
}
const STATUS_SERIES = Object.entries(STATUS_COLORS).map(([label, color]) => ({ key: label, label, color }))

function emptyCounts() {
  return Object.fromEntries(statuses.map(({ key }) => [key, 0]))
}

function rate(part, total) {
  return total ? Math.round(part / total * 100) : null
}

function showRate(value) {
  return value == null ? '—' : `${value}%`
}

function percentile(values, rank) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))
  return sorted[index]
}

function Metric({ label, value, note, color }) {
  return <Card className="analytics-metric"><Text type="secondary">{label}</Text><div className="analytics-metric-value" style={color ? { color } : undefined}>{value}</div><Text type="secondary">{note}</Text></Card>
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.no_run
  return <Tag color={meta.tag}>{meta.label}</Tag>
}

function RunHistory({ statuses: recent = [] }) {
  if (!recent.length) return <Text type="secondary">—</Text>
  return (
    <span className="run-history" aria-label={`Последние запуски: ${recent.map((status) => STATUS_META[status]?.label || status).join(', ')}`}>
      {recent.map((status, index) => {
        const meta = STATUS_META[status] || STATUS_META.no_run
        return <i key={`${status}-${index}`} className={`run-history-dot ${status}`} title={`${index === 0 ? 'последний' : `${index + 1}-й с конца`}: ${meta.label}`}>{meta.symbol}</i>
      })}
    </span>
  )
}

function StatusChart({ counts, total }) {
  return <Card title="Обзор результатов" className="analytics-card"><div className="analytics-status-list">
    {statuses.map(({ key, label, color }) => {
      const count = counts[key] || 0
      return <div className="analytics-status-row" key={key}><div className="analytics-status-label"><i style={{ background: color }} />{label}</div><Progress percent={total ? Math.round(count / total * 100) : 0} showInfo={false} strokeColor={color} trailColor="var(--result-track)"/><strong>{count}</strong></div>
    })}
  </div></Card>
}

function DurationStats({ metrics }) {
  return (
    <Card
      title="Длительность"
      className="analytics-card"
      extra={<Text type="secondary">{metrics.timed ? `${metrics.timed} запусков с временем` : 'нет данных'}</Text>}
    >
      {metrics.timed ? (
        <>
          <div className="duration-percentiles">
            {[['p50', metrics.p50], ['p90', metrics.p90], ['p95', metrics.p95], ['p99', metrics.p99]].map(([label, value]) => (
              <div className="duration-percentile" key={label}>
                <Text type="secondary">{label}</Text>
                <strong>{formatDuration(value)}</strong>
              </div>
            ))}
          </div>
          <StackedBarChart
            rows={metrics.durationBandData}
            labelKey="bucket"
            seriesKey="status"
            valueKey="count"
            series={STATUS_SERIES}
            height={240}
            labelLimit={6}
          />
        </>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных о длительности" />}
    </Card>
  )
}

function SuiteDurationBox({ data }) {
  const groups = useMemo(() => {
    const map = new Map()
    for (const item of data) {
      const values = map.get(item.suite) || []
      values.push(item.duration)
      map.set(item.suite, values)
    }
    return [...map.entries()].map(([label, values]) => ({ label, values }))
  }, [data])

  return (
    <Card title="Разброс длительности по наборам" className="analytics-card" extra={<Text type="secondary">p90 и медиана, секунды</Text>}>
      <DurationProfile groups={groups} height={300} />
    </Card>
  )
}

function StabilityChart({ data }) {
  return (
    <Card title="Стабильность тестов" className="analytics-card" extra={<Text type="secondary">по executed runs</Text>}>
      {data.some((item) => item.count > 0) ? (
        <ColumnChart rows={data} labelKey="band" valueKey="count" color="#8b5cf6" height={280} />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет запусков для оценки стабильности" />}
    </Card>
  )
}

function RetryChart({ data }) {
  return (
    <Card title="Запуски на тест" className="analytics-card" extra={<Text type="secondary">ретраи</Text>}>
      {data.some((item) => item.count > 0) ? (
        <ColumnChart rows={data} labelKey="band" valueKey="count" color="#38bdf8" height={280} />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет запусков" />}
    </Card>
  )
}

function OwnerStackedBar({ data }) {
  return (
    <StackedBarChart
      rows={data}
      labelKey="owner"
      seriesKey="status"
      valueKey="count"
      series={STATUS_SERIES}
      height={260}
      horizontal
      normalize
    />
  )
}

function ErrorPareto({ data }) {
  const chartData = data.map((row, index) => ({ ...row, index: index + 1 }))
  return <ParetoChart rows={chartData} height={280} />
}

function SuiteTable({ suites }) {
  const columns = [
    { title: 'НАБОР', dataIndex: 'name', width: 128, render: (name) => <Text ellipsis={{ tooltip: name }}>{name}</Text> },
    { title: 'ВСЕГО', dataIndex: 'total', width: 56, align: 'right', sorter: (a, b) => a.total - b.total },
    { title: 'PASS RATE', dataIndex: 'passRate', width: 78, align: 'right', sorter: (a, b) => (a.passRate || 0) - (b.passRate || 0), render: showRate },
    { title: 'FAIL+BROKEN', key: 'failed', width: 90, align: 'right', sorter: (a, b) => (a.failed + a.broken) - (b.failed + b.broken), render: (_, row) => <span style={{ color: '#fb7185' }}>{row.failed + row.broken}</span> },
    { title: 'NO RUN', dataIndex: 'noRun', width: 68, align: 'right', sorter: (a, b) => a.noRun - b.noRun },
    { title: 'P90', dataIndex: 'p90', width: 100, align: 'right', sorter: (a, b) => (a.p90 || 0) - (b.p90 || 0), render: formatDuration },
  ]
  return <Table rowKey="name" size="small" tableLayout="fixed" columns={columns} dataSource={suites} pagination={false} scroll={{ x: 520, y: 420 }} />
}

function SignatureSection({ signatures, failedTotal }) {
  const columns = [
    {
      title: 'ПОДПИСЬ ОШИБКИ',
      dataIndex: 'signature',
      render: (signature, row) => (
        <div className="signature-cell">
          <Text ellipsis={{ tooltip: row.message }}>{signature}</Text>
          <Text type="secondary" ellipsis={{ tooltip: row.message }}>{row.message}</Text>
        </div>
      ),
    },
    { title: 'КОЛ-ВО', dataIndex: 'count', width: 84, align: 'right', sorter: (a, b) => a.count - b.count, render: (value) => <Tag color="red">{value}</Tag> },
    { title: 'ДОЛЯ', dataIndex: 'share', width: 76, align: 'right', sorter: (a, b) => a.share - b.share, render: (value) => showRate(Math.round(value * 100)) },
  ]
  return (
    <Card
      title="Подписи ошибок"
      className="analytics-card"
      extra={<Text type="secondary">Парето: столбцы — частота, линия — накопленная доля</Text>}
    >
      {failedTotal ? (
        <>
          <ErrorPareto data={signatures} />
          <Table rowKey="signature" size="small" tableLayout="fixed" columns={columns} dataSource={signatures} pagination={false} scroll={{ y: 240 }} />
        </>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В отчёте нет падений" />}
    </Card>
  )
}

function StaleGreenTable({ tests }) {
  const columns = [
    {
      title: 'ТЕСТ',
      dataIndex: 'name',
      render: (name, test) => (
        <div className="analytics-test-cell">
          <Text strong ellipsis={{ tooltip: test.path }}>{name || test.caseName}</Text>
          <Text type="secondary" ellipsis={{ tooltip: test.path }}>{test.path}</Text>
        </div>
      ),
    },
    { title: 'ПОСЛЕДНИЙ СТАТУС', dataIndex: 'latestStatus', width: 120, render: (status) => <StatusBadge status={status} /> },
    { title: 'ПОСЛЕДНИЙ ЗАПУСК', dataIndex: 'latestStartDate', width: 150, render: (value) => formatDate(value, true) },
    { title: 'ПРИЧИНА', dataIndex: 'latestFailureReason', width: 140, render: (reason) => reason ? <Tag color="orange">{reason}</Tag> : <Text type="secondary">—</Text> },
    { title: 'СООБЩЕНИЕ', dataIndex: 'latestMessage', render: (message) => message ? <Text ellipsis={{ tooltip: message }}>{message}</Text> : <Text type="secondary">—</Text> },
    { title: 'ЗАПУСКОВ', dataIndex: 'runCount', width: 90, align: 'right', render: (value) => value ?? 0 },
  ]
  return (
    <Card
      title="Stale green"
      className="analytics-card"
      extra={<Text type="secondary">отчёт показывает passed, но последний запуск — failed/broken</Text>}
    >
      {tests.length ? <Table rowKey="path" size="small" tableLayout="fixed" columns={columns} dataSource={tests} pagination={false} scroll={{ x: 980 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Все зелёные результаты подтверждены последним запуском" />}
    </Card>
  )
}

function stability(test) {
  const passedRuns = test.passedRuns ?? (test.status === 'passed' ? 1 : 0)
  const executedRuns = passedRuns + (test.failedRuns ?? (test.status === 'failed' || test.status === 'broken' ? 1 : 0))
  if (!executedRuns) return null
  return Math.round(passedRuns / executedRuns * 100)
}

function FlakyTable({ tests, retryFixed, regressed }) {
  const columns = [
    {
      title: 'ТЕСТ',
      dataIndex: 'name',
      render: (name, test) => (
        <div className="analytics-test-cell">
          <Text strong ellipsis={{ tooltip: test.path }}>{name || test.caseName}</Text>
          <Text type="secondary" ellipsis={{ tooltip: test.path }}>{test.path}</Text>
        </div>
      ),
    },
    { title: 'ЗАПУСКОВ', dataIndex: 'runCount', width: 96, align: 'right', sorter: (a, b) => (a.runCount || 0) - (b.runCount || 0), render: (value) => value ?? 0 },
    { title: 'СТАБИЛЬНОСТЬ', key: 'stability', width: 120, align: 'right', sorter: (a, b) => (stability(a) || 0) - (stability(b) || 0), render: (_, test) => showRate(stability(test)) },
    { title: 'ПОСЛЕДНИЕ ЗАПУСКИ', key: 'history', width: 150, render: (_, test) => <RunHistory statuses={test.recentStatuses || []} /> },
    { title: 'ПОСЛЕДНИЙ', dataIndex: 'latestStatus', width: 120, render: (status) => <StatusBadge status={status} /> },
  ]
  return (
    <Card
      title="Флаки и ретраи"
      className="analytics-card"
      extra={<Text type="secondary">исправлено ретраем: {retryFixed} · регресс: {regressed}</Text>}
    >
      {tests.length ? <Table rowKey="path" size="small" tableLayout="fixed" columns={columns} dataSource={tests} pagination={false} scroll={{ x: 820, y: 320 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Флаки не обнаружены" />}
    </Card>
  )
}

export default function ReportDashboard({ data, phase, report, navigate }) {
  const results = data.results || []
  const metrics = useMemo(() => {
    const counts = emptyCounts()
    const suites = new Map()
    const owners = new Map()
    const signatures = new Map()
    const reasons = new Map()
    const failureFeedback = new Map()
    const durations = []
    const histogram = DURATION_BUCKETS.map(() => emptyCounts())
    const suiteDurationData = []
    let duration = 0
    let timed = 0
    let analysisTotal = 0
    let analysisDone = 0

    for (const test of results) {
      counts[test.status] = (counts[test.status] || 0) + 1
      const durationMs = test.durationMs
      if (durationMs > 0) {
        duration += durationMs
        timed += 1
        durations.push(durationMs)
        const bucketIndex = DURATION_BUCKETS.findIndex((bucket) => durationMs < bucket.max)
        histogram[bucketIndex < 0 ? DURATION_BUCKETS.length - 1 : bucketIndex][test.status] += 1
      }

      const suiteName = test.suiteName || 'Без набора'
      const suite = suites.get(suiteName) || { name: suiteName, total: 0, counts: emptyCounts(), durations: [] }
      suite.total += 1
      suite.counts[test.status] = (suite.counts[test.status] || 0) + 1
      if (durationMs > 0) {
        suite.durations.push(durationMs)
        suiteDurationData.push({ suite: suiteName, duration: Number((durationMs / 1000).toFixed(3)) })
      }
      suites.set(suiteName, suite)

      const owner = test.owner || 'Не назначен'
      const ownerStats = owners.get(owner) || {
        owner,
        counts: emptyCounts(),
        total: 0,
        failed: 0,
        needsAnalysis: 0,
        durations: [],
        flaky: 0,
        stale: 0,
      }
      ownerStats.counts[test.status] = (ownerStats.counts[test.status] || 0) + 1
      ownerStats.total += 1
      if (durationMs > 0) ownerStats.durations.push(durationMs)
      if (test.flaky || (test.everPassed && test.everFailed)) ownerStats.flaky += 1
      if (test.staleGreen) ownerStats.stale += 1
      owners.set(owner, ownerStats)

      if (FAILURE_STATUSES.has(test.status)) {
        ownerStats.failed += 1
        analysisTotal += 1
        if (!test.failureReason?.trim()) ownerStats.needsAnalysis += 1
        else analysisDone += 1

        const signature = normalizeErrorMessage(test.message)
        const current = signatures.get(signature) || {
          signature,
          message: test.message?.trim() || '(без сообщения)',
          count: 0,
        }
        current.count += 1
        signatures.set(signature, current)

        const reason = test.failureReason?.trim() || '(null)'
        reasons.set(reason, (reasons.get(reason) || 0) + 1)

        const comment = test.failureComment?.trim() || ''
        if (reason !== '(null)' || comment) {
          const key = `${reason}\u0000${comment}`
          const feedback = failureFeedback.get(key) || { reason: reason === '(null)' ? '' : reason, comment, count: 0 }
          feedback.count += 1
          failureFeedback.set(key, feedback)
        }
      }
    }

    const total = results.length
    const passed = counts.passed
    const executed = counts.passed + counts.failed + counts.broken + counts.skipped
    const failedTotal = counts.failed + counts.broken
    const signatureRows = [...signatures.values()]
      .map((row) => ({ ...row, share: failedTotal ? row.count / failedTotal : 0 }))
      .sort((left, right) => right.count - left.count || left.signature.localeCompare(right.signature))
      .slice(0, 10)
    const ownerRows = [...owners.values()]
      .map((row) => ({
        ...row,
        p90: percentile(row.durations, 0.9),
        passRate: rate(row.counts.passed, row.total),
      }))
      .sort((left, right) => right.failed - left.failed || right.total - left.total)
    const suiteRows = [...suites.values()]
      .map((row) => ({
        name: row.name,
        total: row.total,
        failed: row.counts.failed,
        broken: row.counts.broken,
        noRun: row.counts.no_run,
        passRate: rate(row.counts.passed, row.total),
        p90: percentile(row.durations, 0.9),
      }))
      .sort((left, right) => (right.failed + right.broken) - (left.failed + left.broken) || right.total - left.total)
    const flakyTests = results
      .filter((test) => test.flaky || (test.everPassed && test.everFailed))
      .sort((left, right) => (stability(left) ?? 101) - (stability(right) ?? 101) || (right.runCount || 0) - (left.runCount || 0))
    const staleGreenTests = results
      .filter((test) => test.staleGreen)
      .sort((left, right) => new Date(right.latestStartDate || 0).valueOf() - new Date(left.latestStartDate || 0).valueOf())
    const retryFixed = results.filter((test) => test.retryFixed).length
    const regressed = results.filter((test) => test.regressed).length
    const slowTests = [...results].filter((test) => test.durationMs > 0).sort((left, right) => right.durationMs - left.durationMs).slice(0, 8)
    const durationBandData = DURATION_BUCKETS.flatMap((bucket, index) => (
      ['passed', 'failed', 'broken', 'skipped'].map((status) => ({
        bucket: bucket.label,
        status: STATUS_META[status].label,
        count: histogram[index][status],
      }))
    )).filter((item) => item.count > 0)
    const stabilityBands = STABILITY_BANDS.map((band) => ({ band: band.label, count: 0 }))
    for (const test of results) {
      const value = stability(test)
      if (value == null) continue
      const index = STABILITY_BANDS.findIndex((band) => value >= band.min && value <= band.max)
      if (index >= 0) stabilityBands[index].count += 1
    }
    const runCountBands = [
      { band: '1', count: 0 },
      { band: '2', count: 0 },
      { band: '3', count: 0 },
      { band: '4+', count: 0 },
    ]
    for (const test of results) {
      const runCount = test.runCount ?? (test.resultId ? 1 : 0)
      if (!runCount) continue
      runCountBands[Math.min(runCount, 4) - 1].count += 1
    }
    const ownerStackData = ownerRows.flatMap((row) => (
      statuses.map(({ key, label }) => ({ owner: row.owner, status: label, count: row.counts[key] || 0 }))
    )).filter((item) => item.count > 0)
    let cumulative = 0
    const paretoData = signatureRows.map((row) => {
      cumulative += row.share * 100
      return { ...row, cumulative: Math.min(100, Math.round(cumulative * 10) / 10) }
    })

    return {
      counts,
      total,
      passed,
      executed,
      passRate: rate(passed, total),
      effectivePassRate: rate(passed, executed),
      coverage: rate(executed, total),
      duration,
      timed,
      p50: percentile(durations, 0.5),
      p90: percentile(durations, 0.9),
      p95: percentile(durations, 0.95),
      p99: percentile(durations, 0.99),
      durationBandData,
      suiteDurationData,
      stabilityBands,
      runCountBands,
      ownerStackData,
      suites: suiteRows,
      owners: ownerRows,
      signatures: paretoData,
      failedTotal,
      reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
      reasonTotal: failedTotal,
      failureFeedback: [...failureFeedback.values()].map((item, index) => ({ ...item, key: `${item.reason}-${item.comment}-${index}` })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason) || left.comment.localeCompare(right.comment)),
      analysisTotal,
      analysisDone,
      flakyTests,
      staleGreenTests,
      retryFixed,
      regressed,
      slowTests,
    }
  }, [results])

  const needsAnalysis = metrics.owners.filter((row) => row.needsAnalysis > 0).map((row) => ({ ...row, key: row.owner }))
  const ownerColWidth = Math.min(Math.max(8, ...metrics.owners.map((row) => row.owner.length)) * 8 + 48, 300)
  const ownerColumns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: ownerColWidth, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    {
      title: 'PASSED',
      key: 'passed',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.counts.passed - b.counts.passed,
      render: (_, row) => {
        const percent = row.total ? Math.round(row.counts.passed / row.total * 100) : 0
        return row.counts.passed ? <Tag color="green">{row.counts.passed} · {percent}%</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'FAIL+BROKEN',
      key: 'failed',
      width: 124,
      align: 'right',
      sorter: (a, b) => (a.counts.failed + a.counts.broken) - (b.counts.failed + b.counts.broken),
      render: (_, row) => {
        const failed = row.counts.failed + row.counts.broken
        const percent = row.total ? Math.round(failed / row.total * 100) : 0
        return failed ? <Tag color="red">{failed} · {percent}%</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'SKIPPED',
      key: 'skipped',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.counts.skipped - b.counts.skipped,
      render: (_, row) => row.counts.skipped ? <Tag>{row.counts.skipped}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'NO RUN',
      key: 'no_run',
      width: 88,
      align: 'right',
      sorter: (a, b) => a.counts.no_run - b.counts.no_run,
      render: (_, row) => row.counts.no_run ? <Tag>{row.counts.no_run}</Tag> : <Text type="secondary">—</Text>,
    },
    { title: 'ВСЕГО', dataIndex: 'total', width: 76, align: 'right', render: (total) => <Tag>{total}</Tag> },
    { title: 'P90', dataIndex: 'p90', width: 92, align: 'right', render: formatDuration },
    { title: 'FLAKY', dataIndex: 'flaky', width: 78, align: 'right', render: (value) => value ? <Tag color="orange">{value}</Tag> : <Text type="secondary">—</Text> },
  ]
  const reasonColumns = [
    { title: 'РЕЗУЛЬТАТ АНАЛИЗА', dataIndex: 'reason', render: (reason) => reason === '(null)' ? <Text type="secondary">null (не указано)</Text> : <Text>{reason}</Text> },
    { title: 'КОЛ-ВО / %', key: 'countPercent', align: 'right', width: 130, render: (_, row) => {
      const percent = metrics.reasonTotal ? Math.round(row.count / metrics.reasonTotal * 100) : 0
      return <Tag color="red">{row.count} · {percent}%</Tag>
    } },
  ]
  const needsAnalysisColumns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: ownerColWidth, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    { title: 'НУЖЕН АНАЛИЗ', key: 'needsAnalysis', align: 'right', width: 150, render: (_, row) => {
      const percent = row.failed ? Math.round(row.needsAnalysis / row.failed * 100) : 0
      return <Tag color="orange">{row.needsAnalysis} · {percent}%</Tag>
    } },
  ]
  const feedbackColumns = [
    { title: 'ПРИЧИНА ПАДЕНИЯ', dataIndex: 'reason', width: 200, render: (reason) => reason || <Text type="secondary">Не указано</Text> },
    { title: 'КОММЕНТАРИЙ', dataIndex: 'comment', render: (comment) => comment || <Text type="secondary">Нет комментария</Text> },
    { title: 'КОЛИЧЕСТВО', dataIndex: 'count', width: 100, align: 'right', render: (count) => <Tag color="red">{count}</Tag> },
  ]
  const slowColumns = [
    { title: 'ТЕСТ', dataIndex: 'name', render: (name, test) => <div><Text strong>{name || test.caseName}</Text><div><Text type="secondary">{test.path}</Text></div></div> },
    { title: 'СТАТУС', dataIndex: 'status', width: 110, render: (status) => <StatusBadge status={status} /> },
    { title: 'ДЛИТЕЛЬНОСТЬ', dataIndex: 'durationMs', width: 120, render: formatDuration },
  ]
  const showReport = () => navigate({ page: 'report', phaseId: phase.id, reportId: report.id, phase, report })

  return <>
    <div className="back-link" onClick={showReport}><ArrowLeftOutlined /> Назад к отчёту</div>
    <div className="report-header analytics-header"><div><Text className="eyebrow">АНАЛИТИКА ОТЧЁТА · {phase.name}</Text><Title level={1}>{report.name}</Title><Text type="secondary">Подробная сводка качества и выполнения для этого отчёта</Text></div><Button icon={<BarChartOutlined />} onClick={showReport}>Показать тест-кейсы</Button></div>

    <Row gutter={[12, 12]} className="analytics-metrics">
      <Col xs={24} sm={12} xl={6}><Metric label="Всего тест-кейсов" value={metrics.total} note={`${metrics.suites.length} наборов`} /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Процент прохождения" value={showRate(metrics.passRate)} note={`${metrics.passed} из ${metrics.total}`} color="#4ade80" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Эффективный pass rate" value={showRate(metrics.effectivePassRate)} note={`${metrics.passed} из ${metrics.executed} прогнанных`} color="#4ade80" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Покрытие" value={showRate(metrics.coverage)} note={`${metrics.executed} из ${metrics.total} каталога`} color="#a78bfa" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Упавшие / сломанные" value={metrics.counts.failed + metrics.counts.broken} note={`${metrics.counts.failed} упало · ${metrics.counts.broken} сломано`} color="#fb7185" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="p90 времени" value={formatDuration(metrics.p90)} note={`p50 ${formatDuration(metrics.p50)} · всего ${formatDuration(metrics.duration)}`} /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Флаки" value={metrics.flakyTests.length} note="меняли статус в окне" color="#fbbf24" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Stale green" value={metrics.staleGreenTests.length} note="последний запуск упал" color="#fb7185" /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts">
      <Col xs={24} lg={8}><StatusChart counts={metrics.counts} total={metrics.total} /></Col>
      <Col xs={24} lg={16}><DurationStats metrics={metrics} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24}><SuiteDurationBox data={metrics.suiteDurationData} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24} lg={12}><StabilityChart data={metrics.stabilityBands} /></Col>
      <Col xs={24} lg={12}><RetryChart data={metrics.runCountBands} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24}>
        <Card title="Тесты по владельцам" className="analytics-card" extra={<Text type="secondary">доля статусов на владельца</Text>}>
          <OwnerStackedBar data={metrics.ownerStackData} />
          <Table rowKey="owner" tableLayout="fixed" columns={ownerColumns} dataSource={metrics.owners} pagination={false} size="small" scroll={{ x: 900 }} />
        </Card>
      </Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24} lg={12}><Card title="Наборы" className="analytics-card"><SuiteTable suites={metrics.suites} /></Card></Col>
      <Col xs={24} lg={12}><Card title="Самые медленные тест-кейсы" className="analytics-card"><Table rowKey={(test) => test.rowKey || test.path} tableLayout="fixed" columns={slowColumns} dataSource={metrics.slowTests} pagination={false} size="small" locale={{ emptyText: 'Нет данных о времени' }} /></Card></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24}><SignatureSection signatures={metrics.signatures} failedTotal={metrics.failedTotal} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24}><StaleGreenTable tests={metrics.staleGreenTests} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24}><FlakyTable tests={metrics.flakyTests} retryFixed={metrics.retryFixed} regressed={metrics.regressed} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24} lg={8}>
        <Card
          title="Результаты анализа"
          className="analytics-card"
          extra={<Text type="secondary">разобрано {metrics.analysisDone} из {metrics.analysisTotal}</Text>}
        >
          <Progress
            percent={metrics.analysisTotal ? Math.round(metrics.analysisDone / metrics.analysisTotal * 100) : 0}
            strokeColor="#4ade80"
            trailColor="var(--track)"
          />
          <Table rowKey="reason" columns={reasonColumns} dataSource={metrics.reasons} pagination={false} size="small" locale={{ emptyText: 'Нет результатов анализа в упавших тестах' }} />
        </Card>
      </Col>
      <Col xs={24} lg={8}><Card title="Требует анализа" className="analytics-card"><Table rowKey="key" columns={needsAnalysisColumns} dataSource={needsAnalysis} pagination={false} size="small" locale={{ emptyText: 'Все упавшие тесты проанализированы' }} /></Card></Col>
      <Col xs={24} lg={8}><Card title="Обратная связь по падениям" className="analytics-card"><Table rowKey="key" columns={feedbackColumns} dataSource={metrics.failureFeedback} pagination={false} size="small" locale={{ emptyText: 'Нет причин падения или комментариев' }} /></Card></Col>
    </Row>
  </>
}

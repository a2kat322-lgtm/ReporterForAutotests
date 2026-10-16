import { useMemo } from 'react'
import { Button, Card, Col, Progress, Row, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, BarChartOutlined } from '@ant-design/icons'
import { formatDuration } from '../utils/format'

const { Title, Text } = Typography
const statuses = [
  { key: 'passed', label: 'Passed', color: '#4ade80' },
  { key: 'failed', label: 'Failed', color: '#fb7185' },
  { key: 'broken', label: 'Broken', color: '#fbbf24' },
  { key: 'skipped', label: 'Skipped', color: '#9ca0af' },
  { key: 'no_run', label: 'No run', color: 'var(--result-no-run)' },
]

function Metric({ label, value, note, color }) {
  return <Card className="analytics-metric"><Text type="secondary">{label}</Text><div className="analytics-metric-value" style={{ color }}>{value}</div><Text type="secondary">{note}</Text></Card>
}

function StatusChart({ counts, total }) {
  return <Card title="Обзор результатов" className="analytics-card"><div className="analytics-status-list">
    {statuses.map(({ key, label, color }) => {
      const count = counts[key] || 0
      return <div className="analytics-status-row" key={key}><div className="analytics-status-label"><i style={{ background: color }} />{label}</div><Progress percent={total ? Math.round(count / total * 100) : 0} showInfo={false} strokeColor={color} trailColor="var(--result-track)"/><strong>{count}</strong></div>
    })}
  </div></Card>
}

function DurationChart({ suites }) {
  const max = Math.max(...suites.map((suite) => suite.duration), 1)
  return <Card title="Время выполнения по наборам" className="analytics-card"><div className="analytics-bars">{suites.length ? suites.map((suite) => <div className="analytics-bar-row" key={suite.name}><Text ellipsis title={suite.name}>{suite.name}</Text><div className="analytics-bar-track"><span style={{ width: `${Math.max(suite.duration / max * 100, 2)}%` }} /></div><Text type="secondary">{formatDuration(suite.duration)}</Text></div>) : <Text type="secondary">Нет данных о длительности.</Text>}</div></Card>
}

export default function ReportDashboard({ data, phase, report, navigate }) {
  const results = data.results || []
  const metrics = useMemo(() => {
    const counts = Object.fromEntries(statuses.map(({ key }) => [key, 0]))
    const groups = new Map()
    const owners = new Map()
    const errors = new Map()
    const reasons = new Map()
    const failureFeedback = new Map()
    let duration = 0
    let timed = 0
    for (const test of results) {
      counts[test.status] = (counts[test.status] || 0) + 1
      if (test.durationMs > 0) { duration += test.durationMs; timed += 1 }
      const suiteName = test.suiteName || 'Без набора'
      const suite = groups.get(suiteName) || { name: suiteName, duration: 0, count: 0 }
      suite.duration += test.durationMs || 0
      suite.count += 1
      groups.set(suiteName, suite)
      const owner = test.owner || 'Не назначен'
      const ownerStats = owners.get(owner) || { owner, counts: Object.fromEntries(statuses.map(({ key }) => [key, 0])), total: 0, failed: 0, needsAnalysis: 0 }
      ownerStats.counts[test.status] = (ownerStats.counts[test.status] || 0) + 1
      ownerStats.total += 1
      owners.set(owner, ownerStats)
      if (['failed', 'broken'].includes(test.status)) {
        ownerStats.failed += 1
        if (!test.failureReason?.trim()) ownerStats.needsAnalysis += 1
        if (test.message?.trim()) {
          const errorMessage = test.message.trim()
          errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1)
        }
        const reason = test.failureReason?.trim() || ''
        const comment = test.failureComment?.trim() || ''
        if (reason) {
          reasons.set(reason, (reasons.get(reason) || 0) + 1)
        } else {
          reasons.set('(null)', (reasons.get('(null)') || 0) + 1)
        }
        if (reason || comment) {
          const key = `${reason}\u0000${comment}`
          const current = failureFeedback.get(key) || { reason, comment, count: 0 }
          current.count += 1
          failureFeedback.set(key, current)
        }
      }
    }
    return { counts, total: results.length, duration, timed, suites: [...groups.values()].sort((a, b) => b.duration - a.duration), owners: [...owners.values()].sort((a, b) => b.total - a.total), errors: [...errors].map(([message, count]) => ({ key: message, message, count })).sort((a, b) => b.count - a.count || a.message.localeCompare(b.message)), reasonTotal: [...reasons.values()].reduce((sum, count) => sum + count, 0), reasons: [...reasons].map(([reason, count]) => ({ key: reason, reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)), failureFeedback: [...failureFeedback.values()].map((item, index) => ({ ...item, key: `${item.reason}-${item.comment}-${index}` })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason) || a.comment.localeCompare(b.comment)) }
  }, [results])
  const passedRate = metrics.total ? Math.round(metrics.counts.passed / metrics.total * 100) : 0
  const ownerColWidth = Math.min(Math.max(8, ...metrics.owners.map((row) => row.owner.length)) * 8 + 48, 360)
  const ownerColumns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: ownerColWidth, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    ...statuses.filter(({ key }) => (metrics.counts[key] || 0) > 0).map(({ key, label, color }) => ({
      title: label.toUpperCase(),
      key,
      align: 'center',
      width: 110,
      render: (_, row) => {
        const count = row.counts[key] || 0
        const percent = row.total ? Math.round(count / row.total * 100) : 0
        return count
          ? <Tag style={{ marginInlineEnd: 0 }} color={key === 'passed' ? 'green' : key === 'failed' ? 'red' : key === 'broken' ? 'orange' : key === 'skipped' ? 'default' : 'default'}>{count} · {percent}%</Tag>
          : <Text type="secondary">—</Text>
      },
    })),
    { title: 'ВСЕГО', dataIndex: 'total', width: 80, align: 'right', render: (total) => <Tag>{total}</Tag> },
  ]
  const tableProps = metrics.owners.length
    ? { tableLayout: 'fixed' }
    : {}
  const errorColumns = [{ title: 'СООБЩЕНИЕ ОБ ОШИБКЕ', dataIndex: 'message', render: (message) => <Text>{message}</Text> }, { title: 'КОЛИЧЕСТВО', dataIndex: 'count', width: 100, align: 'right', render: (count) => <Tag color="red">{count}</Tag> }]
  const reasonColumns = [
    { title: 'РЕЗУЛЬТАТ АНАЛИЗА', dataIndex: 'reason', render: (reason) => reason === '(null)' ? <Text type="secondary">null (не указано)</Text> : <Text>{reason}</Text> },
    { title: 'КОЛ-ВО / %', key: 'countPercent', align: 'right', width: 160, render: (_, row) => {
      const percent = metrics.reasonTotal ? Math.round(row.count / metrics.reasonTotal * 100) : 0
      return <Tag color="red">{row.count} · {percent}%</Tag>
    } },
  ]
  const needsAnalysis = metrics.owners.filter((row) => row.needsAnalysis > 0).map((row) => ({ ...row, key: row.owner }))
  const needsAnalysisColumns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: ownerColWidth, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    { title: 'НУЖЕН АНАЛИЗ', key: 'needsAnalysis', align: 'right', width: 160, render: (_, row) => {
      const percent = row.failed ? Math.round(row.needsAnalysis / row.failed * 100) : 0
      return <Tag color="orange">{row.needsAnalysis} · {percent}%</Tag>
    } },
  ]
  const feedbackColumns = [
    { title: 'ПРИЧИНА ПАДЕНИЯ', dataIndex: 'reason', width: 220, render: (reason) => reason || <Text type="secondary">Не указано</Text> },
    { title: 'КОММЕНТАРИЙ', dataIndex: 'comment', render: (comment) => comment || <Text type="secondary">Нет комментария</Text> },
    { title: 'КОЛИЧЕСТВО', dataIndex: 'count', width: 100, align: 'right', render: (count) => <Tag color="red">{count}</Tag> },
  ]
  const slowTests = [...results].filter((test) => test.durationMs > 0).sort((a, b) => b.durationMs - a.durationMs).slice(0, 8)
  const slowColumns = [{ title: 'ТЕСТ', dataIndex: 'name', render: (name, test) => <div><Text strong>{name || test.caseName}</Text><div><Text type="secondary">{test.path}</Text></div></div> }, { title: 'СТАТУС', dataIndex: 'status', width: 110, render: (status) => <Tag color={status === 'passed' ? 'green' : status === 'failed' ? 'red' : 'default'}>{status.replace('_', ' ')}</Tag> }, { title: 'ДЛИТЕЛЬНОСТЬ', dataIndex: 'durationMs', width: 120, render: formatDuration }]
  const showReport = () => navigate({ page: 'report', phaseId: phase.id, reportId: report.id, phase, report })

  return <>
    <div className="back-link" onClick={showReport}><ArrowLeftOutlined /> Назад к отчёту</div>
    <div className="report-header analytics-header"><div><Text className="eyebrow">АНАЛИТИКА ОТЧЁТА · {phase.name}</Text><Title level={1}>{report.name}</Title><Text type="secondary">Подробная сводка качества и выполнения для этого отчёта</Text></div><Button icon={<BarChartOutlined />} onClick={showReport}>Показать тест-кейсы</Button></div>
    <Row gutter={[12, 12]} className="analytics-metrics">
      <Col xs={24} sm={12} xl={6}><Metric label="Всего тест-кейсов" value={metrics.total} note={`${metrics.suites.length} наборов`} /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Процент прохождения" value={`${passedRate}%`} note={`${metrics.counts.passed || 0} пройдено`} color="#4ade80" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Упавшие / сломанные" value={(metrics.counts.failed || 0) + (metrics.counts.broken || 0)} note={`${metrics.counts.failed || 0} упало · ${metrics.counts.broken || 0} сломано`} color="#fb7185" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric label="Время выполнения" value={formatDuration(metrics.duration)} note={metrics.timed ? `В среднем ${formatDuration(metrics.duration / metrics.timed)}` : 'Нет данных о времени'} /></Col>
    </Row>
    <Row gutter={[12, 12]} className="analytics-charts"><Col xs={24} lg={12}><StatusChart counts={metrics.counts} total={metrics.total} /></Col><Col xs={24} lg={12}><Card title="Тесты по владельцам" className="analytics-card"><Table rowKey="owner" columns={ownerColumns} dataSource={metrics.owners} pagination={false} size="small" {...tableProps} /></Card></Col></Row>
    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}><Col xs={24} lg={12}><DurationChart suites={metrics.suites} /></Col><Col xs={24} lg={12}><Card title="Самые медленные тест-кейсы" className="analytics-card"><Table rowKey={(test) => test.rowKey || test.key || test.path} columns={slowColumns} dataSource={slowTests} pagination={false} size="small" locale={{ emptyText: 'Нет данных о времени' }} /></Card></Col></Row>
    <Row gutter={[12, 12]} style={{ marginTop: 12 }}><Col xs={24}><Card title="Уникальные ошибки" className="analytics-card"><Table rowKey="key" columns={errorColumns} dataSource={metrics.errors} pagination={false} size="small" locale={{ emptyText: 'Нет сообщений об ошибках в упавших тестах' }} /></Card></Col></Row>
    <Row gutter={[12, 12]} style={{ marginTop: 12 }}><Col xs={24} lg={8}><Card title="Результаты анализа" className="analytics-card"><Table rowKey="key" columns={reasonColumns} dataSource={metrics.reasons} pagination={false} size="small" locale={{ emptyText: 'Нет результатов анализа в упавших тестах' }} /></Card></Col><Col xs={24} lg={8}><Card title="Требует анализа" className="analytics-card"><Table rowKey="key" columns={needsAnalysisColumns} dataSource={needsAnalysis} pagination={false} size="small" locale={{ emptyText: 'Все упавшие тесты проанализированы' }} /></Card></Col><Col xs={24} lg={8}><Card title="Уникальная обратная связь по падениям" className="analytics-card"><Table rowKey="key" columns={feedbackColumns} dataSource={metrics.failureFeedback} pagination={false} size="small" locale={{ emptyText: 'Нет причин падения или комментариев в упавших тестах' }} /></Card></Col></Row>
  </>
}

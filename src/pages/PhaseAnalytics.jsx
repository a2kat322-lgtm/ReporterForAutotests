import { Fragment, useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Input, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons'
import { Column, Line, Pie } from '@ant-design/charts'
import { formatDate, formatDuration } from '../utils/format'

const { Title, Text } = Typography

const CELL_META = {
  p: { label: 'Passed', symbol: '✓', className: 'passed' },
  f: { label: 'Failed', symbol: '✕', className: 'failed' },
  b: { label: 'Broken', symbol: '!', className: 'broken' },
  s: { label: 'Skipped', symbol: '–', className: 'skipped' },
  n: { label: 'No run', symbol: '·', className: 'no-run' },
}

const STATUS_COLORS = {
  passed: '#4ade80',
  failed: '#fb7185',
  broken: '#fbbf24',
  skipped: '#9ca0af',
  no_run: '#737684',
}

const CHART_STATUSES = [
  { key: 'passed', label: 'Passed', color: STATUS_COLORS.passed },
  { key: 'failed', label: 'Failed', color: STATUS_COLORS.failed },
  { key: 'broken', label: 'Broken', color: STATUS_COLORS.broken },
  { key: 'skipped', label: 'Skipped', color: STATUS_COLORS.skipped },
  { key: 'no_run', label: 'No run', color: STATUS_COLORS.no_run },
]

const LIFECYCLE_META = [
  { key: 'stableGreen', label: 'Стабильно зелёные', color: '#4ade80' },
  { key: 'recovered', label: 'Исправлены', color: '#38bdf8' },
  { key: 'regressed', label: 'Регрессы', color: '#fb7185' },
  { key: 'stableRed', label: 'Стабильно красные', color: '#ef4444' },
  { key: 'neverRun', label: 'Никогда не запускались', color: '#737684' },
  { key: 'other', label: 'Прочее', color: '#9ca0af' },
]

function pct(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function Metric({ label, value, note, color }) {
  return (
    <Card className="analytics-metric">
      <Text type="secondary">{label}</Text>
      <div className="analytics-metric-value" style={color ? { color } : undefined}>{value}</div>
      <Text type="secondary">{note}</Text>
    </Card>
  )
}

function StatusDynamicsChart({ reports, theme }) {
  const data = reports.flatMap((report) => CHART_STATUSES.map((status) => ({
    report: report.name,
    status: status.label,
    count: report.counts[status.key] || 0,
  }))).filter((item) => item.count > 0)

  return (
    <Card title="Статусы по отчётам" className="analytics-card" extra={<Text type="secondary">стек по каждому отчёту</Text>}>
      {reports.length ? (
        <Column
          data={data}
          xField="report"
          yField="count"
          colorField="status"
          stack
          height={300}
          theme={theme}
          scale={{ color: { domain: CHART_STATUSES.map((status) => status.label), range: CHART_STATUSES.map((status) => status.color) } }}
          axis={{ x: { title: false, labelAutoRotate: true, labelAutoHide: true }, y: { title: false } }}
          legend={{ color: { position: 'top' } }}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе ещё нет отчётов" />}
    </Card>
  )
}

function PhaseTrendChart({ reports, theme }) {
  const data = reports.flatMap((report) => [
    { report: report.name, metric: 'Pass rate', value: Math.round(report.passRate * 100) },
    { report: report.name, metric: 'Coverage', value: Math.round(report.coverage * 100) },
  ])

  return (
    <Card title="Динамика прохождения и покрытия" className="analytics-card" extra={<Text type="secondary">по отчётам в хронологии</Text>}>
      {reports.length ? (
        <Line
          data={data}
          xField="report"
          yField="value"
          colorField="metric"
          height={300}
          theme={theme}
          scale={{ y: { domain: [0, 100] }, color: { domain: ['Pass rate', 'Coverage'], range: ['#4ade80', '#a78bfa'] } }}
          axis={{ x: { title: false, labelAutoRotate: true, labelAutoHide: true }, y: { title: false, labelFormatter: (value) => `${value}%` } }}
          legend={{ color: { position: 'top' } }}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе ещё нет отчётов" />}
    </Card>
  )
}

function LifecycleChart({ lifecycle, total, theme }) {
  const data = LIFECYCLE_META.map((item) => ({ type: item.label, value: lifecycle[item.key] || 0 })).filter((item) => item.value > 0)
  return (
    <Card title="Lifecycle тестов" className="analytics-card" extra={<Text type="secondary">тестов в каталоге: {total}</Text>}>
      {data.length ? (
        <Pie
          data={data}
          angleField="value"
          colorField="type"
          innerRadius={0.58}
          height={280}
          theme={theme}
          scale={{ color: { domain: LIFECYCLE_META.map((item) => item.label), range: LIFECYCLE_META.map((item) => item.color) } }}
          legend={{ color: { position: 'bottom' } }}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных о lifecycle" />}
    </Card>
  )
}

function FailureAgingChart({ aging, theme }) {
  const data = aging.buckets || []
  return (
    <Card
      title="Возраст текущих падений"
      className="analytics-card"
      extra={<Text type="secondary">MTTR {formatDuration(aging.mttrMedianMs)} · n={aging.mttrCount}</Text>}
    >
      {aging.totalCurrentFailures ? (
        <Column
          data={data}
          xField="label"
          yField="count"
          height={280}
          theme={theme}
          style={{ fill: '#fb7185' }}
          axis={{ x: { title: false }, y: { title: false } }}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет текущих падений" />}
    </Card>
  )
}

function PhaseMatrix({ matrix }) {
  const [suite, setSuite] = useState(null)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const columns = matrix.columns

  const suiteOptions = useMemo(
    () => [...new Set(matrix.rows.map((row) => row.suiteName))]
      .sort((left, right) => left.localeCompare(right, 'ru', { sensitivity: 'base' }))
      .map((value) => ({ value, label: value })),
    [matrix.rows],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return matrix.rows.filter((row) => {
      if (suite && row.suiteName !== suite) return false
      if (!needle) return true
      return `${row.name} ${row.path} ${row.suiteName} ${row.owner || ''}`.toLowerCase().includes(needle)
    })
  }, [matrix.rows, query, suite])

  const groups = useMemo(() => {
    const bySuite = new Map()
    for (const row of rows) {
      const group = bySuite.get(row.suiteName)
      if (group) group.push(row)
      else bySuite.set(row.suiteName, [row])
    }
    return [...bySuite.entries()].map(([suiteName, items]) => ({ suiteName, items }))
  }, [rows])

  const toggleSuite = (suiteName) => setCollapsed((previous) => {
    const next = new Set(previous)
    if (next.has(suiteName)) next.delete(suiteName)
    else next.add(suiteName)
    return next
  })

  if (!columns.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Матрица появится после создания отчётов" />
  }

  return (
    <div className="phase-matrix">
      <div className="phase-matrix-toolbar">
        <Space wrap>
          <Select
            allowClear
            placeholder="Набор"
            options={suiteOptions}
            value={suite}
            onChange={setSuite}
            style={{ minWidth: 200 }}
            showSearch
            optionFilterProp="label"
          />
          <Input
            allowClear
            placeholder="Тест, путь или владелец"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: 260 }}
          />
          <Button size="small" onClick={() => setCollapsed(new Set(suiteOptions.map((option) => option.value)))}>Свернуть все</Button>
          <Button size="small" onClick={() => setCollapsed(new Set())}>Развернуть все</Button>
        </Space>
        <Text type="secondary">Показано <strong>{rows.length}</strong> из {matrix.rows.length}</Text>
      </div>
      {rows.length ? (
        <div className="phase-matrix-scroll">
          <div
            className="phase-matrix-grid"
            role="grid"
            aria-label="Матрица статусов тестов по отчётам"
            style={{ gridTemplateColumns: `minmax(240px, 280px) repeat(${columns.length}, 44px)` }}
          >
            <div className="phase-matrix-corner">ТЕСТ</div>
            {columns.map((column) => (
              <div
                className="phase-matrix-head"
                key={`head-${column.reportId}`}
                title={`${column.name} · ${formatDate(column.startDate)} — ${formatDate(column.endDate)}`}
              >
                <span>{column.name}</span>
              </div>
            ))}
            {groups.map((group) => {
              const isCollapsed = collapsed.has(group.suiteName)
              return (
                <Fragment key={group.suiteName}>
                  <button
                    type="button"
                    className="phase-matrix-suite"
                    style={{ gridColumn: '1 / -1' }}
                    onClick={() => toggleSuite(group.suiteName)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{group.suiteName}</span>
                    <span>{group.items.length} в наборе · {isCollapsed ? 'показать' : 'скрыть'}</span>
                  </button>
                  {!isCollapsed && group.items.map((row) => (
                    <Fragment key={row.path}>
                      <div className="phase-matrix-test" title={row.path}>
                        <Text ellipsis={{ tooltip: row.path }}>{row.name}</Text>
                        <span>
                          <Text type="secondary">{row.suiteName}</Text>
                          {row.owner ? <Text type="secondary"> · {row.owner}</Text> : null}
                        </span>
                      </div>
                      {row.cells.map((code, index) => {
                        const meta = CELL_META[code] || CELL_META.n
                        const column = columns[index]
                        return (
                          <div
                            className={`phase-matrix-status ${meta.className}`}
                            key={`${row.path}-${column.reportId}`}
                            title={`${column.name} (${formatDate(column.startDate)} — ${formatDate(column.endDate)}): ${meta.label}`}
                            aria-label={`${column.name}: ${meta.label}`}
                          >
                            {meta.symbol}
                          </div>
                        )
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              )
            })}
          </div>
        </div>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет тестов по выбранным фильтрам" />}
      <div className="phase-matrix-legend">
        {Object.entries(CELL_META).map(([key, meta]) => (
          <span key={key}><i className={`phase-matrix-status ${meta.className}`}>{meta.symbol}</i>{meta.label}</span>
        ))}
      </div>
    </div>
  )
}

function ReportComparison({ reports, phase, navigate }) {
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

  return (
    <Table
      className="phase-comparison-table"
      rowKey="reportId"
      size="small"
      columns={columns}
      dataSource={reports}
      pagination={false}
      scroll={{ x: 1120 }}      onRow={(row) => ({
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

function FailureSignatures({ failures }) {
  if (!failures.totalFailures) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе нет упавших запусков" />
  }

  const columns = [
    {
      title: 'ПОДПИСЬ ОШИБКИ',
      dataIndex: 'signature',
      render: (signature, row) => (
        <div className="phase-failure-signature">
          <Text ellipsis={{ tooltip: row.message }}>{signature}</Text>
          <Text type="secondary" ellipsis={{ tooltip: row.message }}>{row.message}</Text>
        </div>
      ),
    },
    { title: 'КОЛ-ВО', dataIndex: 'count', width: 84, align: 'right', sorter: (a, b) => a.count - b.count, render: (value) => <Tag color="red">{value}</Tag> },
    { title: 'ДОЛЯ', dataIndex: 'share', width: 76, align: 'right', sorter: (a, b) => a.share - b.share, render: pct },
  ]

  return <Table rowKey="signature" size="small" columns={columns} dataSource={failures.signatures} pagination={false} scroll={{ y: 300 }} />
}

function FailureReasons({ failures }) {
  if (!failures.totalFailures) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="В фазе нет упавших запусков" />
  }

  const columns = [
    { title: 'РЕЗУЛЬТАТ АНАЛИЗА', dataIndex: 'reason', render: (reason) => reason === '(null)' ? <Text type="secondary">null (не указано)</Text> : reason },
    { title: 'КОЛ-ВО', dataIndex: 'count', width: 84, align: 'right', sorter: (a, b) => a.count - b.count, render: (value) => <Tag color="red">{value}</Tag> },
    { title: 'ДОЛЯ', dataIndex: 'share', width: 76, align: 'right', sorter: (a, b) => a.share - b.share, render: pct },
  ]

  return <Table rowKey="reason" size="small" columns={columns} dataSource={failures.reasons} pagination={false} scroll={{ y: 300 }} />
}

function OwnerTable({ owners }) {
  const columns = [
    { title: 'ВЛАДЕЛЕЦ', dataIndex: 'owner', width: 170, render: (owner) => owner === 'Не назначен' ? <Text type="secondary">{owner}</Text> : owner },
    { title: 'ВСЕГО', dataIndex: 'total', width: 74, align: 'right', sorter: (a, b) => a.total - b.total },
    { title: 'PASS', dataIndex: 'passed', width: 70, align: 'right', sorter: (a, b) => a.passed - b.passed, render: (value) => <span style={{ color: STATUS_COLORS.passed }}>{value}</span> },
    { title: 'FAIL+BROKEN', key: 'failed', width: 112, align: 'right', sorter: (a, b) => (a.failed + a.broken) - (b.failed + b.broken), render: (_, row) => <span style={{ color: STATUS_COLORS.failed }}>{row.failed + row.broken}</span> },
    { title: 'NO RUN', dataIndex: 'no_run', width: 82, align: 'right', sorter: (a, b) => a.no_run - b.no_run },
    { title: 'PASS RATE', dataIndex: 'passRate', width: 100, align: 'right', sorter: (a, b) => a.passRate - b.passRate, render: pct },
    { title: 'FLAKY', dataIndex: 'flaky', width: 76, align: 'right', sorter: (a, b) => a.flaky - b.flaky },
    { title: 'АНАЛИЗ', dataIndex: 'analysisRate', width: 86, align: 'right', sorter: (a, b) => a.analysisRate - b.analysisRate, render: pct },
  ]

  return <Table rowKey="owner" size="small" columns={columns} dataSource={owners} pagination={false} scroll={{ x: 800, y: 300 }} />
}

function SuiteTable({ suites }) {
  const columns = [
    { title: 'НАБОР', dataIndex: 'suiteName', width: 220, render: (name) => <Text ellipsis={{ tooltip: name }}>{name}</Text> },
    { title: 'ВСЕГО', dataIndex: 'total', width: 74, align: 'right', sorter: (a, b) => a.total - b.total },
    { title: 'FAIL+BROKEN', key: 'failed', width: 112, align: 'right', sorter: (a, b) => (a.failed + a.broken) - (b.failed + b.broken), render: (_, row) => <span style={{ color: STATUS_COLORS.failed }}>{row.failed + row.broken}</span> },
    { title: 'NO RUN', dataIndex: 'no_run', width: 82, align: 'right', sorter: (a, b) => a.no_run - b.no_run },
    { title: 'PASS RATE', dataIndex: 'passRate', width: 100, align: 'right', sorter: (a, b) => a.passRate - b.passRate, render: pct },
    { title: 'P90', dataIndex: 'p90', width: 100, align: 'right', sorter: (a, b) => (a.p90 || 0) - (b.p90 || 0), render: formatDuration },
  ]

  return <Table rowKey="suiteName" size="small" columns={columns} dataSource={suites} pagination={false} scroll={{ x: 720, y: 300 }} />
}

function RunsByDay({ days }) {
  if (!days.length) return null
  const max = Math.max(...days.map((day) => day.count), 1)
  return (
    <div className="phase-runs-days" role="img" aria-label="Количество запусков по дням">
      {days.map((day) => (
        <div className="phase-runs-day" key={day.date} title={`${day.date}: ${day.count} запусков`}>
          <span style={{ height: `${Math.max(day.count / max * 100, 4)}%` }} />
          <em>{day.date.slice(5)}</em>
        </div>
      ))}
    </div>
  )
}

function Hygiene({ hygiene }) {
  const items = [
    { label: 'Запусков всего', value: hygiene.totalRuns, note: `${hygiene.environmentRuns} в окружении фазы` },
    { label: 'Вне каталога', value: hygiene.uncataloguedRuns, note: `уникальных путей: ${hygiene.uncataloguedPaths}` },
    { label: 'Дубли', value: hygiene.duplicateRuns, note: `групп: ${hygiene.duplicateGroups} (path + startDate)` },
    { label: 'Чужой circuit', value: hygiene.wrongCircuitRuns, note: 'не попали в отчёты фазы' },
    { label: 'Без владельца', value: hygiene.missingOwnerRuns, note: 'запусков' },
    { label: 'Без сообщения', value: hygiene.missingMessageRuns, note: 'среди падений' },
    { label: 'Пересечение отчётов', value: hygiene.overlappingReportPairs, note: `участвуют: ${hygiene.overlappingReports}` },
  ]

  return (
    <div className="phase-hygiene">
      <div className="phase-hygiene-grid">
        {items.map((item) => (
          <div className="phase-hygiene-item" key={item.label}>
            <Text type="secondary">{item.label}</Text>
            <strong>{item.value}</strong>
            <Text type="secondary">{item.note}</Text>
          </div>
        ))}
      </div>
      {hygiene.runsByDay.length > 0 && (
        <div className="phase-hygiene-days">
          <Text type="secondary">Объём приёма по дням</Text>
          <RunsByDay days={hygiene.runsByDay} />
        </div>
      )}
    </div>
  )
}

export default function PhaseAnalytics({ data, phase, navigate, reload, colorMode }) {
  const analytics = data.analytics

  if (!analytics) {
    return <Empty description="Нет данных аналитики фазы" />
  }

  const { kpi, reports, matrix, owners, suites, failures, hygiene } = analytics
  const lifecycle = analytics.lifecycle || { stableGreen: 0, stableRed: 0, recovered: 0, regressed: 0, neverRun: 0, other: 0 }
  const failureAging = analytics.failureAging || { totalCurrentFailures: 0, buckets: [], mttrMedianMs: null, mttrCount: 0 }
  const chartTheme = colorMode === 'light' ? 'light' : 'dark'
  const showReports = () => navigate({ page: 'reports', phaseId: phase.id, phase })

  return (
    <>
      <div className="back-link" onClick={showReports}><ArrowLeftOutlined /> Назад к отчётам</div>
      <div className="report-header analytics-header">
        <div>
          <Text className="eyebrow">АНАЛИТИКА ФАЗЫ · {phase.environment.toUpperCase()}</Text>
          <Title level={1}>{phase.name}</Title>
          <Text type="secondary">
            {formatDate(phase.startedAt)} — {formatDate(phase.endedAt)} · {kpi.reports} отчётов · {kpi.catalog} тестов в каталоге
          </Text>
        </div>
        <Space>
          <Button icon={<FileTextOutlined />} onClick={showReports}>К отчётам</Button>
          <Button icon={<ReloadOutlined />} onClick={reload}>Обновить</Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} className="analytics-metrics">
        <Col xs={24} sm={12} xl={4}><Metric label="Отчётов" value={kpi.reports} note="в тестовой фазе" /></Col>
        <Col xs={24} sm={12} xl={4}><Metric label="Тестов в каталоге" value={kpi.catalog} note={`запусков: ${kpi.totalRuns}`} /></Col>
        <Col xs={24} sm={12} xl={4}><Metric label="Покрытие" value={pct(kpi.coverage)} note={`${kpi.executed} из ${kpi.catalog} прогнано`} color="#a78bfa" /></Col>
        <Col xs={24} sm={12} xl={4}><Metric label="Прошли хотя бы раз" value={pct(kpi.passRate)} note={`тестов: ${kpi.passedOnce}`} color={STATUS_COLORS.passed} /></Col>
        <Col xs={24} sm={12} xl={4}><Metric label="Никогда не проходили" value={kpi.neverPassed} note={`всегда падают: ${kpi.alwaysFailed}`} color={STATUS_COLORS.failed} /></Col>
        <Col xs={24} sm={12} xl={4}><Metric label="Флаки" value={kpi.flaky} note="меняли статус в фазе" color={STATUS_COLORS.broken} /></Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts">
        <Col xs={24} lg={12}><StatusDynamicsChart reports={reports} theme={chartTheme} /></Col>
        <Col xs={24} lg={12}><PhaseTrendChart reports={reports} theme={chartTheme} /></Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}><LifecycleChart lifecycle={lifecycle} total={kpi.catalog} theme={chartTheme} /></Col>
        <Col xs={24} lg={12}><FailureAgingChart aging={failureAging} theme={chartTheme} /></Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card title="Сравнение отчётов" className="analytics-card" extra={<Text type="secondary">Клик по строке — аналитика отчёта</Text>}>
            <ReportComparison reports={reports} phase={phase} navigate={navigate} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card title="Матрица «тест × отчёт»" className="analytics-card">
            <PhaseMatrix matrix={matrix} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}><Card title="Топ подписей ошибок" className="analytics-card"><FailureSignatures failures={failures} /></Card></Col>
        <Col xs={24} lg={10}><Card title="Результаты анализа" className="analytics-card"><FailureReasons failures={failures} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
        <Col xs={24}><Card title="Владельцы" className="analytics-card" extra={<Text type="secondary">по последнему отчёту</Text>}><OwnerTable owners={owners} /></Card></Col>
        <Col xs={24}><Card title="Наборы" className="analytics-card" extra={<Text type="secondary">по последнему отчёту</Text>}><SuiteTable suites={suites} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
        <Col xs={24}><Card title="Гигиена данных" className="analytics-card"><Hygiene hygiene={hygiene} /></Card></Col>
      </Row>
    </>
  )
}

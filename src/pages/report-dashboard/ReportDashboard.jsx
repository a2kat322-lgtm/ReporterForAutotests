import { useMemo } from 'react'
import { Button, Card, Col, Row, Typography } from 'antd'
import { ArrowLeftOutlined, BarChartOutlined } from '@ant-design/icons'
import MetricCard from '../../components/MetricCard'
import { formatDuration } from '../../utils/format'
import { buildReportMetrics } from './metrics'
import { showRate } from './utils'
import StatusChart from './components/StatusChart'
import DurationStats from './components/DurationStats'
import SuiteDurationTotals from './components/SuiteDurationTotals'
import OwnerSection from './components/OwnerSection'
import SuiteTable from './components/SuiteTable'
import SlowTests from './components/SlowTests'
import SignatureSection from './components/SignatureSection'
import StaleGreenTable from './components/StaleGreenTable'
import FlakyTable from './components/FlakyTable'
import AnalysisSection from './components/AnalysisSection'

const { Title, Text } = Typography

export default function ReportDashboard({ data, phase, report, navigate }) {
  // A fresh `[]` literal on every render would invalidate the metrics memo below.
  const results = useMemo(() => data.results || [], [data.results])
  const metrics = useMemo(() => buildReportMetrics(results), [results])

  const showReport = () => navigate({ page: 'report', phaseId: phase.id, reportId: report.id, phase, report })

  return <>
    <div className="back-link" onClick={showReport}><ArrowLeftOutlined /> Назад к отчёту</div>
    <div className="report-header analytics-header"><div><Text className="eyebrow">АНАЛИТИКА ОТЧЁТА · {phase.name}</Text><Title level={1}>{report.name}</Title><Text type="secondary">Подробная сводка качества и выполнения для этого отчёта</Text></div><Button icon={<BarChartOutlined />} onClick={showReport}>Показать тест-кейсы</Button></div>

    <Row gutter={[12, 12]} className="analytics-metrics">
      <Col xs={24} sm={12} xl={6}><MetricCard label="Всего тест-кейсов" value={metrics.total} note={`${metrics.suites.length} наборов`} /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard label="Процент прохождения" value={showRate(metrics.passRate)} note={`${metrics.passed} из ${metrics.total}`} color="#4ade80" /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard label="Эффективный pass rate" value={showRate(metrics.effectivePassRate)} note={`${metrics.passed} из ${metrics.executed} прогнанных`} color="#4ade80" /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard label="Покрытие" value={showRate(metrics.coverage)} note={`${metrics.executed} из ${metrics.total} каталога`} color="#a78bfa" /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard label="Упавшие / сломанные" value={metrics.counts.failed + metrics.counts.broken} note={`${metrics.counts.failed} упало · ${metrics.counts.broken} сломано`} color="#fb7185" /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard label="p90 времени" value={formatDuration(metrics.p90)} note={`p50 ${formatDuration(metrics.p50)} · всего ${formatDuration(metrics.duration)}`} /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard label="Флаки" value={metrics.flakyTests.length} note="меняли статус в окне" color="#fbbf24" /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard label="Stale green" value={metrics.staleGreenTests.length} note="последний запуск упал" color="#fb7185" /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts">
      <Col xs={24} lg={8}><StatusChart counts={metrics.counts} total={metrics.total} /></Col>
      <Col xs={24} lg={16}><DurationStats metrics={metrics} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24}><SuiteDurationTotals suites={metrics.suites} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24}><OwnerSection owners={metrics.owners} ownerStackData={metrics.ownerStackData} /></Col>
    </Row>

    <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
      <Col xs={24} lg={12}><Card title="Наборы" className="analytics-card"><SuiteTable suites={metrics.suites} /></Card></Col>
      <Col xs={24} lg={12}><SlowTests tests={metrics.slowTests} /></Col>
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

    <AnalysisSection metrics={metrics} />
  </>
}

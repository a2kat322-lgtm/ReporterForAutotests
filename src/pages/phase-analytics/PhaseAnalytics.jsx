import { Button, Card, Col, Empty, Row, Space, Typography } from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons'
import MetricCard from '../../components/MetricCard'
import { formatDate } from '../../utils/format'
import { STATUS_COLORS } from './constants'
import { pct } from './utils'
import StatusDynamicsChart from './components/StatusDynamicsChart'
import PhaseTrendChart from './components/PhaseTrendChart'
import LifecycleChart from './components/LifecycleChart'
import FailureAgingChart from './components/FailureAgingChart'
import ReportComparison from './components/ReportComparison'
import PhaseMatrix from './components/PhaseMatrix'
import FailureSignatures from './components/FailureSignatures'
import FailureReasons from './components/FailureReasons'
import OwnerTable from './components/OwnerTable'
import SuiteTable from './components/SuiteTable'
import Hygiene from './components/Hygiene'

const { Title, Text } = Typography

export default function PhaseAnalytics({ data, phase, navigate, reload }) {
  const analytics = data.analytics

  if (!analytics) {
    return <Empty description="Нет данных аналитики фазы" />
  }

  const { kpi, reports, matrix, owners, suites, failures, hygiene } = analytics
  const lifecycle = analytics.lifecycle || { stableGreen: 0, stableRed: 0, recovered: 0, regressed: 0, neverRun: 0, other: 0 }
  const failureAging = analytics.failureAging || { totalCurrentFailures: 0, buckets: [], mttrMedianMs: null, mttrCount: 0 }
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
        <Col xs={24} sm={12} xl={4}><MetricCard label="Отчётов" value={kpi.reports} note="в тестовой фазе" /></Col>
        <Col xs={24} sm={12} xl={4}><MetricCard label="Тестов в каталоге" value={kpi.catalog} note={`запусков: ${kpi.totalRuns}`} /></Col>
        <Col xs={24} sm={12} xl={4}><MetricCard label="Покрытие" value={pct(kpi.coverage)} note={`${kpi.executed} из ${kpi.catalog} прогнано`} color="#a78bfa" /></Col>
        <Col xs={24} sm={12} xl={4}><MetricCard label="Прошли хотя бы раз" value={pct(kpi.passRate)} note={`тестов: ${kpi.passedOnce}`} color={STATUS_COLORS.passed} /></Col>
        <Col xs={24} sm={12} xl={4}><MetricCard label="Никогда не проходили" value={kpi.neverPassed} note={`всегда падают: ${kpi.alwaysFailed}`} color={STATUS_COLORS.failed} /></Col>
        <Col xs={24} sm={12} xl={4}><MetricCard label="Флаки" value={kpi.flaky} note="меняли статус в фазе" color={STATUS_COLORS.broken} /></Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts">
        <Col xs={24} lg={12}><StatusDynamicsChart reports={reports} /></Col>
        <Col xs={24} lg={12}><PhaseTrendChart reports={reports} /></Col>
      </Row>

      <Row gutter={[12, 12]} className="analytics-charts" style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}><LifecycleChart lifecycle={lifecycle} total={kpi.catalog} /></Col>
        <Col xs={24} lg={12}><FailureAgingChart aging={failureAging} /></Col>
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

import { useState } from 'react'
import { Button, Space, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, BarChartOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import ResultsExplorer from '../components/ResultsExplorer'
import AllureUploadModal from '../components/AllureUploadModal'
import ResultDetailsDrawer from '../components/ResultDetailsDrawer'
import { envColors } from '../constants'
import { formatDate } from '../utils/format'

const { Title, Text } = Typography

export default function ReportPage({ data, phase, report, navigate, reload }) {
  const [detailsId, setDetailsId] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)

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
          <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>Импорт allure-results</Button>
          <Button icon={<BarChartOutlined />} onClick={() => navigate({ page: 'analytics', phaseId: phase.id, reportId: report.id, phase, report })}>Открыть аналитику</Button>
          <Button icon={<ReloadOutlined />} onClick={reload}>Обновить результаты</Button>
        </Space>
      </div>
      <ResultsExplorer results={data.results} reload={reload} onOpenDetails={setDetailsId} />

      <AllureUploadModal
        open={uploadOpen}
        workspaceId={phase.workspaceId}
        environment={phase.environment}
        onClose={() => setUploadOpen(false)}
        onImported={reload}
      />
      <ResultDetailsDrawer resultId={detailsId} open={detailsId != null} onClose={() => setDetailsId(null)} />
    </>
  )
}

import { useMemo, useState } from 'react'
import { App, Button, Card, Empty, Popconfirm, Space, Table, Typography } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, ExperimentOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import CreateReportModal from '../components/CreateReportModal'
import TestCatalogModal from '../components/TestCatalogModal'
import ReportsSummaryChart from '../components/ReportsSummaryChart'
import PageHeading from '../components/PageHeading'
import { formatDate } from '../utils/format'
import { createReport, deleteReport } from '../services/dataService'

const { Text } = Typography

const cardBody = { padding: 0 }
const emptyText = <Empty description="Пока нет отчётов" />

export default function ReportsPage({ data, phase, navigate, reload }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const { message } = App.useApp()
  const reports = useMemo(() => data.reports.filter((item) => item.phaseId === phase.id), [data.reports, phase.id])

  const create = async (values) => {
    try {
      await createReport({ ...values, phaseId: phase.id })
      setModalOpen(false)
      message.success('Отчёт создан')
      reload()
      return true
    } catch (error) {
      message.error(error.message || 'Не удалось создать отчёт')
      return false
    }
  }

  const remove = async (report) => {
    setDeletingId(report.id)
    try {
      await deleteReport(report.id)
      message.success(`Отчёт «${report.name}» удалён`)
      reload()
    } catch (error) {
      message.error(error.message || 'Не удалось удалить отчёт')
    } finally {
      setDeletingId(null)
    }
  }

  // Action column closes over remove(), so columns are built per component instance.
  const columns = useMemo(() => [
    {
      title: 'ОТЧЁТ',
      dataIndex: 'name',
      render: (name, report) => (
        <div className="report-cell">
          <div className="report-icon"><FileTextOutlined /></div>
          <div><Text strong>{name}</Text><Text type="secondary" className="phase-id">{formatDate(report.startDate)} — {formatDate(report.endDate)}</Text><Text type="secondary" className="phase-id">{report.id}</Text></div>
        </div>
      ),
    },
    { title: 'СОЗДАН', dataIndex: 'createdAt', render: (value) => formatDate(value, true) },
    { title: 'СОЗДАЛ', dataIndex: 'author', render: (value) => <Text type="secondary">{value}</Text> },
    {
      title: '',
      width: 96,
      render: (_, report) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Popconfirm
            title="Удалить этот отчёт?"
            description="Сохранённые запуски автоматизации остаются; удаляется только сам отчёт."
            okText="Удалить"
            okButtonProps={{ danger: true, loading: deletingId === report.id }}
            cancelText="Отмена"
            onConfirm={() => remove(report)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Удалить отчёт ${report.name}`} />
          </Popconfirm>
          <Button type="text" icon={<RightOutlined />} aria-label={`Открыть отчёт ${report.name}`} />
        </span>
      ),
    },
  ], [deletingId])

  return (
    <>
      <div className="back-link" onClick={() => navigate({ page: 'phases' })}><ArrowLeftOutlined /> Назад к фазам</div>
      <PageHeading
        eyebrow={`${phase.environment.toUpperCase()} · ${formatDate(phase.startedAt)} — ${formatDate(phase.endedAt)}`}
        title={phase.name}
        description="Отчёты и автоматические запуски тестов для этой тестовой фазы."
        action={
          <Space>
            <Button size="large" icon={<ExperimentOutlined />} onClick={() => setCatalogOpen(true)}>Каталог тестов</Button>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Новый отчёт</Button>
          </Space>
        }
      />
      <div className="toolbar">
        <Text type="secondary"><strong className="toolbar-count">{reports.length}</strong> отчётов</Text>
        <Button icon={<ReloadOutlined />} onClick={reload}>Обновить</Button>
      </div>
      <ReportsSummaryChart reports={reports} summaries={data.reportSummaries || []} />
      <Card className="table-card" styles={{ body: cardBody }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={reports}
          pagination={false}
          onRow={(report) => ({ onClick: () => navigate({ page: 'report', phaseId: phase.id, reportId: report.id, phase, report }) })}
          locale={{ emptyText }}
        />
      </Card>
      <CreateReportModal open={modalOpen} onCancel={() => setModalOpen(false)} onCreate={create} />
      <TestCatalogModal open={catalogOpen} onClose={() => setCatalogOpen(false)} environment={phase.environment} workspaceId={phase.workspaceId} />
    </>
  )
}

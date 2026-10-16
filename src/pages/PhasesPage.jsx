import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { App, Button, Card, Empty, Popconfirm, Switch, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, FolderOpenOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import CreatePhaseModal from '../components/CreatePhaseModal'
import PageHeading from '../components/PageHeading'
import { envColors } from '../constants'
import { formatDate } from '../utils/format'
import { createPhase, deletePhase } from '../services/dataService'

const { Text } = Typography

const cardBody = { padding: 0 }
const emptyText = <Empty description="Пока нет тестовых фаз" />

export default function PhasesPage({ data, navigate, reload }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [onlyCurrentPhases, setOnlyCurrentPhases] = useState(true)
  const { message } = App.useApp()

  const visiblePhases = useMemo(() => {
    if (!onlyCurrentPhases) return data.phases
    const today = dayjs().startOf('day')
    return data.phases.filter((phase) => {
      const startedAt = dayjs(phase.startedAt).startOf('day')
      const endedAt = dayjs(phase.endedAt).startOf('day')
      return !today.isBefore(startedAt) && !today.isAfter(endedAt)
    })
  }, [data.phases, onlyCurrentPhases])

  const create = async (values) => {
    await createPhase(values)
    setModalOpen(false)
    message.success('Фаза создана')
    reload()
  }

  const remove = async (phase) => {
    setDeletingId(phase.id)
    try {
      await deletePhase(phase.id)
      message.success(`Фаза «${phase.name}» удалена`)
      reload()
    } catch (error) {
      message.error(error.message || 'Не удалось удалить фазу')
    } finally {
      setDeletingId(null)
    }
  }

  // Action column closes over remove(), so columns are built per component instance.
  const columns = useMemo(() => [
    {
      title: (
        <div className="phase-table-heading">
          <span>ФАЗА</span>
          <label className="phase-current-filter">
            <Text type="secondary">Активна сегодня</Text>
            <Switch
              size="small"
              checked={onlyCurrentPhases}
              onChange={setOnlyCurrentPhases}
              aria-label="Показывать только фазы, активные сегодня"
            />
          </label>
        </div>
      ),
      dataIndex: 'name',
      key: 'name',
      render: (name, phase) => (
        <div className="phase-cell">
          <div className="phase-icon"><FolderOpenOutlined /></div>
          <div><Text strong>{name}</Text><Text type="secondary" className="phase-id">#{phase.id}</Text></div>
        </div>
      ),
    },
    { title: 'ОКРУЖЕНИЕ', dataIndex: 'environment', render: (value) => <Tag color={envColors[value]}>{value}</Tag> },
    {
      title: 'ПЕРИОД ТЕСТИРОВАНИЯ',
      render: (_, phase) => <Text>{formatDate(phase.startedAt)} <span className="period-arrow">→</span> {formatDate(phase.endedAt)}</Text>,
    },
    { title: 'РЕЗУЛЬТАТЫ', render: () => <Text type="secondary">Откройте фазу для просмотра отчётов</Text> },
    {
      title: (
        <div className="phase-actions-heading">
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={(event) => { event.stopPropagation(); setModalOpen(true) }}
          >
            Добавить фазу
          </Button>
        </div>
      ),
      width: 132,
      render: (_, phase) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Popconfirm
            title="Удалить эту фазу?"
            description="Все отчёты в этой фазе также будут удалены. Сохранённые запуски автоматизации останутся."
            okText="Удалить"
            okButtonProps={{ danger: true, loading: deletingId === phase.id }}
            cancelText="Отмена"
            onConfirm={() => remove(phase)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Удалить фазу ${phase.name}`} />
          </Popconfirm>
          <Button type="text" icon={<RightOutlined />} aria-label={`Открыть фазу ${phase.name}`} />
        </span>
      ),
    },
  ], [deletingId, onlyCurrentPhases])

  return (
    <>
      <PageHeading
        eyebrow="УПРАВЛЕНИЕ ТЕСТИРОВАНИЕМ"
        title="Тестовые фазы"
        description="Организуйте запуски тестов по релизу, окружению или любому циклу тестирования."
      />
      <div className="toolbar">
        <Text type="secondary"><strong className="toolbar-count">{visiblePhases.length}</strong> из {data.phases.length} фаз</Text>
      </div>
      <Card className="table-card" styles={{ body: cardBody }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={visiblePhases}
          pagination={false}
          onRow={(phase) => ({ onClick: () => navigate({ page: 'reports', phaseId: phase.id, phase }) })}
          locale={{ emptyText }}
        />
      </Card>
      <CreatePhaseModal open={modalOpen} onCancel={() => setModalOpen(false)} onCreate={create} />
    </>
  )
}

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
const emptyText = <Empty description="No test phases yet" />

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
    message.success('Phase created')
    reload()
  }

  const remove = async (phase) => {
    setDeletingId(phase.id)
    try {
      await deletePhase(phase.id)
      message.success(`Phase "${phase.name}" deleted`)
      reload()
    } catch (error) {
      message.error(error.message || 'Failed to delete phase')
    } finally {
      setDeletingId(null)
    }
  }

  // Action column closes over remove(), so columns are built per component instance.
  const columns = useMemo(() => [
    {
      title: (
        <div className="phase-table-heading">
          <span>PHASE</span>
          <label className="phase-current-filter">
            <Text type="secondary">Active today</Text>
            <Switch
              size="small"
              checked={onlyCurrentPhases}
              onChange={setOnlyCurrentPhases}
              aria-label="Show only phases active today"
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
    { title: 'ENVIRONMENT', dataIndex: 'environment', render: (value) => <Tag color={envColors[value]}>{value}</Tag> },
    {
      title: 'TESTING PERIOD',
      render: (_, phase) => <Text>{formatDate(phase.startedAt)} <span className="period-arrow">→</span> {formatDate(phase.endedAt)}</Text>,
    },
    { title: 'RESULTS', render: () => <Text type="secondary">Open phase for reports</Text> },
    {
      title: '',
      width: 96,
      render: (_, phase) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Popconfirm
            title="Delete this phase?"
            description="All reports in this phase will be deleted too. Stored automation runs are kept."
            okText="Delete"
            okButtonProps={{ danger: true, loading: deletingId === phase.id }}
            cancelText="Cancel"
            onConfirm={() => remove(phase)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete phase ${phase.name}`} />
          </Popconfirm>
          <Button type="text" icon={<RightOutlined />} aria-label={`Open phase ${phase.name}`} />
        </span>
      ),
    },
  ], [deletingId, onlyCurrentPhases])

  return (
    <>
      <PageHeading
        eyebrow="TEST MANAGEMENT"
        title="Test phases"
        description="Organize test runs by release, environment, or any testing cycle."
        action={<Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>New phase</Button>}
      />
      <div className="toolbar">
        <Text type="secondary"><strong className="toolbar-count">{visiblePhases.length}</strong> of {data.phases.length} phases</Text>
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

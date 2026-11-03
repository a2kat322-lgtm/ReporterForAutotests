import { useMemo, useState } from 'react'
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { ClockCircleOutlined, ReloadOutlined, RightOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import PageHeading from '../components/PageHeading'
import { envColors, runOriginMeta, runOriginOptions } from '../constants'
import { formatDate, formatDuration } from '../utils/format'

const { Text } = Typography

const cardBody = { padding: 0 }
const emptyText = <Empty description="Пока нет загруженных архивов allure-results" />

const statusOrder = ['passed', 'failed', 'broken', 'skipped']
const statusColors = {
  passed: '#4ade80',
  failed: '#fb7185',
  broken: '#fbbf24',
  skipped: '#818596',
}
const statusLabels = {
  passed: 'passed',
  failed: 'failed',
  broken: 'broken',
  skipped: 'skipped',
}

function shortId(id) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function LaunchStatusBadges({ counts, total }) {
  if (!total) return <Text type="secondary">Нет запусков</Text>
  return (
    <div className="launch-results">
      {statusOrder
        .filter((status) => counts[status] > 0)
        .map((status) => (
          <Tooltip key={status} title={`${counts[status]} ${statusLabels[status]}`}>
            <span className="suite-status-badge" style={{ backgroundColor: statusColors[status] }} data-status={status}>
              {counts[status]}
            </span>
          </Tooltip>
        ))}
      <span className="launch-total">всего {total}</span>
    </div>
  )
}

function launchName(launch) {
  return launch.fileName || `Прогон ${shortId(launch.id)}`
}

export default function RunsHistoryPage({ data, navigate, reload }) {
  const [query, setQuery] = useState('')
  const [environment, setEnvironment] = useState(null)
  const [origins, setOrigins] = useState([])
  const launches = useMemo(() => data.launches ?? [], [data.launches])

  const environmentOptions = useMemo(() => [...new Set(launches.map((launch) => launch.environment))]
    .sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })), [launches])

  const visibleLaunches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return launches.filter((launch) => {
      if (environment && launch.environment !== environment) return false
      if (origins.length && !origins.includes(launch.origin ?? 'unknown')) return false
      if (!needle) return true
      return [launch.fileName, launch.id, launch.projectName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [launches, query, environment, origins])

  const columns = useMemo(() => [
    {
      title: 'ПРОГОН',
      dataIndex: 'fileName',
      render: (_, launch) => (
        <div className="launch-cell">
          <div className="report-icon"><ClockCircleOutlined /></div>
          <div className="launch-cell-copy">
            <Text strong>{launchName(launch)}</Text>
            <div className="launch-cell-meta">
              <Tag color={envColors[launch.environment]}>{launch.environment}</Tag>
              <Tag color={(runOriginMeta[launch.origin] ?? runOriginMeta.unknown).color}>
                {(runOriginMeta[launch.origin] ?? runOriginMeta.unknown).label}
              </Tag>
              <Text type="secondary" className="phase-id">{launch.projectName}</Text>
              <Tooltip title={launch.id}><Text type="secondary" className="phase-id">ID {shortId(launch.id)}</Text></Tooltip>
              {launch.warnings.length ? (
                <Tooltip title={`Предупреждений: ${launch.warnings.length}. Первое: ${launch.warnings[0]}`}>
                  <Tag color="warning" icon={<WarningOutlined />}>{launch.warnings.length}</Tag>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'НАЧАЛО',
      render: (_, launch) => <Text>{formatDate(launch.startedAt || launch.createdAt, true)}</Text>,
    },
    {
      title: 'ДЛИТЕЛЬНОСТЬ',
      render: (_, launch) => <Text type="secondary">{formatDuration(launch.durationMs)}</Text>,
    },
    {
      title: 'РЕЗУЛЬТАТЫ',
      render: (_, launch) => <LaunchStatusBadges counts={launch.counts} total={launch.total} />,
    },
    {
      title: 'ЗАГРУЖЕН',
      render: (_, launch) => (
        <div>
          <Text>{formatDate(launch.createdAt, true)}</Text>
          <Text type="secondary" className="phase-id">
            новых {launch.imported}
            {launch.enriched ? ` · дополнено ${launch.enriched}` : ''}
            {launch.duplicates ? ` · дубликатов ${launch.duplicates}` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: '',
      width: 44,
      render: () => <Button type="text" icon={<RightOutlined />} aria-label="Открыть отчёт прогона" />,
    },
  ], [])

  return (
    <>
      <PageHeading
        eyebrow="ИСТОРИЯ ЗАПУСКОВ"
        title="История запусков"
        description="Каждый загруженный архив allure-results — отдельный прогон. Откройте прогон, чтобы посмотреть результаты именно этого запуска; источник прогона (CI/CD, локальный или неизвестный) можно отфильтровать."
        action={<Button icon={<ReloadOutlined />} onClick={reload}>Обновить</Button>}
      />
      <div className="toolbar report-toolbar">
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Поиск по файлу или ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            className="report-filter-select"
            placeholder="Окружение"
            options={environmentOptions}
            value={environment}
            onChange={setEnvironment}
            style={{ width: 180 }}
          />
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            className="report-filter-select"
            placeholder="Источник прогона"
            options={runOriginOptions}
            value={origins}
            onChange={setOrigins}
            style={{ width: 220 }}
          />
        </Space>
        <Text type="secondary"><strong className="toolbar-count">{visibleLaunches.length}</strong> из {launches.length} прогонов</Text>
      </div>
      <Card className="table-card" styles={{ body: cardBody }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={visibleLaunches}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          onRow={(launch) => ({
            onClick: () => navigate({ page: 'launch', launchId: launch.id }),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText }}
        />
      </Card>
    </>
  )
}

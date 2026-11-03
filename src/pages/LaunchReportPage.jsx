import { useState } from 'react'
import { Alert, Button, Space, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import ResultsExplorer from '../components/ResultsExplorer'
import ResultDetailsDrawer from '../components/ResultDetailsDrawer'
import { envColors, runOriginMeta } from '../constants'
import { formatDate, formatDuration } from '../utils/format'

const { Title, Text } = Typography

/**
 * Report of one uploaded allure-results archive. The rows come from the launch
 * itself and are not merged with the catalog, so the page shows exactly what
 * this CI run reported.
 */
export default function LaunchReportPage({ launch, results, navigate, reload }) {
  const [detailsId, setDetailsId] = useState(null)
  const title = launch.fileName || `Прогон ${launch.id.slice(0, 8)}`
  const passedRate = launch.total ? Math.round((launch.counts.passed / launch.total) * 100) : 0

  return (
    <>
      <div className="back-link" onClick={() => navigate({ page: 'runs' })}><ArrowLeftOutlined /> Назад к истории запусков</div>
      <div className="report-header">
        <div>
          <Text className="eyebrow">ПРОГОН · {formatDate(launch.startedAt || launch.createdAt, true)}</Text>
          <Title level={1}>{title}</Title>
          <Space wrap>
            <Tag color={envColors[launch.environment]}>{launch.environment}</Tag>
            <Tag color={(runOriginMeta[launch.origin] ?? runOriginMeta.unknown).color}>
              {(runOriginMeta[launch.origin] ?? runOriginMeta.unknown).label}
            </Tag>
            <Text type="secondary">{launch.projectName}</Text>
            <span className="dot-separator">·</span>
            <Text type="secondary">ID {launch.id}</Text>
            <span className="dot-separator">·</span>
            <Text type="secondary">Длительность {formatDuration(launch.durationMs)}</Text>
            <span className="dot-separator">·</span>
            <Text type="secondary">Пройдено {passedRate}%</Text>
          </Space>
          <div className="launch-import-summary">
            <Text type="secondary">
              Импортировано {launch.imported}
              {launch.enriched ? `, дополнено ${launch.enriched}` : ''}
              {launch.duplicates ? `, дубликатов пропущено ${launch.duplicates}` : ''}
              {launch.attachments ? `, вложений ${launch.attachments}` : ''}
              {launch.archives > 1 ? ` · архивов ${launch.archives}` : ''}
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={reload}>Обновить результаты</Button>
        </Space>
      </div>

      {launch.warnings.length ? (
        <Alert
          type="warning"
          showIcon
          className="launch-warning"
          message={`Импорт завершился с предупреждениями (${launch.warnings.length})`}
          description={(
            <div>
              {launch.warnings.slice(0, 3).map((warning, index) => <div key={`${index}-${warning}`}>• {warning}</div>)}
              {launch.warnings.length > 3 ? <div>…и ещё {launch.warnings.length - 3}</div> : null}
            </div>
          )}
        />
      ) : null}

      {results.length ? (
        <ResultsExplorer results={results} reload={reload} onOpenDetails={setDetailsId} />
      ) : (
        <Alert
          type="info"
          showIcon
          message="В этом архиве нет новых запусков"
          description="Возможно, все результаты уже были импортированы раньше: повторная загрузка того же архива не создаёт дубликатов."
        />
      )}

      <ResultDetailsDrawer resultId={detailsId} open={detailsId != null} onClose={() => setDetailsId(null)} />
    </>
  )
}

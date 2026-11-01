import { useEffect, useState } from 'react'
import { Alert, Descriptions, Drawer, Empty, Image, Spin, Table, Tag, Typography } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import StatusTag from './StatusTag'
import { getAttachmentUrl, getResultDetails } from '../services/dataService'
import { formatDate, formatDuration } from '../utils/format'

const { Text, Title } = Typography

const stepDotColors = {
  passed: '#4ade80',
  failed: '#fb7185',
  broken: '#fbbf24',
  skipped: '#818596',
}

const imageKeyPattern = /\.(png|jpe?g|gif|webp|bmp|svg)$/i

function isImage(attachment) {
  return String(attachment.type || '').startsWith('image/') || imageKeyPattern.test(attachment.key || '')
}

function AttachmentList({ attachments }) {
  if (!attachments?.length) return null
  return (
    <div className="attachment-list">
      {attachments.map((attachment, index) => {
        if (!attachment.key) {
          return (
            <Text key={index} type="secondary" className="attachment-missing">
              {attachment.name} — файла нет в архиве
            </Text>
          )
        }
        const url = getAttachmentUrl(attachment.key)
        if (isImage(attachment)) {
          return (
            <div key={index} className="attachment-image">
              <Image src={url} alt={attachment.name} width={180} />
              <Text type="secondary" className="attachment-caption">{attachment.name}</Text>
            </div>
          )
        }
        return (
          <a key={index} className="attachment-link" href={url} target="_blank" rel="noreferrer">
            {attachment.name}
          </a>
        )
      })}
    </div>
  )
}

function LinkChip({ link }) {
  const url = typeof link.url === 'string' && /^https?:\/\//i.test(link.url) ? link.url : null
  const label = link.name || link.url || 'ссылка'
  if (!url) {
    // Allure writes no URL when @TmsLink has neither `url` nor a configured
    // `allure.link.tms.pattern`; show the identifier instead of a dead link.
    return (
      <span
        className="detail-link detail-link-static"
        title="URL не задан: укажите url в аннотации или pattern allure.link.tms.pattern"
      >
        <LinkOutlined /> {label}
      </span>
    )
  }
  return (
    <a className="detail-link" href={url} target="_blank" rel="noreferrer">
      <LinkOutlined /> {label}
    </a>
  )
}

function LinkList({ links }) {
  if (!links?.length) return null
  return (
    <div className="detail-links">
      {links.map((link, index) => <LinkChip key={`${link.type}-${link.name}-${index}`} link={link} />)}
    </div>
  )
}

function StepNode({ step }) {
  const [expanded, setExpanded] = useState(true)
  const children = Array.isArray(step.steps) ? step.steps : []
  const attachments = Array.isArray(step.attachments) ? step.attachments : []
  const hasBody = children.length > 0 || attachments.length > 0 || Boolean(step.message) || Boolean(step.trace)

  return (
    <li className="step-node">
      <div
        className={`step-row ${hasBody ? 'step-row-toggle' : ''}`}
        onClick={() => hasBody && setExpanded((value) => !value)}
      >
        <span className="step-dot" style={{ backgroundColor: stepDotColors[step.status] || stepDotColors.skipped }} />
        <span className="step-name">{step.name}</span>
        {step.durationMs != null ? <span className="step-duration">{formatDuration(step.durationMs)}</span> : null}
      </div>
      {expanded ? (
        <>
          <AttachmentList attachments={attachments} />
          {step.message ? <pre className="step-message">{step.message}</pre> : null}
          {children.length ? (
            <ol className="step-children">
              {children.map((child, index) => <StepNode key={index} step={child} />)}
            </ol>
          ) : null}
        </>
      ) : null}
    </li>
  )
}

/**
 * Run detail drawer: Allure steps, screenshots and other attachments, parameters
 * and the failure stack trace. Runs posted through the old form contract have
 * no steps, and the drawer explains where the detail comes from.
 */
export default function ResultDetailsDrawer({ resultId, open, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [details, setDetails] = useState(null)

  useEffect(() => {
    if (!open || resultId == null) return undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetails(null)
    getResultDetails(resultId)
      .then((data) => { if (!cancelled) setDetails(data) })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || 'Не удалось загрузить детали') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, resultId])

  const steps = Array.isArray(details?.steps) ? details.steps : []
  const attachments = Array.isArray(details?.attachments) ? details.attachments : []
  const parameters = Array.isArray(details?.parameters) ? details.parameters : []
  const tags = Array.isArray(details?.tags) ? details.tags : []
  const links = Array.isArray(details?.links) ? details.links : []
  const tmsLinks = links.filter((link) => String(link.type || '').toLowerCase() === 'tms')
  const otherLinks = links.filter((link) => String(link.type || '').toLowerCase() !== 'tms')
  const trace = details?.statusDetails?.trace
  const hasDetail = steps.length > 0 || attachments.length > 0 || parameters.length > 0
    || links.length > 0 || Boolean(trace)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      destroyOnClose
      title={details ? (details.caseName || details.path) : 'Детали запуска'}
    >
      {loading ? <Spin /> : null}
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {!loading && !error && details ? (
        <>
          <div className="result-detail-header">
            <StatusTag status={details.status} />
            <Title level={4} className="result-detail-title">{details.caseName || details.path}</Title>
            <Text type="secondary" className="phase-id">{details.path}</Text>
          </div>

          <Descriptions size="small" column={2} className="result-detail-meta">
            <Descriptions.Item label="Владелец">{details.owner || '—'}</Descriptions.Item>
            <Descriptions.Item label="Длительность">
              {details.startDate && details.endDate
                ? formatDuration(new Date(details.endDate) - new Date(details.startDate))
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Запуск">{formatDate(details.startDate, true)}</Descriptions.Item>
            <Descriptions.Item label="Окончание">{formatDate(details.endDate, true)}</Descriptions.Item>
            <Descriptions.Item label="Набор">{details.suiteName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Теги">
              {tags.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '—'}
            </Descriptions.Item>
          </Descriptions>

          {!hasDetail ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="У этого запуска нет шагов и вложений: они появляются только из импорта allure-results."
            />
          ) : null}

          {tmsLinks.length ? (
            <section className="result-detail-section">
              <Title level={5}>TMS</Title>
              <LinkList links={tmsLinks} />
            </section>
          ) : null}

          {otherLinks.length ? (
            <section className="result-detail-section">
              <Title level={5}>Ссылки</Title>
              <LinkList links={otherLinks} />
            </section>
          ) : null}

          {steps.length ? (
            <section className="result-detail-section">
              <Title level={5}>Шаги</Title>
              <ol className="step-list">
                {steps.map((step, index) => <StepNode key={index} step={step} />)}
              </ol>
            </section>
          ) : null}

          {attachments.length ? (
            <section className="result-detail-section">
              <Title level={5}>Вложения</Title>
              <AttachmentList attachments={attachments} />
            </section>
          ) : null}

          {parameters.length ? (
            <section className="result-detail-section">
              <Title level={5}>Параметры</Title>
              <Table
                size="small"
                rowKey={(row) => `${row.name}-${row.value}`}
                pagination={false}
                dataSource={parameters}
                columns={[
                  { title: 'Параметр', dataIndex: 'name' },
                  { title: 'Значение', dataIndex: 'value' },
                ]}
              />
            </section>
          ) : null}

          {trace ? (
            <section className="result-detail-section">
              <Title level={5}>Стектрейс</Title>
              <pre className="result-trace">{trace}</pre>
            </section>
          ) : null}
        </>
      ) : null}
    </Drawer>
  )
}

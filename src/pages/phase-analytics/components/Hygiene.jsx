import { Typography } from 'antd'

const { Text } = Typography

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

export default function Hygiene({ hygiene }) {
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

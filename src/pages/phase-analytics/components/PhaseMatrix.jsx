import { Fragment, useMemo, useState } from 'react'
import { Button, Empty, Input, Select, Space, Typography } from 'antd'
import { formatDate } from '../../../utils/format'
import { CELL_META } from '../constants'

const { Text } = Typography

export default function PhaseMatrix({ matrix }) {
  const [suite, setSuite] = useState(null)
  const [query, setQuery] = useState('')
  // По умолчанию все наборы свёрнуты: храним множество РАЗВЁРНУТЫХ наборов.
  const [expanded, setExpanded] = useState(() => new Set())
  const columns = matrix.columns

  const suiteOptions = useMemo(
    () => [...new Set(matrix.rows.map((row) => row.suiteName))]
      .sort((left, right) => left.localeCompare(right, 'ru', { sensitivity: 'base' }))
      .map((value) => ({ value, label: value })),
    [matrix.rows],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return matrix.rows.filter((row) => {
      if (suite && row.suiteName !== suite) return false
      if (!needle) return true
      return `${row.name} ${row.path} ${row.suiteName} ${row.owner || ''}`.toLowerCase().includes(needle)
    })
  }, [matrix.rows, query, suite])

  const groups = useMemo(() => {
    const bySuite = new Map()
    for (const row of rows) {
      const group = bySuite.get(row.suiteName)
      if (group) group.push(row)
      else bySuite.set(row.suiteName, [row])
    }
    return [...bySuite.entries()].map(([suiteName, items]) => ({ suiteName, items }))
  }, [rows])

  const toggleSuite = (suiteName) => setExpanded((previous) => {
    const next = new Set(previous)
    if (next.has(suiteName)) next.delete(suiteName)
    else next.add(suiteName)
    return next
  })

  if (!columns.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Матрица появится после создания отчётов" />
  }

  return (
    <div className="phase-matrix">
      <div className="phase-matrix-toolbar">
        <Space wrap>
          <Select
            allowClear
            placeholder="Набор"
            options={suiteOptions}
            value={suite}
            onChange={setSuite}
            style={{ minWidth: 200 }}
            showSearch
            optionFilterProp="label"
          />
          <Input
            allowClear
            placeholder="Тест, путь или владелец"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: 260 }}
          />
          <Button size="small" onClick={() => setExpanded(new Set())}>Свернуть все</Button>
          <Button size="small" onClick={() => setExpanded(new Set(suiteOptions.map((option) => option.value)))}>Развернуть все</Button>
        </Space>
        <Text type="secondary">Показано <strong>{rows.length}</strong> из {matrix.rows.length}</Text>
      </div>
      {rows.length ? (
        <div className="phase-matrix-scroll">
          <div
            className="phase-matrix-grid"
            role="grid"
            aria-label="Матрица статусов тестов по отчётам"
            style={{ gridTemplateColumns: `minmax(240px, 280px) repeat(${columns.length}, 44px)` }}
          >
            <div className="phase-matrix-corner">ТЕСТ</div>
            {columns.map((column) => (
              <div
                className="phase-matrix-head"
                key={`head-${column.reportId}`}
                title={`${column.name} · ${formatDate(column.startDate)} — ${formatDate(column.endDate)}`}
              >
                <span>{column.name}</span>
              </div>
            ))}
            {groups.map((group) => {
              const isCollapsed = !expanded.has(group.suiteName)
              return (
                <Fragment key={group.suiteName}>
                  <button
                    type="button"
                    className="phase-matrix-suite"
                    style={{ gridColumn: '1 / -1' }}
                    onClick={() => toggleSuite(group.suiteName)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{group.suiteName}</span>
                    <span>{group.items.length} в наборе · {isCollapsed ? 'показать' : 'скрыть'}</span>
                  </button>
                  {!isCollapsed && group.items.map((row) => (
                    <Fragment key={row.path}>
                      <div className="phase-matrix-test" title={row.path}>
                        <Text ellipsis={{ tooltip: row.path }}>{row.name}</Text>
                        <span>
                          <Text type="secondary">{row.suiteName}</Text>
                          {row.owner ? <Text type="secondary"> · {row.owner}</Text> : null}
                        </span>
                      </div>
                      {row.cells.map((code, index) => {
                        const meta = CELL_META[code] || CELL_META.n
                        const column = columns[index]
                        return (
                          <div
                            className={`phase-matrix-status ${meta.className}`}
                            key={`${row.path}-${column.reportId}`}
                            title={`${column.name} (${formatDate(column.startDate)} — ${formatDate(column.endDate)}): ${meta.label}`}
                            aria-label={`${column.name}: ${meta.label}`}
                          >
                            {meta.symbol}
                          </div>
                        )
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              )
            })}
          </div>
        </div>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет тестов по выбранным фильтрам" />}
      <div className="phase-matrix-legend">
        {Object.entries(CELL_META).map(([key, meta]) => (
          <span key={key}><i className={`phase-matrix-status ${meta.className}`}>{meta.symbol}</i>{meta.label}</span>
        ))}
      </div>
    </div>
  )
}

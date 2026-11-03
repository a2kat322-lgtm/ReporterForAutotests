const suiteFallback = 'Без набора'

/**
 * Turns flat report rows (catalog tests with their latest run, or runs of a
 * single launch) into the suite grouping and status tally shown by the report
 * pages. Filters are applied before grouping, so the chart and the table always
 * describe the same set of cases.
 */
export function buildReportView(results, filters) {
  const matched = []
  const tally = { passed: 0, failed: 0, broken: 0, skipped: 0, no_run: 0 }
  for (const row of results) {
    const owner = row.owner || 'Не назначен'
    const tags = Array.isArray(row.tags) ? row.tags : []
    if (filters.statuses.length && !filters.statuses.includes(row.status)) continue
    if (filters.epics.length && !filters.epics.includes(row.epic)) continue
    if (filters.owners.length && !filters.owners.includes(owner)) continue
    if (filters.tags.length && !filters.tags.some((tag) => tags.includes(tag))) continue
    matched.push(row)
    if (tally[row.status] !== undefined) tally[row.status] += 1
  }
  const suites = []
  const suitesByName = new Map()
  for (const test of matched) {
    const suiteName = test.suiteName || suiteFallback
    let suite = suitesByName.get(suiteName)
    if (!suite) {
      suite = { key: `suite-${suites.length}`, suiteName, tests: [] }
      suitesByName.set(suiteName, suite)
      suites.push(suite)
    }
    suite.tests.push(test)
  }
  for (const suite of suites) {
    suite.tests.sort((a, b) => (a.caseName || a.name || '').localeCompare(b.caseName || b.name || '', undefined, { sensitivity: 'base' }))
  }
  suites.sort((a, b) => a.suiteName.localeCompare(b.suiteName, undefined, { sensitivity: 'base' }))
  return { tests: matched, suites, counts: tally }
}

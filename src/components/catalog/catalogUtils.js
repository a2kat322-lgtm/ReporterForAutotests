export const compareCatalogNames = (left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })

export function groupCatalog(catalog) {
  const groups = new Map()
  for (const test of catalog) {
    const suiteName = test.defaultSuiteName || 'Без набора'
    if (!groups.has(suiteName)) groups.set(suiteName, [])
    groups.get(suiteName).push(test)
  }
  return Array.from(groups, ([suiteName, tests], index) => ({
    key: `suite-${index}`,
    suiteName,
    tests: tests.sort((a, b) => compareCatalogNames(
      a.defaultCaseName || a.resultPath,
      b.defaultCaseName || b.resultPath,
    )),
  })).sort((a, b) => compareCatalogNames(a.suiteName, b.suiteName))
}

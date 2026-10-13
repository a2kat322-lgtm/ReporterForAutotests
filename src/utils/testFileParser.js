// Parses an automated-test catalog file into CreateAutomatedTestDto-shaped
// objects for POST /api/tests/bulk.
//
// File contract: a JSON array (or an object with a "tests" array) of entries
//   { resultPath, defaultCaseName, fullResponsibility?, defaultSuiteName?,
//     defaultOwner?, tags?, visible? }
// `resultPath` is the key that links a stored run (TestResult.path) to its
// catalog definition; `defaultCaseName` falls back to resultPath when omitted
// in the file. `visible` (default true) controls
// whether the test shows up in reports.

const MAX_LENGTHS = {
  resultPath: 300,
  fullResponsibility: 200,
  defaultSuiteName: 200,
  defaultCaseName: 300,
  defaultOwner: 120,
}

function cleanString(value, max) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

function cleanTags(value) {
  let items = value
  if (typeof items === 'string') {
    try { items = JSON.parse(items) } catch { items = items.split(/[,;]/) }
  }
  if (!Array.isArray(items)) return undefined
  const tags = items.map((item) => String(item).trim()).filter(Boolean).slice(0, 100)
  return tags.length ? tags : undefined
}

function normalizeEntry(item) {
  const resultPath = cleanString(item?.resultPath, MAX_LENGTHS.resultPath)
  if (!resultPath) return null
  const test = {
    resultPath,
    defaultCaseName: cleanString(item?.defaultCaseName, MAX_LENGTHS.defaultCaseName) ?? resultPath,
  }
  for (const field of ['fullResponsibility', 'defaultSuiteName', 'defaultCaseName', 'defaultOwner']) {
    const value = cleanString(item?.[field], MAX_LENGTHS[field])
    if (value) test[field] = value
  }
  const tags = cleanTags(item?.tags)
  if (tags) test.tags = tags
  // Only emit `visible` when explicitly disabled; the API defaults it to true.
  if (item?.visible === false || (typeof item?.visible === 'string' && /^(n|no|false|0)$/i.test(item.visible.trim()))) {
    test.visible = false
  }
  return test
}

export function parseTestsFile(filename, text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${filename} is not valid JSON: ${error.message}`)
  }
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tests) ? parsed.tests : null
  if (!items) throw new Error('Expected a JSON array of tests or an object with a "tests" array')

  const tests = []
  const seen = new Set()
  let skipped = 0
  for (const item of items) {
    const test = normalizeEntry(item)
    if (!test) { skipped += 1; continue }
    const key = test.resultPath.toLowerCase()
    if (seen.has(key)) { skipped += 1; continue }
    seen.add(key)
    tests.push(test)
  }
  return { tests, skipped }
}

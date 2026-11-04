#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const acorn = require('acorn')

/**
 * Добавляет в каждый запрос коллекции блоки отправки результата в Reporter
 * for autotests: helper (check), сами проверки не трогает, `pm.test(...)`
 * переименовывает в `check(...)`, в конец добавляет `pm.sendRequest`.
 *
 *   node postman/instrument.js collection.json [--out результат.json]
 *
 * Повторный запуск безопасен: сгенерированные блоки заменяются, проверки
 * сохраняются. Коллекция должна быть экспортирована из Postman в JSON.
 */

const SNIPPET = path.join(__dirname, 'postman-ui-snippet.js')
const HELPER_START = '// reporter:helper:start'
const HELPER_END = '// reporter:helper:end'
const SEND_START = '// reporter:send:start'
const SEND_END = '// reporter:send:end'

const RENAMES = [
  ['reporterChecks', '__reportChecks'],
  ['reporterTotal', '__reportTotal'],
  ['reporterVariable', '__reportVariable'],
  ['reporterCode', '__reportCode'],
  ['reporterEnd', '__reportEnd'],
  ['reporterStatus', '__reportStatus'],
  ['reporterEndpoint', '__reportEndpoint'],
  ['check', '__reportCheck'],
]

function readRegion(source, name) {
  const pattern = new RegExp(`// #region ${name}\\r?\\n([\\s\\S]*?)// #endregion ${name}`)
  const match = source.match(pattern)
  if (!match) throw new Error(`В сниппете не найден блок ${name}: ${SNIPPET}`)
  return match[1].trim()
}

function rename(text) {
  return RENAMES.reduce(
    (result, [from, to]) => result.replace(new RegExp(`\\b${from}\\b`, 'g'), to),
    text,
  )
}

const snippet = fs.readFileSync(SNIPPET, 'utf8')
const helper = rename(readRegion(snippet, 'reporter-helper'))
const sender = rename(readRegion(snippet, 'reporter-send'))

function stripGenerated(source) {
  if (!source.includes(HELPER_START)) return source

  const helperStart = source.indexOf(HELPER_START)
  const helperEnd = source.indexOf(HELPER_END)
  const sendStart = source.indexOf(SEND_START)
  const sendEnd = source.indexOf(SEND_END)
  if (helperEnd < 0 || sendStart < 0 || sendEnd < 0 || !(helperStart < helperEnd && helperEnd < sendStart && sendStart < sendEnd)) {
    throw new Error('Найдены повреждённые маркеры reporter:helper/send — удалите их вручную и повторите')
  }
  return source.slice(helperEnd + HELPER_END.length, sendStart).trim()
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'string') visit(node)
  for (const key of Object.keys(node)) {
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit)
    } else if (value && typeof value === 'object') {
      walk(value, visit)
    }
  }
}

function convertTests(source) {
  if (!source.trim()) return ''
  const ast = acorn.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
  })
  const ranges = []
  walk(ast, (node) => {
    if (node.type !== 'CallExpression' || !node.callee) return
    const callee = node.callee
    if (callee.type !== 'MemberExpression' || callee.computed) return
    if (!callee.object || callee.object.type !== 'Identifier' || callee.object.name !== 'pm') return
    if (!callee.property || callee.property.type !== 'Identifier' || callee.property.name !== 'test') return
    ranges.push([callee.start, callee.end])
  })

  let result = source
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const [start, end] = ranges[index]
    result = result.slice(0, start) + '__reportCheck' + result.slice(end)
  }
  return result
}

function instrumentScript(source) {
  const user = stripGenerated(source)
  if (user.includes('reporterChecks') && user.includes('reporterVariable')) {
    throw new Error('в скрипте уже есть блок отправки Reporter — инструментируйте исходную коллекцию без него')
  }
  return [
    HELPER_START,
    helper,
    HELPER_END,
    '',
    convertTests(user),
    '',
    SEND_START,
    sender,
    SEND_END,
  ].join('\n')
}

function scriptSource(script) {
  if (!script || script.exec == null) return ''
  return Array.isArray(script.exec) ? script.exec.join('\n') : String(script.exec)
}

function instrumentRequest(item) {
  if (!Array.isArray(item.event)) item.event = []
  let tests = item.event.filter((event) => event && event.listen === 'test')
  if (!tests.length) {
    const event = { listen: 'test', script: { type: 'text/javascript', exec: [] } }
    item.event.push(event)
    tests = [event]
  }

  for (const event of tests) {
    if (!event.script) event.script = { type: 'text/javascript', exec: [] }
    if (!event.script.type) event.script.type = 'text/javascript'
    const source = scriptSource(event.script)
    try {
      event.script.exec = instrumentScript(source).split('\n')
    } catch (error) {
      throw new Error(`${item.name || item.id || 'request'}: ${error.message}`)
    }
  }
}

function walkRequests(items, visit) {
  for (const item of items || []) {
    if (Array.isArray(item.item)) walkRequests(item.item, visit)
    else if (item.request) visit(item)
  }
}

function defaultOutput(input) {
  if (/\.postman_collection\.json$/i.test(input)) {
    return input.replace(/\.postman_collection\.json$/i, '.reporter.postman_collection.json')
  }
  if (/\.json$/i.test(input)) return input.replace(/\.json$/i, '.reporter.postman_collection.json')
  return `${input}.reporter.postman_collection.json`
}

function usage() {
  console.log(`
Добавляет отправку результатов в каждый запрос Postman-коллекции.

  node postman/instrument.js <collection.json> [--out <result.json>]

Что делает:
  - добавляет helper с check(...) и блок pm.sendRequest в Tests каждого запроса;
  - переписывает pm.test(...) на check(...), чтобы падения попадали в отчёт;
  - сохраняет проверки, папки и остальные скрипты;
  - повторный запуск заменяет сгенерированные блоки (маркеры reporter:*).

Результат по умолчанию: <имя>.reporter.postman_collection.json.
Импортируйте его в Postman и запускайте Collection Runner.
`)
}

function main() {
  const args = process.argv.slice(2)
  if (!args.length || args[0] === '--help' || args[0] === '-h') {
    usage()
    process.exit(args.length ? 0 : 2)
  }

  const input = path.resolve(args[0])
  const outIndex = args.indexOf('--out')
  if (outIndex >= 0 && !args[outIndex + 1]) {
    console.error('[instrument] не указан путь после --out')
    process.exit(2)
  }
  const output = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : defaultOutput(input)
  if (output === input) {
    console.error('[instrument] --out совпадает с входным файлом; выберите другой путь')
    process.exit(2)
  }

  let collection
  try {
    collection = JSON.parse(fs.readFileSync(input, 'utf8'))
  } catch (error) {
    console.error(`[instrument] не удалось прочитать ${input}: ${error.message}`)
    process.exit(2)
  }
  if (!collection || !Array.isArray(collection.item)) {
    console.error('[instrument] это не Postman-коллекция: нет массива item')
    process.exit(2)
  }

  let count = 0
  try {
    walkRequests(collection.item, (item) => {
      instrumentRequest(item)
      count += 1
    })
  } catch (error) {
    console.error(`[instrument] ${error.message}`)
    process.exit(1)
  }

  fs.writeFileSync(output, JSON.stringify(collection, null, 2) + '\n', 'utf8')
  console.log(`Инструментировано запросов: ${count}`)
  console.log(`Коллекция: ${path.relative(process.cwd(), output)}`)
  if (!count) console.log('В коллекции не найдено запросов — проверьте экспорт.')
}

module.exports = { instrumentScript, convertTests, instrumentRequest }

if (require.main === module) main()

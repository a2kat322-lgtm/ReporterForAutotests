'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Собирает готовую коллекцию для Postman UI из сниппета
 * postman/postman-ui-snippet.js: каждому запросу добавляются блоки
 * reporter-helper (check), проверки и reporter-send (pm.sendRequest).
 *
 * Запуск: node postman/collection-runner/build.js
 */

const ROOT = __dirname
const SNIPPET = path.join(ROOT, '..', 'postman-ui-snippet.js')
const OUTPUT = path.join(ROOT, 'Reporter-for-autotests.postman_collection.json')

function readRegion(source, name) {
  const pattern = new RegExp(`// #region ${name}\\r?\\n([\\s\\S]*?)// #endregion ${name}`)
  const match = source.match(pattern)
  if (!match) throw new Error(`В сниппете не найден блок ${name}: ${SNIPPET}`)
  return match[1].trim()
}

const snippet = fs.readFileSync(SNIPPET, 'utf8')
const helper = readRegion(snippet, 'reporter-helper')
const send = readRegion(snippet, 'reporter-send')

function scriptFor(checks) {
  return [
    '// Reporter for autotests: helper и отправка строки отчёта.',
    '// Проверки пишите через check(), блоки не удаляйте.',
    helper,
    '',
    '// ---- проверки ----',
    ...checks,
    '',
    send,
  ].join('\n').split('\n')
}

function item(name, description, request, checks) {
  return {
    name,
    description,
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: scriptFor(checks) } }],
    request,
    response: [],
  }
}

const getEcho = item(
  'GET echo',
  'Проверяет GET и отправляет строку в Reporter for autotests.',
  {
    method: 'GET',
    header: [],
    url: '{{baseUrl}}/get?name=reporter',
  },
  [
    "check('status 200', function () { pm.response.to.have.status(200) })",
    "check('query echoed', function () { pm.expect(pm.response.json().args.name).to.eql('reporter') })",
  ],
)

const postEcho = item(
  'POST echo',
  'Проверяет POST с JSON-телом и отправляет строку в Reporter for autotests.',
  {
    method: 'POST',
    header: [{ key: 'Content-Type', value: 'application/json' }],
    body: {
      mode: 'raw',
      raw: '{"hello":"reporter"}',
      options: { raw: { language: 'json' } },
    },
    url: '{{baseUrl}}/post',
  },
  [
    "check('status 200', function () { pm.response.to.have.status(200) })",
    "check('body echoed', function () { pm.expect(pm.response.json().json.hello).to.eql('reporter') })",
  ],
)

const expectedFailure = item(
  'GET expected 200',
  'Намеренно падающая проверка: показывает статус failed и сообщение в отчёте. '
    + 'Можно не запускать эту папку.',
  {
    method: 'GET',
    header: [],
    url: '{{baseUrl}}/status/404',
  },
  ["check('status 200', function () { pm.response.to.have.status(200) })"],
)

const collection = {
  info: {
    _postman_id: '3f0b7c1e-9a2d-4c5b-8e6f-1a2b3c4d5e6f',
    name: 'Reporter Demo API',
    description:
      'Демонстрационная коллекция для Reporter for autotests.\n\n'
      + 'Каждый запрос содержит в Tests: helper (check), сами проверки и блок отправки '
      + 'через pm.sendRequest. Настройте переменные коллекции reporter* и запустите '
      + 'через Collection Runner. Подробности — в README рядом.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'https://postman-echo.com', type: 'string' },
    { key: 'reporterUrl', value: 'http://localhost:3001', type: 'string' },
    { key: 'reporterProject', value: 'cwi', type: 'string' },
    { key: 'reporterEnvironment', value: 'dso', type: 'string' },
    { key: 'reporterCollection', value: 'Reporter Demo API', type: 'string' },
    { key: 'reporterOwner', value: 'qa', type: 'string' },
    { key: 'reporterTags', value: 'postman,ui', type: 'string' },
    { key: 'reporterOrigin', value: 'local', type: 'string' },
  ],
  item: [
    {
      name: 'Smoke',
      description: 'Два проходящих запроса: показывают passed в отчёте.',
      item: [getEcho, postEcho],
    },
    {
      name: 'Demo failure (намеренно)',
      description: 'Проверка ожидает 200 на /status/404 — в отчёте появится failed. '
        + 'Снимите галочку с папки, если она не нужна.',
      item: [expectedFailure],
    },
  ],
}

fs.writeFileSync(OUTPUT, JSON.stringify(collection, null, 2) + '\n', 'utf8')
console.log(`Собрана коллекция: ${path.relative(process.cwd(), OUTPUT)}`)

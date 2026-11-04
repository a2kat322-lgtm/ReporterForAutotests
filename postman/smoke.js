'use strict'

const http = require('node:http')
const newman = require('newman')
const AdmZip = require('adm-zip')
const reporter = require('./newman-reporter-report')

const failures = []
let serverToClose = null

function check(condition, message) {
  if (condition) {
    console.log(`PASS  ${message}`)
    return
  }
  failures.push(message)
  console.error(`FAIL  ${message}`)
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET' }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  const rows = []
  let archive = null
  let importQuery = null

  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname === '/api/results') {
        rows.push(JSON.parse(body.toString('utf8')))
        send(res, 201, { received: true })
        return
      }
      if (url.pathname === '/api/allure/import') {
        archive = body
        importQuery = url.searchParams
        send(res, 201, { imported: 0, enriched: 0, duplicates: 0, totalResults: 0, attachments: 0 })
        return
      }
      if (url.pathname === '/ok') {
        send(res, 200, { ok: true })
        return
      }
      if (url.pathname === '/fail') {
        send(res, 500, { ok: false })
        return
      }
      send(res, 404, { ok: false })
    })
  })

  const port = await listen(server)
  serverToClose = server
  const base = `http://127.0.0.1:${port}`

  process.env.REPORTER_API = base
  process.env.REPORTER_PROJECT = 'smoke'
  process.env.REPORTER_ENVIRONMENT = 'dso'
  process.env.REPORTER_LAUNCH = 'smoke-launch'
  process.env.REPORTER_ORIGIN = 'ci'
  process.env.REPORTER_TAGS = 'smoke,postman'

  const collection = {
    info: {
      name: 'Smoke API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      {
        name: 'Smoke',
        item: [
          {
            name: 'GET ok',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    "pm.test('status 200', () => pm.response.to.have.status(200));",
                    "pm.test('body ok', () => pm.expect(pm.response.json().ok).to.eql(true));",
                  ],
                },
              },
            ],
            request: { method: 'GET', header: [], url: `${base}/ok` },
          },
          {
            name: 'GET fail',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    "pm.test('status 200', () => pm.response.to.have.status(200));",
                    "pm.test('body ok', () => pm.expect(pm.response.json().ok).to.eql(true));",
                  ],
                },
              },
            ],
            request: { method: 'GET', header: [], url: `${base}/fail` },
          },
        ],
      },
      {
        name: 'Broken',
        item: [
          {
            name: 'Unreachable',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: ["pm.test('status 200', () => pm.response.to.have.status(200));"],
                },
              },
            ],
            request: { method: 'GET', header: [], url: 'http://127.0.0.1:1/nothing' },
          },
        ],
      },
    ],
  }

  let resolveRun
  const runDone = new Promise((resolve) => {
    resolveRun = resolve
  })

  const emitter = newman.run({ collection, reporters: [] }, (error, summary) => {
    resolveRun({ error, summary })
  })
  reporter(emitter, {}, { collection })

  const reportDone = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 60_000)
    timer.unref()
    emitter.once('report-done', (report) => {
      clearTimeout(timer)
      resolve(report)
    })
  })

  const [run, report] = await Promise.all([runDone, reportDone])
  const catalog = await request(port, '/ok')
  check(catalog.status === 200, 'мок-сервер отвечает на запросы коллекции')

  check(!run.error, `newman завершился без ошибки${run.error ? `: ${run.error.message}` : ''}`)
  check(Boolean(report), 'репортер прислал report-done')
  check(report && report.posted === 3, `форма: отправлено 3 строки (получено ${report && report.posted})`)
  check(report && report.failed === 0, 'форма: нет ошибок отправки')

  const byPath = new Map(rows.map((row) => [row.path, row]))
  check(rows.length === 3, `мок-API получил 3 строки (получено ${rows.length})`)
  check(byPath.get('Smoke API/Smoke#GET ok')?.status === 'passed', 'GET ok → passed')
  check(byPath.get('Smoke API/Smoke#GET fail')?.status === 'failed', 'GET fail → failed')
  check(byPath.get('Smoke API/Broken#Unreachable')?.status === 'broken', 'Unreachable → broken')

  const failedRow = byPath.get('Smoke API/Smoke#GET fail')
  check(Boolean(failedRow && failedRow.message.includes('status 200')), 'сообщение о провале содержит имя проверки')
  check(Boolean(failedRow && failedRow.circuit === 'dso'), 'circuit = environment')
  check(Boolean(failedRow && failedRow.projectName === 'smoke'), 'projectName передан')
  check(Boolean(failedRow && failedRow.tag && failedRow.tag.includes('smoke')), 'теги переданы')
  const start = failedRow && new Date(failedRow.startDate).valueOf()
  const end = failedRow && new Date(failedRow.endDate).valueOf()
  check(Number.isFinite(start) && Number.isFinite(end) && end >= start, 'startDate/endDate корректны и с offset')

  check(Boolean(archive), 'архив allure-results загружен')
  const zip = archive ? new AdmZip(archive) : null
  const resultEntries = zip ? zip.getEntries().filter((entry) => entry.entryName.endsWith('-result.json')) : []
  check(resultEntries.length === 3, `в архиве 3 результата (получено ${resultEntries.length})`)

  const results = resultEntries.map((entry) => JSON.parse(entry.getData().toString('utf8')))
  const resultByPath = new Map(results.map((result) => [result.fullName, result]))
  const okResult = resultByPath.get('Smoke API/Smoke#GET ok')
  const failResult = resultByPath.get('Smoke API/Smoke#GET fail')
  const brokenResult = resultByPath.get('Smoke API/Broken#Unreachable')

  check(Boolean(okResult && okResult.status === 'passed'), 'архив: GET ok → passed')
  check(Boolean(failResult && failResult.status === 'failed'), 'архив: GET fail → failed')
  check(Boolean(brokenResult && brokenResult.status === 'broken'), 'архив: Unreachable → broken')
  check(Boolean(failResult && failResult.steps.length === 2), 'шаги = проверки (2 шага у GET fail)')
  check(Boolean(failResult && failResult.steps.every((step) => step.status === 'failed')), 'провалившиеся проверки отмечены failed')
  check(
    Boolean(okResult && okResult.labels.some((label) => label.name === 'testClass' && label.value === 'Smoke API/Smoke')),
    'labels: testClass совпадает с путём формы',
  )
  check(
    Boolean(okResult && okResult.labels.some((label) => label.name === 'testMethod' && label.value === 'GET ok')),
    'labels: testMethod = имя запроса',
  )

  check(Boolean(importQuery), 'импорт вызван с query-параметрами')
  check(importQuery && importQuery.get('environment') === 'dso', 'импорт: environment=dso')
  check(importQuery && importQuery.get('projectName') === 'smoke', 'импорт: projectName=smoke')
  check(importQuery && importQuery.get('launchId') === 'smoke-launch', 'импорт: launchId=smoke-launch')
  check(importQuery && importQuery.get('origin') === 'ci', 'импорт: origin=ci')
  check(importQuery && importQuery.get('fileName') === 'postman-results.zip', 'импорт: имя архива')

  await new Promise((resolve) => server.close(resolve))
  serverToClose = null

  if (failures.length) {
    console.error(`\n${failures.length} проверок провалено`)
    process.exitCode = 1
    return
  }
  console.log('\nВсе проверки прошли')
}

main().catch(async (error) => {
  console.error(error)
  if (serverToClose) await new Promise((resolve) => serverToClose.close(resolve))
  process.exitCode = 1
})

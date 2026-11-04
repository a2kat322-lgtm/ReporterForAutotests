#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const REPORT_TIMEOUT_MS = 5 * 60_000

function usage() {
  console.log(`
Запуск коллекции Postman с отправкой результатов в Reporter for autotests.

  node run.js <collection.json> [options]

Options:
  -e, --environment <file>     файл окружения Postman
  -d, --iteration-data <file>  файл данных итераций
  -f, --folder <name>          запустить только папку коллекции
      --delay-request <ms>     пауза между запросами
      --no-archive             только форма, без архива allure-results
  -h, --help                   эта справка

Настройки берутся из переменных окружения:
  REPORTER_API, REPORTER_PROJECT, REPORTER_ENVIRONMENT, REPORTER_LAUNCH,
  REPORTER_ORIGIN, REPORTER_TAGS, REPORTER_OWNER, REPORTER_EPIC,
  REPORTER_UPLOAD, REPORTER_ARCHIVE_NAME.

Пример:
  REPORTER_API=http://localhost:3001 REPORTER_PROJECT=cwi REPORTER_ENVIRONMENT=dso \\
    node run.js ./collection.json -e ./environment.json
`)
}

function parseArgs(argv) {
  const args = { archive: true }
  const valueOf = (index) => {
    const value = argv[index + 1]
    if (value == null || value.startsWith('-')) throw new Error(`Не указано значение для ${argv[index]}`)
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--environment' || arg === '-e') {
      args.environment = valueOf(index)
      index += 1
    } else if (arg === '--iteration-data' || arg === '-d') {
      args.iterationData = valueOf(index)
      index += 1
    } else if (arg === '--folder' || arg === '-f') {
      args.folder = valueOf(index)
      index += 1
    } else if (arg === '--delay-request') {
      const value = Number(valueOf(index))
      if (!Number.isFinite(value) || value < 0) throw new Error('--delay-request должен быть неотрицательным числом')
      args.delayRequest = value
      index += 1
    } else if (arg === '--no-archive') {
      args.archive = false
    } else if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    } else if (arg.startsWith('-')) {
      throw new Error(`Неизвестный параметр: ${arg}`)
    } else if (!args.collection) {
      args.collection = arg
    } else {
      throw new Error(`Лишний аргумент: ${arg}`)
    }
  }
  return args
}

function readCollection(file) {
  const absolute = path.resolve(file)
  const raw = fs.readFileSync(absolute, 'utf8')
  return JSON.parse(raw)
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`[reporter] ${error.message}`)
    usage()
    process.exit(2)
  }
  if (!args.collection) {
    usage()
    process.exit(2)
  }

  let newman
  try {
    // Resolved from postman/node_modules after `npm install` in this folder.
    newman = require('newman')
  } catch {
    console.error('[reporter] Newman не установлен. Выполните `npm install` в папке postman.')
    process.exit(2)
  }
  const reporter = require('./newman-reporter-report')

  let collection
  try {
    collection = readCollection(args.collection)
  } catch (error) {
    console.error(`[reporter] Не удалось прочитать коллекцию: ${error.message}`)
    process.exit(2)
  }

  const options = {
    collection,
    reporters: ['cli'],
    folder: args.folder,
    delayRequest: args.delayRequest,
  }
  if (args.environment) options.environment = path.resolve(args.environment)
  if (args.iterationData) options.iterationData = path.resolve(args.iterationData)

  let resolveRun
  const runDone = new Promise((resolve) => {
    resolveRun = resolve
  })

  const emitter = newman.run(options, (error, summary) => resolveRun({ error, summary }))
  reporter(emitter, { upload: args.archive }, { collection })

  const reportDone = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), REPORT_TIMEOUT_MS)
    timer.unref()
    emitter.once('report-done', (report) => {
      clearTimeout(timer)
      resolve(report)
    })
  })

  const [run, report] = await Promise.all([runDone, reportDone])

  if (run.error) {
    console.error('[reporter] Прогон завершился ошибкой:', run.error.message)
    process.exitCode = 2
    return
  }

  const failures = (run.summary && run.summary.run && run.summary.run.failures) || []
  const reportingFailed = Boolean(report && report.failed)
  process.exitCode = failures.length || reportingFailed ? 1 : 0
}

main().catch((error) => {
  console.error('[reporter]', error)
  process.exitCode = 2
})

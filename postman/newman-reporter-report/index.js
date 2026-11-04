'use strict'

const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const AdmZip = require('adm-zip')

/**
 * Newman reporter for Reporter for autotests.
 *
 * Two channels, like the JUnit/TestNG client:
 *   - form:    POST /api/results per completed request (fast rows in the report);
 *   - archive: POST /api/allure/import once per run (assertions as steps, request
 *              and response as parameters, failure text and labels).
 *
 * The archive is written here instead of using `newman-reporter-allure`: Allure's
 * reporter builds `fullName` as `<project>:Collection/Folder#Request`, which does
 * not match the form `path` and would create a second run instead of enriching
 * the posted one. The server derives `path` from `testClass` + `testMethod`
 * labels, so both channels must use exactly the same string.
 */

const POST_CONCURRENCY = 4
const POST_TIMEOUT_MS = 30_000
const UPLOAD_TIMEOUT_MS = 120_000
const MAX_MESSAGE = 20_000
const MAX_PATH = 300
const ORIGINS = new Set(['ci', 'local', 'unknown'])

function trimSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function readEnv(name, fallback) {
  const value = process.env[name]
  return value == null || value === '' ? fallback : value
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function truncate(value, max = MAX_MESSAGE) {
  const text = typeof value === 'string' ? value : String(value ?? '')
  return text.length > max ? text.slice(0, max) : text
}

function readConfig(reporterOptions) {
  const options = reporterOptions || {}
  const rawOrigin = readEnv('REPORTER_ORIGIN', process.env.CI ? 'ci' : 'local').trim().toLowerCase()
  const origin = ORIGINS.has(rawOrigin) ? rawOrigin : 'unknown'
  const rawUpload = options.upload !== undefined ? options.upload : readEnv('REPORTER_UPLOAD', 'true')

  return {
    api: trimSlash(readEnv('REPORTER_API', 'http://localhost:3001')),
    project: readEnv('REPORTER_PROJECT', 'default').trim() || 'default',
    environment: readEnv('REPORTER_ENVIRONMENT', 'local').trim().toLowerCase() || 'local',
    launchId: truncate(readEnv('REPORTER_LAUNCH', randomUUID()), 128),
    origin,
    originWasInvalid: rawOrigin !== origin,
    tags: readEnv('REPORTER_TAGS', '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    owner: readEnv('REPORTER_OWNER', '').trim(),
    epic: readEnv('REPORTER_EPIC', '').trim(),
    upload: !(rawUpload === false || rawUpload === 'false'),
    archiveName: readEnv('REPORTER_ARCHIVE_NAME', 'postman-results.zip'),
  }
}

function collectionNameOf(options, reporterOptions) {
  const collection = options && options.collection
  if (collection && typeof collection === 'object') {
    // `newman.run` receives a Collection instance, while a hand-built options
    // object (and `run.js`) may carry the raw JSON shape with `info.name`.
    if (collection.name) return String(collection.name)
    if (collection.info && collection.info.name) return String(collection.info.name)
  }
  if (typeof collection === 'string' && collection) return path.parse(collection).name
  if (reporterOptions && reporterOptions.collectionName) return String(reporterOptions.collectionName)
  return 'Postman'
}

/** `Collection/Folder#Request`, the same shape the JUnit extension posts as `Class#method`. */
function locationOf(item, collectionName) {
  const folders = []
  if (item && typeof item.forEachParent === 'function') {
    item.forEachParent((parent) => {
      const name = parent && (parent.name || parent.id)
      if (name) folders.unshift(String(name))
    })
  }
  if (folders[0] === collectionName) folders.shift()
  let classPart = [collectionName, ...folders].filter(Boolean).join('/')
  const method = String((item && item.name) || 'request')

  // The server truncates `path` to 300 characters; keeping the method visible
  // here makes the form and archive truncate to the same string.
  if (`${classPart}#${method}`.length > MAX_PATH) {
    classPart = classPart.slice(0, Math.max(0, MAX_PATH - method.length - 1))
  }
  return { classPart, method, path: `${classPart}#${method}`.slice(0, MAX_PATH) }
}

function statusOf(state) {
  if (state.errors.length) return 'broken'
  if (state.assertions.some((assertion) => assertion.error)) return 'failed'
  if (state.assertions.length && state.assertions.every((assertion) => assertion.skipped)) return 'skipped'
  return 'passed'
}

function messageOf(state) {
  if (state.errors.length) {
    const error = state.errors[0]
    return truncate(error.message ? `${error.name || 'error'}: ${error.message}` : error)
  }
  const failed = state.assertions.filter((assertion) => assertion.error)
  if (failed.length) {
    return truncate(failed.map((assertion) => `${assertion.name}: ${assertion.error.message}`).join('; '))
  }
  return ' '
}

function errorOf(error) {
  if (!error) return { name: 'error', message: 'unknown error', stack: '' }
  return {
    name: error.name || 'error',
    message: String(error.message || error),
    stack: typeof error.stack === 'string' ? error.stack : '',
  }
}

function suiteNameOf(location, collectionName) {
  const parts = location.classPart.split('/')
  return parts.length > 1 ? parts[parts.length - 1] : collectionName
}

function buildLabels(location, collectionName, config) {
  const suite = suiteNameOf(location, collectionName)
  const labels = [
    { name: 'testClass', value: location.classPart },
    { name: 'testMethod', value: location.method },
    { name: 'parentSuite', value: collectionName },
    { name: 'suite', value: suite },
    { name: 'feature', value: suite },
    { name: 'story', value: location.method },
    { name: 'framework', value: 'newman' },
  ]
  if (config.owner) labels.push({ name: 'owner', value: config.owner })
  if (config.epic) labels.push({ name: 'epic', value: config.epic })
  for (const tag of config.tags) labels.push({ name: 'tag', value: tag })
  return labels.filter((label) => label.value)
}

function buildAllureResult(config, collectionName, location, state, item, status, start, end) {
  const request = (item && item.request) || {}
  const rawUrl = request.url && typeof request.url.toString === 'function' ? request.url.toString() : ''
  const requestLine = `${request.method || 'GET'} - ${rawUrl}`
  const failedAssertions = state.assertions.filter((assertion) => assertion.error)
  const detailsSource = state.errors[0] || (failedAssertions[0] && failedAssertions[0].error) || null

  const result = {
    uuid: randomUUID(),
    historyId: createHash('md5').update(location.path).digest('hex'),
    name: location.method,
    fullName: location.path,
    status,
    stage: 'finished',
    start,
    stop: end,
    labels: buildLabels(location, collectionName, config),
    links: [],
    attachments: [],
    parameters: [{ name: 'Request', value: requestLine }],
    steps: state.assertions.map((assertion) => ({
      name: assertion.name,
      status: assertion.skipped ? 'skipped' : assertion.error ? 'failed' : 'passed',
      stage: 'finished',
      start: assertion.at,
      stop: assertion.at,
      steps: [],
      attachments: [],
      parameters: [],
      ...(assertion.error
        ? { statusDetails: { message: truncate(assertion.error.message), trace: truncate(assertion.error.stack || '', 50_000) } }
        : {}),
    })),
  }

  if (state.response && state.response.code != null) {
    result.parameters.push({ name: 'Response Code', value: String(state.response.code) })
  }
  if (status === 'failed' || status === 'broken') {
    result.statusDetails = {
      message: messageOf(state),
      trace: truncate((detailsSource && detailsSource.stack) || '', 50_000),
    }
  }
  return result
}

module.exports = function Reporter(emitter, reporterOptions, options) {
  const config = readConfig(reporterOptions)
  const collectionName = collectionNameOf(options, reporterOptions)
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-postman-'))
  const states = new Map()
  const stats = { posted: 0, failed: 0, uploaded: false, imported: null }
  const queue = []
  let active = 0

  const log = (...args) => console.log('[reporter]', ...args)
  const logError = (...args) => console.error('[reporter]', ...args)

  if (config.originWasInvalid) {
    logError(`unknown REPORTER_ORIGIN, expected ci/local/unknown; using "unknown"`)
  }

  const pump = () => {
    while (active < POST_CONCURRENCY && queue.length) {
      const job = queue.shift()
      active += 1
      job()
        .catch((error) => logError('POST /api/results failed:', error.message))
        .finally(() => {
          active -= 1
          pump()
        })
    }
  }

  const flush = async () => {
    while (queue.length || active) await sleep(25)
  }

  async function post(row) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${config.api}/api/results`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(row),
          signal: AbortSignal.timeout(POST_TIMEOUT_MS),
        })
        const text = await response.text()
        if (response.ok) {
          stats.posted += 1
          return
        }
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await sleep(500 * attempt)
          continue
        }
        stats.failed += 1
        logError(`POST /api/results failed: HTTP ${response.status} ${truncate(text, 500)}`)
        return
      } catch (error) {
        if (attempt < 3) {
          await sleep(500 * attempt)
          continue
        }
        stats.failed += 1
        logError('POST /api/results failed:', error.message)
      }
    }
  }

  async function uploadArchive() {
    const files = fs.readdirSync(workDir).filter((name) => name.endsWith('-result.json'))
    if (!files.length) {
      log('no allure results to upload')
      return
    }

    const zip = new AdmZip()
    for (const file of files) zip.addLocalFile(path.join(workDir, file))

    const query = new URLSearchParams({
      environment: config.environment,
      projectName: config.project,
      launchId: config.launchId,
      origin: config.origin,
      fileName: config.archiveName,
    })

    const response = await fetch(`${config.api}/api/allure/import?${query.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: zip.toBuffer(),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    })
    const text = await response.text()
    if (!response.ok) {
      logError(`POST /api/allure/import failed: HTTP ${response.status} ${truncate(text, 500)}`)
      return
    }
    stats.uploaded = true
    try {
      stats.imported = JSON.parse(text)
    } catch {
      stats.imported = { raw: text }
    }
    log(`POST /api/allure/import: ${text}`)
  }

  emitter.on('beforeItem', (err, args) => {
    if (!args || !args.item) return
    states.set(args.item.id, { start: Date.now(), assertions: [], errors: [], response: null })
  })

  emitter.on('assertion', (err, args) => {
    if (!args || !args.item) return
    const state = states.get(args.item.id)
    if (!state) return
    state.assertions.push({
      name: String(args.assertion || 'assertion'),
      skipped: Boolean(args.skipped),
      error: err ? { message: truncate(err.message), stack: truncate(err.stack || '', 50_000) } : null,
      at: Date.now(),
    })
  })

  emitter.on('script', (err, args) => {
    if (!err || !args || !args.item) return
    const state = states.get(args.item.id)
    if (!state) return
    const error = errorOf(err)
    if (!state.errors.some((item) => item.message === error.message)) state.errors.push(error)
  })

  emitter.on('exception', (err, args) => {
    if (!args || !args.item) return
    const state = states.get(args.item.id)
    if (!state) return
    state.errors.push(errorOf(args.error || err))
  })

  emitter.on('request', (err, args) => {
    if (!args || !args.item) return
    const state = states.get(args.item.id)
    if (!state) return
    state.response = args.response ? { code: args.response.code, status: args.response.status } : null
    if (err) state.errors.push(errorOf(err))
  })

  emitter.on('item', (err, args) => {
    if (!args || !args.item) return
    const state = states.get(args.item.id)
    if (!state) return
    states.delete(args.item.id)
    if (err) state.errors.push(errorOf(err))

    const location = locationOf(args.item, collectionName)
    const status = statusOf(state)
    const end = Date.now()
    const start = state.start

    fs.writeFileSync(
      path.join(workDir, `${randomUUID()}-result.json`),
      JSON.stringify(buildAllureResult(config, collectionName, location, state, args.item, status, start, end)),
      'utf8',
    )

    const row = {
      projectName: config.project,
      path: location.path,
      suiteName: suiteNameOf(location, collectionName),
      caseName: location.method,
      status,
      circuit: config.environment,
      message: messageOf(state),
      startDate: new Date(start).toISOString(),
      endDate: new Date(end).toISOString(),
    }
    if (config.owner) row.owner = config.owner
    if (config.epic) row.epic = config.epic
    if (config.tags.length) row.tag = config.tags

    queue.push(() => post(row))
    pump()
  })

  emitter.on('done', () => {
    void (async () => {
      try {
        await flush()
        if (config.upload) await uploadArchive()
        else log('archive channel disabled (REPORTER_UPLOAD=false or upload: false)')
      } catch (error) {
        logError('archive channel failed:', error.message)
      } finally {
        try {
          fs.rmSync(workDir, { recursive: true, force: true })
        } catch {
          // A locked temp file must not hide the run summary.
        }
        const imported = stats.imported && typeof stats.imported === 'object'
          ? `, archive: imported=${stats.imported.imported ?? '?'} enriched=${stats.imported.enriched ?? '?'}`
          : ''
        log(`form: ${stats.posted} posted, ${stats.failed} failed${imported}`)
        emitter.emit('report-done', { ...stats, collection: collectionName })
      }
    })()
  })
}

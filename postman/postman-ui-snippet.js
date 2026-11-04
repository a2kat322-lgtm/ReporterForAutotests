/* global pm */
/*
 * Отправка результата запроса в Reporter for autotests из Postman UI.
 *
 * 1. Collection → Variables: reporterUrl, reporterProject, reporterEnvironment,
 *    reporterCollection, reporterOwner, reporterTags (см. docs/13).
 * 2. В начало post-response скрипта вставьте блок reporter-helper.
 * 3. Проверки пишите через check(...) вместо pm.test(...).
 * 4. В конец post-response скрипта вставьте блок reporter-send.
 *
 * Обычные pm.test(...) отправка не видит. Путь — Коллекция#Запрос (папки
 * в песочнице недоступны), архив allure-results не отправляется.
 */

// #region reporter-helper
const reporterChecks = []
let reporterTotal = 0

function check(name, fn) {
  reporterTotal += 1
  pm.test(name, function () {
    try {
      fn()
    } catch (error) {
      reporterChecks.push(name + ': ' + error.message)
      throw error
    }
  })
}
// #endregion reporter-helper

// Пример; в своих запросах используйте check(...):
check('status 2xx', function () {
  pm.response.to.be.success
})

// #region reporter-send
const reporterVariable = function (name, fallback) {
  return pm.variables.get(name) || fallback
}
const reporterCode = pm.response && pm.response.code
const reporterEnd = Date.now()
const reporterStatus = !reporterCode
  ? 'broken'
  : reporterChecks.length || (reporterTotal === 0 && reporterCode >= 400)
    ? 'failed'
    : 'passed'
const reporterEndpoint = reporterVariable('reporterUrl', 'http://localhost:3001').replace(/\/$/, '')

pm.sendRequest(
  {
    url: reporterEndpoint + '/api/results',
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        projectName: reporterVariable('reporterProject', 'default'),
        path: reporterVariable('reporterCollection', 'Postman') + '#' + pm.info.requestName,
        caseName: pm.info.requestName,
        status: reporterStatus,
        circuit: reporterVariable('reporterEnvironment', 'local'),
        owner: reporterVariable('reporterOwner', '') || undefined,
        message: !reporterCode
          ? 'request failed: no response'
          : reporterChecks.join('; ') || ' ',
        startDate: new Date(reporterEnd - ((pm.response && pm.response.responseTime) || 0)).toISOString(),
        endDate: new Date(reporterEnd).toISOString(),
        tag: reporterVariable('reporterTags', '')
          .split(',')
          .map(function (tag) { return tag.trim() })
          .filter(Boolean),
      }),
    },
  },
  function (error) {
    if (error) console.error('[reporter] ' + error.message)
  },
)
// #endregion reporter-send

'use strict'

const assert = require('node:assert')
const { instrumentRequest, convertTests } = require('./instrument')

const failures = []

function check(name, fn) {
  try {
    fn()
    console.log(`PASS  ${name}`)
  } catch (error) {
    failures.push(name)
    console.error(`FAIL  ${name}: ${error.message}`)
  }
}

check('pm.test(...) переписывается в __reportCheck(...)', () => {
  const source = convertTests("pm.test('status 200', () => pm.response.to.have.status(200))")
  assert.match(source, /__reportCheck\('status 200'/)
  assert.doesNotMatch(source, /[^.]pm\.test\(/)
})

check('pm.test.skip не трогается', () => {
  const source = convertTests("pm.test.skip('later', () => {})")
  assert.match(source, /pm\.test\.skip\(/)
  assert.doesNotMatch(source, /__reportCheck\(/)
})

check('instrumentRequest добавляет helper и send', () => {
  const item = {
    name: 'request',
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('x', () => {})"] } }],
    request: { method: 'GET', url: 'http://localhost' },
  }
  instrumentRequest(item)
  const source = item.event[0].script.exec.join('\n')
  assert.match(source, /reporter:helper:start/)
  assert.match(source, /reporter:send:start/)
  assert.match(source, /__reportCheck\('x'/)
})

check('повторный запуск не дублирует блоки', () => {
  const item = {
    name: 'request',
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('x', () => {})"] } }],
    request: { method: 'GET', url: 'http://localhost' },
  }
  instrumentRequest(item)
  instrumentRequest(item)
  const source = item.event[0].script.exec.join('\n')
  assert.equal((source.match(/reporter:helper:start/g) || []).length, 1)
  assert.equal((source.match(/reporter:send:start/g) || []).length, 1)
  assert.equal((source.match(/__reportCheck\('x'/g) || []).length, 1)
})

check('запрос без Tests получает блок отправки', () => {
  const item = { name: 'no tests', request: { method: 'GET', url: 'http://localhost' } }
  instrumentRequest(item)
  const source = item.event[0].script.exec.join('\n')
  assert.match(source, /reporter:send:start/)
  assert.match(source, /reporter:helper:start/)
})

if (failures.length) {
  console.error(`\n${failures.length} проверок провалено`)
  process.exitCode = 1
} else {
  console.log('\nВсе проверки прошли')
}

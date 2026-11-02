import { readFileSync, writeFileSync } from 'node:fs'

const md = readFileSync('docs/12-client-integration.md', 'utf8')

const blocks = []
let heading = ''
let fence = null

for (const line of md.split(/\r?\n/)) {
  if (line.startsWith('```')) {
    if (fence == null) {
      fence = { heading, lang: line.slice(3).trim(), lines: [] }
    } else {
      blocks.push({ heading: fence.heading, lang: fence.lang, code: fence.lines.join('\n') })
      fence = null
    }
    continue
  }
  if (fence) fence.lines.push(line)
  else if (/^#{1,6}\s/.test(line)) heading = line.replace(/^#{1,6}\s*/, '')
}

function pick(headingPrefix, index, lang) {
  const found = blocks.filter((b) => b.heading.startsWith(headingPrefix) && b.lang === lang)
  if (!found[index]) throw new Error(`Block not found: ${headingPrefix} #${index} (${lang})`)
  return found[index].code
}

const entries = {
  REPORTER_CLIENT: pick('3. Общий клиент', 0, 'java'),
  JUNIT5_RESULT_WRITER: pick('4.2.', 0, 'java'),
  JUNIT5_UPLOADER: pick('4.3.', 0, 'java'),
  JUNIT4_RESULT_WRITER: pick('5.2.', 0, 'java'),
  JUNIT4_RUNNER: pick('5.3.', 0, 'java'),
  JUNIT4_RULE: pick('5.4.', 0, 'java'),
  TESTNG_RESULT_WRITER: pick('6.2.', 0, 'java'),
  TESTNG_UPLOADER: pick('6.3.', 0, 'java'),
}

let output = '// Сгенерировано из docs/12-client-integration.md скриптом scripts/generate-help-code.mjs.\n// Правьте документ и перегенерируйте: node scripts/generate-help-code.mjs\n\n'

for (const [name, code] of Object.entries(entries)) {
  if (code.includes('`')) throw new Error(`Backtick in ${name}`)
  if (code.includes('${')) throw new Error(`Template placeholder in ${name}`)
  output += `export const ${name} = String.raw\`${code}\`\n\n`
}

writeFileSync('src/pages/helpCode.js', output)
console.log(`Generated ${Object.keys(entries).length} constants -> src/pages/helpCode.js`)

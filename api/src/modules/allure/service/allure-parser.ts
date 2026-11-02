import { basename } from 'node:path'
import type { ZipEntry } from './zip-reader'

/**
 * Reads the `allure-results` file format produced by every Allure adapter:
 * `*-result.json` (one file per test) and the attachment files they reference.
 *
 * The parser is intentionally tolerant: the format is external and evolves
 * between Allure versions, so unknown fields are ignored, broken files become
 * warnings instead of failing the whole archive, and no field is trusted to be
 * present. Containers (`*-container.json`) are not used yet: they only describe
 * fixtures, while the report shows the case steps.
 */

export type NormalizedStatus = 'passed' | 'failed' | 'broken' | 'skipped'

export interface AttachmentRef {
  name: string
  type: string
  source: string
}

export interface ParsedParameter {
  name: string
  value: string
}

/**
 * Allure links: `@TmsLink` and `@Issue` produce `{ name, url, type }` entries
 * with `type` `tms` / `issue`; `@Link` uses its own type (default `link`).
 */
export interface ParsedLink {
  name: string
  url: string | null
  type: string
}

export interface ParsedStep {
  name: string
  status: NormalizedStatus
  start: number | null
  stop: number | null
  durationMs: number | null
  steps: ParsedStep[]
  attachments: AttachmentRef[]
  parameters: ParsedParameter[]
  message: string | null
  trace: string | null
}

export interface ParsedStatusDetails {
  message: string | null
  trace: string | null
  known: boolean
  muted: boolean
  flaky: boolean
}

export interface ParsedResult {
  externalId: string
  path: string
  suiteName: string | null
  caseName: string | null
  /** Allure `labels.epic`; the report filters by it. */
  epic: string | null
  owner: string | null
  status: NormalizedStatus
  message: string | null
  startDate: Date
  endDate: Date
  tags: string[]
  steps: ParsedStep[]
  attachments: AttachmentRef[]
  parameters: ParsedParameter[]
  links: ParsedLink[]
  statusDetails: ParsedStatusDetails | null
}

export interface ParsedArchive {
  results: ParsedResult[]
  files: Map<string, Buffer>
  /** Attachment lookup by file name: users often zip the containing folder. */
  byBasename: Map<string, Buffer>
  warnings: string[]
}

const MAX_STEPS_PER_LEVEL = 500
const MAX_STEP_DEPTH = 40
const MAX_TAGS = 100

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function ms(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeStatus(value: unknown): NormalizedStatus {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (status === 'passed' || status === 'failed' || status === 'broken' || status === 'skipped') return status
  // `unknown` (unfinished run) and unexpected values are reported as broken so
  // they stay visible in the report instead of disappearing.
  return 'broken'
}

function parseAttachmentRefs(value: unknown): AttachmentRef[] {
  if (!Array.isArray(value)) return []
  const refs: AttachmentRef[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const source = text((item as { source?: unknown }).source, 300)
    if (!source) continue
    refs.push({
      name: text((item as { name?: unknown }).name, 200) ?? 'attachment',
      type: text((item as { type?: unknown }).type, 100) ?? 'application/octet-stream',
      source,
    })
  }
  return refs
}

function parseParameters(value: unknown): ParsedParameter[] {
  if (!Array.isArray(value)) return []
  const parameters: ParsedParameter[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = text((item as { name?: unknown }).name, 200)
    if (!name) continue
    const rawValue = (item as { value?: unknown }).value
    parameters.push({ name, value: rawValue == null ? '' : String(rawValue).slice(0, 2000) })
  }
  return parameters
}

function parseLinks(value: unknown): ParsedLink[] {
  if (!Array.isArray(value)) return []
  const links: ParsedLink[] = []
  const seen = new Set<string>()
  for (const item of value.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue
    const entry = item as { name?: unknown; url?: unknown; type?: unknown }
    const url = text(entry.url, 2000)
    const name = text(entry.name, 300) ?? url
    if (!name) continue
    const type = (text(entry.type, 30) ?? 'link').toLowerCase()
    const key = `${type}|${name}|${url ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ name, url, type })
  }
  return links
}

function parseStep(value: unknown, depth: number): ParsedStep | null {
  if (!value || typeof value !== 'object' || depth > MAX_STEP_DEPTH) return null
  const step = value as Record<string, unknown>
  const start = ms(step.start)
  const stop = ms(step.stop)
  const details = (step.statusDetails ?? {}) as Record<string, unknown>
  return {
    name: text(step.name, 500) ?? 'step',
    status: normalizeStatus(step.status),
    start,
    stop,
    durationMs: start != null && stop != null ? Math.max(0, stop - start) : null,
    steps: parseSteps(step.steps, depth + 1),
    attachments: parseAttachmentRefs(step.attachments),
    parameters: parseParameters(step.parameters),
    message: text(details.message, 20_000),
    trace: text(details.trace, 50_000),
  }
}

function parseSteps(value: unknown, depth: number): ParsedStep[] {
  if (!Array.isArray(value)) return []
  const steps: ParsedStep[] = []
  for (const item of value.slice(0, MAX_STEPS_PER_LEVEL)) {
    const step = parseStep(item, depth)
    if (step) steps.push(step)
  }
  return steps
}

function parseResult(value: Record<string, unknown>): ParsedResult | null {
  const externalId = text(value.uuid, 128) ?? text(value.historyId, 128)
  if (!externalId) return null

  const start = ms(value.start)
  if (start == null) return null
  const startDate = new Date(start)
  if (Number.isNaN(startDate.valueOf())) return null
  const stop = ms(value.stop)
  const endDate = stop != null && stop >= start ? new Date(stop) : startDate

  const labels = Array.isArray(value.labels) ? value.labels : []
  const label = (wanted: string): string | null => {
    for (const item of labels) {
      if (!item || typeof item !== 'object') continue
      const entry = item as { name?: unknown; value?: unknown }
      if (typeof entry.name !== 'string' || entry.name.trim().toLowerCase() !== wanted) continue
      return text(entry.value, 300)
    }
    return null
  }

  const testClass = label('testclass') ?? label('class')
  const testMethod = label('testmethod') ?? label('method')
  const fallbackPath = text(value.fullName, 300) ?? text(value.name, 300) ?? 'unknown'
  const path = testClass && testMethod
    // Matches the path used by the JUnit extension (Class#method), so imported
    // and posted runs land in the same catalog entry.
    ? `${testClass}#${testMethod}`.slice(0, 300)
    : fallbackPath.replace(/\(\)$/, '').slice(0, 300)

  const rawDetails = (value.statusDetails ?? {}) as Record<string, unknown>
  const message = text(rawDetails.message, 20_000)
  const trace = text(rawDetails.trace, 50_000)
  const statusDetails: ParsedStatusDetails | null = message || trace
    ? {
        message,
        trace,
        known: rawDetails.known === true,
        muted: rawDetails.muted === true,
        flaky: rawDetails.flaky === true,
      }
    : null

  const tags: string[] = []
  for (const item of labels) {
    if (!item || typeof item !== 'object') continue
    const entry = item as { name?: unknown; value?: unknown }
    if (typeof entry.name !== 'string' || entry.name.trim().toLowerCase() !== 'tag') continue
    const tag = text(entry.value, 100)
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) tags.push(tag)
  }

  return {
    externalId,
    path,
    suiteName: (label('feature') ?? label('suite') ?? label('parentsuite'))?.slice(0, 200) ?? null,
    caseName: (label('story') ?? text(value.name, 300))?.slice(0, 300) ?? null,
    epic: label('epic')?.slice(0, 200) ?? null,
    owner: label('owner')?.slice(0, 120) ?? null,
    status: normalizeStatus(value.status),
    message,
    startDate,
    endDate,
    tags,
    steps: parseSteps(value.steps, 0),
    attachments: parseAttachmentRefs(value.attachments),
    parameters: parseParameters(value.parameters),
    links: parseLinks(value.links),
    statusDetails,
  }
}

/** Parses every `*-result.json` in the archive; attachments are resolved by the importer. */
export function parseAllureArchive(entries: ZipEntry[]): ParsedArchive {
  const files = new Map<string, Buffer>()
  const byBasename = new Map<string, Buffer>()
  for (const entry of entries) {
    files.set(entry.name, entry.data)
    const name = basename(entry.name)
    if (!byBasename.has(name)) byBasename.set(name, entry.data)
  }

  const results: ParsedResult[] = []
  const warnings: string[] = []
  for (const entry of entries) {
    const name = basename(entry.name)
    if (!name.endsWith('-result.json')) continue
    let raw: unknown
    try {
      raw = JSON.parse(entry.data.toString('utf8'))
    } catch {
      warnings.push(`${entry.name}: not valid JSON, skipped`)
      continue
    }
    if (!raw || typeof raw !== 'object') {
      warnings.push(`${entry.name}: unexpected JSON shape, skipped`)
      continue
    }
    const result = parseResult(raw as Record<string, unknown>)
    if (!result) {
      warnings.push(`${entry.name}: no uuid or start timestamp, skipped`)
      continue
    }
    results.push(result)
  }

  return { results, files, byBasename, warnings }
}

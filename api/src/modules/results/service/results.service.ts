import { BadRequestException, Injectable } from '@nestjs/common'
import { TestStatus } from '@prisma/client'
import { ResultsRepository } from '../repository/results.repository'
import { NormalizedRun, RunPayload } from '../dto/run-payload'

const STATUSES = new Set<string>(Object.values(TestStatus))

function firstString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmed = value[0].trim()
    return trimmed === '' ? null : trimmed
  }
  return null
}

function parseDate(value: unknown): Date | null {
  const raw = firstString(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.valueOf()) ? null : date
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  const raw = firstString(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    // fall through to delimiter split
  }
  return raw.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
}

function truncate(value: string | null, max: number): string | null {
  return value && value.length > max ? value.slice(0, max) : value
}

@Injectable()
export class ResultsService {
  constructor(private readonly resultsRepository: ResultsRepository) {}

  /** Accepts the raw form body (urlencoded may yield string|string[]) and validates it by hand. */
  normalize(body: Record<string, unknown>): NormalizedRun {
    const path = firstString(body?.path)
    if (!path) throw new BadRequestException('path is required')

    const status = firstString(body?.status)
    if (!status || !STATUSES.has(status)) {
      throw new BadRequestException(`status must be one of ${[...STATUSES].join(', ')}`)
    }

    const startDate = parseDate(body?.startDate)
    if (!startDate) throw new BadRequestException('startDate is required and must be a valid date')
    const endDate = parseDate(body?.endDate) ?? startDate
    if (endDate < startDate) throw new BadRequestException('endDate cannot be before startDate')

    return {
      path: truncate(path, 300) as string,
      suiteName: truncate(firstString(body?.suiteName), 200),
      caseName: truncate(firstString(body?.caseName), 300),
      status: status as TestStatus,
      owner: truncate(firstString(body?.owner), 120),
      circuit: truncate(firstString(body?.circuit), 120),
      message: firstString(body?.message),
      startDate,
      endDate,
      tags: parseTags(body?.tags),
    }
  }

  async ingestRun(body: Record<string, unknown>) {
    const run = this.normalize(body)
    const saved = await this.resultsRepository.create(run)
    return { received: true, id: saved.id, path: saved.path, status: saved.status }
  }
}

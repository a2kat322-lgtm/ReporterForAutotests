import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { TestsRepository } from '../../tests/repository/tests.repository'
import { WorkspacesService } from '../../workspaces/service/workspaces.service'
import { AllureRepository, DetailData, ImportedRun, MergeCandidate } from '../repository/allure.repository'
import { AttachmentStorageService, StoredAttachment } from './attachment-storage.service'
import {
  AttachmentRef,
  ParsedArchive,
  ParsedResult,
  ParsedStep,
  parseAllureArchive,
} from './allure-parser'
import { readZip, ZipFormatError } from './zip-reader'
export interface ImportOptions {
  workspaceId?: bigint
  projectName?: string
  /** `circuit` written to every run; must match the phase environment to appear in reports. */
  environment: string
  launchId?: string
}

export interface ImportSummary {
  imported: number
  enriched: number
  duplicates: number
  totalResults: number
  attachments: number
  launchId: string
  workspaceId: bigint
  projectName: string
  environment: string
  catalogCreated: number
  warnings: string[]
}

/**
 * A posted run (ResultWriter) and the Allure result of the same execution start
 * within milliseconds of each other. The window is generous because the form
 * contract truncates timestamps to seconds.
 */
const MERGE_WINDOW_MS = 10_000

interface StoredStep {
  name: string
  status: string
  start: number | null
  stop: number | null
  durationMs: number | null
  message: string | null
  trace: string | null
  parameters: Array<{ name: string; value: string }>
  attachments: StoredAttachment[]
  steps: StoredStep[]
}

/**
 * Imports an `allure-results` archive (one ZIP, one CI run) into the regular
 * `TestResult` table, so imported runs are shown by the existing report pages
 * next to runs posted through the form contract.
 *
 * Catalog entries are registered automatically: an imported run whose path is
 * not in the catalog would otherwise be invisible in reports, because the
 * catalog is the report filter.
 */
@Injectable()
export class AllureImportService {
  private readonly logger = new Logger(AllureImportService.name)
  private readonly maxBytes: number

  constructor(
    private readonly config: ConfigService,
    private readonly storage: AttachmentStorageService,
    private readonly repository: AllureRepository,
    private readonly workspacesService: WorkspacesService,
    private readonly testsRepository: TestsRepository,
  ) {
    this.maxBytes = this.config.get<number>('app.allureImportMaxBytes') as number
  }

  async importArchive(buffer: Buffer, options: ImportOptions): Promise<ImportSummary> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new BadRequestException(
        'Request body must be a ZIP archive of allure-results sent with Content-Type: application/zip',
      )
    }
    if (buffer.length > this.maxBytes) {
      throw new BadRequestException(
        `Archive is too large: ${buffer.length} bytes, limit is ${this.maxBytes} bytes`,
      )
    }

    const environment = options.environment.trim().toLowerCase()
    if (!environment) throw new BadRequestException('environment must not be empty')
    if (environment.length > 120) throw new BadRequestException('environment is longer than 120 characters')

    const workspace = options.workspaceId != null
      ? await this.workspacesService.findById(options.workspaceId)
      : await this.workspacesService.findOrCreateByName(options.projectName ?? 'default')

    const entries = tryReadZip(buffer)
    const archive = parseAllureArchive(entries)
    if (!archive.results.length) {
      throw new BadRequestException(
        'No *-result.json files found in the archive. Zip the allure-results directory itself, not its parent.',
      )
    }

    const launchId = (options.launchId?.trim() || randomUUID()).slice(0, 128)
    const warnings = [...archive.warnings]
    const rows: ImportedRun[] = []
    const catalog = new Map<string, { resultPath: string; defaultCaseName: string; defaultSuiteName?: string; defaultOwner?: string; tags: string[] }>()
    let attachmentCount = 0
    let enriched = 0

    // ResultWriter posts a run per test for fast local feedback; the archive
    // then only adds steps and screenshots to that row. Matching by path +
    // circuit + start time keeps one row per execution and stops the import
    // from inflating retry/flaky analytics with a duplicate.
    const startTimes = archive.results.map((result) => result.startDate.getTime())
    const candidates = await this.repository.findUnlinkedRuns(
      workspace.id,
      environment,
      new Date(Math.min(...startTimes) - MERGE_WINDOW_MS),
      new Date(Math.max(...startTimes) + MERGE_WINDOW_MS),
    )
    const candidatesByPath = new Map<string, MergeCandidate[]>()
    for (const candidate of candidates) {
      const list = candidatesByPath.get(candidate.path)
      if (list) list.push(candidate)
      else candidatesByPath.set(candidate.path, [candidate])
    }
    const usedCandidates = new Set<bigint>()

    for (const result of archive.results) {
      const steps = await this.storeSteps(result.steps, archive, warnings)
      const attachments = await this.storeAttachments(result.attachments, archive, warnings)
      attachmentCount += attachments.length + countStepAttachments(steps)

      const candidate = this.pickCandidate(candidatesByPath.get(result.path), usedCandidates, result.startDate)
      if (candidate) {
        usedCandidates.add(candidate.id)
        if (candidate.status !== result.status) {
          warnings.push(
            `${result.path}: imported status "${result.status}" differs from the posted status "${candidate.status}", the posted status is kept`,
          )
        }
        await this.repository.enrich(candidate.id, this.toResultUpdate(result, launchId, candidate), this.toDetailUpdate(result, steps, attachments, candidate))
        enriched += 1
      } else {
        rows.push(this.toRow(result, workspace.id, workspace.name, environment, launchId, steps, attachments))
      }

      if (!catalog.has(result.path)) {
        catalog.set(result.path, {
          resultPath: result.path,
          defaultCaseName: result.caseName ?? result.path,
          defaultSuiteName: result.suiteName ?? undefined,
          defaultOwner: result.owner ?? undefined,
          tags: result.tags,
        })
      }
    }

    const { count } = await this.repository.createMany(workspace.id, rows)
    const catalogCreated = await this.testsRepository.harvestBatch(
      [...catalog.values()],
      environment,
      workspace.id,
      'allure',
    )
    if (warnings.length) {
      this.logger.warn(`Import ${launchId} finished with ${warnings.length} warning(s): ${warnings[0]}`)
    }

    return {
      imported: count,
      enriched,
      duplicates: rows.length - count,
      totalResults: archive.results.length,
      attachments: attachmentCount,
      launchId,
      workspaceId: workspace.id,
      projectName: workspace.name,
      environment,
      catalogCreated: catalogCreated.created,
      warnings: warnings.slice(0, 100),
    }
  }

  private toRow(
    result: ParsedResult,
    workspaceId: bigint,
    projectName: string,
    environment: string,
    launchId: string,
    steps: StoredStep[],
    attachments: StoredAttachment[],
  ): ImportedRun {
    const row: Prisma.TestResultCreateManyInput = {
      workspaceId,
      projectName,
      path: result.path,
      suiteName: result.suiteName,
      caseName: result.caseName,
      status: result.status,
      owner: result.owner,
      circuit: environment,
      startDate: result.startDate,
      endDate: result.endDate,
      tags: result.tags as Prisma.InputJsonValue,
      externalId: result.externalId,
      launchId,
    }
    return { result: row, detail: this.toDetail(result, steps, attachments) }
  }

  /**
   * Cold part of the import. A run without failure text and without any Allure
   * detail gets no detail row at all, so the detail table stays sparse.
   */
  private toDetail(
    result: ParsedResult,
    steps: StoredStep[],
    attachments: StoredAttachment[],
    candidate?: MergeCandidate,
  ): DetailData | null {
    const empty = steps.length === 0
      && attachments.length === 0
      && result.parameters.length === 0
      && result.links.length === 0
      && result.statusDetails == null
      && !result.message
      && !candidate?.message
    if (empty) return null
    return {
      // Fill only what the form contract does not provide.
      message: candidate?.message ?? result.message,
      steps: steps as unknown as Prisma.InputJsonValue,
      attachments: attachments as unknown as Prisma.InputJsonValue,
      parameters: result.parameters as unknown as Prisma.InputJsonValue,
      links: result.links as unknown as Prisma.InputJsonValue,
      statusDetails: result.statusDetails
        ? (result.statusDetails as unknown as Prisma.InputJsonValue)
        : undefined,
    }
  }

  /** Nearest not-yet-used posted run of the same path inside the merge window. */
  private pickCandidate(
    candidates: MergeCandidate[] | undefined,
    used: Set<bigint>,
    startDate: Date,
  ): MergeCandidate | null {
    if (!candidates) return null
    let best: MergeCandidate | null = null
    let bestDelta = Number.POSITIVE_INFINITY
    for (const candidate of candidates) {
      if (used.has(candidate.id)) continue
      const delta = Math.abs(candidate.startDate.getTime() - startDate.getTime())
      if (delta > MERGE_WINDOW_MS || delta >= bestDelta) continue
      best = candidate
      bestDelta = delta
    }
    return best
  }

  /**
   * Only Allure-owned detail is written: status, timing, circuit and project
   * stay exactly as ResultWriter posted them, so the report and the
   * retry/flaky counters do not change after importing an archive. The run row
   * receives what the form contract does not provide; the detail row receives
   * the Allure payload.
   */
  private toResultUpdate(
    result: ParsedResult,
    launchId: string,
    candidate: MergeCandidate,
  ): Prisma.TestResultUpdateInput {
    const postedTags = Array.isArray(candidate.tags) ? candidate.tags : []
    return {
      externalId: result.externalId,
      launchId,
      suiteName: candidate.suiteName ?? result.suiteName,
      caseName: candidate.caseName ?? result.caseName,
      owner: candidate.owner ?? result.owner,
      tags: postedTags.length ? undefined : (result.tags as unknown as Prisma.InputJsonValue),
    }
  }

  private toDetailUpdate(
    result: ParsedResult,
    steps: StoredStep[],
    attachments: StoredAttachment[],
    candidate: MergeCandidate,
  ): DetailData {
    return {
      steps: steps as unknown as Prisma.InputJsonValue,
      attachments: attachments as unknown as Prisma.InputJsonValue,
      parameters: result.parameters as unknown as Prisma.InputJsonValue,
      links: result.links as unknown as Prisma.InputJsonValue,
      statusDetails: result.statusDetails
        ? (result.statusDetails as unknown as Prisma.InputJsonValue)
        : undefined,
      // Fill only what the form contract does not provide.
      message: candidate.message ?? result.message,
    }
  }

  private async storeSteps(
    steps: ParsedStep[],
    archive: ParsedArchive,
    warnings: string[],
  ): Promise<StoredStep[]> {
    const stored: StoredStep[] = []
    for (const step of steps) {
      stored.push({
        name: step.name,
        status: step.status,
        start: step.start,
        stop: step.stop,
        durationMs: step.durationMs,
        message: step.message,
        trace: step.trace,
        parameters: step.parameters,
        attachments: await this.storeAttachments(step.attachments, archive, warnings),
        steps: await this.storeSteps(step.steps, archive, warnings),
      })
    }
    return stored
  }

  private async storeAttachments(
    refs: AttachmentRef[],
    archive: ParsedArchive,
    warnings: string[],
  ): Promise<StoredAttachment[]> {
    const stored: StoredAttachment[] = []
    for (const ref of refs) {
      const data = this.findFile(archive, ref.source)
      if (!data) {
        warnings.push(`Attachment "${ref.name}" is missing from the archive (${ref.source})`)
        stored.push({ name: ref.name, type: ref.type, size: 0, key: null, missing: true })
        continue
      }
      stored.push(await this.storage.save(ref.name, ref.type, data))
    }
    return stored
  }

  private findFile(archive: ParsedArchive, source: string): Buffer | undefined {
    return archive.files.get(source)
      ?? archive.byBasename.get(basename(source))
      ?? archive.byBasename.get(source)
  }
}

function countStepAttachments(steps: StoredStep[]): number {
  let total = 0
  for (const step of steps) total += step.attachments.length + countStepAttachments(step.steps)
  return total
}

function tryReadZip(buffer: Buffer) {
  try {
    return readZip(buffer)
  } catch (error) {
    if (error instanceof ZipFormatError) throw new BadRequestException(error.message)
    throw error
  }
}

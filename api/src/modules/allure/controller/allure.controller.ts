import { BadRequestException, Controller, Post, Query, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { AllureImportService } from '../service/allure-import.service'

function firstQuery(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim() || null
  return null
}

@Controller('allure')
export class AllureController {
  constructor(private readonly allureImportService: AllureImportService) {}

  /**
   * Imports one `allure-results` ZIP (one CI run) into the workspace.
   *
   * The archive is sent as a raw body — `curl --data-binary @allure-results.zip`
   * or a `fetch` with `Content-Type: application/zip` — because Allure archives
   * are a plain file tree and a multipart parser would add nothing.
   *
   * `environment` becomes the run `circuit`: it must match the phase
   * environment, otherwise the runs will not appear in that phase's reports.
   */
  @Post('import')
  @Throttle({ short: { limit: 2, ttl: 10_000 }, long: { limit: 30, ttl: 60_000 } })
  importArchive(@Req() request: Request, @Query() query: Record<string, string | string[]>) {
    const environment = firstQuery(query.environment)
    if (!environment) {
      throw new BadRequestException(
        'environment query parameter is required; it is stored as the run circuit and compared with the phase environment',
      )
    }

    const workspaceIdRaw = firstQuery(query.workspaceId)
    const projectName = firstQuery(query.projectName)
    if (!workspaceIdRaw && !projectName) {
      throw new BadRequestException('workspaceId or projectName query parameter is required')
    }

    let workspaceId: bigint | undefined
    if (workspaceIdRaw) {
      if (!/^\d+$/.test(workspaceIdRaw)) {
        throw new BadRequestException('workspaceId must be a positive integer')
      }
      workspaceId = BigInt(workspaceIdRaw)
    }

    return this.allureImportService.importArchive(request.body as Buffer, {
      workspaceId,
      projectName: projectName ?? undefined,
      environment,
      launchId: firstQuery(query.launchId) ?? undefined,
      fileName: firstQuery(query.fileName) ?? undefined,
      origin: firstQuery(query.origin) ?? undefined,
    })
  }
}

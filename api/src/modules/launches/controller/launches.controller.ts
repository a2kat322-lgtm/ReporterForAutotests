import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common'
import { LaunchesService } from '../service/launches.service'

@Controller('launches')
export class LaunchesController {
  constructor(private readonly launchesService: LaunchesService) {}

  /**
   * Uploaded `allure-results` archives of a workspace, newest first. The query
   * value is validated by hand: the global ValidationPipe cannot transform an
   * optional `bigint` query parameter (BigInt is not a constructible class).
   */
  @Get()
  findAll(@Query('workspaceId') workspaceIdRaw?: string) {
    if (!workspaceIdRaw) return this.launchesService.findAll()
    if (!/^\d+$/.test(workspaceIdRaw)) {
      throw new BadRequestException('workspaceId must be a positive integer')
    }
    return this.launchesService.findAll(BigInt(workspaceIdRaw))
  }

  /** One launch with the run rows shown on its report page. */
  @Get(':launchId')
  findOne(@Param('launchId') launchId: string) {
    return this.launchesService.findOne(launchId)
  }
}

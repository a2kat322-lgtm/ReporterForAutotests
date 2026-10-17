import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { BulkAutomatedTestsDto } from '../dto/bulk-automated-tests.dto'
import { CreateAutomatedTestDto } from '../dto/create-automated-test.dto'
import { UpdateVisibilityDto } from '../dto/update-visibility.dto'
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe'
import { TestsService } from '../service/tests.service'

@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  /** Full catalog, or — with `?environment=` — only tests whose runs' circuit matches it. */
  @Get()
  findAll(
    @Query('environment') environment?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.testsService.findForEnvironment(environment, workspaceId ? BigInt(workspaceId) : undefined)
  }

  @Post()
  create(@Body() dto: CreateAutomatedTestDto) { return this.testsService.create(dto) }

  @Post('bulk')
  @HttpCode(200)
  createBulk(@Body() dto: BulkAutomatedTestsDto) { return this.testsService.createBulk(dto.tests) }

  @Post('visibility')
  @HttpCode(200)
  updateVisibility(@Body() dto: UpdateVisibilityDto) { return this.testsService.updateVisibility(dto) }

  /** Builds the catalog from distinct paths in stored run results, optionally scoped to one environment (circuit). */
  @Post('harvest')
  @HttpCode(200)
  @Throttle({ short: { limit: 1, ttl: 10_000 }, long: { limit: 10, ttl: 60_000 } })
  harvest(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('environment') environment?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.testsService.harvestFromResults(startDate, endDate, environment, workspaceId)
  }

  @Delete(':testId')
  @HttpCode(200)
  delete(@Param('testId', ParseBigIntPipe) testId: bigint) { return this.testsService.delete(testId) }
}

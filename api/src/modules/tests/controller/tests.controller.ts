import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { BulkAutomatedTestsDto } from '../dto/bulk-automated-tests.dto'
import { CreateAutomatedTestDto } from '../dto/create-automated-test.dto'
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe'
import { TestsService } from '../service/tests.service'

@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  findAll() { return this.testsService.findAll() }

  @Post()
  create(@Body() dto: CreateAutomatedTestDto) { return this.testsService.create(dto) }

  @Post('bulk')
  @HttpCode(200)
  createBulk(@Body() dto: BulkAutomatedTestsDto) { return this.testsService.createBulk(dto.tests) }

  /** Builds the catalog from distinct paths in stored run results. */
  @Post('harvest')
  @HttpCode(200)
  @Throttle({ short: { limit: 1, ttl: 10_000 }, long: { limit: 10, ttl: 60_000 } })
  harvest(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.testsService.harvestFromResults(startDate, endDate)
  }

  @Delete(':testId')
  @HttpCode(200)
  delete(@Param('testId', ParseBigIntPipe) testId: bigint) { return this.testsService.delete(testId) }
}

import { Body, Controller, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ResultsService } from '../service/results.service'

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  /**
   * Endpoint for the automation system: posts one finished run as
   * application/x-www-form-urlencoded (or JSON). The global urlencoded parser
   * exposes the fields as strings; JSON bodies work too.
   */
  @Post()
  @Throttle({ short: { limit: 50, ttl: 1000 }, long: { limit: 5000, ttl: 60_000 } })
  ingest(@Body() body: Record<string, unknown>) {
    return this.resultsService.ingestRun(body)
  }
}

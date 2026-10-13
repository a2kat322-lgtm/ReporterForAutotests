import { Module } from '@nestjs/common'
import { ResultsModule } from '../results/results.module'
import { TestsController } from './controller/tests.controller'
import { TestsRepository } from './repository/tests.repository'
import { TestsService } from './service/tests.service'

@Module({
  imports: [ResultsModule],
  controllers: [TestsController],
  providers: [TestsService, TestsRepository],
  exports: [TestsService, TestsRepository],
})
export class TestsModule {}

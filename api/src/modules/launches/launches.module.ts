import { Module } from '@nestjs/common'
import { ResultsModule } from '../results/results.module'
import { LaunchesController } from './controller/launches.controller'
import { LaunchesRepository } from './repository/launches.repository'
import { LaunchesService } from './service/launches.service'

@Module({
  imports: [ResultsModule],
  controllers: [LaunchesController],
  providers: [LaunchesService, LaunchesRepository],
  exports: [LaunchesRepository],
})
export class LaunchesModule {}

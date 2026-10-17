import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { ImportModule } from './modules/import/import.module'
import { PhasesModule } from './modules/phases/phases.module'
import { ReportsModule } from './modules/reports/reports.module'
import { ResultsModule } from './modules/results/results.module'
import { TestsModule } from './modules/tests/tests.module'
import { WorkspacesModule } from './modules/workspaces/workspaces.module'
import { PrismaModule } from './common/database/prisma.module'
import { appConfig } from './config/app.config'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60_000, limit: 300 },
    ]),
    PrismaModule,
    PhasesModule,
    ReportsModule,
    ResultsModule,
    TestsModule,
    WorkspacesModule,
    ImportModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

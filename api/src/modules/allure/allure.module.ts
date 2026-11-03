import { Module } from '@nestjs/common'
import { LaunchesModule } from '../launches/launches.module'
import { TestsModule } from '../tests/tests.module'
import { WorkspacesModule } from '../workspaces/workspaces.module'
import { AllureController } from './controller/allure.controller'
import { AttachmentController } from './controller/attachment.controller'
import { AllureRepository } from './repository/allure.repository'
import { AllureImportService } from './service/allure-import.service'
import { AttachmentStorageService } from './service/attachment-storage.service'

@Module({
  imports: [WorkspacesModule, TestsModule, LaunchesModule],
  controllers: [AllureController, AttachmentController],
  providers: [AllureImportService, AttachmentStorageService, AllureRepository],
})
export class AllureModule {}

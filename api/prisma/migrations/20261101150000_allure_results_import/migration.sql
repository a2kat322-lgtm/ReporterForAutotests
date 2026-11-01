-- DropForeignKey
ALTER TABLE "AutomatedTest" DROP CONSTRAINT "AutomatedTest_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Phase" DROP CONSTRAINT "Phase_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_phaseId_fkey";

-- DropForeignKey
ALTER TABLE "TestResult" DROP CONSTRAINT "TestResult_workspaceId_fkey";

-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN     "attachments" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "externalId" VARCHAR(128),
ADD COLUMN     "launchId" VARCHAR(128),
ADD COLUMN     "parameters" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "statusDetails" JSONB,
ADD COLUMN     "steps" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "TestResult_workspaceId_launchId_idx" ON "TestResult"("workspaceId", "launchId");

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_workspaceId_externalId_key" ON "TestResult"("workspaceId", "externalId");

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomatedTest" ADD CONSTRAINT "AutomatedTest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


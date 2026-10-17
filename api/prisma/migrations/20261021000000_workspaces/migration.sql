-- Workspaces isolate phases, reports, catalog entries and runs per project.
-- A default workspace backfills pre-existing rows so existing data stays intact.

-- 1. Workspace table.
CREATE TABLE "Workspace" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");
CREATE INDEX "Workspace_createdAt_idx" ON "Workspace"("createdAt");

-- 2. Seed the default workspace (idempotent).
INSERT INTO "Workspace" ("name", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- 3. Add workspaceId columns as nullable first, backfill, then enforce NOT NULL.
ALTER TABLE "Phase" ADD COLUMN "workspaceId" BIGINT;
ALTER TABLE "AutomatedTest" ADD COLUMN "workspaceId" BIGINT;
ALTER TABLE "TestResult" ADD COLUMN "workspaceId" BIGINT;
ALTER TABLE "TestResult" ADD COLUMN "projectName" VARCHAR(200) NOT NULL DEFAULT 'default';

UPDATE "Phase" SET "workspaceId" = (SELECT "id" FROM "Workspace" WHERE "name" = 'default');
UPDATE "AutomatedTest" SET "workspaceId" = (SELECT "id" FROM "Workspace" WHERE "name" = 'default');
UPDATE "TestResult" SET "workspaceId" = (SELECT "id" FROM "Workspace" WHERE "name" = 'default');

ALTER TABLE "Phase" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "AutomatedTest" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TestResult" ALTER COLUMN "workspaceId" SET NOT NULL;

-- 4. Foreign keys (cascade: deleting a workspace removes its data).
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
ALTER TABLE "AutomatedTest" ADD CONSTRAINT "AutomatedTest_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

-- 5. Scoped unique key: resultPath is now unique per workspace, not globally.
DROP INDEX "AutomatedTest_resultPath_key";
CREATE UNIQUE INDEX "AutomatedTest_workspaceId_resultPath_key"
  ON "AutomatedTest"("workspaceId", "resultPath");

-- 6. Scoped indexes (replace the global equivalents where applicable).
CREATE INDEX "Phase_workspaceId_idx" ON "Phase"("workspaceId");
CREATE INDEX "TestResult_workspaceId_path_startDate_idx" ON "TestResult"("workspaceId", "path", "startDate");
CREATE INDEX "TestResult_workspaceId_startDate_endDate_idx" ON "TestResult"("workspaceId", "startDate", "endDate");
CREATE INDEX "TestResult_workspaceId_circuit_idx" ON "TestResult"("workspaceId", "circuit");

-- Drop the now-redundant global indexes on TestResult.
DROP INDEX "TestResult_path_startDate_idx";
DROP INDEX "TestResult_startDate_endDate_idx";
DROP INDEX "TestResult_circuit_idx";

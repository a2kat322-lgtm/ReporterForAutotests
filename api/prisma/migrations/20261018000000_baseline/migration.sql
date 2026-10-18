-- Baseline schema for a fresh PostgreSQL database.
-- This migration represents the final Prisma schema and replaces the
-- historical development migrations.

CREATE TYPE "TestStatus" AS ENUM ('passed', 'failed', 'broken', 'skipped');

CREATE TABLE "Workspace" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Phase" (
    "id" BIGSERIAL NOT NULL,
    "workspaceId" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "environment" TEXT NOT NULL,
    "startedAt" DATE NOT NULL,
    "endedAt" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" BIGSERIAL NOT NULL,
    "phaseId" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "author" VARCHAR(120) NOT NULL DEFAULT 'You',
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomatedTest" (
    "id" BIGSERIAL NOT NULL,
    "workspaceId" BIGINT NOT NULL,
    "resultPath" VARCHAR(300) NOT NULL,
    "fullResponsibility" VARCHAR(200),
    "defaultSuiteName" VARCHAR(200),
    "defaultCaseName" VARCHAR(300),
    "defaultOwner" VARCHAR(120),
    "tags" JSONB NOT NULL DEFAULT '[]',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AutomatedTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomatedTestEnvironment" (
    "automatedTestId" BIGINT NOT NULL,
    "environment" TEXT NOT NULL,
    CONSTRAINT "AutomatedTestEnvironment_pkey" PRIMARY KEY ("automatedTestId", "environment")
);

CREATE TABLE "TestResult" (
    "id" BIGSERIAL NOT NULL,
    "workspaceId" BIGINT NOT NULL,
    "projectName" VARCHAR(200) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "suiteName" VARCHAR(200),
    "caseName" VARCHAR(300),
    "status" "TestStatus" NOT NULL,
    "owner" VARCHAR(120),
    "circuit" VARCHAR(120),
    "message" TEXT,
    "failureReason" VARCHAR(120),
    "failureComment" TEXT,
    "startDate" TIMESTAMPTZ(3) NOT NULL,
    "endDate" TIMESTAMPTZ(3) NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");
CREATE INDEX "Workspace_createdAt_idx" ON "Workspace"("createdAt");

CREATE INDEX "Phase_createdAt_idx" ON "Phase"("createdAt");
CREATE INDEX "Phase_workspaceId_idx" ON "Phase"("workspaceId");

CREATE UNIQUE INDEX "Report_phaseId_name_key" ON "Report"("phaseId", "name");
CREATE INDEX "Report_phaseId_createdAt_idx" ON "Report"("phaseId", "createdAt");
CREATE INDEX "Report_phaseId_startDate_endDate_idx" ON "Report"("phaseId", "startDate", "endDate");

CREATE UNIQUE INDEX "AutomatedTest_workspaceId_resultPath_key" ON "AutomatedTest"("workspaceId", "resultPath");

CREATE INDEX "AutomatedTestEnvironment_environment_idx"
    ON "AutomatedTestEnvironment"("environment");

CREATE INDEX "TestResult_workspaceId_path_startDate_idx"
    ON "TestResult"("workspaceId", "path", "startDate");
CREATE INDEX "TestResult_workspaceId_startDate_endDate_idx"
    ON "TestResult"("workspaceId", "startDate", "endDate");
CREATE INDEX "TestResult_workspaceId_circuit_idx"
    ON "TestResult"("workspaceId", "circuit");
CREATE INDEX "TestResult_period_overlap_gist_idx"
    ON "TestResult" USING GIST (tstzrange("startDate", "endDate", '[]'));

ALTER TABLE "Phase"
    ADD CONSTRAINT "Phase_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "Report"
    ADD CONSTRAINT "Report_phaseId_fkey"
    FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE;

ALTER TABLE "AutomatedTest"
    ADD CONSTRAINT "AutomatedTest_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "AutomatedTestEnvironment"
    ADD CONSTRAINT "AutomatedTestEnvironment_automatedTestId_fkey"
    FOREIGN KEY ("automatedTestId") REFERENCES "AutomatedTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TestResult"
    ADD CONSTRAINT "TestResult_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "Phase"
    ADD CONSTRAINT "Phase_environment_lowercase_check"
    CHECK ("environment" = lower(btrim("environment")));

ALTER TABLE "AutomatedTestEnvironment"
    ADD CONSTRAINT "AutomatedTestEnvironment_environment_lowercase_check"
    CHECK ("environment" = lower(btrim("environment")) AND "environment" <> '');

ALTER TABLE "TestResult"
    ADD CONSTRAINT "TestResult_circuit_lowercase_check"
    CHECK ("circuit" IS NULL OR "circuit" = lower("circuit"));

ALTER TABLE "TestResult"
    ADD CONSTRAINT "TestResult_path_trimmed_check"
    CHECK ("path" = btrim("path") AND "path" <> '');

ALTER TABLE "AutomatedTest"
    ADD CONSTRAINT "AutomatedTest_resultPath_trimmed_check"
    CHECK ("resultPath" = btrim("resultPath") AND "resultPath" <> '');

-- Keep a fresh installation empty. The default workspace is created lazily by
-- the application when the first workspace-bound record is ingested.
SELECT setval(pg_get_serial_sequence('"Workspace"', 'id'), 1, false)
WHERE NOT EXISTS (SELECT 1 FROM "Workspace");

-- One row per Allure launch (one uploaded `allure-results` archive, or several
-- archives of the same CI run sharing `launchId`). The history page reads this
-- table instead of aggregating `TestResult` on every request, so an upload that
-- only contained duplicates still appears in the history.
CREATE TABLE "AllureLaunch" (
    "id" VARCHAR(128) NOT NULL,
    "workspaceId" BIGINT NOT NULL,
    "environment" VARCHAR(120) NOT NULL,
    "projectName" VARCHAR(200) NOT NULL,
    "fileName" VARCHAR(255),
    "archives" INTEGER NOT NULL DEFAULT 1,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "enriched" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "totalResults" INTEGER NOT NULL DEFAULT 0,
    "attachments" INTEGER NOT NULL DEFAULT 0,
    "catalogCreated" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AllureLaunch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AllureLaunch_workspaceId_createdAt_idx" ON "AllureLaunch"("workspaceId", "createdAt");

ALTER TABLE "AllureLaunch" ADD CONSTRAINT "AllureLaunch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill launches imported before this table existed, so the history page is
-- not empty after the migration. One launch can only belong to one workspace;
-- the aggregate keeps the first/last run timestamps of the batch.
INSERT INTO "AllureLaunch" (
    "id",
    "workspaceId",
    "environment",
    "projectName",
    "archives",
    "imported",
    "enriched",
    "duplicates",
    "totalResults",
    "attachments",
    "catalogCreated",
    "warnings",
    "startedAt",
    "finishedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    aggregated."launchId",
    aggregated."workspaceId",
    COALESCE(aggregated."environment", 'unknown'),
    aggregated."projectName",
    1,
    aggregated."runCount",
    0,
    0,
    aggregated."runCount",
    0,
    0,
    '[]'::JSONB,
    aggregated."startedAt",
    aggregated."finishedAt",
    aggregated."createdAt",
    aggregated."updatedAt"
FROM (
    SELECT
        "launchId",
        "workspaceId",
        MAX("circuit") AS "environment",
        MAX("projectName") AS "projectName",
        COUNT(*)::INTEGER AS "runCount",
        MIN("startDate") AS "startedAt",
        MAX("endDate") AS "finishedAt",
        MIN("createdAt") AS "createdAt",
        MAX("updatedAt") AS "updatedAt"
    FROM "TestResult"
    WHERE "launchId" IS NOT NULL
    GROUP BY "launchId", "workspaceId"
) AS aggregated
ON CONFLICT ("id") DO NOTHING;

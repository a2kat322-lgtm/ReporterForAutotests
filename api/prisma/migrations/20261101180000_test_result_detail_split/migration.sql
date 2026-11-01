-- Split the cold columns of a run into `TestResultDetail`.
--
-- Reports and analytics read thousands of run rows per request; `message`,
-- `steps`, `attachments`, `parameters`, `links` and `statusDetails` are needed
-- for one run at a time (the detail drawer) and for failed runs only (failure
-- analytics). Keeping them on the hot row made every wide scan read far more
-- pages than it needed to.

CREATE TABLE "TestResultDetail" (
    "resultId" BIGINT NOT NULL,
    "message" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "parameters" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "statusDetails" JSONB,
    CONSTRAINT "TestResultDetail_pkey" PRIMARY KEY ("resultId")
);

-- Preserve the detail of every existing run: one detail row per run that has any.
INSERT INTO "TestResultDetail" ("resultId", "message", "steps", "attachments", "parameters", "links", "statusDetails")
SELECT "id", "message", "steps", "attachments", "parameters", "links", "statusDetails"
FROM "TestResult"
WHERE "message" IS NOT NULL
   OR "steps" <> '[]'::jsonb
   OR "attachments" <> '[]'::jsonb
   OR "parameters" <> '[]'::jsonb
   OR "links" <> '[]'::jsonb
   OR "statusDetails" IS NOT NULL;

ALTER TABLE "TestResult"
    DROP COLUMN "message",
    DROP COLUMN "steps",
    DROP COLUMN "attachments",
    DROP COLUMN "parameters",
    DROP COLUMN "links",
    DROP COLUMN "statusDetails";

ALTER TABLE "TestResultDetail"
    ADD CONSTRAINT "TestResultDetail_resultId_fkey"
    FOREIGN KEY ("resultId") REFERENCES "TestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- `startDate` joins the circuit key so a circuit-scoped window filter can use a
-- date range instead of walking every run of that circuit in the workspace.
DROP INDEX "TestResult_workspaceId_circuit_idx";
CREATE INDEX "TestResult_workspaceId_circuit_startDate_idx"
    ON "TestResult" ("workspaceId", "circuit", "startDate");

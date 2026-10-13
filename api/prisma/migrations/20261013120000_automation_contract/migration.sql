-- Automation contract: TestStatus gains `broken` and loses `running`.
ALTER TYPE "TestStatus" RENAME TO "TestStatus_old";
CREATE TYPE "TestStatus" AS ENUM ('passed', 'failed', 'broken', 'skipped');

-- TestResult becomes a standalone run record keyed by path; it is no longer
-- bound to a phase/report row because a report selects runs by date window.
DROP TABLE "TestResult";
CREATE TABLE "TestResult" (
    "id" VARCHAR(30) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "suiteName" VARCHAR(200),
    "caseName" VARCHAR(300),
    "status" "TestStatus" NOT NULL,
    "owner" VARCHAR(120),
    "circuit" VARCHAR(120),
    "message" TEXT,
    "startDate" TIMESTAMPTZ(3) NOT NULL,
    "endDate" TIMESTAMPTZ(3) NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestResult_path_startDate_idx" ON "TestResult"("path", "startDate");
CREATE INDEX "TestResult_startDate_endDate_idx" ON "TestResult"("startDate", "endDate");

-- AutomatedTest now mirrors the JSON import file contract.
DROP TABLE "AutomatedTest";
CREATE TABLE "AutomatedTest" (
    "id" VARCHAR(30) NOT NULL,
    "resultPath" VARCHAR(300) NOT NULL,
    "display" VARCHAR(300) NOT NULL,
    "fullResponsibility" VARCHAR(200),
    "defaultSuiteName" VARCHAR(200),
    "defaultCaseName" VARCHAR(300),
    "defaultOwner" VARCHAR(120),
    "tags" JSONB NOT NULL DEFAULT '[]',
    "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AutomatedTest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomatedTest_resultPath_key" ON "AutomatedTest"("resultPath");

DROP TYPE "TestStatus_old";

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('test', 'stage', 'production');
CREATE TYPE "TestStatus" AS ENUM ('passed', 'failed', 'skipped', 'running');

-- CreateTable
CREATE TABLE "Phase" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "environment" "Environment" NOT NULL,
    "startedAt" DATE NOT NULL,
    "endedAt" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" VARCHAR(30) NOT NULL,
    "phaseId" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" VARCHAR(120) NOT NULL DEFAULT 'You',
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestResult" (
    "id" VARCHAR(30) NOT NULL,
    "phaseId" INTEGER NOT NULL,
    "reportId" VARCHAR(30) NOT NULL,
    "automatedTestId" VARCHAR(200) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "status" "TestStatus" NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Phase_createdAt_idx" ON "Phase"("createdAt");
CREATE INDEX "Report_phaseId_createdAt_idx" ON "Report"("phaseId", "createdAt");
CREATE UNIQUE INDEX "TestResult_reportId_automatedTestId_key" ON "TestResult"("reportId", "automatedTestId");
CREATE INDEX "TestResult_phaseId_reportId_idx" ON "TestResult"("phaseId", "reportId");

ALTER TABLE "Report" ADD CONSTRAINT "Report_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

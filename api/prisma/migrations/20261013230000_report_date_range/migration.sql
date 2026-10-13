ALTER TABLE "Report"
  ADD COLUMN "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "endDate" DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE "Report"
  ALTER COLUMN "startDate" DROP DEFAULT,
  ALTER COLUMN "endDate" DROP DEFAULT;

CREATE INDEX "Report_phaseId_startDate_endDate_idx" ON "Report"("phaseId", "startDate", "endDate");

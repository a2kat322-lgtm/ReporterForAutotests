-- Add audit timestamps to Phase, Report, and TestResult.
-- DEFAULT is used only to backfill existing rows, then dropped to match
-- Prisma's @updatedAt column shape (NOT NULL, no default).

ALTER TABLE "Phase"
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Phase" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Report"
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Report" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "TestResult"
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TestResult" ALTER COLUMN "updatedAt" DROP DEFAULT;

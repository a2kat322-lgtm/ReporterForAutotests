-- Adds failure-analysis fields to runs. IF NOT EXISTS keeps the migration safe
-- for databases where the legacy `20260309000000_add_failure_feedback` migration
-- was already applied before this one was re-filed after `automation_contract`.
ALTER TABLE "TestResult"
  ADD COLUMN IF NOT EXISTS "failureReason" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "failureComment" TEXT;

-- Canonicalize the "environment/circuit" string representations and the
-- catalog/run join keys, then enforce the canonical form at the DB level.

-- Phase.environment: lowercase + trim, matching AutomatedTestEnvironment.environment.
UPDATE "Phase"
SET "environment" = lower(btrim("environment"))
WHERE "environment" IS DISTINCT FROM lower(btrim("environment"));

ALTER TABLE "Phase"
  ADD CONSTRAINT "Phase_environment_lowercase_check"
  CHECK ("environment" = lower(btrim("environment")));

-- TestResult.circuit: lowercase so it can be matched with an exact btree lookup
-- (the report query previously used a case-insensitive match that skipped indexes).
UPDATE "TestResult"
SET "circuit" = lower("circuit")
WHERE "circuit" IS NOT NULL AND "circuit" IS DISTINCT FROM lower("circuit");

ALTER TABLE "TestResult"
  ADD CONSTRAINT "TestResult_circuit_lowercase_check"
  CHECK ("circuit" IS NULL OR "circuit" = lower("circuit"));

CREATE INDEX "TestResult_circuit_idx" ON "TestResult" ("circuit");

-- Join keys (path / resultPath) are whitespace-trimmed on write; enforce so the
-- in-memory catalog/run join never misses on surrounding whitespace.
UPDATE "TestResult"
SET "path" = btrim("path")
WHERE "path" IS DISTINCT FROM btrim("path");

ALTER TABLE "TestResult"
  ADD CONSTRAINT "TestResult_path_trimmed_check"
  CHECK ("path" = btrim("path") AND "path" <> '');

UPDATE "AutomatedTest"
SET "resultPath" = btrim("resultPath")
WHERE "resultPath" IS DISTINCT FROM btrim("resultPath");

ALTER TABLE "AutomatedTest"
  ADD CONSTRAINT "AutomatedTest_resultPath_trimmed_check"
  CHECK ("resultPath" = btrim("resultPath") AND "resultPath" <> '');

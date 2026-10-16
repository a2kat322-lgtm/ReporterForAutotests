-- Report names must be unique within a phase. Rename existing duplicates
-- (keep the earliest by createdAt, then id) before adding the unique index.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "phaseId", "name" ORDER BY "createdAt", "id") AS rn
  FROM "Report"
)
UPDATE "Report" r
SET "name" = r."name" || ' (dup ' || ranked.rn || ')'
FROM ranked
WHERE ranked."id" = r."id" AND ranked.rn > 1;

CREATE UNIQUE INDEX "Report_phaseId_name_key" ON "Report" ("phaseId", "name");

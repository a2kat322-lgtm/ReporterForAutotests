-- Report.id becomes an autoincrement integer key (like Phase) instead of a cuid
-- string. Existing reports are renumbered 1..N ordered by createdAt, id.

ALTER TABLE "Report" RENAME COLUMN "id" TO "old_id";
ALTER TABLE "Report" ADD COLUMN "id" SERIAL;

WITH numbered AS (
  SELECT "old_id", ROW_NUMBER() OVER (ORDER BY "createdAt", "old_id") AS rn
  FROM "Report"
)
UPDATE "Report" r SET "id" = n.rn FROM numbered n WHERE r."old_id" = n."old_id";

ALTER TABLE "Report" DROP CONSTRAINT "Report_pkey";
ALTER TABLE "Report" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_pkey" PRIMARY KEY ("id");
SELECT setval(pg_get_serial_sequence('"Report"', 'id'), COALESCE((SELECT MAX("id") FROM "Report"), 0) + 1, false);

ALTER TABLE "Report" DROP COLUMN "old_id";

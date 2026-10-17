-- A fresh installation must start empty. The workspaces migration inserts a
-- `default` workspace to backfill rows that predate workspaces; on a clean
-- database nothing uses it, so remove it. Ingest and legacy import recreate the
-- default workspace on demand when they actually need it.
DELETE FROM "Workspace" AS w
WHERE w."name" = 'default'
  AND NOT EXISTS (SELECT 1 FROM "Phase" p WHERE p."workspaceId" = w."id")
  AND NOT EXISTS (SELECT 1 FROM "AutomatedTest" t WHERE t."workspaceId" = w."id")
  AND NOT EXISTS (SELECT 1 FROM "TestResult" r WHERE r."workspaceId" = w."id");

-- On a brand-new installation the table is empty; let the first workspace get id 1.
SELECT setval(pg_get_serial_sequence('"Workspace"', 'id'), 1, false)
WHERE NOT EXISTS (SELECT 1 FROM "Workspace");

-- Normalize test/environment membership into a relation. Environment keys are
-- stored lowercase so equality and uniqueness are case-insensitive by contract.
CREATE TABLE "AutomatedTestEnvironment" (
    "automatedTestId" BIGINT NOT NULL,
    "environment" TEXT NOT NULL,
    CONSTRAINT "AutomatedTestEnvironment_pkey" PRIMARY KEY ("automatedTestId", "environment"),
    CONSTRAINT "AutomatedTestEnvironment_automatedTestId_fkey"
      FOREIGN KEY ("automatedTestId") REFERENCES "AutomatedTest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Preserve existing memberships and collapse case-only duplicates.
INSERT INTO "AutomatedTestEnvironment" ("automatedTestId", "environment")
SELECT DISTINCT "AutomatedTest"."id", lower(btrim(env.value))
FROM "AutomatedTest"
CROSS JOIN LATERAL unnest("AutomatedTest"."environments") AS env(value)
WHERE btrim(env.value) <> ''
ON CONFLICT DO NOTHING;

CREATE INDEX "AutomatedTestEnvironment_environment_idx"
  ON "AutomatedTestEnvironment" ("environment");

ALTER TABLE "AutomatedTest" DROP COLUMN "environments";

-- Enforce the lowercase canonical form even for writes outside Prisma.
ALTER TABLE "AutomatedTestEnvironment"
  ADD CONSTRAINT "AutomatedTestEnvironment_environment_lowercase_check"
  CHECK ("environment" = lower(btrim("environment")) AND "environment" <> '');

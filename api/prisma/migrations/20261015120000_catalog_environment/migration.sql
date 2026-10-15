-- Bind catalog entries to the phase environment that harvested them.
ALTER TABLE "AutomatedTest" ADD COLUMN "environments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "AutomatedTest_environments_idx" ON "AutomatedTest" USING GIN ("environments");

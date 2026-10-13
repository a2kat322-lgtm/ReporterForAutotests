-- Link catalog entries to results via a stable external id and stop treating name as unique.
ALTER TABLE "AutomatedTest" ADD COLUMN "automatedTestId" VARCHAR(200);

DROP INDEX "AutomatedTest_name_key";

CREATE UNIQUE INDEX "AutomatedTest_automatedTestId_key" ON "AutomatedTest"("automatedTestId");

ALTER TABLE "AutomatedTest" ALTER COLUMN "automatedTestId" SET NOT NULL;

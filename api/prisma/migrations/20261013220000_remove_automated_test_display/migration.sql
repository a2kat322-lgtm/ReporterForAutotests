-- Move legacy display labels into the case-name field before removing display.
UPDATE "AutomatedTest"
SET "defaultCaseName" = "display"
WHERE "defaultCaseName" IS NULL;

ALTER TABLE "AutomatedTest" DROP COLUMN "display";

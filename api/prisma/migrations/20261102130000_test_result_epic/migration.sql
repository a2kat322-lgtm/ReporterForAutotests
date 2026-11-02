-- Allure `labels.epic` is the top level of the behaviour hierarchy. It stays on
-- the hot run row: the report loads it with every row and filters by it next to
-- status, owner and tags, so a separate lookup would add a query per report.
ALTER TABLE "TestResult" ADD COLUMN "epic" VARCHAR(200);

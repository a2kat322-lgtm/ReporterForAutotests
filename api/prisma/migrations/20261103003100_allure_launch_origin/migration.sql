-- Where a `allure-results` launch was executed. Existing launches (and clients
-- that do not pass `origin` to POST /allure/import) stay `unknown`.
CREATE TYPE "RunOrigin" AS ENUM ('ci', 'local', 'unknown');

ALTER TABLE "AllureLaunch" ADD COLUMN "origin" "RunOrigin" NOT NULL DEFAULT 'unknown';

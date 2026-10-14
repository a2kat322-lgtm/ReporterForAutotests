-- Allow custom environment names instead of a fixed enum.
ALTER TABLE "Phase" ALTER COLUMN "environment" TYPE TEXT USING "environment"::TEXT;
DROP TYPE "Environment";

-- Catalog display flag: tests with visible = false are hidden from report views.
ALTER TABLE "AutomatedTest" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;

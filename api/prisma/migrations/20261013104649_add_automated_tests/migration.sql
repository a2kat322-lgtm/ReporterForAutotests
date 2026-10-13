-- CreateTable
CREATE TABLE "AutomatedTest" (
    "id" VARCHAR(30) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "suite" VARCHAR(200),
    "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AutomatedTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomatedTest_name_key" ON "AutomatedTest"("name");

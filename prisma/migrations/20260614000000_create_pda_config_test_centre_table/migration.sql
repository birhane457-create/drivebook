-- CreateTable PDAConfigTestCentre (explicit junction table with id)
CREATE TABLE "PDAConfigTestCentre" (
    "id" TEXT NOT NULL,
    "pdaConfigId" TEXT NOT NULL,
    "testCentreId" TEXT NOT NULL,

    CONSTRAINT "PDAConfigTestCentre_pkey" PRIMARY KEY ("id")
);

-- Create unique index to prevent duplicate relationships
CREATE UNIQUE INDEX "PDAConfigTestCentre_pdaConfigId_testCentreId_key" ON "PDAConfigTestCentre"("pdaConfigId", "testCentreId");

-- Create index on testCentreId for efficient queries
CREATE INDEX "PDAConfigTestCentre_testCentreId_idx" ON "PDAConfigTestCentre"("testCentreId");

-- Add foreign key constraints
ALTER TABLE "PDAConfigTestCentre" ADD CONSTRAINT "PDAConfigTestCentre_pdaConfigId_fkey" FOREIGN KEY ("pdaConfigId") REFERENCES "PDATestConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PDAConfigTestCentre" ADD CONSTRAINT "PDAConfigTestCentre_testCentreId_fkey" FOREIGN KEY ("testCentreId") REFERENCES "TestCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the old implicit junction table if it exists
DROP TABLE IF EXISTS "_PDATestConfigToTestCentre";

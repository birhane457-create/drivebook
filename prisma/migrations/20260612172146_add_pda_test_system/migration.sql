-- Migration: add_pda_test_system
-- Adds PDATestConfig and PDATestBooking models for managing PDA tests

-- Create PDATestConfig table
CREATE TABLE "PDATestConfig" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discountPercent" DOUBLE PRECISION,
    "includes" JSONB,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PDATestConfig_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PDATestConfig_instructorId_idx" ON "PDATestConfig"("instructorId");

ALTER TABLE "PDATestConfig" ADD CONSTRAINT "PDATestConfig_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create junction table for PDATestConfig to TestCentre (many-to-many)
CREATE TABLE "_PDATestConfigToTestCentre" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_PDATestConfigToTestCentre_AB_unique" ON "_PDATestConfigToTestCentre"("A", "B");
CREATE INDEX "_PDATestConfigToTestCentre_B_index" ON "_PDATestConfigToTestCentre"("B");

ALTER TABLE "_PDATestConfigToTestCentre" ADD CONSTRAINT "_PDATestConfigToTestCentre_A_fkey"
    FOREIGN KEY ("A") REFERENCES "PDATestConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_PDATestConfigToTestCentre" ADD CONSTRAINT "_PDATestConfigToTestCentre_B_fkey"
    FOREIGN KEY ("B") REFERENCES "TestCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create PDATestBooking table
CREATE TABLE "PDATestBooking" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "testCentreId" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "testTime" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "discountPercent" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PDATestBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PDATestBooking_instructorId_testDate_idx" ON "PDATestBooking"("instructorId", "testDate");
CREATE INDEX "PDATestBooking_clientId_idx" ON "PDATestBooking"("clientId");
CREATE INDEX "PDATestBooking_testCentreId_idx" ON "PDATestBooking"("testCentreId");

ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_configId_fkey"
    FOREIGN KEY ("configId") REFERENCES "PDATestConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_testCentreId_fkey"
    FOREIGN KEY ("testCentreId") REFERENCES "TestCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

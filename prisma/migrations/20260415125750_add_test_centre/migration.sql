-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "lockedDiscountPct" DOUBLE PRECISION,
ADD COLUMN     "lockedHourlyRate" DOUBLE PRECISION,
ADD COLUMN     "offlineAmountPaid" DOUBLE PRECISION,
ADD COLUMN     "offlinePaymentMethod" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'platform';

-- AlterTable
ALTER TABLE "Instructor" ADD COLUMN     "customSlug" TEXT,
ADD COLUMN     "offersTestPackage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testPackageDuration" INTEGER,
ADD COLUMN     "testPackageIncludes" JSONB,
ADD COLUMN     "testPackagePrice" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "label" TEXT,
    "exceptionDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCentre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'WA',
    "region" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCentre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityException_instructorId_exceptionDate_idx" ON "AvailabilityException"("instructorId", "exceptionDate");

-- CreateIndex
CREATE UNIQUE INDEX "TestCentre_name_key" ON "TestCentre"("name");

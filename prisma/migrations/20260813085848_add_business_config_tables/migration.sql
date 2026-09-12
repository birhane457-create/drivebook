/*
  Warnings:

  - You are about to drop the column `specialServiceId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `specialServiceName` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `specialServiceType` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `isPaid` on the `PDATestBooking` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `PDATestBooking` table. All the data in the column will be lost.
  - Added the required column `email` to the `BookingIdempotencyKey` table without a default value. This is not possible if the table is not empty.
  - Made the column `testTime` on table `PDATestBooking` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "PDATestBooking" DROP CONSTRAINT "PDATestBooking_clientId_fkey";

-- DropForeignKey
ALTER TABLE "PDATestBooking" DROP CONSTRAINT "PDATestBooking_configId_fkey";

-- DropForeignKey
ALTER TABLE "PDATestBooking" DROP CONSTRAINT "PDATestBooking_instructorId_fkey";

-- DropIndex
DROP INDEX "Booking_specialServiceType_idx";

-- DropIndex
DROP INDEX "PlatformRateChange_status_effectiveDate_idx";

-- AlterTable
ALTER TABLE "AvailabilityException" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "specialServiceId",
DROP COLUMN "specialServiceName",
DROP COLUMN "specialServiceType",
ADD COLUMN     "actualDuration" INTEGER,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "checkInBy" TEXT,
ADD COLUMN     "checkInLocation" TEXT,
ADD COLUMN     "checkInPhoto" TEXT,
ADD COLUMN     "checkInTime" TIMESTAMP(3),
ADD COLUMN     "checkOutBy" TEXT,
ADD COLUMN     "checkOutLocation" TEXT,
ADD COLUMN     "checkOutPhoto" TEXT,
ADD COLUMN     "checkOutTime" TIMESTAMP(3),
ADD COLUMN     "paymentToken" TEXT,
ADD COLUMN     "smsCheckOutSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "whiteboardSketchUrl" TEXT;

-- AlterTable
ALTER TABLE "BookingIdempotencyKey" ADD COLUMN     "email" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DeviceToken" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Instructor" ADD COLUMN     "baseAddressLat" DOUBLE PRECISION,
ADD COLUMN     "baseAddressLng" DOUBLE PRECISION,
ADD COLUMN     "baseLatitude" DOUBLE PRECISION,
ADD COLUMN     "baseLongitude" DOUBLE PRECISION,
ADD COLUMN     "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payoutHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payoutHoldReason" TEXT,
ADD COLUMN     "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "voiceLine" TEXT,
ADD COLUMN     "voiceLineSid" TEXT,
ADD COLUMN     "voiceLineStatus" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "reminderStage" TEXT;

-- AlterTable
ALTER TABLE "PDATestBooking" DROP COLUMN "isPaid",
DROP COLUMN "paidAt",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parentBookingId" TEXT,
ALTER COLUMN "testTime" SET NOT NULL;

-- AlterTable
ALTER TABLE "PlatformRateChange" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "maxAdminCreditAmount" DOUBLE PRECISION NOT NULL DEFAULT 500,
ADD COLUMN     "maxAdminDeductAmount" DOUBLE PRECISION NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "verificationToken" TEXT,
ADD COLUMN     "verificationTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "TwilioPhoneNumber" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "friendlyName" TEXT,
    "areaCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "assignedTo" TEXT,
    "assignedAt" TIMESTAMPTZ(6),
    "assignedBy" TEXT,
    "releasedAt" TIMESTAMPTZ(6),
    "releasedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwilioPhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronHealth" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "lastStatus" TEXT NOT NULL DEFAULT 'OK',
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeDispute" (
    "id" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "stripeChargeId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "bookingId" TEXT,
    "instructorId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payoutFrozen" BOOLEAN NOT NULL DEFAULT false,
    "adjustmentCreated" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "location" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LoginDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardOrder" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "suburbs" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "abn" TEXT,
    "abnVerified" BOOLEAN NOT NULL DEFAULT false,
    "supportEmail" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Perth',
    "templateSlug" TEXT,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'BASIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "minAdvanceHours" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "bookingBufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "maxAppointmentsPerDay" INTEGER NOT NULL DEFAULT 8,
    "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 3.6,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "freeCancellationHours" INTEGER NOT NULL DEFAULT 48,
    "lateCancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
    "cancellationRefundPercent" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "package6Discount" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "package10Discount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "package15Discount" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessBranding" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColour" TEXT NOT NULL DEFAULT '#3B82F6',
    "secondaryColour" TEXT,
    "fontFamily" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "showPlatformBranding" BOOLEAN NOT NULL DEFAULT true,
    "customSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCapabilities" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "onlineBooking" BOOLEAN NOT NULL DEFAULT true,
    "onlinePayments" BOOLEAN NOT NULL DEFAULT true,
    "quotes" BOOLEAN NOT NULL DEFAULT false,
    "packages" BOOLEAN NOT NULL DEFAULT true,
    "waitingList" BOOLEAN NOT NULL DEFAULT false,
    "reviews" BOOLEAN NOT NULL DEFAULT true,
    "aiReceptionist" BOOLEAN NOT NULL DEFAULT false,
    "voiceLine" BOOLEAN NOT NULL DEFAULT false,
    "mobileApp" BOOLEAN NOT NULL DEFAULT false,
    "googleCalendar" BOOLEAN NOT NULL DEFAULT true,
    "documentVerification" BOOLEAN NOT NULL DEFAULT false,
    "travelTime" BOOLEAN NOT NULL DEFAULT false,
    "assessmentTracking" BOOLEAN NOT NULL DEFAULT false,
    "websiteBuilder" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCapabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessTerminology" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'Provider',
    "providers" TEXT NOT NULL DEFAULT 'Providers',
    "customer" TEXT NOT NULL DEFAULT 'Customer',
    "customers" TEXT NOT NULL DEFAULT 'Customers',
    "booking" TEXT NOT NULL DEFAULT 'Booking',
    "bookings" TEXT NOT NULL DEFAULT 'Bookings',
    "service" TEXT NOT NULL DEFAULT 'Service',
    "services" TEXT NOT NULL DEFAULT 'Services',
    "providerGroup" TEXT NOT NULL DEFAULT 'Business',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessTerminology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAIConfig" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessDescription" TEXT NOT NULL,
    "openingHours" TEXT NOT NULL DEFAULT 'Mon-Fri 9am-5pm',
    "greetingScript" TEXT,
    "personality" TEXT NOT NULL DEFAULT 'friendly',
    "faq" JSONB NOT NULL DEFAULT '[]',
    "allowedActions" JSONB NOT NULL DEFAULT '["book","reschedule","cancel","message"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessAIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessService" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bookingMode" TEXT NOT NULL DEFAULT 'appointment',
    "locationMode" TEXT NOT NULL DEFAULT 'flexible',
    "providerRequired" BOOLEAN NOT NULL DEFAULT true,
    "depositPercent" DOUBLE PRECISION,
    "payOnBooking" BOOLEAN NOT NULL DEFAULT true,
    "payOnCompletion" BOOLEAN NOT NULL DEFAULT false,
    "quoteRequired" BOOLEAN NOT NULL DEFAULT false,
    "freeCancellationHours" INTEGER NOT NULL DEFAULT 48,
    "refundPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "minAdvanceHours" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "aiCanBook" BOOLEAN NOT NULL DEFAULT false,
    "aiCanQuote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDomain" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'subdomain',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationToken" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "sslActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessWebsite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDesc" TEXT,
    "seoImage" TEXT,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwilioPhoneNumber_sid_key" ON "TwilioPhoneNumber"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioPhoneNumber_phoneNumber_key" ON "TwilioPhoneNumber"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioPhoneNumber_assignedTo_key" ON "TwilioPhoneNumber"("assignedTo");

-- CreateIndex
CREATE INDEX "TwilioPhoneNumber_status_idx" ON "TwilioPhoneNumber"("status");

-- CreateIndex
CREATE INDEX "TwilioPhoneNumber_assignedTo_idx" ON "TwilioPhoneNumber"("assignedTo");

-- CreateIndex
CREATE UNIQUE INDEX "CronHealth_jobName_key" ON "CronHealth"("jobName");

-- CreateIndex
CREATE INDEX "CronHealth_jobName_idx" ON "CronHealth"("jobName");

-- CreateIndex
CREATE UNIQUE INDEX "StripeDispute_stripeDisputeId_key" ON "StripeDispute"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "StripeDispute_bookingId_idx" ON "StripeDispute"("bookingId");

-- CreateIndex
CREATE INDEX "StripeDispute_instructorId_idx" ON "StripeDispute"("instructorId");

-- CreateIndex
CREATE INDEX "StripeDispute_stripePaymentIntentId_idx" ON "StripeDispute"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "LoginDevice_userId_idx" ON "LoginDevice"("userId");

-- CreateIndex
CREATE INDEX "LoginDevice_lastUsedAt_idx" ON "LoginDevice"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginDevice_userId_fingerprint_key" ON "LoginDevice"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "CardOrder_instructorId_idx" ON "CardOrder"("instructorId");

-- CreateIndex
CREATE INDEX "CardOrder_status_idx" ON "CardOrder"("status");

-- CreateIndex
CREATE INDEX "Business_subscriptionTier_idx" ON "Business"("subscriptionTier");

-- CreateIndex
CREATE INDEX "Business_isActive_idx" ON "Business"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_businessId_key" ON "BusinessSettings"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessBranding_businessId_key" ON "BusinessBranding"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessBranding_customSlug_key" ON "BusinessBranding"("customSlug");

-- CreateIndex
CREATE INDEX "BusinessBranding_customSlug_idx" ON "BusinessBranding"("customSlug");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCapabilities_businessId_key" ON "BusinessCapabilities"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessTerminology_businessId_key" ON "BusinessTerminology"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAIConfig_businessId_key" ON "BusinessAIConfig"("businessId");

-- CreateIndex
CREATE INDEX "BusinessService_businessId_isActive_idx" ON "BusinessService"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "BusinessService_businessId_sortOrder_idx" ON "BusinessService"("businessId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDomain_host_key" ON "BusinessDomain"("host");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDomain_verificationToken_key" ON "BusinessDomain"("verificationToken");

-- CreateIndex
CREATE INDEX "BusinessDomain_businessId_idx" ON "BusinessDomain"("businessId");

-- CreateIndex
CREATE INDEX "BusinessDomain_host_idx" ON "BusinessDomain"("host");

-- CreateIndex
CREATE INDEX "BusinessDomain_verified_idx" ON "BusinessDomain"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessWebsite_businessId_key" ON "BusinessWebsite"("businessId");

-- CreateIndex
CREATE INDEX "BookingIdempotencyKey_email_idx" ON "BookingIdempotencyKey"("email");

-- CreateIndex
CREATE INDEX "PDATestBooking_configId_idx" ON "PDATestBooking"("configId");

-- CreateIndex
CREATE INDEX "PDATestBooking_status_idx" ON "PDATestBooking"("status");

-- CreateIndex
CREATE INDEX "PDATestConfig_isActive_idx" ON "PDATestConfig"("isActive");

-- AddForeignKey
ALTER TABLE "TwilioPhoneNumber" ADD CONSTRAINT "TwilioPhoneNumber_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PDATestConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginDevice" ADD CONSTRAINT "LoginDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardOrder" ADD CONSTRAINT "CardOrder_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessBranding" ADD CONSTRAINT "BusinessBranding_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCapabilities" ADD CONSTRAINT "BusinessCapabilities_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessTerminology" ADD CONSTRAINT "BusinessTerminology_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAIConfig" ADD CONSTRAINT "BusinessAIConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessService" ADD CONSTRAINT "BusinessService_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDomain" ADD CONSTRAINT "BusinessDomain_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessWebsite" ADD CONSTRAINT "BusinessWebsite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

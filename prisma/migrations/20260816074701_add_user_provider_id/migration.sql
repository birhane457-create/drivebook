/*
  Warnings:

  - You are about to drop the column `instructorId` on the `AvailabilityException` table. All the data in the column will be lost.
  - You are about to drop the column `clientEmail` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `clientName` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `clientPhone` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `clientRating` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `clientReview` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `instructorPayout` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `CardOrder` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `FinancialLedger` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `LedgerEntry` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `PDATestBooking` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `PDATestBooking` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `PDATestConfig` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `Payout` table. All the data in the column will be lost.
  - You are about to drop the column `drivingTestPackagePrice` on the `PlatformSettings` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `SlotReservation` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `StripeDispute` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `instructorPayout` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `instructorId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Client` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Instructor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InstructorExpense` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `providerId` to the `AvailabilityException` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `CardOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `PDATestBooking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `PDATestBooking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `PDATestConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `Payout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `SlotReservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "CardOrder" DROP CONSTRAINT "CardOrder_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_userId_fkey";

-- DropForeignKey
ALTER TABLE "Instructor" DROP CONSTRAINT "Instructor_userId_fkey";

-- DropForeignKey
ALTER TABLE "InstructorExpense" DROP CONSTRAINT "InstructorExpense_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "PDATestBooking" DROP CONSTRAINT "PDATestBooking_clientId_fkey";

-- DropForeignKey
ALTER TABLE "PDATestBooking" DROP CONSTRAINT "PDATestBooking_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "PDATestConfig" DROP CONSTRAINT "PDATestConfig_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "SlotReservation" DROP CONSTRAINT "SlotReservation_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "TwilioPhoneNumber" DROP CONSTRAINT "TwilioPhoneNumber_assignedTo_fkey";

-- DropIndex
DROP INDEX "AvailabilityException_instructorId_exceptionDate_idx";

-- DropIndex
DROP INDEX "Booking_instructorId_clientRating_idx";

-- DropIndex
DROP INDEX "CardOrder_instructorId_idx";

-- DropIndex
DROP INDEX "FinancialLedger_instructorId_idx";

-- DropIndex
DROP INDEX "PDATestBooking_clientId_idx";

-- DropIndex
DROP INDEX "PDATestBooking_instructorId_testDate_idx";

-- DropIndex
DROP INDEX "PDATestConfig_instructorId_idx";

-- DropIndex
DROP INDEX "SlotReservation_instructorId_expiresAt_idx";

-- DropIndex
DROP INDEX "StripeDispute_instructorId_idx";

-- DropIndex
DROP INDEX "Task_instructorId_idx";

-- AlterTable
ALTER TABLE "AvailabilityException" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "clientEmail",
DROP COLUMN "clientId",
DROP COLUMN "clientName",
DROP COLUMN "clientPhone",
DROP COLUMN "clientRating",
DROP COLUMN "clientReview",
DROP COLUMN "instructorId",
DROP COLUMN "instructorPayout",
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "customerRating" INTEGER,
ADD COLUMN     "customerReview" TEXT,
ADD COLUMN     "preferredDate" TEXT,
ADD COLUMN     "providerId" TEXT NOT NULL,
ADD COLUMN     "providerPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "requestDescription" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "serviceId" TEXT,
ADD COLUMN     "siteAddress" TEXT,
ADD COLUMN     "siteAddressLat" DOUBLE PRECISION,
ADD COLUMN     "siteAddressLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "paymentModel" TEXT NOT NULL DEFAULT 'saas';

-- AlterTable
ALTER TABLE "BusinessCapabilities" ADD COLUMN     "commission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payouts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wallet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CardOrder" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DrivingProviderProfile" ADD COLUMN     "lessonPackages" JSONB,
ADD COLUMN     "testPackageDefaultPrice" DOUBLE PRECISION DEFAULT 225,
ADD COLUMN     "voiceLine" TEXT,
ADD COLUMN     "voiceLineSid" TEXT,
ADD COLUMN     "voiceLineStatus" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "FinancialLedger" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT;

-- AlterTable
ALTER TABLE "LedgerEntry" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT;

-- AlterTable
ALTER TABLE "PDATestBooking" DROP COLUMN "clientId",
DROP COLUMN "instructorId",
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PDATestConfig" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payout" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PlatformSettings" DROP COLUMN "drivingTestPackagePrice";

-- AlterTable
ALTER TABLE "SlotReservation" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StripeDispute" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "clientId",
DROP COLUMN "instructorId",
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "providerId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "instructorId",
DROP COLUMN "instructorPayout",
ADD COLUMN     "providerId" TEXT NOT NULL,
ADD COLUMN     "providerPayout" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "instructorId",
ADD COLUMN     "providerId" TEXT;

-- DropTable
DROP TABLE "Client";

-- DropTable
DROP TABLE "Instructor";

-- DropTable
DROP TABLE "InstructorExpense";

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "businessId" TEXT,
    "preferredProviderId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "defaultPickupAddress" TEXT,
    "defaultPickupLat" DOUBLE PRECISION,
    "defaultPickupLng" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "serviceAreas" TEXT,
    "copilotAgentEndpoint" TEXT,
    "bio" TEXT,
    "languages" TEXT,
    "baseAddress" TEXT,
    "serviceRadiusKm" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "averageRating" DOUBLE PRECISION,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'BASIC',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "accountType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "paymentMode" TEXT NOT NULL DEFAULT 'PLATFORM',
    "customDomain" TEXT,
    "brandedBookingPage" BOOLEAN NOT NULL DEFAULT false,
    "brandLogo" TEXT,
    "brandColorPrimary" TEXT,
    "brandColorSecondary" TEXT,
    "showBrandingOnBookingPage" BOOLEAN NOT NULL DEFAULT false,
    "maxProviders" INTEGER NOT NULL DEFAULT 1,
    "stripeCustomerId" TEXT,
    "stripeAccountId" TEXT,
    "profileImage" TEXT,
    "documentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "documentsVerifiedAt" TIMESTAMP(3),
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "workingHours" JSONB,
    "policyExceptionCount" INTEGER NOT NULL DEFAULT 0,
    "allowedDurations" JSONB,
    "bookingBufferMinutes" INTEGER,
    "enableTravelTime" BOOLEAN NOT NULL DEFAULT false,
    "travelTimeMinutes" INTEGER,
    "payoutMethod" TEXT NOT NULL DEFAULT 'stripe_connect',
    "bankBsb" TEXT,
    "bankAccount" TEXT,
    "bankAccountName" TEXT,
    "abn" TEXT,
    "abnVerified" BOOLEAN NOT NULL DEFAULT false,
    "abnStatus" TEXT,
    "abnEntityName" TEXT,
    "abnVerifiedAt" TIMESTAMP(3),
    "abnVerifiedBy" TEXT,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
    "withholdingTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 47,
    "syncGoogleCalendar" BOOLEAN NOT NULL DEFAULT false,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "googleCalendarId" TEXT,
    "calendarBufferMode" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "yearsExperience" INTEGER,
    "domainVerified" BOOLEAN NOT NULL DEFAULT false,
    "domainVerifiedAt" TIMESTAMP(3),
    "customSlug" TEXT,
    "baseAddressLat" DOUBLE PRECISION,
    "baseAddressLng" DOUBLE PRECISION,
    "baseLatitude" DOUBLE PRECISION,
    "baseLongitude" DOUBLE PRECISION,
    "acceptingBookings" BOOLEAN NOT NULL DEFAULT true,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutHold" BOOLEAN NOT NULL DEFAULT false,
    "payoutHoldReason" TEXT,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoUrl" TEXT,
    "specialties" TEXT,
    "suburb" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "timezone" TEXT,
    "businessName" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderExpense" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "depositPercent" DOUBLE PRECISION,
    "depositAmount" DOUBLE PRECISION,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_userId_key" ON "Provider"("userId");

-- CreateIndex
CREATE INDEX "Provider_state_suburb_idx" ON "Provider"("state", "suburb");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_stripeSessionId_key" ON "Quote"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Quote_bookingId_idx" ON "Quote"("bookingId");

-- CreateIndex
CREATE INDEX "Quote_providerId_status_idx" ON "Quote"("providerId", "status");

-- CreateIndex
CREATE INDEX "Quote_customerId_status_idx" ON "Quote"("customerId", "status");

-- CreateIndex
CREATE INDEX "Quote_status_validUntil_idx" ON "Quote"("status", "validUntil");

-- CreateIndex
CREATE INDEX "AvailabilityException_providerId_exceptionDate_idx" ON "AvailabilityException"("providerId", "exceptionDate");

-- CreateIndex
CREATE INDEX "Booking_providerId_customerRating_idx" ON "Booking"("providerId", "customerRating");

-- CreateIndex
CREATE INDEX "Business_paymentModel_idx" ON "Business"("paymentModel");

-- CreateIndex
CREATE INDEX "CardOrder_providerId_idx" ON "CardOrder"("providerId");

-- CreateIndex
CREATE INDEX "FinancialLedger_providerId_idx" ON "FinancialLedger"("providerId");

-- CreateIndex
CREATE INDEX "PDATestBooking_providerId_testDate_idx" ON "PDATestBooking"("providerId", "testDate");

-- CreateIndex
CREATE INDEX "PDATestBooking_customerId_idx" ON "PDATestBooking"("customerId");

-- CreateIndex
CREATE INDEX "PDATestConfig_providerId_idx" ON "PDATestConfig"("providerId");

-- CreateIndex
CREATE INDEX "SlotReservation_providerId_expiresAt_idx" ON "SlotReservation"("providerId", "expiresAt");

-- CreateIndex
CREATE INDEX "StripeDispute_providerId_idx" ON "StripeDispute"("providerId");

-- CreateIndex
CREATE INDEX "Task_providerId_idx" ON "Task"("providerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwilioPhoneNumber" ADD CONSTRAINT "TwilioPhoneNumber_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProviderExpense" ADD CONSTRAINT "ProviderExpense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotReservation" ADD CONSTRAINT "SlotReservation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PDATestConfig" ADD CONSTRAINT "PDATestConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PDATestBooking" ADD CONSTRAINT "PDATestBooking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardOrder" ADD CONSTRAINT "CardOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

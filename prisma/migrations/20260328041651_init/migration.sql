-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "instructorId" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "ageDeclaration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "instructorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredInstructorId" TEXT,
    "defaultPickupAddress" TEXT,
    "defaultPickupLat" DOUBLE PRECISION,
    "defaultPickupLng" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "serviceAreas" TEXT,
    "copilotAgentEndpoint" TEXT,
    "bio" TEXT,
    "carMake" TEXT,
    "carModel" TEXT,
    "carYear" TEXT,
    "vehicleTypes" TEXT,
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
    "customDomain" TEXT,
    "brandedBookingPage" BOOLEAN NOT NULL DEFAULT false,
    "brandLogo" TEXT,
    "brandColorPrimary" TEXT,
    "brandColorSecondary" TEXT,
    "showBrandingOnBookingPage" BOOLEAN NOT NULL DEFAULT false,
    "maxInstructors" INTEGER NOT NULL DEFAULT 1,
    "stripeCustomerId" TEXT,
    "stripeAccountId" TEXT,
    "licenseNumber" TEXT,
    "insuranceNumber" TEXT,
    "licenseImageFront" TEXT,
    "licenseImageBack" TEXT,
    "insurancePolicyDoc" TEXT,
    "policeCheckDoc" TEXT,
    "wwcCheckDoc" TEXT,
    "photoIdDoc" TEXT,
    "certificationDoc" TEXT,
    "vehicleRegistrationDoc" TEXT,
    "profileImage" TEXT,
    "carImage" TEXT,
    "documentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "documentsVerifiedAt" TIMESTAMP(3),
    "licenseExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "policeCheckExpiry" TIMESTAMP(3),
    "wwcCheckExpiry" TIMESTAMP(3),
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "workingHours" JSONB,
    "policyExceptionCount" INTEGER NOT NULL DEFAULT 0,
    "allowedDurations" JSONB,
    "bookingBufferMinutes" INTEGER,
    "enableTravelTime" BOOLEAN NOT NULL DEFAULT false,
    "travelTimeMinutes" INTEGER,
    "lessonPackages" JSONB,
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

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "bookingType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" DOUBLE PRECISION,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instructorPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paymentCaptured" BOOLEAN NOT NULL DEFAULT false,
    "paymentCapturedAt" TIMESTAMP(3),
    "paymentIntentId" TEXT,
    "pickupAddress" TEXT,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "dropoffAddress" TEXT,
    "dropoffLatitude" DOUBLE PRECISION,
    "dropoffLongitude" DOUBLE PRECISION,
    "notes" TEXT,
    "isFirstBooking" BOOLEAN NOT NULL DEFAULT false,
    "isPackageBooking" BOOLEAN NOT NULL DEFAULT false,
    "parentBookingId" TEXT,
    "packageHours" DOUBLE PRECISION,
    "packageHoursUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packageHoursRemaining" DOUBLE PRECISION,
    "packageTotalPaid" DOUBLE PRECISION,
    "packageExpiryDate" TIMESTAMP(3),
    "packageStatus" TEXT,
    "createdBy" TEXT,
    "originalStartTime" TIMESTAMP(3),
    "isNonRefundable" BOOLEAN NOT NULL DEFAULT false,
    "rescheduledFrom" JSONB,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "noShowParty" TEXT,
    "googleCalendarEventId" TEXT,
    "lessonFeedback" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "instructorNotes" TEXT,
    "feedbackGivenAt" TIMESTAMP(3),
    "studentStrengths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "focusAreas" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "performanceScore" INTEGER,
    "clientRating" INTEGER,
    "clientReview" TEXT,
    "reviewGivenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "instructorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instructorPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeTransferId" TEXT,
    "taxWithheld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "resolutionGroupId" TEXT,
    "resolutionStatus" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "callerName" TEXT,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "taxWithheld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "stripeTransferId" TEXT,
    "bankReference" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "failureReason" TEXT,
    "holdReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payoutRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutTransaction" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,

    CONSTRAINT "PayoutTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformLedger" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "totalCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaidOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRefunded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTaxWithheld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "referenceId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "instructorId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "basicCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "proCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "businessCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "basicNewStudentBonus" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "proNewStudentBonus" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "businessNewStudentBonus" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "platformFeePercentage" DOUBLE PRECISION NOT NULL DEFAULT 3.6,
    "package6Discount" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "package10Discount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "package15Discount" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "discountPaidBy" TEXT NOT NULL DEFAULT 'shared',
    "drivingTestPackagePrice" DOUBLE PRECISION NOT NULL DEFAULT 225,
    "cancellationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lateCancellationWindowHours" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "noShowPenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "walletTopUpMin" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "walletTopUpMax" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "withholdingTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 47,
    "peakSurchargeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "peakSurchargePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationReport" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "paymentsChecked" INTEGER NOT NULL DEFAULT 0,
    "missingPayments" INTEGER NOT NULL DEFAULT 0,
    "transfersChecked" INTEGER NOT NULL DEFAULT 0,
    "missingTransfers" INTEGER NOT NULL DEFAULT 0,
    "stuckPayouts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningContent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tipText" TEXT NOT NULL,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'basic',
    "pdaCodes" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "durationSec" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_userId_key" ON "Instructor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientWallet_userId_key" ON "ClientWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_payoutRef_key" ON "Payout"("payoutRef");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformLedger_key_key" ON "PlatformLedger"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSettings_key_key" ON "PlatformSettings"("key");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWallet" ADD CONSTRAINT "ClientWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ClientWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

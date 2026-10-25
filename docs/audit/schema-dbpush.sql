--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AdminWalletIdempotencyKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AdminWalletIdempotencyKey" (
    key text NOT NULL,
    "walletId" text NOT NULL,
    "operationType" text NOT NULL,
    "transactionId" text,
    response jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    action text NOT NULL,
    "actorId" text NOT NULL,
    "actorRole" text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    metadata jsonb,
    success boolean DEFAULT true NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AvailabilityException; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AvailabilityException" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    label text,
    "exceptionDate" timestamp(3) without time zone NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "allDay" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason text
);


--
-- Name: Booking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Booking" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "customerId" text,
    "customerName" text,
    "customerPhone" text,
    "bookingType" text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "startTime" timestamp(3) without time zone,
    "endTime" timestamp(3) without time zone,
    duration double precision,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    "platformFee" numeric(12,2) DEFAULT 0 NOT NULL,
    "providerPayout" numeric(12,2) DEFAULT 0 NOT NULL,
    "commissionRate" numeric(5,4) DEFAULT 0 NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "paymentCaptured" boolean DEFAULT false NOT NULL,
    "paymentCapturedAt" timestamp(3) without time zone,
    "paymentIntentId" text,
    "pickupAddress" text,
    "pickupLatitude" double precision,
    "pickupLongitude" double precision,
    "dropoffAddress" text,
    "dropoffLatitude" double precision,
    "dropoffLongitude" double precision,
    notes text,
    "isFirstBooking" boolean DEFAULT false NOT NULL,
    "isPackageBooking" boolean DEFAULT false NOT NULL,
    "parentBookingId" text,
    "packageHours" numeric(8,2),
    "packageHoursUsed" numeric(8,2) DEFAULT 0 NOT NULL,
    "packageHoursRemaining" numeric(8,2),
    "packageTotalPaid" numeric(12,2),
    "packageExpiryDate" timestamp(3) without time zone,
    "packageStatus" text,
    "createdBy" text,
    "originalStartTime" timestamp(3) without time zone,
    "isNonRefundable" boolean DEFAULT false NOT NULL,
    "rescheduledFrom" jsonb,
    "rescheduleCount" integer DEFAULT 0 NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "deletedBy" text,
    "noShowParty" text,
    "googleCalendarEventId" text,
    "customerRating" integer,
    "customerReview" text,
    "reviewGivenAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "customerEmail" text,
    "lockedDiscountPct" numeric(5,2),
    "lockedDiscountMinHours" numeric(8,2),
    "lockedHourlyRate" numeric(10,2),
    "offlineAmountPaid" numeric(12,2),
    "offlinePaymentMethod" text,
    source text DEFAULT 'platform'::text NOT NULL,
    "cancelledAt" timestamp(3) without time zone,
    "actualDuration" integer,
    "checkInBy" text,
    "checkInLocation" text,
    "checkInPhoto" text,
    "checkInTime" timestamp(3) without time zone,
    "checkOutBy" text,
    "checkOutLocation" text,
    "checkOutPhoto" text,
    "checkOutTime" timestamp(3) without time zone,
    "smsCheckOutSent" boolean DEFAULT false NOT NULL,
    "cancellationStatus" text,
    "cancellationRequestedAt" timestamp(3) without time zone,
    "cancellationRequestedBy" text,
    "cancellationReason" text,
    "adminReviewedAt" timestamp(3) without time zone,
    "adminReviewedBy" text,
    "adminReviewNote" text,
    "adminOverrideAmount" numeric(10,2),
    "stripeRefundId" text,
    "paymentToken" text,
    timezone text,
    "serviceId" text,
    "requestDescription" text,
    "requestedAt" timestamp(3) without time zone,
    "preferredDate" text,
    "siteAddress" text,
    "siteAddressLat" double precision,
    "siteAddressLng" double precision
);


--
-- Name: BookingIdempotencyKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BookingIdempotencyKey" (
    key text NOT NULL,
    "bookingId" text NOT NULL,
    response jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    email text NOT NULL
);


--
-- Name: Business; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Business" (
    id text NOT NULL,
    name text NOT NULL,
    "legalName" text,
    abn text,
    "abnVerified" boolean DEFAULT false NOT NULL,
    "supportEmail" text NOT NULL,
    phone text,
    timezone text DEFAULT 'Australia/Perth'::text NOT NULL,
    "templateSlug" text,
    "subscriptionTier" text DEFAULT 'BASIC'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "paymentModel" text DEFAULT 'saas'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessAIConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessAIConfig" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "businessDescription" text NOT NULL,
    "openingHours" text DEFAULT 'Mon-Fri 9am-5pm'::text NOT NULL,
    "greetingScript" text,
    personality text DEFAULT 'friendly'::text NOT NULL,
    faq jsonb DEFAULT '[]'::jsonb NOT NULL,
    "allowedActions" jsonb DEFAULT '["book", "reschedule", "cancel", "message"]'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessBranding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessBranding" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    logo text,
    "primaryColour" text DEFAULT '#3B82F6'::text NOT NULL,
    "secondaryColour" text,
    "fontFamily" text,
    theme text DEFAULT 'light'::text NOT NULL,
    "showPlatformBranding" boolean DEFAULT true NOT NULL,
    "customSlug" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessCapabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessCapabilities" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "onlineBooking" boolean DEFAULT true NOT NULL,
    "onlinePayments" boolean DEFAULT true NOT NULL,
    quotes boolean DEFAULT false NOT NULL,
    packages boolean DEFAULT true NOT NULL,
    "waitingList" boolean DEFAULT false NOT NULL,
    reviews boolean DEFAULT true NOT NULL,
    "aiReceptionist" boolean DEFAULT false NOT NULL,
    "voiceLine" boolean DEFAULT false NOT NULL,
    "mobileApp" boolean DEFAULT false NOT NULL,
    "googleCalendar" boolean DEFAULT true NOT NULL,
    "documentVerification" boolean DEFAULT false NOT NULL,
    "travelTime" boolean DEFAULT false NOT NULL,
    "assessmentTracking" boolean DEFAULT false NOT NULL,
    "websiteBuilder" boolean DEFAULT true NOT NULL,
    wallet boolean DEFAULT false NOT NULL,
    payouts boolean DEFAULT false NOT NULL,
    commission boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessDomain; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessDomain" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    host text NOT NULL,
    type text DEFAULT 'subdomain'::text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verificationToken" text,
    "provisionedAt" timestamp(3) without time zone,
    "sslActive" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessService; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessService" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    description text,
    duration integer NOT NULL,
    price numeric(12,2) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "bookingMode" text DEFAULT 'appointment'::text NOT NULL,
    "locationMode" text DEFAULT 'flexible'::text NOT NULL,
    "providerRequired" boolean DEFAULT true NOT NULL,
    "depositPercent" numeric(5,2),
    "payOnBooking" boolean DEFAULT true NOT NULL,
    "payOnCompletion" boolean DEFAULT false NOT NULL,
    "quoteRequired" boolean DEFAULT false NOT NULL,
    "freeCancellationHours" integer DEFAULT 48 NOT NULL,
    "refundPercent" numeric(5,2) DEFAULT 100 NOT NULL,
    "minAdvanceHours" integer DEFAULT 2 NOT NULL,
    "maxAdvanceDays" integer DEFAULT 60 NOT NULL,
    "aiCanBook" boolean DEFAULT false NOT NULL,
    "aiCanQuote" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessSettings" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "minAdvanceHours" integer DEFAULT 2 NOT NULL,
    "maxAdvanceDays" integer DEFAULT 60 NOT NULL,
    "bookingBufferMinutes" integer DEFAULT 10 NOT NULL,
    "maxAppointmentsPerDay" integer DEFAULT 8 NOT NULL,
    "platformFeePercent" numeric(5,2) DEFAULT 3.6 NOT NULL,
    "commissionRate" numeric(5,2) DEFAULT 15.0 NOT NULL,
    "freeCancellationHours" integer DEFAULT 48 NOT NULL,
    "lateCancellationWindowHours" integer DEFAULT 24 NOT NULL,
    "cancellationRefundPercent" numeric(5,2) DEFAULT 100.0 NOT NULL,
    "package6Discount" numeric(5,2) DEFAULT 5 NOT NULL,
    "package10Discount" numeric(5,2) DEFAULT 10 NOT NULL,
    "package15Discount" numeric(5,2) DEFAULT 12 NOT NULL,
    "gstEnabled" boolean DEFAULT true NOT NULL,
    "gstRate" numeric(5,2) DEFAULT 10 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessTerminology; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessTerminology" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    provider text DEFAULT 'Provider'::text NOT NULL,
    providers text DEFAULT 'Providers'::text NOT NULL,
    customer text DEFAULT 'Customer'::text NOT NULL,
    customers text DEFAULT 'Customers'::text NOT NULL,
    booking text DEFAULT 'Booking'::text NOT NULL,
    bookings text DEFAULT 'Bookings'::text NOT NULL,
    service text DEFAULT 'Service'::text NOT NULL,
    services text DEFAULT 'Services'::text NOT NULL,
    "providerGroup" text DEFAULT 'Business'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BusinessWebsite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessWebsite" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "seoTitle" text,
    "seoDesc" text,
    "seoImage" text,
    pages jsonb DEFAULT '[]'::jsonb NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CardOrder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CardOrder" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    quantity integer NOT NULL,
    suburbs text,
    notes text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ClientWallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClientWallet" (
    id text NOT NULL,
    "userId" text NOT NULL,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CronHealth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CronHealth" (
    id text NOT NULL,
    "jobName" text NOT NULL,
    "lastRunAt" timestamp(3) without time zone NOT NULL,
    "lastStatus" text DEFAULT 'OK'::text NOT NULL,
    "lastError" text,
    "runCount" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    "userId" text,
    "businessId" text,
    "preferredProviderId" text,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    "defaultPickupAddress" text,
    "defaultPickupLat" double precision,
    "defaultPickupLng" double precision,
    notes text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DeviceToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeviceToken" (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DrivingLessonOutcome; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DrivingLessonOutcome" (
    id text NOT NULL,
    "bookingId" text NOT NULL,
    "assessmentType" text DEFAULT 'COACHING'::text NOT NULL,
    "lessonTopics" text,
    "pdaScores" jsonb,
    passed boolean,
    "performanceScore" integer,
    "studentStrengths" integer[] DEFAULT ARRAY[]::integer[],
    "focusAreas" integer[] DEFAULT ARRAY[]::integer[],
    "lessonFeedback" integer[] DEFAULT ARRAY[]::integer[],
    "instructorNotes" text,
    "whiteboardSketchUrl" text,
    "feedbackGivenAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DrivingProviderProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DrivingProviderProfile" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "carMake" text,
    "carModel" text,
    "carYear" text,
    "vehicleTypes" text,
    "carImage" text,
    "vehicleRegistrationDoc" text,
    "licenseNumber" text,
    "licenseExpiry" timestamp(3) without time zone,
    "licenseImageFront" text,
    "licenseImageBack" text,
    "insuranceNumber" text,
    "insuranceExpiry" timestamp(3) without time zone,
    "insurancePolicyDoc" text,
    "policeCheckDoc" text,
    "policeCheckExpiry" timestamp(3) without time zone,
    "wwcCheckDoc" text,
    "wwcCheckExpiry" timestamp(3) without time zone,
    "certificationDoc" text,
    "photoIdDoc" text,
    "offersTestPackage" boolean DEFAULT false NOT NULL,
    "testPackageDuration" integer,
    "testPackageIncludes" jsonb,
    "testPackagePrice" numeric(12,2),
    "testPackageDefaultPrice" numeric(12,2) DEFAULT 225,
    "voiceLine" text,
    "voiceLineStatus" text DEFAULT 'NONE'::text NOT NULL,
    "voiceLineSid" text,
    "lessonPackages" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FinancialLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinancialLedger" (
    id text NOT NULL,
    "debitAccount" text NOT NULL,
    "creditAccount" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    "idempotencyKey" text NOT NULL,
    "bookingId" text,
    "transactionId" text,
    "payoutId" text,
    "userId" text,
    "providerId" text,
    metadata jsonb,
    "createdBy" text DEFAULT 'SYSTEM'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LearningContent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LearningContent" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "tipText" text NOT NULL,
    "videoUrl" text,
    "thumbnailUrl" text,
    category text NOT NULL,
    difficulty text DEFAULT 'basic'::text NOT NULL,
    "pdaCodes" integer[] DEFAULT ARRAY[]::integer[],
    "durationSec" integer,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LedgerEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LedgerEntry" (
    id text NOT NULL,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'AUD'::text NOT NULL,
    "referenceId" text NOT NULL,
    "referenceType" text NOT NULL,
    "providerId" text,
    description text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LoginDevice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LoginDevice" (
    id text NOT NULL,
    "userId" text NOT NULL,
    fingerprint text NOT NULL,
    "lastUsedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "firstSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text NOT NULL,
    "userAgent" text NOT NULL,
    location text,
    trusted boolean DEFAULT false NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "callerNumber" text NOT NULL,
    "callerName" text,
    message text NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    "isRead" boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reminderStage" text,
    channel text
);


--
-- Name: PDAConfigTestCentre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PDAConfigTestCentre" (
    id text NOT NULL,
    "pdaConfigId" text NOT NULL,
    "testCentreId" text NOT NULL
);


--
-- Name: PDATestBooking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PDATestBooking" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "customerId" text NOT NULL,
    "configId" text NOT NULL,
    "testCentreId" text NOT NULL,
    "testDate" timestamp(3) without time zone NOT NULL,
    "testTime" text NOT NULL,
    price numeric(12,2) NOT NULL,
    "discountPercent" numeric(5,2),
    status text DEFAULT 'PENDING'::text NOT NULL,
    result text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    notes text,
    "parentBookingId" text
);


--
-- Name: PDATestConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PDATestConfig" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    name text NOT NULL,
    "durationMinutes" integer NOT NULL,
    price numeric(12,2) NOT NULL,
    "discountPercent" numeric(5,2),
    includes jsonb,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Payout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payout" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "grossAmount" numeric(12,2) NOT NULL,
    "taxWithheld" numeric(12,2) DEFAULT 0 NOT NULL,
    "gstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "netAmount" numeric(12,2) NOT NULL,
    "payoutMethod" text NOT NULL,
    "stripeAccountId" text,
    "stripeTransferId" text,
    "bankReference" text,
    "sentAt" timestamp(3) without time zone,
    "sentBy" text,
    "confirmedAt" timestamp(3) without time zone,
    "confirmedBy" text,
    "idempotencyKey" text NOT NULL,
    "failureReason" text,
    "holdReason" text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "payoutRef" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PayoutTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PayoutTransaction" (
    id text NOT NULL,
    "payoutId" text NOT NULL,
    "transactionId" text NOT NULL
);


--
-- Name: PlatformLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformLedger" (
    id text NOT NULL,
    key text DEFAULT 'default'::text NOT NULL,
    "totalCollected" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalReserved" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalPaidOut" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalRefunded" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalTaxWithheld" numeric(12,2) DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlatformRateChange; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformRateChange" (
    id text NOT NULL,
    tier text NOT NULL,
    field text NOT NULL,
    "currentRate" numeric(10,4) NOT NULL,
    "newRate" numeric(10,4) NOT NULL,
    "effectiveDate" timestamp(3) without time zone NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "notifiedAt" timestamp(3) without time zone,
    "appliedAt" timestamp(3) without time zone,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlatformSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformSettings" (
    id text NOT NULL,
    key text DEFAULT 'default'::text NOT NULL,
    "basicCommissionRate" numeric(5,2) DEFAULT 15 NOT NULL,
    "proCommissionRate" numeric(5,2) DEFAULT 12 NOT NULL,
    "studioCommissionRate" numeric(5,2) DEFAULT 11 NOT NULL,
    "businessCommissionRate" numeric(5,2) DEFAULT 10 NOT NULL,
    "basicNewStudentBonus" numeric(10,2) DEFAULT 8 NOT NULL,
    "proNewStudentBonus" numeric(10,2) DEFAULT 10 NOT NULL,
    "businessNewStudentBonus" numeric(10,2) DEFAULT 12 NOT NULL,
    "platformFeePercentage" numeric(5,2) DEFAULT 3.6 NOT NULL,
    "package6Discount" numeric(5,2) DEFAULT 5 NOT NULL,
    "package10Discount" numeric(5,2) DEFAULT 10 NOT NULL,
    "package15Discount" numeric(5,2) DEFAULT 12 NOT NULL,
    "packageTiers" jsonb,
    "discountPaidBy" text DEFAULT 'shared'::text NOT NULL,
    "cancellationFee" numeric(10,2) DEFAULT 0 NOT NULL,
    "lateCancellationWindowHours" numeric(6,2) DEFAULT 24 NOT NULL,
    "noShowPenaltyAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "walletTopUpMin" numeric(10,2) DEFAULT 10 NOT NULL,
    "walletTopUpMax" numeric(10,2) DEFAULT 500 NOT NULL,
    "gstEnabled" boolean DEFAULT true NOT NULL,
    "gstRate" numeric(5,2) DEFAULT 10 NOT NULL,
    "withholdingTaxRate" numeric(5,2) DEFAULT 47 NOT NULL,
    "peakSurchargeEnabled" boolean DEFAULT false NOT NULL,
    "peakSurchargePercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "updatedBy" text,
    "maxAdminCreditAmount" numeric(12,2) DEFAULT 500 NOT NULL,
    "maxAdminDeductAmount" numeric(12,2) DEFAULT 500 NOT NULL
);


--
-- Name: Provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Provider" (
    id text NOT NULL,
    "userId" text,
    name text NOT NULL,
    phone text NOT NULL,
    "hourlyRate" double precision NOT NULL,
    "serviceAreas" text,
    "copilotAgentEndpoint" text,
    bio text,
    languages text,
    "baseAddress" text,
    "serviceRadiusKm" double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "isFeatured" boolean DEFAULT false NOT NULL,
    "averageRating" double precision,
    "totalReviews" integer DEFAULT 0 NOT NULL,
    "subscriptionTier" text DEFAULT 'BASIC'::text NOT NULL,
    "subscriptionStatus" text DEFAULT 'TRIAL'::text NOT NULL,
    "trialEndsAt" timestamp(3) without time zone,
    "accountType" text DEFAULT 'INDIVIDUAL'::text NOT NULL,
    "businessModel" text DEFAULT 'SAAS'::text NOT NULL,
    "paymentMode" text DEFAULT 'PLATFORM'::text NOT NULL,
    "customDomain" text,
    "brandedBookingPage" boolean DEFAULT false NOT NULL,
    "brandLogo" text,
    "brandColorPrimary" text,
    "brandColorSecondary" text,
    "showBrandingOnBookingPage" boolean DEFAULT false NOT NULL,
    "maxProviders" integer DEFAULT 1 NOT NULL,
    "stripeCustomerId" text,
    "stripeAccountId" text,
    "stripeSubscriptionId" text,
    "profileImage" text,
    "documentsVerified" boolean DEFAULT false NOT NULL,
    "documentsVerifiedAt" timestamp(3) without time zone,
    "approvalStatus" text DEFAULT 'PENDING'::text NOT NULL,
    "workingHours" jsonb,
    "policyExceptionCount" integer DEFAULT 0 NOT NULL,
    "allowedDurations" jsonb,
    "bookingBufferMinutes" integer,
    "enableTravelTime" boolean DEFAULT false NOT NULL,
    "travelTimeMinutes" integer,
    "payoutMethod" text DEFAULT 'stripe_connect'::text NOT NULL,
    "bankBsb" text,
    "bankAccount" text,
    "bankAccountName" text,
    abn text,
    "abnVerified" boolean DEFAULT false NOT NULL,
    "abnStatus" text,
    "abnEntityName" text,
    "abnVerifiedAt" timestamp(3) without time zone,
    "abnVerifiedBy" text,
    "gstRegistered" boolean DEFAULT false NOT NULL,
    "withholdingTaxRate" numeric(5,2) DEFAULT 47 NOT NULL,
    "syncGoogleCalendar" boolean DEFAULT false NOT NULL,
    "googleAccessToken" text,
    "googleRefreshToken" text,
    "googleTokenExpiry" timestamp(3) without time zone,
    "googleCalendarId" text,
    "calendarBufferMode" text,
    whatsapp text,
    instagram text,
    facebook text,
    "yearsExperience" integer,
    "domainVerified" boolean DEFAULT false NOT NULL,
    "domainVerifiedAt" timestamp(3) without time zone,
    "customSlug" text,
    "baseAddressLat" double precision,
    "baseAddressLng" double precision,
    "baseLatitude" double precision,
    "baseLongitude" double precision,
    "acceptingBookings" boolean DEFAULT true NOT NULL,
    "chargesEnabled" boolean DEFAULT false NOT NULL,
    "payoutHold" boolean DEFAULT false NOT NULL,
    "payoutHoldReason" text,
    "payoutsEnabled" boolean DEFAULT false NOT NULL,
    "videoUrl" text,
    specialties text,
    suburb text,
    state text,
    postcode text,
    timezone text,
    "businessName" text
);


--
-- Name: ProviderExpense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderExpense" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Quote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Quote" (
    id text NOT NULL,
    "bookingId" text NOT NULL,
    "providerId" text NOT NULL,
    "customerId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    "lineItems" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "validUntil" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "declinedAt" timestamp(3) without time zone,
    "declineReason" text,
    "stripeSessionId" text,
    "stripePaymentIntentId" text,
    "checkoutGeneration" integer DEFAULT 1 NOT NULL,
    "depositPercent" numeric(5,2),
    "depositAmount" numeric(12,2),
    "depositPaid" boolean DEFAULT false NOT NULL,
    "customerNotes" text,
    "internalNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ReconciliationReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReconciliationReport" (
    id text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    status text NOT NULL,
    "windowStart" timestamp(3) without time zone NOT NULL,
    "windowEnd" timestamp(3) without time zone NOT NULL,
    "paymentsChecked" integer DEFAULT 0 NOT NULL,
    "missingPayments" integer DEFAULT 0 NOT NULL,
    "transfersChecked" integer DEFAULT 0 NOT NULL,
    "missingTransfers" integer DEFAULT 0 NOT NULL,
    "stuckPayouts" integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SlotReservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SlotReservation" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "sessionId" text NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone NOT NULL
);


--
-- Name: StaffMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StaffMember" (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    department text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isSupervisor" boolean DEFAULT false NOT NULL,
    "currentLoad" integer DEFAULT 0 NOT NULL,
    "maxCapacity" integer DEFAULT 10 NOT NULL,
    "tasksCompleted" integer DEFAULT 0 NOT NULL,
    "avgResolutionTimeHours" double precision,
    "satisfactionScore" double precision,
    skills jsonb,
    permissions text[] DEFAULT ARRAY[]::text[],
    "canApproveRefunds" boolean DEFAULT false NOT NULL,
    "canOverridePolicy" boolean DEFAULT false NOT NULL,
    "canAccessFinancials" boolean DEFAULT false NOT NULL,
    "maxRefundAmount" numeric(10,2) DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StripeDispute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StripeDispute" (
    id text NOT NULL,
    "stripeDisputeId" text NOT NULL,
    "stripeChargeId" text NOT NULL,
    "stripePaymentIntentId" text,
    "bookingId" text,
    "providerId" text,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'AUD'::text NOT NULL,
    reason text NOT NULL,
    status text NOT NULL,
    "payoutFrozen" boolean DEFAULT false NOT NULL,
    "adjustmentCreated" boolean DEFAULT false NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    tier text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "billingCycle" text DEFAULT 'monthly'::text NOT NULL,
    "monthlyAmount" numeric(10,2) NOT NULL,
    "stripeSubscriptionId" text,
    "stripeCustomerId" text,
    "currentPeriodStart" timestamp(3) without time zone NOT NULL,
    "currentPeriodEnd" timestamp(3) without time zone NOT NULL,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "trialEndsAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "lastWebhookEventId" text,
    "lastWebhookEventTimestamp" integer,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    priority text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "providerId" text,
    "customerId" text,
    "bookingId" text,
    "userId" text,
    "contactName" text,
    "contactEmail" text,
    "contactPhone" text,
    "assignedToId" text,
    "assignedAt" timestamp(3) without time zone,
    "autoAssigned" boolean DEFAULT false NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "financialAmount" numeric(12,2),
    "financialImpact" jsonb,
    "requiresApproval" boolean DEFAULT false NOT NULL,
    "firstResponseAt" timestamp(3) without time zone,
    "slaBreached" boolean DEFAULT false NOT NULL,
    "slaBreachReason" text,
    "resolutionTimeHours" double precision,
    "escalatedAt" timestamp(3) without time zone,
    "escalatedTo" text,
    "escalationReason" text,
    "escalationCount" integer DEFAULT 0 NOT NULL,
    "autoEscalated" boolean DEFAULT false NOT NULL,
    resolution text,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedBy" text,
    "closedAt" timestamp(3) without time zone,
    "closedBy" text,
    "linkedEntityVerified" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TaskNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskNote" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "staffId" text NOT NULL,
    note text NOT NULL,
    "isInternal" boolean DEFAULT true NOT NULL,
    attachments jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TestCentre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestCentre" (
    id text NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    suburb text NOT NULL,
    state text DEFAULT 'WA'::text NOT NULL,
    region text,
    lat double precision,
    lng double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Transaction" (
    id text NOT NULL,
    "bookingId" text,
    "providerId" text NOT NULL,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "platformFee" numeric(12,2) DEFAULT 0 NOT NULL,
    "providerPayout" numeric(12,2) DEFAULT 0 NOT NULL,
    "commissionRate" numeric(5,4) DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    description text,
    "stripePaymentIntentId" text,
    "stripeChargeId" text,
    "stripeTransferId" text,
    "taxWithheld" numeric(12,2) DEFAULT 0 NOT NULL,
    "gstAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    metadata jsonb,
    "resolutionGroupId" text,
    "resolutionStatus" text,
    "processedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TwilioPhoneNumber; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TwilioPhoneNumber" (
    id text NOT NULL,
    sid text NOT NULL,
    "phoneNumber" text NOT NULL,
    "friendlyName" text,
    "areaCode" text,
    status text DEFAULT 'AVAILABLE'::text NOT NULL,
    "assignedTo" text,
    "assignedAt" timestamp(6) with time zone,
    "assignedBy" text,
    "releasedAt" timestamp(6) with time zone,
    "releasedBy" text,
    notes text,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text,
    name text,
    role text DEFAULT 'CLIENT'::text NOT NULL,
    "providerId" text,
    "resetToken" text,
    "resetTokenExpiry" timestamp(3) without time zone,
    "termsAcceptedAt" timestamp(3) without time zone,
    "termsVersion" text,
    "ageDeclaration" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "verificationToken" text,
    "verificationTokenExpiry" timestamp(3) without time zone
);


--
-- Name: WalletTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletTransaction" (
    id text NOT NULL,
    "walletId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    type text NOT NULL,
    description text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    metadata jsonb,
    "bookingId" text
);


--
-- Name: WebhookEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WebhookEvent" (
    id text NOT NULL,
    "idempotencyKey" text NOT NULL,
    "eventType" text NOT NULL,
    "stripeEventId" text NOT NULL,
    metadata jsonb,
    "processedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AdminWalletIdempotencyKey AdminWalletIdempotencyKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminWalletIdempotencyKey"
    ADD CONSTRAINT "AdminWalletIdempotencyKey_pkey" PRIMARY KEY (key);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AvailabilityException AvailabilityException_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AvailabilityException"
    ADD CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY (id);


--
-- Name: BookingIdempotencyKey BookingIdempotencyKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BookingIdempotencyKey"
    ADD CONSTRAINT "BookingIdempotencyKey_pkey" PRIMARY KEY (key);


--
-- Name: Booking Booking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_pkey" PRIMARY KEY (id);


--
-- Name: BusinessAIConfig BusinessAIConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessAIConfig"
    ADD CONSTRAINT "BusinessAIConfig_pkey" PRIMARY KEY (id);


--
-- Name: BusinessBranding BusinessBranding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessBranding"
    ADD CONSTRAINT "BusinessBranding_pkey" PRIMARY KEY (id);


--
-- Name: BusinessCapabilities BusinessCapabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessCapabilities"
    ADD CONSTRAINT "BusinessCapabilities_pkey" PRIMARY KEY (id);


--
-- Name: BusinessDomain BusinessDomain_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessDomain"
    ADD CONSTRAINT "BusinessDomain_pkey" PRIMARY KEY (id);


--
-- Name: BusinessService BusinessService_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessService"
    ADD CONSTRAINT "BusinessService_pkey" PRIMARY KEY (id);


--
-- Name: BusinessSettings BusinessSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessSettings"
    ADD CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY (id);


--
-- Name: BusinessTerminology BusinessTerminology_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessTerminology"
    ADD CONSTRAINT "BusinessTerminology_pkey" PRIMARY KEY (id);


--
-- Name: BusinessWebsite BusinessWebsite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessWebsite"
    ADD CONSTRAINT "BusinessWebsite_pkey" PRIMARY KEY (id);


--
-- Name: Business Business_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Business"
    ADD CONSTRAINT "Business_pkey" PRIMARY KEY (id);


--
-- Name: CardOrder CardOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CardOrder"
    ADD CONSTRAINT "CardOrder_pkey" PRIMARY KEY (id);


--
-- Name: ClientWallet ClientWallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientWallet"
    ADD CONSTRAINT "ClientWallet_pkey" PRIMARY KEY (id);


--
-- Name: CronHealth CronHealth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CronHealth"
    ADD CONSTRAINT "CronHealth_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: DeviceToken DeviceToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeviceToken"
    ADD CONSTRAINT "DeviceToken_pkey" PRIMARY KEY (id);


--
-- Name: DrivingLessonOutcome DrivingLessonOutcome_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DrivingLessonOutcome"
    ADD CONSTRAINT "DrivingLessonOutcome_pkey" PRIMARY KEY (id);


--
-- Name: DrivingProviderProfile DrivingProviderProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DrivingProviderProfile"
    ADD CONSTRAINT "DrivingProviderProfile_pkey" PRIMARY KEY (id);


--
-- Name: FinancialLedger FinancialLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinancialLedger"
    ADD CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY (id);


--
-- Name: LearningContent LearningContent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningContent"
    ADD CONSTRAINT "LearningContent_pkey" PRIMARY KEY (id);


--
-- Name: LedgerEntry LedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: LoginDevice LoginDevice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoginDevice"
    ADD CONSTRAINT "LoginDevice_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PDAConfigTestCentre PDAConfigTestCentre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDAConfigTestCentre"
    ADD CONSTRAINT "PDAConfigTestCentre_pkey" PRIMARY KEY (id);


--
-- Name: PDATestBooking PDATestBooking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDATestBooking"
    ADD CONSTRAINT "PDATestBooking_pkey" PRIMARY KEY (id);


--
-- Name: PDATestConfig PDATestConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDATestConfig"
    ADD CONSTRAINT "PDATestConfig_pkey" PRIMARY KEY (id);


--
-- Name: PayoutTransaction PayoutTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayoutTransaction"
    ADD CONSTRAINT "PayoutTransaction_pkey" PRIMARY KEY (id);


--
-- Name: Payout Payout_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payout"
    ADD CONSTRAINT "Payout_pkey" PRIMARY KEY (id);


--
-- Name: PlatformLedger PlatformLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformLedger"
    ADD CONSTRAINT "PlatformLedger_pkey" PRIMARY KEY (id);


--
-- Name: PlatformRateChange PlatformRateChange_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformRateChange"
    ADD CONSTRAINT "PlatformRateChange_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSettings PlatformSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformSettings"
    ADD CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY (id);


--
-- Name: ProviderExpense ProviderExpense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderExpense"
    ADD CONSTRAINT "ProviderExpense_pkey" PRIMARY KEY (id);


--
-- Name: Provider Provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_pkey" PRIMARY KEY (id);


--
-- Name: Quote Quote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_pkey" PRIMARY KEY (id);


--
-- Name: ReconciliationReport ReconciliationReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReconciliationReport"
    ADD CONSTRAINT "ReconciliationReport_pkey" PRIMARY KEY (id);


--
-- Name: SlotReservation SlotReservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SlotReservation"
    ADD CONSTRAINT "SlotReservation_pkey" PRIMARY KEY (id);


--
-- Name: StaffMember StaffMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffMember"
    ADD CONSTRAINT "StaffMember_pkey" PRIMARY KEY (id);


--
-- Name: StripeDispute StripeDispute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StripeDispute"
    ADD CONSTRAINT "StripeDispute_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: TaskNote TaskNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskNote"
    ADD CONSTRAINT "TaskNote_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TestCentre TestCentre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestCentre"
    ADD CONSTRAINT "TestCentre_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: TwilioPhoneNumber TwilioPhoneNumber_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TwilioPhoneNumber"
    ADD CONSTRAINT "TwilioPhoneNumber_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WalletTransaction WalletTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY (id);


--
-- Name: WebhookEvent WebhookEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebhookEvent"
    ADD CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY (id);


--
-- Name: AdminWalletIdempotencyKey_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminWalletIdempotencyKey_expiresAt_idx" ON public."AdminWalletIdempotencyKey" USING btree ("expiresAt");


--
-- Name: AdminWalletIdempotencyKey_key_walletId_operationType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AdminWalletIdempotencyKey_key_walletId_operationType_key" ON public."AdminWalletIdempotencyKey" USING btree (key, "walletId", "operationType");


--
-- Name: AdminWalletIdempotencyKey_walletId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminWalletIdempotencyKey_walletId_idx" ON public."AdminWalletIdempotencyKey" USING btree ("walletId");


--
-- Name: AvailabilityException_providerId_exceptionDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AvailabilityException_providerId_exceptionDate_idx" ON public."AvailabilityException" USING btree ("providerId", "exceptionDate");


--
-- Name: BookingIdempotencyKey_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BookingIdempotencyKey_createdAt_idx" ON public."BookingIdempotencyKey" USING btree ("createdAt");


--
-- Name: BookingIdempotencyKey_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BookingIdempotencyKey_email_idx" ON public."BookingIdempotencyKey" USING btree (email);


--
-- Name: Booking_providerId_customerRating_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_providerId_customerRating_idx" ON public."Booking" USING btree ("providerId", "customerRating");


--
-- Name: BusinessAIConfig_businessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessAIConfig_businessId_key" ON public."BusinessAIConfig" USING btree ("businessId");


--
-- Name: BusinessBranding_businessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessBranding_businessId_key" ON public."BusinessBranding" USING btree ("businessId");


--
-- Name: BusinessBranding_customSlug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessBranding_customSlug_idx" ON public."BusinessBranding" USING btree ("customSlug");


--
-- Name: BusinessBranding_customSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessBranding_customSlug_key" ON public."BusinessBranding" USING btree ("customSlug");


--
-- Name: BusinessCapabilities_businessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessCapabilities_businessId_key" ON public."BusinessCapabilities" USING btree ("businessId");


--
-- Name: BusinessDomain_businessId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessDomain_businessId_idx" ON public."BusinessDomain" USING btree ("businessId");


--
-- Name: BusinessDomain_host_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessDomain_host_idx" ON public."BusinessDomain" USING btree (host);


--
-- Name: BusinessDomain_host_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessDomain_host_key" ON public."BusinessDomain" USING btree (host);


--
-- Name: BusinessDomain_verificationToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessDomain_verificationToken_key" ON public."BusinessDomain" USING btree ("verificationToken");


--
-- Name: BusinessDomain_verified_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessDomain_verified_idx" ON public."BusinessDomain" USING btree (verified);


--
-- Name: BusinessService_businessId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessService_businessId_isActive_idx" ON public."BusinessService" USING btree ("businessId", "isActive");


--
-- Name: BusinessService_businessId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessService_businessId_sortOrder_idx" ON public."BusinessService" USING btree ("businessId", "sortOrder");


--
-- Name: BusinessSettings_businessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessSettings_businessId_key" ON public."BusinessSettings" USING btree ("businessId");


--
-- Name: BusinessTerminology_businessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessTerminology_businessId_key" ON public."BusinessTerminology" USING btree ("businessId");


--
-- Name: BusinessWebsite_businessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessWebsite_businessId_key" ON public."BusinessWebsite" USING btree ("businessId");


--
-- Name: Business_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Business_isActive_idx" ON public."Business" USING btree ("isActive");


--
-- Name: Business_paymentModel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Business_paymentModel_idx" ON public."Business" USING btree ("paymentModel");


--
-- Name: Business_subscriptionTier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Business_subscriptionTier_idx" ON public."Business" USING btree ("subscriptionTier");


--
-- Name: CardOrder_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CardOrder_providerId_idx" ON public."CardOrder" USING btree ("providerId");


--
-- Name: CardOrder_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CardOrder_status_idx" ON public."CardOrder" USING btree (status);


--
-- Name: ClientWallet_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ClientWallet_userId_key" ON public."ClientWallet" USING btree ("userId");


--
-- Name: CronHealth_jobName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CronHealth_jobName_idx" ON public."CronHealth" USING btree ("jobName");


--
-- Name: CronHealth_jobName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CronHealth_jobName_key" ON public."CronHealth" USING btree ("jobName");


--
-- Name: DeviceToken_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeviceToken_active_idx" ON public."DeviceToken" USING btree (active);


--
-- Name: DeviceToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeviceToken_token_key" ON public."DeviceToken" USING btree (token);


--
-- Name: DeviceToken_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeviceToken_userId_idx" ON public."DeviceToken" USING btree ("userId");


--
-- Name: DrivingLessonOutcome_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DrivingLessonOutcome_bookingId_idx" ON public."DrivingLessonOutcome" USING btree ("bookingId");


--
-- Name: DrivingLessonOutcome_bookingId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DrivingLessonOutcome_bookingId_key" ON public."DrivingLessonOutcome" USING btree ("bookingId");


--
-- Name: DrivingProviderProfile_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DrivingProviderProfile_providerId_idx" ON public."DrivingProviderProfile" USING btree ("providerId");


--
-- Name: DrivingProviderProfile_providerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DrivingProviderProfile_providerId_key" ON public."DrivingProviderProfile" USING btree ("providerId");


--
-- Name: FinancialLedger_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancialLedger_bookingId_idx" ON public."FinancialLedger" USING btree ("bookingId");


--
-- Name: FinancialLedger_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancialLedger_createdAt_idx" ON public."FinancialLedger" USING btree ("createdAt");


--
-- Name: FinancialLedger_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinancialLedger_idempotencyKey_key" ON public."FinancialLedger" USING btree ("idempotencyKey");


--
-- Name: FinancialLedger_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancialLedger_providerId_idx" ON public."FinancialLedger" USING btree ("providerId");


--
-- Name: FinancialLedger_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancialLedger_userId_idx" ON public."FinancialLedger" USING btree ("userId");


--
-- Name: LoginDevice_lastUsedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginDevice_lastUsedAt_idx" ON public."LoginDevice" USING btree ("lastUsedAt");


--
-- Name: LoginDevice_userId_fingerprint_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LoginDevice_userId_fingerprint_key" ON public."LoginDevice" USING btree ("userId", fingerprint);


--
-- Name: LoginDevice_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginDevice_userId_idx" ON public."LoginDevice" USING btree ("userId");


--
-- Name: PDAConfigTestCentre_pdaConfigId_testCentreId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PDAConfigTestCentre_pdaConfigId_testCentreId_key" ON public."PDAConfigTestCentre" USING btree ("pdaConfigId", "testCentreId");


--
-- Name: PDAConfigTestCentre_testCentreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDAConfigTestCentre_testCentreId_idx" ON public."PDAConfigTestCentre" USING btree ("testCentreId");


--
-- Name: PDATestBooking_configId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDATestBooking_configId_idx" ON public."PDATestBooking" USING btree ("configId");


--
-- Name: PDATestBooking_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDATestBooking_customerId_idx" ON public."PDATestBooking" USING btree ("customerId");


--
-- Name: PDATestBooking_providerId_testDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDATestBooking_providerId_testDate_idx" ON public."PDATestBooking" USING btree ("providerId", "testDate");


--
-- Name: PDATestBooking_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDATestBooking_status_idx" ON public."PDATestBooking" USING btree (status);


--
-- Name: PDATestBooking_testCentreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDATestBooking_testCentreId_idx" ON public."PDATestBooking" USING btree ("testCentreId");


--
-- Name: PDATestConfig_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDATestConfig_isActive_idx" ON public."PDATestConfig" USING btree ("isActive");


--
-- Name: PDATestConfig_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PDATestConfig_providerId_idx" ON public."PDATestConfig" USING btree ("providerId");


--
-- Name: Payout_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON public."Payout" USING btree ("idempotencyKey");


--
-- Name: Payout_payoutRef_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payout_payoutRef_key" ON public."Payout" USING btree ("payoutRef");


--
-- Name: PlatformLedger_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PlatformLedger_key_key" ON public."PlatformLedger" USING btree (key);


--
-- Name: PlatformSettings_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PlatformSettings_key_key" ON public."PlatformSettings" USING btree (key);


--
-- Name: Provider_customSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Provider_customSlug_key" ON public."Provider" USING btree ("customSlug");


--
-- Name: Provider_state_suburb_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Provider_state_suburb_idx" ON public."Provider" USING btree (state, suburb);


--
-- Name: Provider_stripeCustomerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Provider_stripeCustomerId_key" ON public."Provider" USING btree ("stripeCustomerId");


--
-- Name: Provider_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Provider_userId_key" ON public."Provider" USING btree ("userId");


--
-- Name: Quote_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_bookingId_idx" ON public."Quote" USING btree ("bookingId");


--
-- Name: Quote_customerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_customerId_status_idx" ON public."Quote" USING btree ("customerId", status);


--
-- Name: Quote_providerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_providerId_status_idx" ON public."Quote" USING btree ("providerId", status);


--
-- Name: Quote_status_validUntil_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_status_validUntil_idx" ON public."Quote" USING btree (status, "validUntil");


--
-- Name: Quote_stripeSessionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Quote_stripeSessionId_key" ON public."Quote" USING btree ("stripeSessionId");


--
-- Name: SlotReservation_providerId_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SlotReservation_providerId_expiresAt_idx" ON public."SlotReservation" USING btree ("providerId", "expiresAt");


--
-- Name: SlotReservation_sessionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SlotReservation_sessionId_idx" ON public."SlotReservation" USING btree ("sessionId");


--
-- Name: StaffMember_department_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StaffMember_department_isActive_idx" ON public."StaffMember" USING btree (department, "isActive");


--
-- Name: StaffMember_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StaffMember_email_key" ON public."StaffMember" USING btree (email);


--
-- Name: StaffMember_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StaffMember_userId_key" ON public."StaffMember" USING btree ("userId");


--
-- Name: StripeDispute_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StripeDispute_bookingId_idx" ON public."StripeDispute" USING btree ("bookingId");


--
-- Name: StripeDispute_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StripeDispute_providerId_idx" ON public."StripeDispute" USING btree ("providerId");


--
-- Name: StripeDispute_stripeDisputeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StripeDispute_stripeDisputeId_key" ON public."StripeDispute" USING btree ("stripeDisputeId");


--
-- Name: StripeDispute_stripePaymentIntentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StripeDispute_stripePaymentIntentId_idx" ON public."StripeDispute" USING btree ("stripePaymentIntentId");


--
-- Name: Subscription_stripeSubscriptionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON public."Subscription" USING btree ("stripeSubscriptionId");


--
-- Name: TaskNote_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskNote_taskId_idx" ON public."TaskNote" USING btree ("taskId");


--
-- Name: Task_assignedToId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_assignedToId_idx" ON public."Task" USING btree ("assignedToId");


--
-- Name: Task_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_bookingId_idx" ON public."Task" USING btree ("bookingId");


--
-- Name: Task_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_providerId_idx" ON public."Task" USING btree ("providerId");


--
-- Name: Task_status_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_status_priority_idx" ON public."Task" USING btree (status, priority);


--
-- Name: TestCentre_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TestCentre_name_key" ON public."TestCentre" USING btree (name);


--
-- Name: TwilioPhoneNumber_assignedTo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TwilioPhoneNumber_assignedTo_idx" ON public."TwilioPhoneNumber" USING btree ("assignedTo");


--
-- Name: TwilioPhoneNumber_assignedTo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TwilioPhoneNumber_assignedTo_key" ON public."TwilioPhoneNumber" USING btree ("assignedTo");


--
-- Name: TwilioPhoneNumber_phoneNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TwilioPhoneNumber_phoneNumber_key" ON public."TwilioPhoneNumber" USING btree ("phoneNumber");


--
-- Name: TwilioPhoneNumber_sid_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TwilioPhoneNumber_sid_key" ON public."TwilioPhoneNumber" USING btree (sid);


--
-- Name: TwilioPhoneNumber_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TwilioPhoneNumber_status_idx" ON public."TwilioPhoneNumber" USING btree (status);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: WebhookEvent_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON public."WebhookEvent" USING btree ("idempotencyKey");


--
-- Name: Booking Booking_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Booking Booking_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BusinessAIConfig BusinessAIConfig_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessAIConfig"
    ADD CONSTRAINT "BusinessAIConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessBranding BusinessBranding_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessBranding"
    ADD CONSTRAINT "BusinessBranding_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessCapabilities BusinessCapabilities_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessCapabilities"
    ADD CONSTRAINT "BusinessCapabilities_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessDomain BusinessDomain_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessDomain"
    ADD CONSTRAINT "BusinessDomain_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessService BusinessService_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessService"
    ADD CONSTRAINT "BusinessService_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessSettings BusinessSettings_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessSettings"
    ADD CONSTRAINT "BusinessSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessTerminology BusinessTerminology_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessTerminology"
    ADD CONSTRAINT "BusinessTerminology_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessWebsite BusinessWebsite_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessWebsite"
    ADD CONSTRAINT "BusinessWebsite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CardOrder CardOrder_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CardOrder"
    ADD CONSTRAINT "CardOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClientWallet ClientWallet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientWallet"
    ADD CONSTRAINT "ClientWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Customer Customer_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DeviceToken DeviceToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LoginDevice LoginDevice_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoginDevice"
    ADD CONSTRAINT "LoginDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PDAConfigTestCentre PDAConfigTestCentre_pdaConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDAConfigTestCentre"
    ADD CONSTRAINT "PDAConfigTestCentre_pdaConfigId_fkey" FOREIGN KEY ("pdaConfigId") REFERENCES public."PDATestConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PDAConfigTestCentre PDAConfigTestCentre_testCentreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDAConfigTestCentre"
    ADD CONSTRAINT "PDAConfigTestCentre_testCentreId_fkey" FOREIGN KEY ("testCentreId") REFERENCES public."TestCentre"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PDATestBooking PDATestBooking_configId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDATestBooking"
    ADD CONSTRAINT "PDATestBooking_configId_fkey" FOREIGN KEY ("configId") REFERENCES public."PDATestConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PDATestBooking PDATestBooking_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDATestBooking"
    ADD CONSTRAINT "PDATestBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PDATestBooking PDATestBooking_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDATestBooking"
    ADD CONSTRAINT "PDATestBooking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PDATestBooking PDATestBooking_testCentreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDATestBooking"
    ADD CONSTRAINT "PDATestBooking_testCentreId_fkey" FOREIGN KEY ("testCentreId") REFERENCES public."TestCentre"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PDATestConfig PDATestConfig_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PDATestConfig"
    ADD CONSTRAINT "PDATestConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PayoutTransaction PayoutTransaction_payoutId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayoutTransaction"
    ADD CONSTRAINT "PayoutTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES public."Payout"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PayoutTransaction PayoutTransaction_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayoutTransaction"
    ADD CONSTRAINT "PayoutTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProviderExpense ProviderExpense_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderExpense"
    ADD CONSTRAINT "ProviderExpense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Provider Provider_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Quote Quote_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Quote Quote_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Quote Quote_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SlotReservation SlotReservation_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SlotReservation"
    ADD CONSTRAINT "SlotReservation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StaffMember StaffMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffMember"
    ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskNote TaskNote_staffId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskNote"
    ADD CONSTRAINT "TaskNote_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES public."StaffMember"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskNote TaskNote_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskNote"
    ADD CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."StaffMember"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Transaction Transaction_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TwilioPhoneNumber TwilioPhoneNumber_assignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TwilioPhoneNumber"
    ADD CONSTRAINT "TwilioPhoneNumber_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES public."Provider"(id) ON DELETE SET NULL;


--
-- Name: WalletTransaction WalletTransaction_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."ClientWallet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


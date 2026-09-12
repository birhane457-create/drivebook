-- ============================================================
-- Phase 6 Fix 3: Booking.instructorId → providerId
--               Booking.instructorPayout → providerPayout
-- ============================================================
-- Run AFTER: npx prisma migrate dev --name phase6_booking_provider
-- Run in a transaction.
-- ============================================================

BEGIN;

-- 1. Rename the FK column
ALTER TABLE "Booking" RENAME COLUMN "instructorId"   TO "providerId";

-- 2. Rename the payout column
ALTER TABLE "Booking" RENAME COLUMN "instructorPayout" TO "providerPayout";

-- 3. Rename the composite index
ALTER INDEX IF EXISTS "Booking_instructorId_customerRating_idx"
  RENAME TO "Booking_providerId_customerRating_idx";

COMMIT;

-- ============================================================
-- ROLLBACK (reference only)
-- ============================================================
-- BEGIN;
-- ALTER TABLE "Booking" RENAME COLUMN "providerId"    TO "instructorId";
-- ALTER TABLE "Booking" RENAME COLUMN "providerPayout" TO "instructorPayout";
-- COMMIT;

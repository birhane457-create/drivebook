-- ============================================================
-- Phase 6 Fix 2: Rename Client → Customer
-- ============================================================
-- Run AFTER: npx prisma migrate dev --name phase6_customer_rename
-- This SQL handles the data-level renames Prisma won't do automatically.
--
-- Run in a transaction so all steps succeed or none do.
-- ============================================================

BEGIN;

-- 1. Rename the Client table → Customer
ALTER TABLE "Client" RENAME TO "Customer";

-- 2. Rename the hard FK column (instructorId → removed, businessId added)
--    Drop the old instructorId FK constraint first
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "instructorId";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "preferredInstructorId";

-- 3. Add new generic columns
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "businessId"          TEXT,
  ADD COLUMN IF NOT EXISTS "preferredProviderId" TEXT;

-- 4. Update Booking — clientId → customerId
ALTER TABLE "Booking" RENAME COLUMN "clientId"    TO "customerId";
ALTER TABLE "Booking" RENAME COLUMN "clientName"  TO "customerName";
ALTER TABLE "Booking" RENAME COLUMN "clientPhone" TO "customerPhone";
ALTER TABLE "Booking" RENAME COLUMN "clientEmail" TO "customerEmail";
ALTER TABLE "Booking" RENAME COLUMN "clientRating" TO "customerRating";
ALTER TABLE "Booking" RENAME COLUMN "clientReview" TO "customerReview";

-- 5. Update PDATestBooking — clientId → customerId (already done in Fix 1 SQL,
--    but guard with IF EXISTS in case migration order varies)
ALTER TABLE "PDATestBooking" RENAME COLUMN IF EXISTS "clientId" TO "customerId";

-- 6. Update Task — clientId → customerId
ALTER TABLE "Task" RENAME COLUMN IF EXISTS "clientId" TO "customerId";

-- 7. Rename index on Booking
ALTER INDEX IF EXISTS "Booking_instructorId_clientRating_idx"
  RENAME TO "Booking_instructorId_customerRating_idx";

COMMIT;

-- ============================================================
-- ROLLBACK (reference only)
-- ============================================================
-- BEGIN;
-- ALTER TABLE "Customer" RENAME TO "Client";
-- ALTER TABLE "Client" ADD COLUMN "instructorId" TEXT NOT NULL DEFAULT '';
-- ALTER TABLE "Client" ADD COLUMN "preferredInstructorId" TEXT;
-- ALTER TABLE "Client" DROP COLUMN IF EXISTS "businessId";
-- ALTER TABLE "Client" DROP COLUMN IF EXISTS "preferredProviderId";
-- ALTER TABLE "Booking" RENAME COLUMN "customerId"    TO "clientId";
-- ALTER TABLE "Booking" RENAME COLUMN "customerName"  TO "clientName";
-- ALTER TABLE "Booking" RENAME COLUMN "customerPhone" TO "clientPhone";
-- ALTER TABLE "Booking" RENAME COLUMN "customerEmail" TO "clientEmail";
-- ALTER TABLE "Booking" RENAME COLUMN "customerRating" TO "clientRating";
-- ALTER TABLE "Booking" RENAME COLUMN "customerReview" TO "clientReview";
-- COMMIT;

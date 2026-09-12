-- ============================================================
-- Phase 6 Fix 1: Rename Instructor → Provider
-- ============================================================
-- Run AFTER: npx prisma migrate dev --name phase6_provider_rename
-- This SQL handles the data-level renames that Prisma migration
-- will NOT do automatically (it would DROP + CREATE instead).
--
-- Run in a transaction so all steps succeed or none do.
-- ============================================================

BEGIN;

-- 1. Rename the Instructor table → Provider
ALTER TABLE "Instructor" RENAME TO "Provider";

-- 2. Rename FK column on User
ALTER TABLE "User" RENAME COLUMN "instructorId" TO "providerId";

-- 3. Rename FK column on Booking (done in Fix 3 migration, but listed here for reference)
-- ALTER TABLE "Booking" RENAME COLUMN "instructorId" TO "providerId";

-- 4. Rename FK column on InstructorExpense table → ProviderExpense
ALTER TABLE "InstructorExpense" RENAME TO "ProviderExpense";
ALTER TABLE "ProviderExpense" RENAME COLUMN "instructorId" TO "providerId";

-- 5. Rename FK column on SlotReservation
ALTER TABLE "SlotReservation" RENAME COLUMN "instructorId" TO "providerId";

-- 6. Rename FK column on Subscription
ALTER TABLE "Subscription" RENAME COLUMN "instructorId" TO "providerId";

-- 7. Rename FK column on CardOrder
ALTER TABLE "CardOrder" RENAME COLUMN "instructorId" TO "providerId";

-- 8. Rename FK column on PDATestConfig
ALTER TABLE "PDATestConfig" RENAME COLUMN "instructorId" TO "providerId";

-- 9. Rename FK column on PDATestBooking
ALTER TABLE "PDATestBooking" RENAME COLUMN "instructorId" TO "providerId";

-- 10. Add driving-specific columns to DrivingProviderProfile
--     (moved from Provider/Instructor — only if not already there)
ALTER TABLE "DrivingProviderProfile"
  ADD COLUMN IF NOT EXISTS "voiceLine"       TEXT,
  ADD COLUMN IF NOT EXISTS "voiceLineStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "voiceLineSid"    TEXT,
  ADD COLUMN IF NOT EXISTS "lessonPackages"  JSONB;

-- 11. Migrate voice line data from Provider → DrivingProviderProfile
--     (only where a DrivingProviderProfile record already exists)
UPDATE "DrivingProviderProfile" dp
SET
  "voiceLine"       = p."voiceLine",
  "voiceLineStatus" = p."voiceLineStatus",
  "voiceLineSid"    = p."voiceLineSid",
  "lessonPackages"  = p."lessonPackages"
FROM "Provider" p
WHERE dp."providerId" = p."id"
  AND (p."voiceLine" IS NOT NULL OR p."lessonPackages" IS NOT NULL);

-- 12. Drop the now-migrated columns from Provider
ALTER TABLE "Provider"
  DROP COLUMN IF EXISTS "voiceLine",
  DROP COLUMN IF EXISTS "voiceLineStatus",
  DROP COLUMN IF EXISTS "voiceLineSid",
  DROP COLUMN IF EXISTS "lessonPackages",
  DROP COLUMN IF EXISTS "carImage",
  DROP COLUMN IF EXISTS "vehicleTypes";

-- 13. Rename index on Provider (was on Instructor)
ALTER INDEX IF EXISTS "Instructor_state_suburb_idx" RENAME TO "Provider_state_suburb_idx";

COMMIT;

-- ============================================================
-- ROLLBACK (keep for reference — do NOT run unless reverting)
-- ============================================================
-- BEGIN;
-- ALTER TABLE "Provider" RENAME TO "Instructor";
-- ALTER TABLE "User" RENAME COLUMN "providerId" TO "instructorId";
-- ALTER TABLE "ProviderExpense" RENAME TO "InstructorExpense";
-- ALTER TABLE "InstructorExpense" RENAME COLUMN "providerId" TO "instructorId";
-- ALTER TABLE "SlotReservation" RENAME COLUMN "providerId" TO "instructorId";
-- ALTER TABLE "Subscription" RENAME COLUMN "providerId" TO "instructorId";
-- ALTER TABLE "CardOrder" RENAME COLUMN "providerId" TO "instructorId";
-- ALTER TABLE "PDATestConfig" RENAME COLUMN "providerId" TO "instructorId";
-- ALTER TABLE "PDATestBooking" RENAME COLUMN "providerId" TO "instructorId";
-- COMMIT;

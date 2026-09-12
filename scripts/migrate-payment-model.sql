-- ============================================================
-- Phase 6 Fix 4: Add paymentModel to Business
--               Add wallet/payouts/commission to BusinessCapabilities
-- ============================================================
-- Run AFTER: npx prisma migrate dev --name phase6_payment_model
-- This migration is purely additive — no data is destroyed.
-- ============================================================

BEGIN;

-- 1. Add paymentModel to Business
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "paymentModel" TEXT NOT NULL DEFAULT 'saas';

-- 2. Add payment model capability flags to BusinessCapabilities
ALTER TABLE "BusinessCapabilities"
  ADD COLUMN IF NOT EXISTS "wallet"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payouts"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "commission" BOOLEAN NOT NULL DEFAULT false;

-- 3. For any existing driving/marketplace businesses, set the flags correctly.
--    Identify marketplace businesses by their templateSlug.
--    Adjust the WHERE clause to match your actual driving school data.
UPDATE "Business"
SET "paymentModel" = 'marketplace'
WHERE "templateSlug" = 'driving';

UPDATE "BusinessCapabilities" bc
SET
  "wallet"     = true,
  "payouts"    = true,
  "commission" = true
FROM "Business" b
WHERE bc."businessId" = b.id
  AND b."paymentModel" = 'marketplace';

-- 4. Add index on paymentModel for reporting queries
CREATE INDEX IF NOT EXISTS "Business_paymentModel_idx"
  ON "Business" ("paymentModel");

COMMIT;

-- ============================================================
-- ROLLBACK (reference only)
-- ============================================================
-- BEGIN;
-- ALTER TABLE "Business" DROP COLUMN IF EXISTS "paymentModel";
-- ALTER TABLE "BusinessCapabilities"
--   DROP COLUMN IF EXISTS "wallet",
--   DROP COLUMN IF EXISTS "payouts",
--   DROP COLUMN IF EXISTS "commission";
-- COMMIT;

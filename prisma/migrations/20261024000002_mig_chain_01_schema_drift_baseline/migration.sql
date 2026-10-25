-- MIG-CHAIN-01 SCHEMA DRIFT BASELINE
-- Generated from: prisma migrate diff --from-url <deployed-db> --to-schema-datamodel prisma/schema.prisma
-- This migration reconciles the schema drift between the migration chain and the
-- current Prisma schema. All statements are the authoritative output of Prisma's
-- own diff tool against a clean PostgreSQL 16 database after running all 37 migrations.
--
-- Date: 2026-10-24
-- Source: docs/audit/MIG-CHAIN-01-prisma-diff.sql

-- DropIndex (was added by baseline v1 error; not in Prisma schema)
DROP INDEX IF EXISTS "PDATestBooking_parentBookingId_idx";

-- AlterTable: fix timestamp column types (Prisma schema uses TIMESTAMP(3))
ALTER TABLE "Booking"
  ALTER COLUMN "cancellationRequestedAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "adminReviewedAt"         SET DATA TYPE TIMESTAMP(3);

-- AlterTable: Customer.status — added via db push, missing from migrations
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable: Provider — remove columns added by baseline v1 error that are not in schema
--   paymentModel and voiceLineStatus are on DrivingProviderProfile, not Provider
--   withholdingTaxRate needs correct Decimal type
ALTER TABLE "Provider"
  DROP COLUMN IF EXISTS "paymentModel",
  DROP COLUMN IF EXISTS "voiceLineStatus",
  ALTER COLUMN "withholdingTaxRate" SET DATA TYPE DECIMAL(5,2);

-- AlterTable: StaffMember — remove columns added by baseline v1 error that are not in schema
ALTER TABLE "StaffMember"
  DROP COLUMN IF EXISTS "reason",
  DROP COLUMN IF EXISTS "wallet";

-- AlterTable: Subscription — remove checkoutGeneration (not in schema); add metadata
ALTER TABLE "Subscription"
  DROP COLUMN IF EXISTS "checkoutGeneration",
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "lastWebhookEventId"        TEXT,
  ADD COLUMN IF NOT EXISTS "lastWebhookEventTimestamp" INTEGER;

-- AlterTable: Provider — add businessModel, stripeSubscriptionId
ALTER TABLE "Provider"
  ADD COLUMN IF NOT EXISTS "businessModel"       TEXT NOT NULL DEFAULT 'SAAS',
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

-- AlterTable: PlatformSettings — add packageTiers
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "packageTiers" JSONB;

-- CreateIndex: Provider_stripeCustomerId_key (from SUB-06-A, may already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Provider_stripeCustomerId_key') THEN
    CREATE UNIQUE INDEX "Provider_stripeCustomerId_key" ON "Provider"("stripeCustomerId");
  END IF;
END $$;

-- CreateIndex: Subscription_stripeSubscriptionId_key (from SUB-06-A, may already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Subscription_stripeSubscriptionId_key') THEN
    CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
  END IF;
END $$;

-- CreateIndex: WalletTransaction stripePaymentIntentId unique (prevents double-credit P0-01B)
-- This was added via db push migration 20260911000000; must be present for webhook idempotency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'WalletTransaction_stripePaymentIntentId_unique'
  ) THEN
    CREATE UNIQUE INDEX "WalletTransaction_stripePaymentIntentId_unique"
      ON "WalletTransaction" (((metadata ->> 'stripePaymentIntentId'::text)))
      WHERE ((metadata ->> 'stripePaymentIntentId'::text) IS NOT NULL);
  END IF;
END $$;

-- RenameIndex: AdminWalletIdempotencyKey composite unique index (old name → new name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AdminWalletIdempotencyKey_key_walletId_opType_key') THEN
    ALTER INDEX "AdminWalletIdempotencyKey_key_walletId_opType_key"
      RENAME TO "AdminWalletIdempotencyKey_key_walletId_operationType_key";
  END IF;
END $$;

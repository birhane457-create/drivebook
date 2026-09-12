-- ============================================================
-- Quote System Migration
-- Adds: Quote model, request/quote booking status values,
--       job request fields on Booking
-- Run: npx prisma migrate dev --name add_quote_system
-- ============================================================

BEGIN;

-- 1. Create the Quote table
CREATE TABLE IF NOT EXISTS "Quote" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "bookingId"             TEXT NOT NULL,
  "providerId"            TEXT NOT NULL,
  "customerId"            TEXT NOT NULL,
  "amount"                DOUBLE PRECISION NOT NULL,
  "description"           TEXT NOT NULL,
  "lineItems"             JSONB NOT NULL DEFAULT '[]',
  "validUntil"            TIMESTAMPTZ NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'PENDING',
  "acceptedAt"            TIMESTAMPTZ,
  "declinedAt"            TIMESTAMPTZ,
  "declineReason"         TEXT,
  "stripeSessionId"       TEXT UNIQUE,
  "stripePaymentIntentId" TEXT,
  "depositPercent"        DOUBLE PRECISION,
  "depositAmount"         DOUBLE PRECISION,
  "depositPaid"           BOOLEAN NOT NULL DEFAULT false,
  "customerNotes"         TEXT,
  "internalNotes"         TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Quote_bookingId_fkey"
    FOREIGN KEY ("bookingId")  REFERENCES "Booking"("id")  ON DELETE CASCADE,
  CONSTRAINT "Quote_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id"),
  CONSTRAINT "Quote_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
);

CREATE INDEX IF NOT EXISTS "Quote_bookingId_idx"       ON "Quote" ("bookingId");
CREATE INDEX IF NOT EXISTS "Quote_provider_status_idx" ON "Quote" ("providerId", "status");
CREATE INDEX IF NOT EXISTS "Quote_customer_status_idx" ON "Quote" ("customerId", "status");
CREATE INDEX IF NOT EXISTS "Quote_status_expiry_idx"   ON "Quote" ("status", "validUntil");

-- 2. Add job request fields to Booking
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "serviceId"          TEXT,
  ADD COLUMN IF NOT EXISTS "requestDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedAt"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "preferredDate"      TEXT,
  ADD COLUMN IF NOT EXISTS "siteAddress"        TEXT,
  ADD COLUMN IF NOT EXISTS "siteAddressLat"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "siteAddressLng"     DOUBLE PRECISION;

COMMIT;

-- ============================================================
-- ROLLBACK (reference only)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS "Quote";
-- ALTER TABLE "Booking"
--   DROP COLUMN IF EXISTS "serviceId",
--   DROP COLUMN IF EXISTS "requestDescription",
--   DROP COLUMN IF EXISTS "requestedAt",
--   DROP COLUMN IF EXISTS "preferredDate",
--   DROP COLUMN IF EXISTS "siteAddress",
--   DROP COLUMN IF EXISTS "siteAddressLat",
--   DROP COLUMN IF EXISTS "siteAddressLng";
-- COMMIT;

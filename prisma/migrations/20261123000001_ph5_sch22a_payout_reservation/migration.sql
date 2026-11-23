-- PH5-SCH-22a Phase 1: Durable payout reservation
-- 
-- Adds three fields to Payout for tracking in-flight fund reservations, and one
-- field to PlatformLedger to aggregate all active reservations.
--
-- These columns support the reservation lifecycle:
--   reservePayoutFunds()       stamps reservedAt/Amount/Id and increments totalPayoutReserved
--   commitPayoutCompletion()   clears reservation fields and moves amount to totalPaidOut
--   releasePayoutReservation() clears reservation fields and decrements totalPayoutReserved
--
-- The unique index on reservationId prevents double-reservation on idempotent retries.

-- Payout: reservation stamp fields
ALTER TABLE "Payout"
  ADD COLUMN "reservedAt"     TIMESTAMP(3),
  ADD COLUMN "reservedAmount" DECIMAL(12,2),
  ADD COLUMN "reservationId"  TEXT;

-- reservationId must be unique when set (NULL values are excluded from unique indexes in PostgreSQL)
CREATE UNIQUE INDEX "Payout_reservationId_key" ON "Payout"("reservationId");

-- PlatformLedger: running total of all active reservations
-- Default 0 — existing row is updated in-place; no data migration required.
ALTER TABLE "PlatformLedger"
  ADD COLUMN "totalPayoutReserved" DECIMAL(12,2) NOT NULL DEFAULT 0;

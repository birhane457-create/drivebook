-- PH5-SCH-22a Phase 1: Recovery claim lease fields
--
-- Adds two columns to Payout for exclusive recovery ownership.
-- These are separate from the financial reservation fields (reservedAt,
-- reservedAmount, reservationId) so that a failed recovery attempt can
-- release its claim without touching the financial reservation.
--
-- recoveryClaimToken    — unique token identifying the worker that currently
--                         owns recovery for this payout. NULL = no active claim.
-- recoveryClaimExpiresAt — when the claim expires, allowing another worker to
--                         take over if the original worker crashed.
--
-- Acquisition condition (enforced in code, not a DB constraint):
--   recoveryClaimToken IS NULL OR recoveryClaimExpiresAt < now()
-- This is evaluated inside a SELECT FOR UPDATE transaction so it is atomic.

ALTER TABLE "Payout"
  ADD COLUMN "recoveryClaimToken"     TEXT,
  ADD COLUMN "recoveryClaimExpiresAt" TIMESTAMP(3);

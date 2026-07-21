-- Migration: add accountType and paymentMode to Instructor
-- Foundation for BUSINESS white-label and Direct Charges (phase 2).
-- All existing accounts default to INDIVIDUAL / PLATFORM — zero behaviour change.

ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "accountType" TEXT NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT NOT NULL DEFAULT 'PLATFORM';

-- Migration: add businessName to Instructor
-- BUSINESS tier: optional trading/school name shown instead of instructor personal name
-- on booking page, AI receptionist, SMS, and email communications.
-- Falls back to instructor.name when NULL.

ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "businessName" TEXT;

-- Migration: add_special_service_tracking
-- Adds fields to track which instructor service (lesson package, PDA test, etc.) was booked
-- Purpose: Track booking origin and for analytics/reporting

-- Add special service tracking columns to Booking table
ALTER TABLE "Booking" ADD COLUMN "specialServiceId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "specialServiceName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "specialServiceType" TEXT;

-- Create index for faster lookups by service type
CREATE INDEX "Booking_specialServiceType_idx" ON "Booking"("specialServiceType");

-- Backfill existing bookings with 'LESSON' as type (for backward compatibility)
UPDATE "Booking" SET "specialServiceType" = 'LESSON' WHERE "specialServiceType" IS NULL;

-- Note: specialServiceId and specialServiceName can be null for old bookings

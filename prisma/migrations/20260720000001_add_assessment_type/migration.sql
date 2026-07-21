-- Migration: add assessmentType, lessonTopics, passed to Booking
-- assessmentType: COACHING (default) | MOCK | OFFICIAL
-- Existing bookings default to COACHING — no behaviour change.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "assessmentType" TEXT NOT NULL DEFAULT 'COACHING';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "lessonTopics" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "passed" BOOLEAN;

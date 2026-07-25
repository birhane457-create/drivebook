-- Migration: add studioCommissionRate to PlatformSettings
-- Default 11% — between PRO (12%) and BUSINESS (10%)

ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "studioCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 11;

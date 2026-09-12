-- AddColumn: Add endTime to SlotReservation for proper overlap detection
-- Purpose: Store lesson end time to enable accurate range-based overlap detection
-- Impact: Enables proper collision detection when multiple users reserve overlapping slots
--
-- Migration strategy:
-- 1. Add column as TIMESTAMP(3) (nullable initially)
-- 2. Set existing records to expiresAt (safe since holds are auto-cleaned after 10 mins)
-- 3. Make column non-nullable via schema

ALTER TABLE "SlotReservation" ADD COLUMN "endTime" TIMESTAMP(3);

-- Backfill existing records with expiresAt value
-- (SlotReservations are temporary and auto-deleted, so safe to use expiresAt)
UPDATE "SlotReservation" SET "endTime" = "expiresAt" WHERE "endTime" IS NULL;

-- Make column non-nullable
ALTER TABLE "SlotReservation" ALTER COLUMN "endTime" SET NOT NULL;

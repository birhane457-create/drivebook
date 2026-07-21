-- Add discrete location fields to Instructor for SEO location pages.
-- suburb, state, postcode are extracted from baseAddress on settings save
-- and used to generate /driving-lessons/[state]/[suburb] pages.
-- Backfill is handled by: node scripts/backfill-instructor-locations.js

ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "suburb"   TEXT;
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "state"    TEXT;
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "postcode" TEXT;

-- Index for location-page queries: find all instructors in a given state+suburb
CREATE INDEX IF NOT EXISTS "Instructor_state_suburb_idx" ON "Instructor" ("state", "suburb");

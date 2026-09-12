-- Gap 13: Prevent duplicate reviews at the database level.
--
-- A plain UNIQUE constraint on "reviewGivenAt" won't work because the column
-- is nullable (NULL ≠ NULL in SQL, so multiple NULLs would be allowed anyway
-- and a non-null unique would wrongly block a booking from ever being reviewed).
--
-- The correct fix is a PARTIAL UNIQUE INDEX on (id) WHERE "reviewGivenAt" IS NOT NULL.
-- This means: among all bookings that have been reviewed, no two can share the
-- same booking id — i.e. each booking can only be reviewed once.
-- Bookings with reviewGivenAt = NULL (not yet reviewed) are excluded from the
-- uniqueness check, so the index does not interfere with unreviewed bookings.
--
-- Prisma does not support partial indexes declaratively, so this is a raw migration.
-- The application-level updateMany atomic guard (reviewGivenAt: null in WHERE clause)
-- remains as defence-in-depth.

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_review_once_idx"
  ON "Booking" ("id")
  WHERE "reviewGivenAt" IS NOT NULL;

-- Performance: speed up the aggregate rating recalculation query that runs after
-- every review POST (findMany where instructorId + clientRating IS NOT NULL).
CREATE INDEX IF NOT EXISTS "Booking_instructorId_clientRating_idx"
  ON "Booking" ("instructorId", "clientRating");

-- PAY-H-04: SlotReservation interval exclusion constraint
--
-- Installs btree_gist and adds an all-rows GiST exclusion constraint that
-- prevents two SlotReservation rows for the same provider from covering
-- overlapping [startTime, endTime) intervals.
--
-- Design rationale: docs/audit/PAY-H-04_INVESTIGATION.md
-- Prototype evidence: scripts/payh04-constraint-prototype.mjs (0f0b5cf8)
--
-- NO WHERE clause — partial predicates using NOW() are STABLE not IMMUTABLE
-- and cannot be used in index-based constraints.  Expired rows are handled
-- by synchronous targeted deletion in the application (Layer 1) before insert.
--
-- Boundary semantics preserved: tsrange with '[)' (half-open) means
-- [10:00, 11:00) and [11:00, 12:00) do NOT overlap.
--
-- Error surfaced by Prisma: PrismaClientUnknownRequestError
-- PostgreSQL error code in message: 23P01
-- Both paths must catch this and return HTTP 409.

-- Step 1: Install btree_gist if absent
-- (btree_gist enables combining equality operators with range operators in
--  a single GiST index — required for the mixed = / && constraint below)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 2: Add all-rows exclusion constraint
-- Two rows conflict iff they share the same providerId AND their
-- [startTime, endTime) half-open ranges overlap (tsrange WITH &&).
ALTER TABLE "SlotReservation"
ADD CONSTRAINT "SlotReservation_no_overlap"
EXCLUDE USING GIST (
  "providerId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
);

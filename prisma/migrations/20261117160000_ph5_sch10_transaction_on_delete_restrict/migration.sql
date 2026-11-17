-- PH5-SCH-10: Change Transaction.bookingId FK from ON DELETE CASCADE to ON DELETE RESTRICT
--
-- Purpose: Prevents financial records (Transaction) from being cascade-deleted
-- when a Booking is hard-deleted. The application uses soft-delete (deletedAt
-- timestamp) for Bookings, so this constraint change is safe — no production
-- code path calls booking.delete() or issues DELETE FROM "Booking".
--
-- Audit evidence:
--   - PHASE-5-SCHEMA-INTEGRITY-AUDIT.md, Finding PH5-SCH-10 (HIGH)
--   - Cascade chain confirmed: Customer DELETE → Booking DELETE → Transaction DELETE
--   - Source search confirmed zero production hard-delete paths (app/, lib/, scripts/)
--   - Soft-delete pattern (deletedAt) is the standard for all models
--
-- Risk: Low. No data changes. Only affects future DELETE operations on Booking.
-- Existing rows are unaffected. NULL bookingId values are not constrained by RESTRICT.

-- Drop the existing CASCADE constraint
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_bookingId_fkey";

-- Re-add with ON DELETE RESTRICT (ON UPDATE CASCADE unchanged)
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

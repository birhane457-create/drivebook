-- H-01 FIX: Add lockedDiscountMinHours to Booking
-- Stores the minimum qualifying hours threshold for the discount tier that
-- was in effect at package purchase time. Used by calculatePartialPackageRefund()
-- to re-evaluate tier eligibility on cancellation.
--
-- Nullable: null on legacy rows (predates this column). Null means the
-- discount is always retained — documented compatibility rule per
-- PACKAGE-ACCOUNTING-POLICY.md §4. This is the safe/generous interpretation
-- for existing customers.

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "lockedDiscountMinHours" DECIMAL(8,2);

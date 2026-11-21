-- Migration: WalletTransaction CREDIT unique index on stripePaymentIntentId
--
-- Prevents duplicate CONFIRMED CREDIT rows for the same Stripe PaymentIntent.
-- Applied to WalletTransaction rows that carry stripePaymentIntentId in their
-- JSON metadata. Rows without this key (PENDING rows, PLATFORM_FEE rows, legacy
-- rows) are not covered by this index and do not conflict.
--
-- This is a partial unique index on the extracted JSON scalar value.
-- The WHERE clause ensures only rows with the field set are covered.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'WalletTransaction_stripePaymentIntentId_unique'
  ) THEN
    CREATE UNIQUE INDEX "WalletTransaction_stripePaymentIntentId_unique"
      ON "WalletTransaction" ((metadata->>'stripePaymentIntentId'))
      WHERE (metadata->>'stripePaymentIntentId') IS NOT NULL;
  END IF;
END $$;

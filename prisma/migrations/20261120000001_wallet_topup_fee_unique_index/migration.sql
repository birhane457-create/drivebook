-- Migration: wallet top-up PLATFORM_FEE unique index
-- 
-- Prevents duplicate PLATFORM_FEE records when wallet-add and the Stripe
-- webhook both attempt to record the fee for the same PaymentIntent.
--
-- PLATFORM_FEE rows use metadata key 'platformFeeForPiId' (not 'stripePaymentIntentId')
-- to avoid conflicting with the CREDIT unique index which covers all rows
-- with metadata->>'stripePaymentIntentId' IS NOT NULL.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'WalletTransaction_platformFee_pi_unique'
  ) THEN
    CREATE UNIQUE INDEX "WalletTransaction_platformFee_pi_unique"
      ON "WalletTransaction" ("walletId", (metadata->>'platformFeeForPiId'))
      WHERE type = 'PLATFORM_FEE'
        AND (metadata->>'platformFeeForPiId') IS NOT NULL;
  END IF;
END $$;

-- Migration: wallet top-up PLATFORM_FEE unique index
-- 
-- Prevents duplicate PLATFORM_FEE records when wallet-add and the Stripe
-- webhook both attempt to record the fee for the same PaymentIntent.
--
-- The CREDIT row is already protected by:
--   WalletTransaction_stripePaymentIntentId_unique
--   ON "WalletTransaction" ((metadata->>'stripePaymentIntentId'))
--   WHERE (metadata->>'stripePaymentIntentId') IS NOT NULL
--
-- This migration adds equivalent protection for PLATFORM_FEE rows,
-- scoped by walletId to allow different wallets to have fee rows with
-- the same PI id (should not happen, but belt-and-braces).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'WalletTransaction_platformFee_pi_unique'
  ) THEN
    CREATE UNIQUE INDEX "WalletTransaction_platformFee_pi_unique"
      ON "WalletTransaction" ("walletId", (metadata->>'stripePaymentIntentId'))
      WHERE type = 'PLATFORM_FEE'
        AND (metadata->>'stripePaymentIntentId') IS NOT NULL;
  END IF;
END $$;

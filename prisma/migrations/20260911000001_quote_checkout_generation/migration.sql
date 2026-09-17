-- MM-10-B: Add checkoutGeneration to Quote
-- Supports generation-based Stripe idempotency keys: scs-{quoteId}-{checkoutGeneration}
-- Non-breaking: existing rows default to 1 (their first checkout attempt generation).
ALTER TABLE "Quote" ADD COLUMN "checkoutGeneration" INTEGER NOT NULL DEFAULT 1;

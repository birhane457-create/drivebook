-- P0-01B: Add unique constraint on stripePaymentIntentId to prevent concurrent double-credit
-- This blocks two simultaneous requests from crediting the same PaymentIntent twice

-- Create unique index on the JSON field metadata->>'stripePaymentIntentId'
-- This provides database-level enforcement (foolproof vs application-level check)
CREATE UNIQUE INDEX "WalletTransaction_stripePaymentIntentId_unique" 
ON "WalletTransaction" ((metadata->>'stripePaymentIntentId'))
WHERE (metadata->>'stripePaymentIntentId') IS NOT NULL;

-- Note: The WHERE clause ensures we only index non-null payment intents
-- This allows other wallet transactions (manual credits, deducts) without stripePaymentIntentId

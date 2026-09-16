-- SUB-22 Step 5: Enforce one current subscription per provider
-- 
-- This migration creates a partial unique index to prevent duplicate
-- TRIAL/ACTIVE/PAST_DUE subscriptions for the same provider.
-- 
-- Historical EXPIRED/CANCELLED subscriptions remain unaffected (one-to-many preserved).

-- Pre-migration validation: Ensure no duplicate current subscriptions exist
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "providerId"
    FROM "Subscription"
    WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
    GROUP BY "providerId"
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Migration blocked: % provider(s) have duplicate current subscriptions. Run duplicate cleanup first.', duplicate_count;
  END IF;
  
  RAISE NOTICE 'Pre-migration validation passed: No duplicate current subscriptions found';
END $$;

-- Create partial unique index: one current subscription per provider
-- Note: CONCURRENTLY removed because Prisma runs migrations in transactions
-- With only 19 subscriptions, lock duration will be negligible
CREATE UNIQUE INDEX "Subscription_provider_current_unique"
ON "Subscription"("providerId")
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

-- Optional: Also enforce Stripe subscription ID uniqueness
-- Prevents the same Stripe subscription from being linked to multiple local rows
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_unique"
ON "Subscription"("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;

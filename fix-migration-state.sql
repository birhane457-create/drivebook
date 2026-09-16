-- Fix stuck Prisma migration state and apply SUB-22 indexes

-- Step 1: Release any advisory locks (if stuck)
SELECT pg_advisory_unlock_all();

-- Step 2: Check current migration state
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20260916131858_sub22_unique_current_subscription';

-- Step 3: Delete the failed migration record so we can retry
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260916131858_sub22_unique_current_subscription';

-- Step 4: Pre-migration validation (same as in migration file)
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
    RAISE EXCEPTION 'Migration blocked: % provider(s) have duplicate current subscriptions', duplicate_count;
  END IF;
  
  RAISE NOTICE 'Validation passed: No duplicate current subscriptions found';
END $$;

-- Step 5: Create the indexes (non-CONCURRENTLY since we're in a manual script)
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_provider_current_unique"
ON "Subscription"("providerId")
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_unique"
ON "Subscription"("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;

-- Step 6: Verify indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'Subscription' 
  AND indexname LIKE '%unique%'
ORDER BY indexname;

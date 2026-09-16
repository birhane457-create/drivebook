-- Final production state check after SUB-22 migration

-- 1. Verify both unique indexes exist with correct predicates
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'Subscription' 
  AND indexname IN ('Subscription_provider_current_unique', 'Subscription_stripeSubscriptionId_unique')
ORDER BY indexname;

-- 2. Count current subscriptions (should be clean, no duplicates)
SELECT 
    status,
    COUNT(*) as count
FROM "Subscription"
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
GROUP BY status
ORDER BY status;

-- 3. Verify no provider has multiple current subscriptions
SELECT 
    COUNT(DISTINCT "providerId") as providers_with_current_subscription,
    SUM(CASE WHEN status IN ('TRIAL', 'ACTIVE', 'PAST_DUE') THEN 1 ELSE 0 END) as total_current_subscriptions
FROM "Subscription";

-- 4. Check for any duplicate Stripe IDs (should be 0)
SELECT 
    "stripeSubscriptionId",
    COUNT(*) as count
FROM "Subscription"
WHERE "stripeSubscriptionId" IS NOT NULL
GROUP BY "stripeSubscriptionId"
HAVING COUNT(*) > 1;

-- 5. Check migration record
SELECT 
    migration_name,
    finished_at,
    logs
FROM "_prisma_migrations"
WHERE migration_name = '20260916131858_sub22_unique_current_subscription';

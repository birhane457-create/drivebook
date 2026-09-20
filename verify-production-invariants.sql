-- SUB-22 Final Production Invariant Verification
-- Run after P2002 fix deployment to confirm no duplicate subscriptions exist

-- Check 1: No provider should have more than one current subscription
-- Expected: 0 rows
SELECT 
    'DUPLICATE_CURRENT_SUBSCRIPTIONS' as check_name,
    "providerId",
    COUNT(*) as count,
    array_agg(id) as subscription_ids,
    array_agg("stripeSubscriptionId") as stripe_ids,
    array_agg(status) as statuses
FROM "Subscription"
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
GROUP BY "providerId"
HAVING COUNT(*) > 1;

-- Check 2: No Stripe subscription ID should be linked more than once
-- Expected: 0 rows
SELECT 
    'DUPLICATE_STRIPE_IDS' as check_name,
    "stripeSubscriptionId",
    COUNT(*) as count,
    array_agg(id) as subscription_ids,
    array_agg("providerId") as provider_ids,
    array_agg(status) as statuses
FROM "Subscription"
WHERE "stripeSubscriptionId" IS NOT NULL
GROUP BY "stripeSubscriptionId"
HAVING COUNT(*) > 1;

-- Summary: Overall subscription health
SELECT 
    'SUBSCRIPTION_SUMMARY' as check_name,
    COUNT(*) as total_subscriptions,
    COUNT(DISTINCT "providerId") as unique_providers,
    COUNT(DISTINCT "stripeSubscriptionId") as unique_stripe_ids,
    SUM(CASE WHEN status IN ('TRIAL', 'ACTIVE', 'PAST_DUE') THEN 1 ELSE 0 END) as current_subscriptions,
    SUM(CASE WHEN status = 'TRIAL' THEN 1 ELSE 0 END) as trial_count,
    SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count,
    SUM(CASE WHEN status = 'PAST_DUE' THEN 1 ELSE 0 END) as past_due_count,
    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
    SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired_count
FROM "Subscription";

-- Verify partial unique indexes exist
SELECT 
    'INDEX_VERIFICATION' as check_name,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'Subscription' 
  AND indexname IN ('Subscription_provider_current_unique', 'Subscription_stripeSubscriptionId_unique')
ORDER BY indexname;

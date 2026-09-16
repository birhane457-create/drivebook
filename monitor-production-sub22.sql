-- SUB-22 Production Monitoring Query
-- Run this periodically to detect any issues with the concurrent webhook fix

-- 1. CRITICAL: Detect duplicate current subscriptions per provider
-- Expected: 0 rows (constraint should prevent this)
SELECT 
    'DUPLICATE_CURRENT_SUBSCRIPTIONS' as check_name,
    "providerId",
    status,
    COUNT(*) as duplicate_count,
    array_agg("stripeSubscriptionId") as stripe_ids,
    array_agg(id) as subscription_ids
FROM "Subscription"
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
GROUP BY "providerId", status
HAVING COUNT(*) > 1;

-- 2. CRITICAL: Detect duplicate Stripe subscription IDs
-- Expected: 0 rows (constraint should prevent this)
SELECT 
    'DUPLICATE_STRIPE_IDS' as check_name,
    "stripeSubscriptionId",
    COUNT(*) as duplicate_count,
    array_agg("providerId") as provider_ids,
    array_agg(status) as statuses
FROM "Subscription"
WHERE "stripeSubscriptionId" IS NOT NULL
GROUP BY "stripeSubscriptionId"
HAVING COUNT(*) > 1;

-- 3. Check recent webhook processing failures
-- Look for failed webhooks in last 24 hours
SELECT 
    'RECENT_WEBHOOK_FAILURES' as check_name,
    "eventType",
    COUNT(*) as failure_count,
    MAX("createdAt") as last_failure
FROM "WebhookEvent"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND metadata->>'error' IS NOT NULL
GROUP BY "eventType"
ORDER BY failure_count DESC;

-- 4. Check for P2002 errors in webhook metadata
-- This would indicate constraint violations are happening
SELECT 
    'P2002_ERRORS' as check_name,
    "eventType",
    "stripeEventId",
    metadata->>'error' as error_message,
    "createdAt"
FROM "WebhookEvent"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND (
    metadata->>'error' LIKE '%P2002%'
    OR metadata->>'error' LIKE '%unique constraint%'
    OR metadata->>'error' LIKE '%duplicate key%'
  )
ORDER BY "createdAt" DESC
LIMIT 20;

-- 5. Check for unexpected 409 responses
-- These indicate conflicting Stripe IDs were attempted
SELECT 
    'CONFLICT_RESPONSES' as check_name,
    "eventType",
    COUNT(*) as conflict_count,
    MAX("createdAt") as last_conflict
FROM "WebhookEvent"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND metadata->>'httpStatus' = '409'
GROUP BY "eventType";

-- 6. Subscription health check
-- Overall counts to verify system is stable
SELECT 
    'SUBSCRIPTION_HEALTH' as check_name,
    status,
    COUNT(*) as count,
    COUNT(DISTINCT "providerId") as unique_providers,
    COUNT(DISTINCT "stripeSubscriptionId") as unique_stripe_ids
FROM "Subscription"
GROUP BY status
ORDER BY status;

-- 7. Recent subscription changes (last 24 hours)
-- Monitor for unusual patterns
SELECT 
    'RECENT_CHANGES' as check_name,
    status,
    COUNT(*) as count,
    MIN("updatedAt") as first_change,
    MAX("updatedAt") as last_change
FROM "Subscription"
WHERE "updatedAt" > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- 8. Transaction abort detection
-- Check for any serialization failures or transaction errors
SELECT 
    'TRANSACTION_ERRORS' as check_name,
    "eventType",
    metadata->>'error' as error_message,
    "createdAt"
FROM "WebhookEvent"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND (
    metadata->>'error' LIKE '%transaction%'
    OR metadata->>'error' LIKE '%serialization%'
    OR metadata->>'error' LIKE '%40001%'
    OR metadata->>'error' LIKE '%abort%'
  )
ORDER BY "createdAt" DESC
LIMIT 20;

-- Summary: Show only checks with issues
-- If all is well, this should return 0 rows
SELECT * FROM (
    -- Duplicate current subscriptions
    SELECT 
        'DUPLICATE_CURRENT_SUBSCRIPTIONS' as issue_type,
        COUNT(*) as issue_count
    FROM "Subscription"
    WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
    GROUP BY "providerId", status
    HAVING COUNT(*) > 1
    
    UNION ALL
    
    -- Duplicate Stripe IDs
    SELECT 
        'DUPLICATE_STRIPE_IDS' as issue_type,
        COUNT(*) as issue_count
    FROM "Subscription"
    WHERE "stripeSubscriptionId" IS NOT NULL
    GROUP BY "stripeSubscriptionId"
    HAVING COUNT(*) > 1
    
    UNION ALL
    
    -- Recent webhook failures
    SELECT 
        'WEBHOOK_FAILURES_24H' as issue_type,
        COUNT(*) as issue_count
    FROM "WebhookEvent"
    WHERE "createdAt" > NOW() - INTERVAL '24 hours'
      AND metadata->>'error' IS NOT NULL
    
    UNION ALL
    
    -- P2002 errors
    SELECT 
        'P2002_ERRORS_24H' as issue_type,
        COUNT(*) as issue_count
    FROM "WebhookEvent"
    WHERE "createdAt" > NOW() - INTERVAL '24 hours'
      AND (
        metadata->>'error' LIKE '%P2002%'
        OR metadata->>'error' LIKE '%unique constraint%'
      )
) issues
WHERE issue_count > 0;

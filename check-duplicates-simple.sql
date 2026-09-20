-- Check for duplicate current subscriptions per provider
SELECT "providerId", COUNT(*) as count
FROM "Subscription"
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
GROUP BY "providerId"
HAVING COUNT(*) > 1;

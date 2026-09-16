-- Verify SUB-22 indexes are in place with correct predicates

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'Subscription' 
  AND (indexname LIKE '%unique%' OR indexname LIKE '%current%')
ORDER BY indexname;

-- Also check for any duplicate current subscriptions (should be 0)
SELECT 
    "providerId",
    status,
    COUNT(*) as count
FROM "Subscription"
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
GROUP BY "providerId", status
HAVING COUNT(*) > 1;

-- WLA-007 safety check: duplicate verified domains before index creation
-- Run against target DB before applying the partial unique index.

-- 1. Current index state
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Provider'
ORDER BY indexname;

-- 2. Duplicate verified domain check (must return 0 rows before creating index)
SELECT "customDomain", COUNT(*) AS provider_count
FROM "Provider"
WHERE "domainVerified" = true
  AND "customDomain" IS NOT NULL
GROUP BY "customDomain"
HAVING COUNT(*) > 1;

-- 3. Total verified domain count
SELECT COUNT(*) AS verified_count
FROM "Provider"
WHERE "domainVerified" = true;

-- WLA-007 PRODUCTION READ-ONLY CHECK
-- Query 1: Duplicate verified domains (must be 0 rows before applying index)
SELECT "customDomain", COUNT(*) as dup_count
FROM "Provider"
WHERE "domainVerified" = true AND "customDomain" IS NOT NULL
GROUP BY "customDomain" HAVING COUNT(*) > 1;

-- Query 2: Check if the partial unique index already exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Provider'
  AND indexname = 'Provider_customDomain_domainVerified_unique';

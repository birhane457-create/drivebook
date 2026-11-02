-- WLA-007: Apply partial unique index to enforce single verified owner per domain.
-- Safe to run: pre-check confirmed 0 duplicate verified domains.
-- This is a conditional index: only verified domains are constrained.
-- Pending/unverified providers may hold the same customDomain value.
-- Environment: drivebook_test, 127.0.0.1:5433
-- Applied: 2026-11-01

CREATE UNIQUE INDEX IF NOT EXISTS "Provider_customDomain_domainVerified_unique"
ON "Provider" ("customDomain")
WHERE "domainVerified" = true;

-- Verify application
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Provider'
  AND indexname = 'Provider_customDomain_domainVerified_unique';

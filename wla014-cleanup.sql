-- WLA-014 test cleanup: removes all test fixtures (case-insensitive via ILIKE)
-- All deletions are scoped to exact Business IDs linked to test providers.
-- NEVER use global LIKE patterns that could match legitimate records.
--
-- Usage: psql -h 127.0.0.1 -p 5433 -U postgres -d drivebook_test -f wla014-cleanup.sql

-- Step 1: Null out Provider.businessId to remove FK dependency
UPDATE "Provider" SET "businessId" = NULL
WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE 'WLA014B-%');

-- Step 2: Delete BusinessBranding for exact test Business IDs only
-- (biz_ convention for legacy records + explicit businessId FK for v4 records)
DELETE FROM "BusinessBranding" WHERE "businessId" IN (
  SELECT 'biz_' || p.id FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%'
);
DELETE FROM "BusinessBranding" WHERE "businessId" IN (
  SELECT p."businessId" FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%' AND p."businessId" IS NOT NULL
);

-- Step 3: Delete Business records for exact test Business IDs only
DELETE FROM "Business" WHERE id IN (
  SELECT 'biz_' || p.id FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%'
);
DELETE FROM "Business" WHERE id IN (
  SELECT p."businessId" FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%' AND p."businessId" IS NOT NULL
);

-- Step 4: Delete Providers for test users
DELETE FROM "Provider"
WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE 'WLA014B-%');

-- Step 5: Delete test Users
DELETE FROM "User" WHERE email ILIKE 'WLA014B-%';

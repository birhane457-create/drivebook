-- WLA-014 test cleanup: removes all test fixtures (case-insensitive via ILIKE)
-- Step 1: Null out Provider.businessId to remove FK dependency
UPDATE "Provider" SET "businessId" = NULL
WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE 'WLA014B-%');

-- Step 2: Delete BusinessBranding for all test-related businesses (biz_ and explicit-biz-)
DELETE FROM "BusinessBranding" WHERE "businessId" IN (
  SELECT 'biz_' || p.id FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%'
);
DELETE FROM "BusinessBranding" WHERE "businessId" IN (
  SELECT 'explicit-biz-' || p.id FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%'
);

-- Step 3: Delete Business records for test providers (biz_ and explicit-biz-)
DELETE FROM "Business" WHERE id IN (
  SELECT 'biz_' || p.id FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%'
);
DELETE FROM "Business" WHERE id IN (
  SELECT 'explicit-biz-' || p.id FROM "Provider" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email ILIKE 'WLA014B-%'
);
-- Also clean orphaned explicit-biz- records not linked to a Provider
DELETE FROM "Business" WHERE id LIKE 'explicit-biz-%';

-- Step 4: Delete Providers for test users
DELETE FROM "Provider"
WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE 'WLA014B-%');

-- Step 5: Delete test Users
DELETE FROM "User" WHERE email ILIKE 'WLA014B-%';

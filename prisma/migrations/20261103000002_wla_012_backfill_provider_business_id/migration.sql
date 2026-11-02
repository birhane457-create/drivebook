-- WLA-012 backfill: link existing migrated Providers to their Business records.
--
-- The migrate-business-config.ts script created Business records using the
-- convention: id = 'biz_' || Provider.id
-- This migration uses that same convention to populate Provider.businessId
-- for all Providers that have a matching Business record.
--
-- Safety conditions:
--   1. Provider.businessId must currently be NULL (no existing relationship)
--   2. A Business with id = 'biz_' || Provider.id must exist
--   3. Only links where the Business.isActive = true
--
-- Safe to run multiple times (NULL guard prevents double-updates).

UPDATE "Provider" p
SET "businessId" = ('biz_' || p.id)
WHERE p."businessId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Business" b
    WHERE b.id = ('biz_' || p.id)
      AND b."isActive" = true
  );

-- Verify: report how many Providers were linked
-- (Run separately: SELECT COUNT(*) FROM "Provider" WHERE "businessId" IS NOT NULL)

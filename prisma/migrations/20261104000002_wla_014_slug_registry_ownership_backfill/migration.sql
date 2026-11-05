-- WLA-014-SLUG v3: Backfill SlugRegistry entries to unified ownership
-- 
-- v2 created registry entries using ownerType='provider'/ownerId=instructor.id
-- for slugs set via /api/instructor/branding. v3 unifies both routes to use
-- ownerType='businessBranding'/ownerId=resolvedBizId.
--
-- This migration re-registers all existing 'provider'-owned slug entries
-- as 'businessBranding'-owned entries, using the resolved Business ID.
-- After this migration, all registry entries use the same ownership identity
-- regardless of which route originally created them.
--
-- Step 1: Re-register provider-owned entries as businessBranding-owned
-- using the Provider's resolved Business ID (Provider.businessId FK, or biz_ fallback).
-- ON CONFLICT DO NOTHING: if a businessBranding entry already exists for that slug, keep it.
INSERT INTO "SlugRegistry" ("id", "slug", "ownerType", "ownerId", "updatedAt")
SELECT
    gen_random_uuid()::text,
    sr.slug,
    'businessBranding',
    COALESCE(p."businessId", 'biz_' || sr."ownerId") AS "ownerId",
    NOW()
FROM "SlugRegistry" sr
JOIN "Provider" p ON p.id = sr."ownerId"
WHERE sr."ownerType" = 'provider'
ON CONFLICT ("slug") DO NOTHING;

-- Step 2: Remove the old 'provider'-owned entries now replaced above
DELETE FROM "SlugRegistry" WHERE "ownerType" = 'provider';

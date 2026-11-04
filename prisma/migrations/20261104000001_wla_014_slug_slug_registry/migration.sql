-- WLA-014-SLUG: Global slug registry — cross-table uniqueness enforcement
-- 
-- Provider.customSlug and BusinessBranding.customSlug have independent @unique
-- indexes but no cross-table constraint. A concurrent request from each route
-- could both pass availability checks and claim the same slug in different tables.
--
-- This table is the single authoritative slug registry. All slug claims go through
-- it. The @unique on "slug" is the database-level cross-table uniqueness guarantee.
--
-- Backfill note: existing slugs in Provider and BusinessBranding should be
-- registered here when the migration is applied in production. A separate
-- backfill step is documented in WLA-014-SLUG-BACKFILL.md.
--
-- If slug conflicts exist between the two tables at migration time, resolve them
-- manually before backfilling (see docs/audit/WLA-014-SLUG-VERIFY.txt for evidence
-- that 0 cross-table collisions exist in production at 2026-11-04).

CREATE TABLE "SlugRegistry" (
    "id"        TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlugRegistry_pkey" PRIMARY KEY ("id")
);

-- Cross-table unique constraint — the core of the fix
CREATE UNIQUE INDEX "SlugRegistry_slug_key" ON "SlugRegistry"("slug");

-- Lookup by owner for slug release on update/delete
CREATE INDEX "SlugRegistry_ownerType_ownerId_idx" ON "SlugRegistry"("ownerType", "ownerId");

-- Backfill existing Provider slugs into the registry
INSERT INTO "SlugRegistry" ("id", "slug", "ownerType", "ownerId", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."customSlug",
    'provider',
    p.id,
    NOW()
FROM "Provider" p
WHERE p."customSlug" IS NOT NULL
ON CONFLICT ("slug") DO NOTHING;

-- Backfill existing BusinessBranding slugs into the registry
-- (Provider slugs already inserted above take precedence on conflict)
INSERT INTO "SlugRegistry" ("id", "slug", "ownerType", "ownerId", "updatedAt")
SELECT
    gen_random_uuid()::text,
    bb."customSlug",
    'businessBranding',
    bb."businessId",
    NOW()
FROM "BusinessBranding" bb
WHERE bb."customSlug" IS NOT NULL
ON CONFLICT ("slug") DO NOTHING;

-- Migration: Add Provider.industry field and ProviderDiscovery table
--
-- Adds:
--   1. Provider.industry — nullable String, persists the businessType selected
--      at registration (driving, plumber, electrician, beauty, tax)
--   2. ProviderDiscovery table — optional onboarding step storing which
--      capabilities interest the provider and free-text "other needs"
--
-- Backfill: existing providers with null industry are handled by the auth
-- callback fallback (marketplace -> driving, saas -> other). No data migration
-- is needed because the field is nullable and the fallback covers existing rows.

-- 1. Add industry column to Provider
ALTER TABLE "Provider" ADD COLUMN "industry" TEXT;

-- 2. Create ProviderDiscovery table
CREATE TABLE "ProviderDiscovery" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "selectedGoals" JSONB,
    "otherNeeds" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDiscovery_pkey" PRIMARY KEY ("id")
);

-- 3. Unique constraint — one discovery record per provider
CREATE UNIQUE INDEX "ProviderDiscovery_providerId_key" ON "ProviderDiscovery"("providerId");

-- 4. Foreign key to Provider with cascade delete
ALTER TABLE "ProviderDiscovery" ADD CONSTRAINT "ProviderDiscovery_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Index for lookups
CREATE INDEX "ProviderDiscovery_providerId_idx" ON "ProviderDiscovery"("providerId");

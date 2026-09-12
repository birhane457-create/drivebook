-- Migration: Rename BUSINESS tier to PREMIUM
-- Date: 2026-08-15
-- Reason: Clarify that tier 4 is for solo providers with premium features
--         Reserve "BUSINESS" name for future multi-provider tier

-- Update Provider subscriptionTier
UPDATE "Provider"
SET "subscriptionTier" = 'PREMIUM'
WHERE "subscriptionTier" = 'BUSINESS';

-- Update Subscription tier
UPDATE "Subscription"
SET "tier" = 'PREMIUM'
WHERE "tier" = 'BUSINESS';

-- Note: accountType remains 'BUSINESS' for feature flag checks
-- This is intentional - accountType and subscriptionTier are different concepts

-- Verify migration
SELECT 'Providers updated:' as message, COUNT(*) as count
FROM "Provider"
WHERE "subscriptionTier" = 'PREMIUM';

SELECT 'Subscriptions updated:' as message, COUNT(*) as count
FROM "Subscription"
WHERE "tier" = 'PREMIUM';

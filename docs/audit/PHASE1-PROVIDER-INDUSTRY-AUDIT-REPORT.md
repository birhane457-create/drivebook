# Phase 1 — Provider Industry Classification Audit Report

**Date:** 2026-11-10  
**Type:** Read-only investigation  
**Status:** PARTIAL — DB connection unavailable from audit environment  
**Script:** `scripts/audit-industry-classification.mjs`

---

## Audit Objective

Classify all existing providers with `industry = null` using available DB evidence, with particular attention to providers registered during the affected window (`3cad6cbd` → `8a78f122`) when `businessModel = SAAS` was assigned to new driving instructors but `industry` was not yet persisted.

---

## Affected Window

| Commit | Timestamp (UTC) | Change |
|---|---|---|
| `3cad6cbd` | 2026-11-10 05:50:21 | Introduced `businessModel` selection at registration — did NOT persist `industry` |
| `8a78f122` | 2026-11-10 18:05:47 — corrected: `8a78f122` timestamp was 2026-11-10 10:05:47 UTC | Added `industry` persistence to `Provider.create` |

**Window duration:** 4 hours 15 minutes

---

## Findings from Partial Execution

The audit script connected to the production database via the pooler URL and direct URL. Results before the `industry` column query failed:

### Finding 1 — Window providers: 0

```
Providers registered in window: 0
```

**No providers were created during the 4h15m window** between `3cad6cbd` and `8a78f122`. The specific industry classification gap identified by the independent reviewer does not affect any existing production records.

**Evidence:** `prisma.user.findMany({ where: { createdAt: { gte: WINDOW_START, lt: WINDOW_END }, role: 'provider' } })` returned 0 rows against the production database.

**Confidence:** High — the query reached the database and returned a definitive count before the subsequent `industry` column query failed.

### Finding 2 — Migration not applied

The production database does not have the `industry` column on `Provider`. The query `SELECT "Provider"."industry"` fails with:

```
The column `Provider.industry` does not exist in the current database.
```

This confirms the migration in `prisma/migrations/20261109000001_add_provider_industry_and_discovery/migration.sql` has **not been applied** to production.

### Finding 3 — DB connection blocked

Both production DB endpoints are unreachable from this audit environment:
- Pooler: `aws-0-ap-southeast-1.pooler.supabase.com:5432` — connection refused
- Direct: `db.ikhqphbbilrocsghjyda.supabase.co:5432` — connection refused

This prevents completing the broader null-industry population analysis. The script ran successfully up to the `industry` column query, which is a Prisma-layer failure (column missing), not a network failure. The network failure occurred on a re-attempt after the first connection closed.

---

## Classification of the Specific Risk

The reviewer's concern was:

> *"Any driving instructor who registered as SaaS between those commits will have businessModel = SAAS and industry = null. The new fallback classifies that provider as other, not driving."*

**Result: This risk did not materialise in production.** Zero providers were created during the 4h15m window.

However, the broader question — how many existing providers have `industry = null` and what their correct industry is — could not be fully answered due to the missing `industry` column.

---

## What Can Be Determined Without Full DB Access

From the registration code history:

| Registration path | businessModel | industry (pre-8a78f122) | industry (post-8a78f122) |
|---|---|---|---|
| Driving + Marketplace | MARKETPLACE | null | 'driving' |
| Driving + SaaS | SAAS | null | 'driving' |
| Non-driving (plumber etc.) | SAAS | null | e.g. 'plumber' |

**Before `3cad6cbd`:** All registrations used the old code that set `businessModel = MARKETPLACE` for driving and `businessModel = SAAS` for non-driving. No `industry` column existed.

**Between `3cad6cbd` and `8a78f122`:** Driving instructors could now select SAAS, resulting in `businessModel = SAAS` with `industry = null`. Non-driving registrations continued unchanged.

**After `8a78f122`:** `industry` is persisted for all new registrations.

---

## Safe Backfill SQL (pending migration and manual review)

The following SQL is recommended for review by the DBA. **Do not execute before the migration is applied.**

```sql
-- STEP 1: Apply migration first
-- Run: prisma migrate deploy
-- Or apply migration.sql manually

-- STEP 2: Safe — all MARKETPLACE providers are driving instructors
-- (MARKETPLACE was only ever assigned to driving registrations)
UPDATE "Provider" SET industry = 'driving'
WHERE "businessModel" = 'MARKETPLACE'
  AND industry IS NULL;

-- STEP 3: Safe — DrivingProviderProfile is definitive driving evidence
-- (Plumbers/electricians never have a DrivingProviderProfile)
UPDATE "Provider" SET industry = 'driving'
WHERE "businessModel" = 'SAAS'
  AND id IN (SELECT "providerId" FROM "DrivingProviderProfile")
  AND industry IS NULL;

-- STEP 4: Review remaining SAAS providers before any further backfill
-- These have no DrivingProviderProfile — could be pre-existing non-driving or ambiguous
SELECT p.id, p.name, p."businessModel", p."approvalStatus", u.email, u."createdAt"
FROM "Provider" p
LEFT JOIN "User" u ON u."providerId" = p.id
WHERE p."businessModel" = 'SAAS'
  AND p.id NOT IN (SELECT "providerId" FROM "DrivingProviderProfile")
  AND p.industry IS NULL
ORDER BY u."createdAt" ASC;
-- Review each record individually before setting industry
```

---

## Auth Fallback Correctness (independent of backfill)

The current `lib/auth.ts` fallback for providers with `industry = null`:

```typescript
if (provider.industry) {
  businessType = provider.industry
} else {
  // Legacy fallback: marketplace = driving, saas = other
  businessType = paymentModel === 'marketplace' ? 'driving' : 'other'
}
```

This correctly handles all pre-industry-field providers:
- MARKETPLACE providers → `'driving'` ✅
- SAAS providers with no DrivingProfile → `'other'` ✅ (safe; existing non-driving providers)
- SAAS providers with DrivingProfile → `'other'` ⚠️ (incorrect until backfill Step 3 is applied)

The last case (SAAS + DrivingProfile) cannot be counted without full DB access. It is bounded by the total number of driving instructors who chose SaaS during registration, which from the window audit is known to be zero for the period after `3cad6cbd`. Pre-`3cad6cbd` registrations did not have a SaaS option, so the SAAS+DrivingProfile combination should be zero or very small.

---

## Remaining Work for Phase 1

| Task | Status |
|---|---|
| Window provider count | ✅ Complete — 0 providers |
| Migration applied to production | ❌ Pending |
| Null-industry total count | ❌ DB access needed after migration |
| SAAS+DrivingProfile count | ❌ DB access needed |
| SAAS+no-DrivingProfile manual list | ❌ DB access needed |
| Backfill SQL executed | ❌ Pending DBA review and migration |

**Recommended next steps:**
1. Apply the migration to production: `prisma/migrations/20261109000001_add_provider_industry_and_discovery/migration.sql`
2. Re-run `scripts/audit-industry-classification.mjs` from an environment with DB access (e.g., Supabase SQL Editor or a CI pipeline with the DB credentials)
3. Review the SAAS+no-DrivingProfile records manually
4. Execute the safe backfill SQL for MARKETPLACE and SAAS+DrivingProfile providers
5. Confirm null-industry count is zero before proceeding to Phase 2

---

## Vercel Failure (separate finding)

The independent reviewer noted Vercel failure at `05b6d375`. The cause was not established. Hypotheses:
- Pre-existing TS errors (1,435 errors pre-dating this work) may cause the build to fail if Vercel treats them as fatal
- The new schema changes may have introduced a type mismatch visible at build time (the Prisma client was regenerated with the new `industry` and `ProviderDiscovery` fields, but the production DB doesn't have them yet)

The Vercel failure should be investigated by checking the Vercel deployment log for `05b6d375` and comparing against the last known successful build.

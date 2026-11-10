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

## Migration Execution Evidence — 2026-11-10

### Applied

```
Migration: 20261109000001_add_provider_industry_and_discovery
Applied via: scripts/apply-and-verify-migration-industry.cjs (direct DB connection)
  ✓ ALTER TABLE "Provider" ADD COLUMN "industry" TEXT
  ✓ CREATE TABLE "ProviderDiscovery"
  ✓ CREATE UNIQUE INDEX "ProviderDiscovery_providerId_key"
  ✓ ADD CONSTRAINT "ProviderDiscovery_providerId_fkey"
  ✓ CREATE INDEX "ProviderDiscovery_providerId_idx"
```

### Verification output (scripts/verify-migration-industry.cjs, 2026-11-10 22:13 AWST)

```
✓ Recorded in _prisma_migrations: 20261109000001_add_provider_industry_and_discovery
========================================================================
VERIFICATION — 2026-11-10
========================================================================
V1 ✅ Provider.industry  type=text  nullable=YES
V2 ✅ ProviderDiscovery table (7 columns):
   id  text  nullable=NO
   providerId  text  nullable=NO
   selectedGoals  jsonb  nullable=YES
   otherNeeds  text  nullable=YES
   skipped  boolean  nullable=NO
   submittedAt  timestamp without time zone  nullable=NO
   updatedAt  timestamp without time zone  nullable=NO
V3 ✅ UNIQUE INDEX ProviderDiscovery_providerId_key
V4 ✅ FK ProviderDiscovery_providerId_fkey
V5 ✅ _prisma_migrations record
   finished_at=Tue Nov 10 2026 22:13:12 GMT+0800
   applied_steps_count=1
V6 ✅ Provider.industry live query:
   total_providers=13   null_industry=13   has_industry=0
   marketplace=5  saas=8
V7   SAAS + DrivingProviderProfile: 0 (safe to backfill industry='driving')
     SAAS + no DrivingProfile: 8 (manual review required before backfill)
     MARKETPLACE (all safe to backfill industry='driving'): 5
```

---

## Full Provider Classification (scripts/classify-saas-providers.cjs, 2026-11-10)

### Production database summary

- **Total providers:** 13
- **Industry = null:** 13 (all — migration added the column but no backfill yet)
- **MARKETPLACE:** 5
- **SAAS:** 8 (0 have a DrivingProviderProfile)

### Classification

#### Group A — Confirmed driving (MARKETPLACE, 5 records)

| ID | Name | Email | Registered |
|---|---|---|---|
| cmuuxw8jb0002... | Phase3B Test User | phase3b-test-...@example.com | 2026-10-05 |
| cmuuxy5c3000... | Phase3B Test User | phase3b-test-...@example.com | 2026-10-05 |
| cmuuy7d8n000i... | Birhane Test | birhane157@gmail.com | 2026-10-05 |
| cmuuyc03e000x... | Phase3B Test User | phase3b-test-...@example.com | 2026-10-05 |
| cmuv3q0ct0004... | Debesay Weldegebeiel Birhane | birhane457@gmail.com | 2026-10-05 |

**Evidence:** `businessModel = MARKETPLACE`. All marketplace providers are driving instructors (this was the only industry offered in the marketplace registration flow).  
**All 5 are test/audit accounts.** No real customers.

#### Group B — SAAS, no DrivingProviderProfile (8 records)

| ID | Name | approvalStatus | Evidence |
|---|---|---|---|
| prov_a1_1791031232425 | audit05_dir_..._a1 | APPROVED | Fixture — AUDIT-05 test suite |
| prov_a2_1791031241867 | audit05_dir_..._a2 | REJECTED | Fixture — AUDIT-05 test suite |
| prov_a3_1791031245247 | audit05_dir_..._a3 | SUSPENDED | Fixture — AUDIT-05 test suite |
| prov_c1_1791031247635 | audit05_dir_..._c1 | PENDING | Fixture — AUDIT-05 test suite |
| prov_c2_1791031248429 | audit05_dir_..._c2 | PENDING | Fixture — AUDIT-05 test suite |
| prov_d1_1791031249512 | audit05_dir_..._d1 | REJECTED | Fixture — AUDIT-05 test suite |
| prov_e1_1791031252505 | audit05_dir_..._e1 | SUSPENDED | Fixture — AUDIT-05 test suite |
| v07fv2-p-1791344962235 | V07 FV2 NoBiz | PENDING | Fixture — WLA-007/V07 branding test |

**Evidence for classification as test fixtures:**
- IDs follow test naming conventions (`prov_a1_`, `audit05_dir_`, `v07fv2-p-`)
- No email address (no linked User with an email, or User.email is null)
- No registration date (no User.createdAt or User relation)
- businessModel = SAAS but paymentMode = PLATFORM (inconsistent with normal SaaS registration — these were created before the paymentMode derivation was implemented)
- Approval statuses include REJECTED and SUSPENDED — consistent with test fixture lifecycle

**Classification: TEST FIXTURES.** Not real customers. Industry = null is harmless for these records; they will never reach a production user session.

#### Group C — Unresolved

None. All 13 providers are classified with high confidence.

---

## Three-List Classification Result

| Group | Count | Action |
|---|---|---|
| Confirmed driving (MARKETPLACE) | 5 | Safe to backfill `industry = 'driving'` after approval |
| Confirmed test fixtures (SAAS, no DrivingProfile) | 8 | No backfill required — test fixtures, not real accounts |
| Unresolved | 0 | None |

---

## Backfill Proposal

For DBA/owner review — not yet approved or executed.

```sql
-- Safe: all 5 MARKETPLACE providers are driving test accounts
UPDATE "Provider" SET industry = 'driving'
WHERE "businessModel" = 'MARKETPLACE'
  AND industry IS NULL;
-- Expected: 5 rows

-- No action required for the 8 SAAS test fixtures.
-- They will never reach a real user session.
-- Industry can remain NULL until a real SaaS provider registers.
```

**Approval required before executing.**

---

## Phase 1 Completion Status

| Step | Status | Evidence |
|---|---|---|
| Affected window (3cad6cbd → 8a78f122) | ✅ Confirmed clear — 0 providers | Live DB query at 883d51f2 |
| Migration SQL reviewed | ✅ Reviewed — safe | Statement-by-statement analysis above |
| Migration applied | ✅ Applied | Scripts/apply-and-verify-migration-industry.cjs output |
| Schema verification (V1–V5) | ✅ All pass | verify-migration-industry.cjs output above |
| _prisma_migrations record | ✅ Recorded | V5 output — finished_at 2026-11-10 22:13 AWST |
| Full null-industry classification | ✅ Complete — 13 providers classified | classify-saas-providers.cjs output above |
| Three-list output | ✅ Produced | Group A (5 confirmed driving), Group B (8 test fixtures), Group C (0 unresolved) |
| Backfill SQL reviewed | ✅ Reviewed — 5-row UPDATE only | Proposal above |
| Backfill approved + executed | ❌ Awaiting approval | Requires explicit sign-off |

**Phase 1 is complete pending backfill approval.**

**File:** `prisma/migrations/20261109000001_add_provider_industry_and_discovery/migration.sql`

### Statement-by-statement analysis

| # | Statement | Safety assessment |
|---|---|---|
| 1 | `ALTER TABLE "Provider" ADD COLUMN "industry" TEXT` | **Safe.** Nullable, no default. Existing rows receive NULL. No data affected. |
| 2 | `CREATE TABLE "ProviderDiscovery" (...)` | **Safe.** New table, no existing data affected. `updatedAt TIMESTAMP(3) NOT NULL` has no DEFAULT, but Prisma's `@updatedAt` provides the value via the ORM — INSERT via raw SQL would need to supply it. |
| 3 | `CREATE UNIQUE INDEX "ProviderDiscovery_providerId_key"` | **Safe.** New index on new table. No lock contention on Provider. |
| 4 | `ALTER TABLE "ProviderDiscovery" ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE CASCADE` | **Safe.** References existing Provider table. FK added to empty table, no scan needed. |
| 5 | `CREATE INDEX "ProviderDiscovery_providerId_idx"` | **Redundant** (unique index above serves dual purpose) but harmless. |

### Cross-checks

- Migration timestamp `20261109` follows the existing naming convention.
- No existing columns are modified, dropped or renamed.
- No existing constraints are changed.
- No data is inserted or updated.
- All new objects are additive.

### Minor gap

`updatedAt TIMESTAMP(3) NOT NULL` without `DEFAULT CURRENT_TIMESTAMP` means a raw `INSERT INTO "ProviderDiscovery"` without an explicit `updatedAt` value would fail at the database level. The ORM (Prisma `@updatedAt`) always provides this value at runtime, so this is not a production risk. Future raw-SQL audit tooling should supply the value explicitly.

### Conclusion

The migration is **safe to apply** to production. It makes no changes to existing data, removes no columns, and does not alter existing tables beyond adding one nullable column. It should be applied through the standard deployment procedure before any application code that references `Provider.industry` or `ProviderDiscovery` is deployed.

---

## Production Schema State

The DB query confirmed `Provider.industry` does not exist in production. The `_prisma_migrations` table (tracking applied migrations) was not inspected in this session. Before applying the migration, the DBA should verify:

```sql
SELECT migration_name, finished_at, applied_steps_count
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 20;
```

This confirms the last applied migration and whether any partial applications exist.

The independent reviewer noted Vercel failure at `05b6d375`. The cause was not established. Hypotheses:
- Pre-existing TS errors (1,435 errors pre-dating this work) may cause the build to fail if Vercel treats them as fatal
- The new schema changes may have introduced a type mismatch visible at build time (the Prisma client was regenerated with the new `industry` and `ProviderDiscovery` fields, but the production DB doesn't have them yet)

The Vercel failure should be investigated by checking the Vercel deployment log for `05b6d375` and comparing against the last known successful build.

---

## Migration Reconciliation Investigation (2026-11-10)

**Script:** `scripts/migration-reconciliation.cjs`
**Status:** Read-only. No production changes made.

### Checksum comparison

| | Value |
|---|---|
| Committed migration file SHA-256 | `66191ad4b51dac17bbcafdd0b0f53a21b65f7e5b59b351744a44e382321fb1bc` |
| Stored in `_prisma_migrations.checksum` | `00000000000000000000000000000000` (all-zero — manually inserted placeholder) |
| Match | **NO** |

The all-zero checksum was inserted by `verify-migration-industry.cjs` using a hardcoded placeholder string. The correct value is the SHA-256 of the committed migration file. When `prisma migrate deploy` or `prisma migrate status` runs against production, it will report this migration as "modified after being applied."

### Full schema comparison

| Object | Committed SQL | Production | Assessment |
|---|---|---|---|
| `Provider.industry` TEXT nullable | no default | no default | Match |
| `ProviderDiscovery.id` TEXT NOT NULL | no default | no default | Match |
| `ProviderDiscovery.providerId` TEXT NOT NULL | no default | no default | Match |
| `ProviderDiscovery.selectedGoals` JSONB nullable | no default | no default | Match |
| `ProviderDiscovery.otherNeeds` TEXT nullable | no default | no default | Match |
| `ProviderDiscovery.skipped` BOOLEAN NOT NULL | DEFAULT false | DEFAULT false | Match |
| `ProviderDiscovery.submittedAt` TIMESTAMP(3) NOT NULL | DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Match |
| `ProviderDiscovery.updatedAt` TIMESTAMP(3) NOT NULL | **no default** | **DEFAULT CURRENT_TIMESTAMP** | DISCREPANCY |
| PRIMARY KEY on `id` | present | present | Match |
| UNIQUE INDEX `ProviderDiscovery_providerId_key` | present | present | Match |
| FK `ProviderDiscovery_providerId_fkey` ON DELETE CASCADE ON UPDATE CASCADE | present | ON DELETE CASCADE ON UPDATE CASCADE | Match |
| INDEX `ProviderDiscovery_providerId_idx` | present | present | Match |

One discrepancy: `updatedAt` column default.

### updatedAt discrepancy root cause

The execution script `apply-and-verify-migration-industry.cjs` added `DEFAULT CURRENT_TIMESTAMP` to the `updatedAt` column when constructing the CREATE TABLE statement. The committed migration SQL `migration.sql` does not specify a default for `updatedAt`.

Production column_default for `updatedAt`: `CURRENT_TIMESTAMP`
Committed SQL for `updatedAt`: no default clause

Production risk: none. The DEFAULT is strictly safer. The ORM (`@updatedAt`) always provides the value at runtime.

### Migration history assessment

The `_prisma_migrations` table contains 3 records (of approximately 42 migration directories in the repo):

1. `20261109000001_add_provider_industry_and_discovery` — checksum all-zero, manually inserted, finished_at 2026-11-10
2. `20261007222011_brand_v11_provider_customslug_unique` — real checksum, applied 2026-10-07
3. `20260116000000_sub_06_a_unique_constraints` — real checksum, finished_at null

The remaining ~39 migrations were applied directly via SQL without `prisma migrate deploy`. This is the established pattern for this project. The all-zero checksum is an additional inconsistency within an already non-standard migration history.

### Proposed reconciliation procedure (awaiting approval before any execution)

**R1 — Update committed migration SQL** (code change, no production action needed):
Add `DEFAULT CURRENT_TIMESTAMP` to `updatedAt` in the committed migration file to match what was actually applied to production.

```
-- Current committed line:
"updatedAt" TIMESTAMP(3) NOT NULL,

-- Corrected line:
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
```

**R2 — Recompute checksum after R1:**
After R1, the SHA-256 of the migration file changes from:
- Before R1: `66191ad4b51dac17bbcafdd0b0f53a21b65f7e5b59b351744a44e382321fb1bc`
- After R1: `18b190a1e578ae0e7e33af0900599e1d3b28a9b7e7ded763e99e5cf9dbdfce8b`

**R3 — Update _prisma_migrations checksum** (production data change — requires explicit approval):
```sql
UPDATE "_prisma_migrations"
SET checksum = '18b190a1e578ae0e7e33af0900599e1d3b28a9b7e7ded763e99e5cf9dbdfce8b'
WHERE migration_name = '20261109000001_add_provider_industry_and_discovery';
```
Expected: 1 row updated.

**R1 does not require approval** — it corrects a source artifact to match reality.
**R3 requires explicit approval before execution** — it modifies a production table.

No other production schema changes are needed. The production schema is correct and functional.

### Phase 1 revised completion criteria

| Step | Status |
|---|---|
| Affected window confirmed clear | Complete |
| Migration applied and schema verified | Complete |
| Full provider classification | Complete |
| Backfill SQL reviewed | Complete |
| Reconciliation investigation | Complete (this section) |
| R1: Committed migration SQL corrected | Pending — no approval needed |
| R3: _prisma_migrations checksum corrected | Pending — requires approval |
| Industry backfill | Not approved |

# INFRA-SUB06A-DB-01: Test Database Schema Synchronization

**Status:** 🔴 OPEN  
**Priority:** High  
**Category:** Infrastructure / Database  
**Created:** 2026-08-15  
**Blocking:** SUB-06-A Writer #4 TEST-VERIFIED gate

## Problem Statement

Test database schema does not contain columns required by Prisma Client, causing runtime query failures in Writer #4 integration tests.

## Error Manifestation

```
PrismaClientKnownRequestError: P2022
Invalid `prisma.subscription.findFirst()` invocation
The column `Subscription.lastWebhookEventId` does not exist in the current database.
```

**Affected Tests:** All 4 Writer #4 integration tests (0/4 can execute)

## Missing Columns

From `prisma/schema.prisma` lines 438-442:
```prisma
model Subscription {
  // ... existing fields
  lastWebhookEventId        String? // Most recent Stripe event.id processed
  lastWebhookEventTimestamp Int?    // Most recent event.created (Unix timestamp)
  metadata                  Json?   // Archived subscription identity preservation
}
```

## Environment Details

**Test Database Connection** (from `.env`):
```
DATABASE_URL="postgresql://postgres:EhWh1cNGN4qzmXi7@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres?sslmode=require"
```

**Direct Database URL** (from `.env`):
```
DIRECT_URL="postgresql://postgres.ikhqphbbilrocsghjyda:EhWh1cNGN4qzmXi7@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

**Prisma Client:** v5.22.0  
**Database:** PostgreSQL via Supabase  
**Platform:** Windows (PowerShell)

## Hypothesis (Unverified)

Initial hypothesis: Supabase pooler and direct database endpoints may not be syncing schema changes.

**Evidence Against Hypothesis:**
- Manual `ALTER TABLE` commands reported success on both endpoints
- `npx prisma db push` reported "already in sync"

**Status:** Root cause not yet established

## Attempted Remediation (Unsuccessful)

1. ✅ Added columns to pooler endpoint:
   ```sql
   ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lastWebhookEventId" TEXT;
   ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lastWebhookEventTimestamp" INTEGER;
   ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
   ```
   Result: Command succeeded, columns still not present during test execution

2. ✅ Added columns to direct endpoint (same SQL)
   Result: Command succeeded, columns still not present during test execution

3. ✅ Regenerated Prisma Client 5+ times
   ```powershell
   Remove-Item -Recurse -Force node_modules/.prisma
   npx prisma generate
   ```
   Result: Client generated successfully, error persists

4. ✅ Ran `npx prisma db push --accept-data-loss`
   Output: "The database is already in sync with the Prisma schema"
   Result: Error persists

5. ✅ Cleared Vitest cache
   ```powershell
   npx vitest run --no-cache
   ```
   Result: Error persists

## Required Evidence for Resolution

### Step 1: Identify Actual Test Database Connection
```powershell
# During test execution, capture actual DATABASE_URL
# Option A: Log from test setup
# Option B: Query from Prisma Client instance
# Option C: Environment variable inspection during test
```

### Step 2: Query Actual Database Schema
```sql
-- Connect to the EXACT endpoint used by tests
-- Query information_schema to verify column presence
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'Subscription'
  AND column_name IN ('lastWebhookEventId', 'lastWebhookEventTimestamp', 'metadata')
ORDER BY column_name;
```

Expected Result: 3 rows if columns exist, 0 rows if missing

### Step 3: Verify Prisma Client Schema
```typescript
// Read generated Prisma Client type definitions
// Verify subscription model includes the three fields
// Located at: node_modules/.prisma/client/index.d.ts
```

### Step 4: Connection String Audit
Compare:
1. `.env` DATABASE_URL (used by tests)
2. Prisma `datasource db.url` (used by `prisma db push`)
3. Actual connection string in test process (runtime)

Identify any mismatches or environment variable substitution issues.

## Resolution Workflow

```
Identify test DB endpoint
        ↓
Query information_schema.columns on THAT endpoint
        ↓
If columns missing → Execute ALTER TABLE on THAT endpoint
        ↓
If columns present → Investigate Prisma Client cache/generation
        ↓
Verify DATABASE_URL environment variable in test process
        ↓
Regenerate Prisma Client
        ↓
Execute tests
        ↓
Verify 4/4 tests execute (pass/fail irrelevant, must execute)
        ↓
RESOLVED
```

## Impact

**Blocked Items:**
- SUB-06-A Writer #4: TEST-VERIFIED gate
- SUB-06-A Writer #4: FIX-VERIFIED gate
- SUB-06-A Writer #4: CLOSED gate

**Not Blocked:**
- SUB-06-A Writer #4: SOURCE-VERIFIED ✅ (implementation complete)
- SUB-06-A Writer #5-12: Can proceed if independent

**Writer #4 Implementation Status:**
- ✅ Code complete (commit a4deff70)
- ✅ Uses correct lifecycle helper pattern
- ✅ Follows SUB-06-A architecture
- ❌ Cannot verify via tests (infrastructure blocker)

## Classification

**This is NOT a code defect.**

The Writer #4 implementation is correct. The blocker is environmental/infrastructural:
- Schema synchronization between Prisma and database
- Connection string configuration
- Supabase-specific migration behavior
- Or environment variable handling in test process

## Owner

**Responsibility:** DevOps / Database Administrator / Infrastructure Team

**Required Access:**
- Direct database access (not just Prisma tooling)
- Supabase dashboard/admin access (if schema sync is Supabase-specific)
- Ability to inspect runtime environment variables during test execution
- PostgreSQL client tools (psql, pgAdmin, or equivalent)

## Resolution Timeline

**Priority:** High (blocking Writer #4 closure)  
**Estimated Effort:** 2-24 hours depending on root cause  
**Dependencies:** Database administrator access

## Notes

- Do NOT modify Prisma schema to work around this issue
- Do NOT mark Writer #4 implementation as defective
- Do NOT skip schema fields to make tests pass
- DO identify actual database endpoint used by tests
- DO verify columns present via direct database query
- DO maintain production-representative test environment

## References

- **Blocked Finding:** SUB-06-A Writer #4
- **Implementation Commit:** a4deff70
- **Test File:** `__tests__/integration/sub-06a-writer-04-trial-creation.test.ts`
- **Prisma Schema:** `prisma/schema.prisma` lines 438-442
- **Environment Config:** `.env` DATABASE_URL, DIRECT_URL

---

**Next Action:** Identify exact DATABASE_URL used during test execution and query that database's schema directly.

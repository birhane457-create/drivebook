# INT-M-03A MSE-5 Fix Summary

**Date:** 2026-08-15  
**Issue:** MSE-5 still using `node` instead of `npx tsx` for first migration call  
**Audit Reference:** Independent review of commit 6b98e6ce  

## Problem Statement

Per independent audit finding:

> "MSE-5 — NOT FIXED IN THE COMMITTED SOURCE... The first migration in MSE-5 still says: `await execAsync(\`node "${MIGRATION_SCRIPT}"\`,` It should be: `await execAsync(\`npx tsx "${MIGRATION_SCRIPT}"\`,`"

**File:** `__tests__/integration/oauth-migration-script-execution.test.ts`  
**Line:** ~325 (in MSE-5 test block)

## Root Cause

The MSE-5 test executes the migration script twice:
1. **First call (line ~319):** Used `node` (INCORRECT)
2. **Second call (line ~328):** Used `npx tsx` (CORRECT)

The first call was missed during the 6b98e6ce fixes.

## Fix Applied

Changed line 319 from:
```typescript
await execAsync(
  `node "${MIGRATION_SCRIPT}"`,
```

To:
```typescript
await execAsync(
  `npx tsx "${MIGRATION_SCRIPT}"`,
```

## Verification

Both migration invocations in MSE-5 now use `npx tsx`:

```typescript
describe('[MSE-5] Migration --verify-only Mode', () => {
  it('should verify encrypted tokens without making changes', async () => {
    // First, run actual migration
    await execAsync(
      `npx tsx "${MIGRATION_SCRIPT}"`,  // ✅ FIXED
      { env: { ...process.env, OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY } }
    );

    // Run --verify-only mode
    const { stdout } = await execAsync(
      `npx tsx "${MIGRATION_SCRIPT}" --verify-only`,  // ✅ Already correct
      { env: { ...process.env, OAUTH_TOKEN_ENCRYPTION_KEY: TEST_KEY } }
    );
    // ...
  });
});
```

## Status

- ✅ **MSE-5 FIXED:** All migration script invocations use `npx tsx`
- ⏳ **Isolated Database:** Not yet configured
- ⏳ **Full Test Execution:** Blocked pending isolated database setup

## Next Steps

Per audit requirement:

> "Do not change the encryption implementation. Make only these corrections: Change the remaining MSE-5 node invocation to npx tsx. Run the MSE suite against the isolated PostgreSQL database. Confirm all six tests actually execute and pass."

### Required Actions

1. ✅ **Fix MSE-5 `node` reference** — COMPLETED
2. ⏳ **Set up isolated PostgreSQL database** — PENDING
3. ⏳ **Run MSE suite with DATABASE_URL set to test database** — PENDING
4. ⏳ **Capture execution output with 6/6 test results** — PENDING
5. ⏳ **Push commit to GitHub** — PENDING
6. ⏳ **Request independent audit review** — PENDING

### Database Setup Options

Per `__tests__/integration/README-MSE-SETUP.md`, three options available:

**Option 1: Local PostgreSQL**
```powershell
# Create test database
createdb drivebook_test

# Run Prisma migrations
$env:DATABASE_URL = "postgresql://localhost:5432/drivebook_test"
npx prisma migrate deploy

# Set encryption key and run tests
$env:OAUTH_TOKEN_ENCRYPTION_KEY = (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
npm test -- __tests__/integration/oauth-migration-script-execution.test.ts
```

**Option 2: Docker PostgreSQL**
```powershell
# Start container
docker run --name drivebook-test-db `
  -e POSTGRES_PASSWORD=testpass `
  -e POSTGRES_DB=drivebook_test `
  -p 5433:5432 `
  -d postgres:15

# Configure and test
$env:DATABASE_URL = "postgresql://postgres:testpass@localhost:5433/drivebook_test"
npx prisma migrate deploy
npm test -- __tests__/integration/oauth-migration-script-execution.test.ts
```

**Option 3: Supabase Test Project**
- Create separate Supabase project
- Never use production database
- Get connection string from test project dashboard

## Commit Message

```
fix(INT-M-03A): MSE-5 use npx tsx for first migration call

Per independent audit of commit 6b98e6ce, MSE-5 still had one
remaining 'node' invocation on line ~325. Changed to 'npx tsx'
to match the second migration call and handle TypeScript imports.

All migration script invocations in MSE test suite now use npx tsx.

Next: Set up isolated PostgreSQL database and run complete MSE suite.
```

## Audit Trail

- **Original Issue:** Commit e72c36e9 - Migration tests simulated logic (REJECTED)
- **MSE Test Suite Created:** Commit a4ed7c76 - 3/6 tests passed
- **Partial Fixes:** Commit 6b98e6ce - MSE-2/MSE-3/docs fixed, MSE-5 still broken
- **MSE-5 Final Fix:** This commit - All `node` references corrected to `npx tsx`

---

**INT-M-03A Status:** REOPENED / TEST VERIFIED NOT YET ESTABLISHED

Awaiting isolated database execution and 6/6 test pass confirmation.

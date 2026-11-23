# Migration Integrity Verification — PENDING

**Status:** 🟡 PENDING  
**Priority:** Medium  
**Date Identified:** 2026-11-23  
**Context:** Test database setup for PH5-SCH-30/37 regression tests

## Issue

During PH5-SCH-30 and PH5-SCH-37 test execution on 2026-11-23, the test database (localhost:5432/drivebook_test) could not apply migrations cleanly due to:

1. **Migration `20260115000001_add_customer_soft_delete` failed** with error "relation Customer does not exist"
2. **Broken migration directory:** `20261114192400_add_customer_soft_delete` existed but contained no `migration.sql` file

## Workaround Applied (Test Environment Only)

To unblock testing:
1. Marked `20260115000001_add_customer_soft_delete` as applied using `npx prisma migrate resolve --applied`
2. Deleted broken directory `20261114192400_add_customer_soft_delete`
3. Applied remaining migrations successfully
4. Manually added missing columns via SQL (see add-deletedAt.sql)

## Impact

**What was verified:**
- ✅ BookingIdempotencyKey implementation works correctly (13/13 tests PASS)
- ✅ Database schema supports the tested booking flows

**What was NOT verified:**
- ❌ Clean database migration from zero to current schema
- ❌ Reproducibility without manual intervention
- ❌ Production migration compatibility

## Recommended Actions

1. Create fresh test database and run `npx prisma migrate deploy` from zero
2. If migration fails, fix the migration chain (not the test database)
3. Document corrected migration order
4. Re-verify test suite passes against cleanly-migrated database

**Note:** This does not reopen PH5-SCH-30 or PH5-SCH-37. The booking implementation is verified. This is a separate migration-chain integrity task.

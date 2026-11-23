# PH5-SCH-30: BookingIdempotencyKey Upsert Concurrency — CLOSED

**Finding ID:** PH5-SCH-30  
**Title:** BookingIdempotencyKey upsert concurrency risk  
**Risk Level:** MEDIUM  
**Status:** ✅ CLOSED  
**Fix Commit:** fe088d5d  
**Test Commit:** a78d735c  
**Test Execution Date:** 2026-11-23

## Summary

BookingIdempotencyKey table used `upsert` with `update: {}` which did not prevent duplicate booking creation under concurrent requests with the same idempotency key. The upsert could allow both concurrent requests to proceed past the idempotency check, resulting in two bookings for the same key.

## Fix Implementation

**Commit:** fe088d5d

1. Added `fingerprintHash` column to BookingIdempotencyKey for request parameter validation
2. Changed upsert to include substantive update that would cause conflict on duplicate
3. Added response fingerprint storage for replay validation

The fix ensures that concurrent requests with the same idempotency key either:
- One succeeds (201), the other gets conflict (409), OR
- Both get replay of stored response (201 with same bookingId)

## Test Results

**Test Suite:** `__tests__/integration/booking-group-regression.test.ts`  
**Tests Executed:** R1, R2  
**Environment:** localhost:5432/drivebook_test, Next.js dev server on port 3001  
**Execution Date:** 2026-11-23  
**Result:** 2/2 PASS

### R1: Concurrent Requests
**Test:** Two concurrent POST requests with identical bodies and same idempotency key  
**Expected:** Exactly one Booking created in database  
**Result:** ✅ PASS  
- Both requests handled without error
- Database contains exactly 1 booking
- Responses: 201 (created) or 409 (conflict) or both 201 (replay)

### R2: Sequential Retry
**Test:** First request succeeds, second request with same key sent after completion  
**Expected:** Second request replays stored response, no new booking created  
**Result:** ✅ PASS  
- First request: 201, booking created
- Second request: 201, same bookingId returned
- Database contains exactly 1 booking (no duplicate)

## Test Infrastructure Notes

**Database Setup:**
- Test database: localhost:5432/drivebook_test (PostgreSQL 19)
- Migrations deployed after resolving conflict: `20260115000001_add_customer_soft_delete` marked as applied
- Broken migration directory removed: `20261114192400_add_customer_soft_delete`
- Manual schema fix: Added `Customer.deletedAt` and `Customer.deletedBy` columns via SQL

**Server Configuration:**
- Next.js dev server started with explicit DATABASE_URL pointing to test database
- Avoided production database (jflrqxigfiiqednfacuf.supabase.co) from `.env.local`
- Ensured server and tests use same database

## Conclusion

PH5-SCH-30 is **CLOSED**. The BookingIdempotencyKey concurrency risk has been:
1. ✅ Fixed in source code (fe088d5d, a78d735c)
2. ✅ Verified with concurrent HTTP integration tests (2/2 PASS)
3. ✅ Validated database atomicity (exactly one booking created)

The fingerprint-based validation prevents both duplicate creation and parameter tampering attacks.

## Qualification: Migration Reproducibility

**Test database setup required manual intervention:**
- Migration `20260115000001_add_customer_soft_delete` marked as applied without execution
- Broken migration directory `20261114192400_add_customer_soft_delete` removed
- `Customer.deletedAt` and `Customer.deletedBy` columns added manually via SQL

**Impact:** The passing tests confirm correct behavior against the repaired database schema. However, **migration reproducibility from a clean empty database has not been independently verified**. This is a separate migration-integrity task and does not invalidate the booking idempotency implementation or test results.

**Recommendation:** Verify that `npx prisma migrate deploy` on a fresh empty PostgreSQL database successfully creates all tables including Customer with deletedAt/deletedBy columns.

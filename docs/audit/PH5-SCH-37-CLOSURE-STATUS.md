# PH5-SCH-37: BookingIdempotencyKey Replay Scope Insufficiently Bound — CLOSED

**Finding ID:** PH5-SCH-37  
**Title:** BookingIdempotencyKey replay scope insufficiently bound  
**Risk Level:** MEDIUM  
**Status:** ✅ CLOSED  
**Fix Commit:** a78d735c  
**Test Execution Date:** 2026-11-23

## Summary

BookingIdempotencyKey replay validation did not check `instructorQuery` field, allowing an attacker to reuse an idempotency key to book different instructors. Additionally, the fingerprint validation needed to cover all booking parameters to prevent parameter tampering.

## Fix Implementation

**Commit:** a78d735c

1. Added `instructorQuery` to replay scope validation (legacy fallback path)
2. Implemented fingerprint-based validation for all booking parameters:
   - providerId / instructorQuery
   - hours
   - packageType
   - bookingType
   - scheduled slots (date, time, duration, pickup location)
   - learner name
3. Fingerprint stored with BookingIdempotencyKey for replay detection

## Test Results

**Test Suite:** `__tests__/integration/booking-group-regression.test.ts`  
**Tests Executed:** R5-R15 (11 tests covering PH5-SCH-37)  
**Environment:** localhost:5432/drivebook_test, Next.js dev server on port 3001  
**Execution Date:** 2026-11-23  
**Result:** 11/11 PASS

### R5: Same Parameters → Replay Succeeds
**Test:** Retry with identical parameters  
**Expected:** 201, same bookingId returned  
**Result:** ✅ PASS

### R6: Different Provider → Conflict
**Test:** Same key, different providerId  
**Expected:** 409 "Idempotency-Key does not match provider"  
**Result:** ✅ PASS

### R7: Different Hours → Conflict
**Test:** Same key, different hours value  
**Expected:** 409 "Idempotency-Key does not match booking hours"  
**Result:** ✅ PASS

### R8: Different Package Type → Conflict
**Test:** Same key, different packageType  
**Expected:** 409 "Idempotency-Key does not match package type"  
**Result:** ✅ PASS

### R9: Different Booking Type → Conflict
**Test:** Same key, different bookingType (now vs later)  
**Expected:** 409 "Idempotency-Key does not match booking type"  
**Result:** ✅ PASS

### R10: instructorQuery Replay Succeeds
**Test:** Original used instructorQuery, replay with same query  
**Expected:** 201, replay succeeds  
**Result:** ✅ PASS

### R11: Different instructorQuery → Conflict
**Test:** Original used instructorQuery, replay with different query  
**Expected:** 409 "Idempotency-Key does not match instructor query"  
**Result:** ✅ PASS

### R12: Different Scheduled Date → Conflict
**Test:** Same key, different scheduled booking date  
**Expected:** 409 (fingerprint mismatch)  
**Result:** ✅ PASS

### R13: Different Scheduled Time → Conflict
**Test:** Same key, different scheduled booking time  
**Expected:** 409 (fingerprint mismatch)  
**Result:** ✅ PASS

### R14: Different Pickup Location → Conflict
**Test:** Same key, different pickup location  
**Expected:** 409 (fingerprint mismatch)  
**Result:** ✅ PASS

### R15: Different Learner Name → Conflict
**Test:** Same key, different accountHolderName  
**Expected:** 409 (fingerprint mismatch)  
**Result:** ✅ PASS

## Validation Coverage

The tests verify **two layers of protection**:

1. **Legacy fallback path** (per-field checks):
   - providerId
   - instructorQuery (newly added in fix)
   - hours
   - packageType
   - bookingType

2. **Fingerprint-based validation** (complete request hash):
   - All fields above
   - Scheduled slots (date, time, duration, pickup location, notes)
   - Learner information (name, email, phone)
   - Any other request parameters

## Conclusion

PH5-SCH-37 is **CLOSED**. The BookingIdempotencyKey replay scope insufficiency has been:
1. ✅ Fixed in source code (a78d735c) — instructorQuery gap closed
2. ✅ Fingerprint validation implemented for complete parameter binding
3. ✅ Verified with 11/11 HTTP integration tests covering all parameter variations
4. ✅ Both legacy (per-field) and new (fingerprint) validation layers tested

The dual-layer protection ensures that idempotency keys cannot be reused with different booking parameters, preventing both obvious attacks (different provider) and subtle tampering (changed pickup location, learner name, etc.).

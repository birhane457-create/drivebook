# SUB-06-B: PostgreSQL Serialization Error Not Retried
**Date Discovered:** 2026-09-28  
**Status:** OPEN  
**Severity:** MEDIUM  
**Related:** SUB-06-A (discovered during watermark remediation testing)

## Summary

Invoice webhook handlers (`payment_succeeded` and `payment_failed`) do not retry transactions when PostgreSQL serialization errors (Code 40001) occur during concurrent updates. Handlers return HTTP 500 instead of retrying the operation.

## Discovery Context

This defect was discovered during SUB-06-A watermark remediation testing when running concurrent webhook scenarios:
- Test 9/9: "Should handle concurrent invoice.payment_succeeded + invoice.payment_failed with serialization retry"
- Two handlers executed simultaneously on the same subscription
- First handler succeeded, second handler hit serialization conflict
- Expected: Retry and eventual success (HTTP 200)
- Actual: Immediate failure (HTTP 500)

## Evidence

**Test Output:**
```
[2026-09-28T13:04:23.052Z] ERROR: 🚨❌ Webhook handler error for invoice.payment_failed
{"error":"Raw query failed. Code: `40001`. Message: `could not serialize access due to concurrent update`"}

❌ expected 500 to be 200 // Object.is equality
```

**Error Code:** PostgreSQL 40001 - "could not serialize access due to concurrent update"

**Location:** `app/api/stripe/webhook/route.ts` - Invoice payment handlers

**Test File:** `__tests__/integration/sub-06-a-invoice-handlers.test.ts:721`

**Commit SHA:** `70e6d43ad370df1bb4bed78acec320f652f3a0c5`

## Technical Analysis

### Current Behavior

When concurrent webhook handlers update the same subscription:
1. Handler A locks Provider record and begins transaction
2. Handler B attempts to lock same Provider record
3. PostgreSQL detects serialization conflict (40001)
4. Error bubbles up to handler
5. Handler logs error and returns HTTP 500
6. **No retry attempted**

### Expected Behavior

When serialization error occurs:
1. Catch PostgreSQL error code 40001
2. Wait with exponential backoff (e.g., 50ms, 100ms, 200ms)
3. Retry transaction (2-3 attempts recommended)
4. Return HTTP 200 on success
5. Return HTTP 500 only after all retries exhausted

### Root Cause

The invoice payment handlers lack retry logic for transient database conflicts. The error handling catches the exception but does not distinguish between:
- **Transient errors** (40001 - serialization) → Should retry
- **Permanent errors** (constraint violations, invalid data) → Should fail immediately

## Impact Assessment

### Severity: MEDIUM

**Why not HIGH:**
- Does not affect single-threaded webhook processing (most common case)
- Stripe has built-in webhook retry mechanism (will retry failed webhooks)
- Only affects concurrent updates to same subscription

**Why not LOW:**
- Real production scenario (concurrent webhooks can occur)
- Creates unnecessary webhook retry burden on Stripe
- Poor user experience (delayed state updates)

### Affected Scenarios

**Likely to trigger:**
- Subscription updated while payment processing
- Multiple invoice events for same subscription within seconds
- Manual admin actions concurrent with automated webhooks

**Unlikely to trigger:**
- Single webhook events (sequential processing)
- Different subscriptions (no resource contention)
- Non-overlapping event types

## Scope Clarification

### Relationship to SUB-06-A

**NOT BLOCKING SUB-06-A watermark remediation:**
- Watermark defect (Date.now() vs event.created) is a separate issue
- 8/9 non-concurrent scenarios prove watermark fix works correctly
- Serialization retry was not part of original SUB-06-A scope

**SEPARATE DEFECT:**
- Different root cause (missing retry logic vs incorrect timestamp source)
- Different fix required (add retry wrapper vs change timestamp source)
- Different acceptance criteria

## Acceptance Criteria

### Definition of Done

1. ✅ **Detect serialization errors**
   - Catch PostgreSQL error code 40001
   - Distinguish from other database errors

2. ✅ **Implement retry logic**
   - Maximum 3 retry attempts
   - Exponential backoff (50ms, 100ms, 200ms)
   - Log retry attempts for observability

3. ✅ **Return correct HTTP status**
   - HTTP 200 after successful retry
   - HTTP 500 only after all retries exhausted
   - Include retry metadata in error logs

4. ✅ **Test verification**
   - Concurrent test scenario passes (9/9)
   - Logs show retry attempts
   - Final state consistent with latest event

## Proposed Solution

### Implementation Approach

```typescript
async function withSerializationRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      // Check if it's a PostgreSQL serialization error
      if (error.code === '40001' || error.message?.includes('could not serialize')) {
        if (attempt < maxAttempts) {
          const backoffMs = 50 * Math.pow(2, attempt - 1);
          console.warn(`Serialization conflict, retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
      }
      // Non-retryable error or max attempts reached
      throw error;
    }
  }
  throw new Error('Retry logic failed to return or throw');
}
```

### Integration Points

**Wrap critical sections:**
1. Invoice payment_succeeded handler (Writer #7)
2. Invoice payment_failed handler (Writer #8)
3. Other subscription state mutation handlers

**Example usage:**
```typescript
await withSerializationRetry(async () => {
  return await prisma.$transaction(async (tx) => {
    // ... existing Provider-first locking logic
  });
});
```

## Testing Plan

### Verification Steps

1. **Unit test:** Verify retry logic with mocked errors
2. **Integration test:** Existing test 9/9 should pass
3. **Manual test:** Trigger concurrent webhooks in staging
4. **Observability:** Confirm retry logs appear in production monitoring

### Success Criteria

- Test 9/9 passes with both handlers returning HTTP 200
- Logs show serialization conflict detected and retried
- Final subscription state matches latest event timestamp
- No regressions in non-concurrent scenarios (tests 1-8 still pass)

## Recommendations

### Priority: MEDIUM

**Rationale:**
- Not blocking SUB-06-A watermark verification
- Affects edge case scenarios only
- Stripe's built-in retry provides safety net
- Should be fixed before production deployment

### Sequence

1. ✅ **Complete SUB-06-A watermark remediation** (Writers #7-8 done, proceed to #3-6, #9-12)
2. 🔄 **Implement serialization retry** (this finding)
3. 🔄 **Re-run full test suite** (all 9/9 should pass)
4. ✅ **Close SUB-06-A** (when all writers verified AND retry implemented)

### Timeline

- Estimated effort: 2-4 hours (implementation + testing)
- Can be done in parallel with remaining writer remediation
- Should be completed before closing SUB-06-A entirely

## Related Documents

- **SUB-06-A_TEST_RESULTS_FINAL.md** - Test output showing 8/9 pass
- **SUB-06-A_DISCOVERY.md** - Original watermark defect discovery
- **SUB-06-A_WRITER_INVENTORY.md** - Complete writer analysis
- **test-sub-06-a-COMPLETE.txt** - Raw test output with 40001 error

## Audit Trail

| Date | Status | Notes |
|------|--------|-------|
| 2026-09-28 | DISCOVERED | Found during concurrent test scenario (test 9/9) |
| 2026-09-28 | DOCUMENTED | Created this finding document |
| TBD | IN_PROGRESS | Implementation begins |
| TBD | TEST-VERIFIED | Integration test 9/9 passes |
| TBD | CLOSED | Deployed to production |

---

**Note:** This is a separate defect from SUB-06-A watermark remediation. The watermark fix (Writers #7-8) is TEST-VERIFIED and can proceed independently. This serialization retry implementation should be completed before final SUB-06-A closure.

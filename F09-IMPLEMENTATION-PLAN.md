# F-09 Implementation Plan

## Transaction Safety Analysis Results

### Summary
- **Total transactions**: 11
- **Safe for retry**: 8 transactions (no external side effects)
- **Require refactoring**: 3 transactions (audit log calls use global prisma)

### Transaction Details

#### ✅ SAFE - No Refactoring Required (8 transactions)

1. **Line 448** - `checkout.session.completed` (first case)
   - Pure database operations with `tx`
   - Safe for retry

2. **Line 679** - `handleWalletPaymentSuccess`
   - Pure database operations with `tx`
   - Safe for retry

3. **Line 876** - Booking payment (`payment_intent.succeeded`)
   - Throws `ExpiredBookingError` (refund handled outside)
   - Pure database operations with `tx`
   - Safe for retry

4. **Line 1317** - `handleBookingPaymentFailed`
   - Pure database operations with `tx`
   - Safe for retry

5. **Line 1608** - `handleTrialEnding` (webhook record only)
   - Pure database operations with `tx`
   - Safe for retry
   - Note: Email sent AFTER transaction

6. **Line 1656** - `handleInvoicePaymentSucceeded`
   - Pure database operations with `tx`
   - Safe for retry

7. **Line 1701** - `handleInvoicePaymentFailed`
   - Pure database operations with `tx`
   - Safe for retry

8. **Line 2237** - `checkout.session.completed` (connect account)
   - Pure database operations with `tx`
   - Safe for retry

#### ⚠️ REQUIRES REFACTORING (3 transactions)

9. **Line 562** - `checkout.session.completed` (subscription)
   - Contains: `await logSubscriptionAction(...)` using global `prisma`
   - **Fix**: Move audit log call AFTER transaction completes
   - Return subscription data from transaction for audit logging

10. **Line 1427** - `subscription.updated`
    - Contains: `await logSubscriptionAction(...)` using global `prisma`
    - **Fix**: Move audit log call AFTER transaction completes
    - Return subscription data from transaction for audit logging

11. **Line 1571** - `subscription.cancelled`
    - Contains: `await logSubscriptionAction(...)` using global `prisma`
    - **Fix**: Move audit log call AFTER transaction completes
    - Return subscription data from transaction for audit logging

## Implementation Steps

### Step 1: Refactor 3 Transactions with Audit Logs

For each transaction (#9, #10, #11):
1. Remove `logSubscriptionAction` call from inside transaction
2. Capture necessary data during transaction
3. Move `logSubscriptionAction` call after transaction completes
4. Use try-catch around audit log (non-fatal)

### Step 2: Add withSerializableRetry Wrapper

Wrap all 11 transactions with:
```typescript
await withSerializableRetry(async () => {
  await prisma.$transaction(async (tx) => {
    // existing transaction code
  }, SERIALIZABLE_TX);
});
```

### Step 3: Add Idempotency Key for Expired Booking Refund

In the `ExpiredBookingError` catch block, use deterministic idempotency key:
```typescript
await stripe.refunds.create({
  payment_intent: err.paymentIntentId,
  reason: 'duplicate',
  metadata: {
    bookingId: err.bookingId,
    reason: 'Booking expired before payment confirmed',
  },
}, {
  idempotencyKey: `expired-booking-refund-${err.bookingId}-${err.paymentIntentId}`
});
```

### Step 4: Create Regression Tests

Test file: `app/api/stripe/webhook/__tests__/f09-retry.test.ts`

Tests:
- A. P2034 retry succeeds on second attempt
- B. Retry exhaustion propagates error
- C. Non-retryable errors not retried  
- D. Expired booking produces exactly one refund
- E. Expired booking + P2034 = one refund
- F. No duplicate side effects on retry
- G. Existing flows unchanged

### Step 5: Verification

1. Run TypeScript validation
2. Run F-09 test suite
3. Run existing webhook tests
4. Inspect git diff
5. Update AREA6_AUDIT_FINDINGS.md

## Expected Files Changed

1. `app/api/stripe/webhook/route.ts` - Add retry wrappers, refactor audit logs
2. `app/api/stripe/webhook/__tests__/f09-retry.test.ts` - New test file
3. `docs/AREA6_AUDIT_FINDINGS.md` - Mark F-09 as FIXED/VERIFIED

## Success Criteria

- ✅ All 11 transactions wrapped with withSerializableRetry
- ✅ No external side effects inside transaction callbacks
- ✅ Expired booking refund uses idempotency key
- ✅ All F-09 tests pass
- ✅ Existing webhook tests pass
- ✅ TypeScript validates without errors

# Ledger Atomicity Audit

**Date:** 2026-11-23  
**Scope:** All LedgerEntry + PlatformLedger write pairs  
**Status:** IN PROGRESS

---

## Overview

This audit inventories all code paths that write to both `LedgerEntry` (event log) and `PlatformLedger` (singleton totals) to verify atomicity guarantees.

**Root Vulnerability:** If these two writes are not wrapped in a transaction, partial failures can corrupt `PlatformLedger` totals, causing:
- Ghost inflation (totals higher than reality) → platform overpays instructors
- Ghost deflation (totals lower than reality) → legitimate payouts blocked

---

## Findings Summary

| ID | Function | Location | Status | Notes |
|----|----------|----------|--------|-------|
| **PH5-SCH-22** | `recordPaymentCollected()` | payout-service.ts:745 | ✅ FIXED | Wrapped in transaction (ac306e287) |
| **PH5-SCH-22** | `recordRefundIssued()` | payout-service.ts:770 | ✅ FIXED | Wrapped in transaction (fc1a7305b) |
| **PH5-SCH-22a** | `executePayout()` | payout-service.ts:430-445 | ⚠️ OPEN | `Promise.all([PAYOUT_PAID, TAX_WITHHELD, incrementLedger])` |
| **PH5-SCH-22a** | `confirmPayoutReceived()` | payout-service.ts:? | ⚠️ OPEN | Needs inspection |
| TBD | Dispute/chargeback handling | TBD | ⏳ PENDING | Needs inventory |
| TBD | Tax withholding records | TBD | ⏳ PENDING | Needs inventory |

---

## Detailed Analysis

### ✅ **PH5-SCH-22: Payment Collection (FIXED)**

**Function:** `recordPaymentCollected(bookingId, amount, providerPayout)`  
**Call Site:** `app/api/stripe/webhook/route.ts:1634` (payment_intent.succeeded)

**Before Fix:**
```typescript
await Promise.all([
  appendLedgerEntry({ type: 'PAYMENT_COLLECTED', amount, ... }),
  incrementLedger({ totalCollected: amount, totalReserved: providerPayout })
]);
```

**After Fix (ac306e287):**
```typescript
await prisma.$transaction(async (tx) => {
  await appendLedgerEntry({...}, tx);
  await incrementLedger({...}, tx);
});
```

**Verification:** Integration test proves transaction atomicity at Prisma level (3/3 PASS)  
**Limitation:** Test does not force failure during `incrementLedger()` within actual `recordPaymentCollected()` call

---

### ✅ **PH5-SCH-22: Refund Issuance (FIXED)**

**Function:** `recordRefundIssued(bookingId, refundAmount, providerId, postPayout)`  
**Call Sites:** Refund route handlers

**Before Fix:**
```typescript
await Promise.all([
  appendLedgerEntry({ type: 'REFUND_ISSUED', ... }),
  incrementLedger({ totalRefunded: refundAmount }),
  ...(postPayout ? [appendLedgerEntry({ type: 'ADJUSTMENT', ... })] : [])
]);
```

**After Fix (fc1a7305b):**
```typescript
await prisma.$transaction(async (tx) => {
  await appendLedgerEntry({ type: 'REFUND_ISSUED', ... }, tx);
  await incrementLedger({ totalRefunded: refundAmount }, tx);
  if (postPayout) {
    await appendLedgerEntry({ type: 'ADJUSTMENT', ... }, tx);
  }
});
```

**Verification:** Refund path now atomic, same transaction pattern as payment collection

---

### ⚠️ **PH5-SCH-22a: Payout Execution (OPEN)**

**Function:** `executePayout(payoutId, adminUserId)`  
**Location:** `lib/services/payout-service.ts` (estimated lines 365-450)

**Current Code Pattern (from GitHub source):**
```typescript
// Stripe Connect: money moves now
const transfer = await stripe.transfers.create({ ... });

await prisma.payout.update({
  where: { id: payoutId },
  data: { status: 'PAID', stripeTransferId: transfer.id, ... }
});

await Promise.all([
  appendLedgerEntry({
    type: 'PAYOUT_PAID',
    amount: -netAmount,
    referenceId: payoutId,
    ...
  }),
  ...(taxWithheld > 0 ? [appendLedgerEntry({
    type: 'TAX_WITHHELD',
    amount: taxWithheld,
    ...
  })] : []),
  incrementLedger({
    totalPaidOut: netAmount,
    totalTaxWithheld: taxWithheld,
    totalReserved: -netAmount
  })
]);
```

**Vulnerabilities:**

1. **Non-atomic ledger writes:** `Promise.all` allows partial failure
   - If `appendLedgerEntry(PAYOUT_PAID)` succeeds but `incrementLedger` fails → event log has payout but `totalPaidOut` not incremented
   - If `incrementLedger` succeeds but `appendLedgerEntry` fails → `totalPaidOut` incremented but no event log

2. **Stripe transfer atomicity:** The Stripe API call is **external** and cannot be part of database transaction
   - If Stripe succeeds but database writes fail → instructor paid, no ledger record
   - If database succeeds but Stripe idempotency fails → retry may duplicate ledger writes
   - Requires idempotency key correlation between Stripe and database

3. **Payout status update separate:** `prisma.payout.update` happens outside the ledger transaction
   - Could have payout marked PAID but ledger writes failed
   - Or ledger written but payout status not updated

**Required Fix:**
1. Wrap ledger writes (`appendLedgerEntry` + `incrementLedger`) in transaction
2. Document Stripe transfer failure/retry handling separately (cannot be in DB transaction)
3. Consider including payout status update in same transaction as ledger writes

---

### ⚠️ **PH5-SCH-22a: Payout Confirmation (OPEN)**

**Function:** `confirmPayoutReceived()` or similar  
**Location:** Needs inspection  
**Status:** Pending code review

**Expected Pattern:** Bank/manual payouts update ledger when admin confirms receipt  
**Concern:** Likely uses same `Promise.all` pattern as `executePayout()`

---

## External Operation Atomicity

**Problem:** Stripe transfers are external API calls that cannot be rolled back by database transactions.

**Scenarios:**

| Scenario | Stripe | Database | Result |
|----------|--------|----------|--------|
| Happy path | SUCCESS | SUCCESS | ✅ Consistent |
| DB failure | SUCCESS | FAIL | ❌ Instructor paid, no record |
| Stripe failure | FAIL | N/A | ✅ No money moved, no record (correct) |
| Retry after success | Idempotent | Duplicate? | ⚠️ Depends on idempotency design |

**Mitigation Strategy:**
1. **Idempotency:** Use `payout.idempotencyKey` for both Stripe and database operations
2. **State Machine:** Payout status (ELIGIBLE → PROCESSING → PAID) with guard locks
3. **Reconciliation:** Daily cron compares Stripe transfers against LedgerEntry(PAYOUT_PAID)
4. **Retry Logic:** If Stripe succeeds but DB fails, retry DB writes (not Stripe call)

**Current Implementation:** Needs review of retry paths and idempotency enforcement

---

## Recommended Actions

### **Immediate (Before Any SaaS Work):**

1. **Fix `executePayout()` atomicity:**
   - Wrap `appendLedgerEntry` + `incrementLedger` calls in `prisma.$transaction`
   - Document Stripe transfer idempotency separately
   - Consider including payout status update in transaction

2. **Fix `confirmPayoutReceived()` atomicity:**
   - Same transaction wrapping as executePayout

3. **Inventory remaining paths:**
   - Dispute opened/won/lost ledger writes
   - Chargeback handling
   - Refund synced from Stripe dashboard
   - Adjustment ledger entries

### **Medium Term:**

4. **Improve T2 test:**
   - Mock `incrementLedger` to throw error during `recordPaymentCollected()`
   - Verify both operations roll back
   - Current test proves Prisma transaction behavior, not function-level atomicity

5. **Implement reconciliation:**
   - Daily cron comparing:
     - `PlatformLedger.totalCollected` vs `sum(LedgerEntry WHERE type='PAYMENT_COLLECTED')`
     - `PlatformLedger.totalRefunded` vs `sum(LedgerEntry WHERE type='REFUND_ISSUED')`
     - `PlatformLedger.totalPaidOut` vs `sum(LedgerEntry WHERE type='PAYOUT_PAID')`
   - Alert on divergence > $0.01

6. **External operation handling:**
   - Document Stripe transfer retry policy
   - Verify idempotency key usage across all Stripe operations
   - Test failure scenarios (Stripe success + DB failure, etc.)

---

## Testing Strategy

### **Unit Level:**
- Each `recordX()` function should have forced-failure rollback test
- Mock underlying Prisma operations to trigger specific failure points

### **Integration Level:**
- Actual database transactions with constraint violations
- Verify both LedgerEntry and PlatformLedger state after rollback

### **End-to-End:**
- Stripe sandbox testing with network failures
- Idempotency key collision scenarios
- Retry after partial completion

---

## Sign-Off

**Audit Status:** IN PROGRESS  
**Completed:** Payment collection, refund issuance  
**Pending:** Payout execution, payout confirmation, disputes, chargebacks  
**Blocking:** SaaS expansion should wait for complete ledger consistency

**Next Session:** Fix `executePayout()` and `confirmPayoutReceived()`, then inventory remaining paths

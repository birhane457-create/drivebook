# PH5-SCH-22a: Payout Atomicity Source Audit

**Finding ID:** PH5-SCH-22a  
**Severity:** MEDIUM  
**Date:** 2026-11-23  
**Status:** AUDIT IN PROGRESS

---

## Executive Summary

This audit maps the complete payout lifecycle for both Stripe Connect and manual bank transfer paths, identifying:
1. **Database atomicity gaps** (LedgerEntry + PlatformLedger + payout state)
2. **Stripe transfer consistency** (external operation handling)
3. **State machine correctness** (ELIGIBLE → PROCESSING → PAID/FAILED)
4. **Retry and idempotency** (duplicate prevention)
5. **Concurrency risks** (race conditions)

**Critical Finding:** `executePayout()` and `confirmPayoutReceived()` both use `Promise.all()` for ledger writes, allowing partial failures that corrupt financial totals.

---

## Payout State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│ PAYOUT STATE TRANSITIONS                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  buildPayout()                                                   │
│       │                                                          │
│       ▼                                                          │
│   ELIGIBLE ◄─────────────────┐                                  │
│       │                      │                                  │
│       │ executePayout()      │ retry                            │
│       │                      │                                  │
│       ▼                      │                                  │
│  PROCESSING                  │                                  │
│       │                      │                                  │
│       ├─► Stripe Connect ────┼─► PAID (ledger updated)         │
│       │                      │                                  │
│       ├─► Bank/Manual ───────┼─► PENDING_TRANSFER              │
│       │                           │                             │
│       │                           │ markPayoutSent()            │
│       │                           ▼                             │
│       │                         SENT                            │
│       │                           │                             │
│       │                           │ confirmPayoutReceived()     │
│       │                           ▼                             │
│       │                         PAID (ledger updated)           │
│       │                                                         │
│       └─► (error) ───────────► FAILED                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Lock Mechanism:** `updateMany({ where: { status: { in: ['ELIGIBLE', 'FAILED'] } }, data: { status: 'PROCESSING' } })`
- Atomic: only one executor can claim ELIGIBLE → PROCESSING transition
- Prevents duplicate execution

---

## Function 1: `executePayout()` — Stripe Connect Path

### Operation Sequence (Lines 321-520)

| Step | Operation | Type | Current Implementation | Atomicity Risk |
|------|-----------|------|------------------------|----------------|
| 1 | Lock payout status | DB | `updateMany(ELIGIBLE/FAILED → PROCESSING)` | ✅ Atomic (guard lock) |
| 2 | Check balance | DB Read | `assertSufficientBalance()` | ⚠️ TOCTOU (Time-Of-Check-Time-Of-Use) |
| 3 | Verify Stripe ownership | Stripe API | `verifyPayoutDestinationOwnership()` | ✅ Read-only |
| 4 | **Stripe transfer** | **Stripe API** | `stripe.transfers.create()` with idempotencyKey | ⚠️ **EXTERNAL OPERATION** |
| 5 | Update payout status | DB | `payout.update(PROCESSING → PAID)` | ❌ **Separate from ledger** |
| 6 | **Ledger writes** | **DB** | `Promise.all([appendLedgerEntry, incrementLedger])` | ❌ **NON-ATOMIC** |
| 7 | Log transition | DB | `auditLog.create()` | ✅ Independent audit log |
| 8 | Mark adjustments recovered | DB | `ledgerEntry.update()` (loop) | ⚠️ Outside transaction |
| 9 | Send notifications | Email/SMS | Non-critical, fire-and-forget | ✅ OK to fail |

### Detailed Analysis

#### **Step 4: Stripe Transfer (CRITICAL BOUNDARY)**

**Current Code (Lines 388-407):**
```typescript
const transfer = await stripe.transfers.create(
  {
    amount: Math.round(toNumber(toDecimal(payout.netAmount)) * 100),
    currency: 'aud',
    destination: verifiedAccountId,
    // ...
  },
  { idempotencyKey: payout.idempotencyKey },
);
```

**Idempotency Key:** `payout.idempotencyKey` (SHA-256 hash of sorted transaction IDs from `buildPayout()`)

**Failure Scenarios:**

| Scenario | Stripe | DB Status | Ledger | Recovery |
|----------|--------|-----------|--------|----------|
| **A. Network timeout** | Unknown | PROCESSING | Not written | ⚠️ Needs manual check: query Stripe by idempotencyKey |
| **B. Stripe rejects (insufficient funds)** | FAIL | PROCESSING → FAILED | Not written | ✅ Clean, can retry |
| **C. Stripe succeeds, DB update fails** | SUCCESS | PROCESSING | Not written | ❌ **CRITICAL: Money moved, no record** |
| **D. Stripe succeeds, ledger write fails** | SUCCESS | PAID | Partial/none | ❌ **CRITICAL: Payout recorded, ledger corrupt** |

**Current Handling:**
- Try/catch wraps entire sequence
- Error → payout status set to FAILED
- **Problem:** If Stripe succeeds but subsequent operations fail, payout marked FAILED but money already transferred

---

#### **Steps 5-6: Status + Ledger Updates (NON-ATOMIC)**

**Current Code (Lines 409-434):**
```typescript
// Step 5: Update payout status
await prisma.payout.update({
  where: { id: payoutId },
  data: {
    status: 'PAID',
    stripeTransferId: transfer.id,
    paidAt: new Date(),
    failureReason: null,
  },
});

// Step 6: Ledger writes (NON-ATOMIC)
await Promise.all([
  appendLedgerEntry({
    type: 'PAYOUT_PAID',
    amount: -toNumber(payout.netAmount),
    referenceId: payoutId,
    referenceType: 'PAYOUT',
    providerId: payout.providerId,
    description: `${payout.payoutRef} - net payout to instructor (Stripe)`,
    metadata: { stripeTransferId: transfer.id, txCount },
  }),
  ...(Number(payout.taxWithheld) > 0
    ? [appendLedgerEntry({
        type: 'TAX_WITHHELD',
        amount: toNumber(payout.taxWithheld),
        // ...
      })]
    : []),
  incrementLedger({
    totalPaidOut: toNumber(payout.netAmount),
    totalReserved: -toNumber(payout.grossAmount),
    totalTaxWithheld: toNumber(payout.taxWithheld),
  }),
]);
```

**Vulnerabilities:**

1. **Payout status separate from ledger**
   - If status update succeeds but `Promise.all` fails → payout marked PAID but ledger not updated
   - Reconciliation would see: status=PAID, no LedgerEntry(PAYOUT_PAID)

2. **Ledger writes non-atomic (Promise.all)**
   - If `appendLedgerEntry(PAYOUT_PAID)` succeeds but `incrementLedger` fails:
     - Event log: "Payout $500 to instructor"
     - PlatformLedger.totalPaidOut: NOT incremented
     - **Result:** Ledger says no payout, event log says payout happened
   
   - If `incrementLedger` succeeds but `appendLedgerEntry` fails:
     - PlatformLedger.totalPaidOut: Incremented by $500
     - Event log: No PAYOUT_PAID entry
     - **Result:** Totals say payout happened, but no audit trail

3. **TAX_WITHHELD conditional in Promise.all**
   - If tax > 0, creates 3 parallel writes (PAYOUT_PAID, TAX_WITHHELD, incrementLedger)
   - Any partial failure corrupts accounting

---

#### **Step 2: Balance Check (TOCTOU Race)**

**Current Code (Line 365):**
```typescript
await assertSufficientBalance(Number(payout.netAmount));
```

**Vulnerability:**
```
Time   Process A              Process B
─────────────────────────────────────────────
T0     Check balance: $1000   
       Need: $600 ✅          
T1                            Check balance: $1000
                              Need: $600 ✅
T2     Stripe transfer $600   
T3                            Stripe transfer $600
T4     Balance: $1000 - $1200 = -$200 ❌
```

**Mitigation:**
- `assertNonNegativeBalance()` runs AFTER ledger writes (line 445)
- If balance goes negative, throws error and sends CRITICAL alert
- **Problem:** Money already transferred to both instructors — cannot undo Stripe transfers

**Better Approach:**
- SELECT FOR UPDATE on PlatformLedger before Stripe call
- Or pessimistic lock with explicit reservation

---

## Function 2: `confirmPayoutReceived()` — Bank Transfer Path

### Operation Sequence (Lines 633-679)

| Step | Operation | Type | Current Implementation | Atomicity Risk |
|------|-----------|------|------------------------|----------------|
| 1 | Read payout | DB | `payout.findUnique()` | ⚠️ No lock |
| 2 | Validate status | Logic | `if (status !== 'SENT')` | ⚠️ No concurrency guard |
| 3 | Update payout status | DB | `payout.update(SENT → PAID)` | ❌ Separate from ledger |
| 4 | **Ledger writes** | **DB** | `Promise.all([appendLedgerEntry, incrementLedger])` | ❌ **NON-ATOMIC** |
| 5 | Log transition | DB | `auditLog.create()` | ✅ Independent audit log |

### Detailed Analysis

**Current Code (Lines 639-676):**
```typescript
const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
if (!payout) throw new Error('Payout not found');
if (payout.status !== 'SENT') throw new Error(`Cannot confirm: payout is ${payout.status}`);

await prisma.payout.update({
  where: { id: payoutId },
  data: {
    status: 'PAID',
    paidAt: new Date(),
    confirmedAt: new Date(),
    confirmedBy: adminUserId,
    failureReason: null,
  },
});

// Ledger updated now that money is confirmed moved
await Promise.all([
  appendLedgerEntry({ type: 'PAYOUT_PAID', ... }),
  ...(Number(payout.taxWithheld) > 0 ? [appendLedgerEntry({ type: 'TAX_WITHHELD', ... })] : []),
  incrementLedger({ totalPaidOut, totalReserved, totalTaxWithheld }),
]);
```

**Vulnerabilities:**

1. **No concurrency lock**
   - `findUnique` → check → `update` is NOT atomic
   - Two admins could call `confirmPayoutReceived()` concurrently
   - Both see `status='SENT'`, both proceed
   - First `update` succeeds (SENT → PAID)
   - Second `update` succeeds (overwrites timestamps)
   - Both execute `Promise.all` for ledger writes
   - **Result:** Ledger written TWICE for same payout

2. **Same non-atomic ledger pattern as `executePayout()`**
   - Payout status update separate from ledger writes
   - `Promise.all` allows partial failures
   - Same corruption scenarios as Stripe path

**Race Condition Example:**
```
Time   Admin A                Admin B
──────────────────────────────────────────────────
T0     Read: status='SENT'    
T1                            Read: status='SENT'
T2     Update: SENT→PAID      
T3                            Update: PAID→PAID (succeeds, updates timestamps)
T4     Ledger: +$500 paidOut  
T5                            Ledger: +$500 paidOut (DUPLICATE!)
T6     Total paidOut: $1000 (should be $500) ❌
```

---

## Function 3: `markPayoutSent()` — Intermediate State

### Operation Sequence (Lines 608-629)

| Step | Operation | Type | Current Implementation | Atomicity Risk |
|------|-----------|------|------------------------|----------------|
| 1 | Update status | DB | `updateMany(PENDING_TRANSFER → SENT)` | ✅ Atomic guard |
| 2 | Validate success | DB | Check `updated.count` | ✅ |
| 3 | Log transition | DB | `auditLog.create()` | ✅ Independent |

**Current Code:**
```typescript
const updated = await prisma.payout.updateMany({
  where: { id: payoutId, status: 'PENDING_TRANSFER' },
  data: {
    status: 'SENT',
    bankReference,
    sentAt: new Date(),
    sentBy: adminUserId,
  },
});

if (updated.count === 0) {
  const current = await prisma.payout.findUnique({ where: { id: payoutId } });
  throw new Error(`Cannot mark sent: payout is ${current?.status ?? 'not found'}`);
}
```

**Analysis:** ✅ **CORRECT**
- `updateMany` with status guard is atomic
- Only transitions from PENDING_TRANSFER → SENT
- Cannot be called twice on same payout
- No ledger writes at this stage (ledger updated later in `confirmPayoutReceived`)

---

## Identified Vulnerabilities Summary

| ID | Function | Vulnerability | Severity | Impact |
|----|----------|---------------|----------|--------|
| **V1** | `executePayout` | Payout status update separate from ledger writes | HIGH | Payout=PAID but ledger not updated |
| **V2** | `executePayout` | `Promise.all` ledger writes (non-atomic) | HIGH | Partial ledger updates |
| **V3** | `executePayout` | Stripe transfer not in DB transaction | ARCHITECTURAL | Money moved but DB fails → orphaned transfer |
| **V4** | `executePayout` | TOCTOU balance check | MEDIUM | Concurrent payouts can overdraw balance |
| **V5** | `executePayout` | Adjustment recovery outside transaction | LOW | Adjustments may not be marked recovered |
| **V6** | `confirmPayoutReceived` | No concurrency lock | HIGH | Duplicate ledger writes |
| **V7** | `confirmPayoutReceived` | Same non-atomic ledger pattern as V1/V2 | HIGH | Same corruption scenarios |

---

## Required Fixes

### **Fix 1: Database Atomicity (V1, V2, V7)**

**Wrap status + ledger writes in single transaction:**

```typescript
// executePayout() - after Stripe transfer succeeds
await prisma.$transaction(async (tx) => {
  // Update payout status
  await tx.payout.update({
    where: { id: payoutId },
    data: {
      status: 'PAID',
      stripeTransferId: transfer.id,
      paidAt: new Date(),
      failureReason: null,
    },
  });

  // Ledger writes (atomic with status)
  await appendLedgerEntry({
    type: 'PAYOUT_PAID',
    amount: -toNumber(payout.netAmount),
    referenceId: payoutId,
    referenceType: 'PAYOUT',
    providerId: payout.providerId,
    description: `${payout.payoutRef} - net payout to instructor (Stripe)`,
    metadata: { stripeTransferId: transfer.id, txCount },
  }, tx);

  if (Number(payout.taxWithheld) > 0) {
    await appendLedgerEntry({
      type: 'TAX_WITHHELD',
      amount: toNumber(payout.taxWithheld),
      referenceId: payoutId,
      referenceType: 'PAYOUT',
      providerId: payout.providerId,
      description: `${payout.payoutRef} - ATO withholding`,
    }, tx);
  }

  await incrementLedger({
    totalPaidOut: toNumber(payout.netAmount),
    totalReserved: -toNumber(payout.grossAmount),
    totalTaxWithheld: toNumber(payout.taxWithheld),
  }, tx);
});
```

**Result:**
- If any ledger write fails, payout status rolls back to PROCESSING
- Payout never marked PAID without complete ledger record
- All-or-nothing guarantee

---

### **Fix 2: Concurrency Lock for confirmPayoutReceived (V6)**

**Use atomic status transition:**

```typescript
export async function confirmPayoutReceived(
  payoutId: string,
  adminUserId: string,
) {
  // Atomic lock: only transitions SENT → PAID once
  const updated = await prisma.payout.updateMany({
    where: { id: payoutId, status: 'SENT' },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      confirmedAt: new Date(),
      confirmedBy: adminUserId,
      failureReason: null,
    },
  });

  if (updated.count === 0) {
    const current = await prisma.payout.findUnique({ where: { id: payoutId } });
    throw new Error(`Cannot confirm: payout is ${current?.status ?? 'not found'}`);
  }

  // Now read confirmed payout for ledger writes
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new Error('Payout not found after confirmation');

  // Ledger writes in transaction (similar to executePayout fix)
  await prisma.$transaction(async (tx) => {
    await appendLedgerEntry({
      type: 'PAYOUT_PAID',
      // ...
    }, tx);

    if (Number(payout.taxWithheld) > 0) {
      await appendLedgerEntry({ type: 'TAX_WITHHELD', ... }, tx);
    }

    await incrementLedger({ totalPaidOut, totalReserved, totalTaxWithheld }, tx);
  });

  await logTransition(payoutId, adminUserId, 'PAYOUT_CONFIRMED', { ... });
}
```

**Result:**
- Status update happens ONCE (atomic guard via `updateMany`)
- Ledger writes in separate transaction (can retry if fail)
- No duplicate ledger entries

---

### **Fix 3: Stripe Transfer Consistency (V3)**

**Current behavior is ACCEPTABLE if properly documented:**

1. **Stripe transfer uses idempotency key** ✅
   - Retries with same `payout.idempotencyKey` are safe
   - Stripe returns existing transfer if already created

2. **Error handling needs improvement:**

```typescript
try {
  const transfer = await stripe.transfers.create(
    { ... },
    { idempotencyKey: payout.idempotencyKey },
  );

  // ✅ Stripe succeeded, now update DB atomically
  await prisma.$transaction(async (tx) => {
    await tx.payout.update({ ... status: 'PAID' ... });
    await appendLedgerEntry({ ... }, tx);
    await incrementLedger({ ... }, tx);
  });

} catch (err) {
  // Check if Stripe transfer actually succeeded
  if (err.type === 'StripeConnectionError') {
    // Network timeout — transfer status unknown
    // ⚠️ Query Stripe to check if transfer exists with idempotencyKey
    const existingTransfer = await stripe.transfers.list({
      limit: 1,
      // Stripe doesn't support querying by idempotency key directly
      // Need to check payout metadata or use Stripe events
    });
    
    // If transfer found, treat as success and update DB
    // If not found, treat as failure
  }

  // Other Stripe errors: treat as failure, mark payout FAILED
  await prisma.payout.update({
    where: { id: payoutId },
    data: { status: 'FAILED', failureReason: err.message },
  });
  
  throw err;
}
```

**Better approach:** Use Stripe webhooks
- `transfer.paid` event confirms money moved
- Webhook handler updates payout status + ledger atomically
- More reliable than inline error handling

---

### **Fix 4: Balance Check TOCTOU (V4)**

**Option A: Pessimistic Locking**
```typescript
await prisma.$transaction(async (tx) => {
  // Lock PlatformLedger row
  const ledger = await tx.platformLedger.findUnique({
    where: { key: 'default' },
    // Note: Prisma doesn't support SELECT FOR UPDATE directly
    // Would need raw SQL: SELECT * FROM "PlatformLedger" WHERE key='default' FOR UPDATE
  });

  const availableBalance = Number(ledger!.totalCollected) - Number(ledger!.totalPaidOut) - Number(ledger!.totalRefunded);
  
  if (netAmount > availableBalance) {
    throw new Error('Insufficient balance');
  }

  // Proceed with Stripe transfer (outside this transaction)
});
```

**Option B: Reconciliation Alert (Current approach is acceptable)**
- `assertNonNegativeBalance()` runs AFTER payout
- If balance negative, CRITICAL alert sent
- Admin reviews and blocks further payouts
- **Trade-off:** Allows temporary overdraw but catches it immediately

---

## Required Tests

### **Test Suite 1: Database Atomicity**

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| T1 | `executePayout`: appendLedgerEntry succeeds, incrementLedger fails | Payout status rolls back to PROCESSING, no ledger entries |
| T2 | `executePayout`: incrementLedger succeeds, appendLedgerEntry fails | Payout status rolls back to PROCESSING, PlatformLedger unchanged |
| T3 | `confirmPayoutReceived`: same as T1 | Status remains PAID (already set), ledger transaction retryable |
| T4 | `confirmPayoutReceived`: same as T2 | Status remains PAID, ledger transaction retryable |

### **Test Suite 2: Stripe Consistency**

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| T5 | Stripe succeeds, DB transaction fails | Payout remains PROCESSING, retry succeeds (idempotency) |
| T6 | Stripe network timeout | Status PROCESSING, manual Stripe query determines outcome |
| T7 | Stripe rejects (insufficient funds) | Status → FAILED, no DB changes |
| T8 | Retry after Stripe success | Idempotency prevents duplicate transfer |

### **Test Suite 3: Concurrency**

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| T9 | Two concurrent `executePayout` calls | Only one succeeds (guard lock), other gets "already PROCESSING" |
| T10 | Two concurrent `confirmPayoutReceived` calls | Only one succeeds (atomic status transition), second fails |
| T11 | Two concurrent payouts, insufficient balance | First succeeds, second triggers negative balance alert |

### **Test Suite 4: State Machine**

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| T12 | Call `confirmPayoutReceived` on ELIGIBLE payout | Error: "Cannot confirm: payout is ELIGIBLE" |
| T13 | Call `markPayoutSent` on PAID payout | Error: "Cannot mark sent: payout is PAID" |
| T14 | Retry FAILED payout | Status transitions FAILED → PROCESSING → PAID |

---

## Recommended Implementation Order

1. ✅ **DONE:** Source audit complete
2. **NEXT:** Fix `executePayout()` database atomicity (V1, V2)
3. **THEN:** Fix `confirmPayoutReceived()` concurrency + atomicity (V6, V7)
4. **THEN:** Improve Stripe error handling (V3)
5. **THEN:** Document balance check TOCTOU trade-off (V4)
6. **THEN:** Create test suite (T1-T14)
7. **FINALLY:** Update tracker, close PH5-SCH-22a

---

## Sign-Off

**Audit Completed:** 2026-11-23  
**Findings:** 7 vulnerabilities identified (4 HIGH, 1 MEDIUM, 2 ARCHITECTURAL)  
**Next Step:** Implement Fix 1 (database atomicity for `executePayout`)  
**Blocking:** SaaS expansion should wait for complete payout atomicity

---

**Reviewer Note:** This audit establishes the complete scope before any code changes. Fixes will be implemented incrementally with test coverage at each step.

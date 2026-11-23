# PH5-SCH-22a Phase 1: Implementation Plan (REVISED)

**Status:** REVISION IN PROGRESS  
**Date:** 2026-11-23  
**Commit Base:** 90626ebdf  
**Revision:** Addressing reviewer feedback on balance protection and transaction atomicity

---

## Reviewer Feedback (Critical Design Problems)

### **Problem 1: confirmPayoutReceived() Transaction Split**

**Current Plan Issue:**
```typescript
// Step 1: Update status (separate)
await prisma.payout.update({ status: 'PAID', ... });

// Step 2: Ledger writes (separate transaction)
await prisma.$transaction(async (tx) => {
  await appendLedgerEntry(...);
  await incrementLedger(...);
});
```

**Why This Fails:**
- If ledger transaction fails → payout remains PAID but accounting missing
- Retry fails because payout no longer SENT
- Financial state inconsistent

**Required Fix:**
> Put conditional status transition and ALL ledger writes inside the SAME transaction.

**✅ REVISED SOLUTION:** Single transaction wraps status + ALL ledger writes (see Part B below)

---

### **Problem 2: T11 Post-Payout Alert Insufficient**

**Current Plan Issue:**
- Balance check with SELECT FOR UPDATE
- Stripe transfer executed
- Post-payout `assertNonNegativeBalance()` alert if negative

**Why This Fails:**
> A warning after two Stripe transfers have succeeded does not prevent financial loss.

**Required Fix:**
> Use durable reservation mechanism that:
> 1. Reserves funds BEFORE Stripe call
> 2. Prevents concurrent payouts from consuming same balance
> 3. Releases reservation only on definitive failure
> 4. Converts reservation → completed payout when committed
> 5. Preserves reservation when Stripe outcome uncertain

**✅ REVISED SOLUTION:** Durable reservation system with `totalPayoutReserved` tracking (see Part A below)

---

## Summary of Revisions

| Issue | Old Plan | Revised Plan | Reviewer Requirement Met |
|-------|----------|--------------|--------------------------|
| **confirmPayoutReceived split** | Status update separate from ledger | Single transaction: status + ledger | ✅ Problem 1 addressed |
| **Concurrent payout race** | SELECT FOR UPDATE + post-alert | Durable reservation before Stripe | ✅ Problem 2 addressed |
| **T11 behavior** | Both payouts reach Stripe, alert fires | Second payout fails at reservation | ✅ "Negative balance = failed control" |
| **Idempotency** | Stripe idempotency only | Stripe idempotency + reservation preservation | ✅ Complete recovery |
| **Schema** | No changes | Add reservation fields + totalPayoutReserved | ✅ Durable state |

---

## Pre-Implementation Analysis Complete

### **1. Schema Changes Required**

#### **A. Payout Schema Extension (Add Reservation Fields)**

```prisma
model Payout {
  id               String              @id @default(cuid())
  providerId       String
  status           String              @default("PENDING")
  grossAmount      Decimal             @db.Decimal(12, 2)
  taxWithheld      Decimal             @default(0) @db.Decimal(12, 2)
  gstAmount        Decimal             @default(0) @db.Decimal(12, 2)
  netAmount        Decimal             @db.Decimal(12, 2)
  payoutMethod     String
  stripeAccountId  String?
  stripeTransferId String?
  bankReference    String?
  sentAt           DateTime?
  sentBy           String?
  confirmedAt      DateTime?
  confirmedBy      String?
  idempotencyKey   String              @unique
  failureReason    String?
  holdReason       String?
  retryCount       Int                 @default(0)
  approvedBy       String?
  approvedAt       DateTime?
  paidAt           DateTime?
  payoutRef        String              @unique
  
  // ⚠️ PHASE 1 ADDITIONS: Durable balance reservation
  reservedAt       DateTime?           // When funds were reserved
  reservedAmount   Decimal?            @db.Decimal(12, 2) // Amount reserved (netAmount)
  reservationId    String?             @unique // Unique reservation token
  
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  transactions     PayoutTransaction[]
}
```

#### **B. PlatformLedger Schema Extension (Add Reserved Column)**

```prisma
model PlatformLedger {
  key              String   @id
  totalCollected   Decimal  @db.Decimal(12, 2)
  totalPaidOut     Decimal  @default(0) @db.Decimal(12, 2)
  totalRefunded    Decimal  @default(0) @db.Decimal(12, 2)
  totalReserved    Decimal  @default(0) @db.Decimal(12, 2)
  totalTaxWithheld Decimal  @default(0) @db.Decimal(12, 2)
  
  // ⚠️ PHASE 1 ADDITION: Track in-flight payout reservations
  totalPayoutReserved Decimal @default(0) @db.Decimal(12, 2)
  
  updatedAt        DateTime @updatedAt
}
```

**Available Balance Calculation (NEW):**
```typescript
availableBalance = totalCollected - totalPaidOut - totalRefunded - totalPayoutReserved
```

**Current Status Values:**
- `PENDING` (default, created state)
- `ELIGIBLE` (buildPayout creates with this)
- `PROCESSING` (guard lock acquired, **funds now RESERVED**)
- `PENDING_TRANSFER` (manual/bank path, funds reserved)
- `SENT` (manual/bank path, funds reserved)
- `PAID` (confirmed complete, **reservation converted to totalPaidOut**)
- `FAILED` (definitively failed, **reservation released**)
- `ON_HOLD` (manual hold, not in audit scope)

**Phase 2 Addition (NOT in Phase 1):**
- `UNCERTAIN` (Stripe outcome unknown, **reservation PRESERVED**) ← **DO NOT ADD YET**

---

### **2. All PlatformLedger Writers (Complete Inventory)**

| Function | File | Lines | Status | Notes |
|----------|------|-------|--------|-------|
| `recordPaymentCollected()` | payout-service.ts | 760 | ✅ FIXED (PH5-SCH-22) | Wrapped in transaction |
| `recordRefundIssued()` | payout-service.ts | 788 | ✅ FIXED (PH5-SCH-22) | Wrapped in transaction |
| **`executePayout()`** | **payout-service.ts** | **437** | **⚠️ NEEDS FIX** | Promise.all, Stripe path |
| **`confirmPayoutReceived()`** | **payout-service.ts** | **673** | **⚠️ NEEDS FIX** | Promise.all, manual path |
| Booking completion | booking-service.ts | 1578 | ⚠️ REVIEW NEEDED | On-checkout ledger write |
| Reconciliation cron | reconcile-stripe/route.ts | TBD | ⚠️ REVIEW NEEDED | Backfill missing entries |

**Phase 1 Scope:** Fix `executePayout()` and `confirmPayoutReceived()` only  
**Future Work:** Audit booking completion and reconciliation paths separately

---

### **3. Payout State Machine (Current)**

```
buildPayout()
   │
   ▼
ELIGIBLE ◄────────────┐
   │                  │ retry
   │ executePayout()  │
   ▼                  │
PROCESSING            │
   │                  │
   ├─► Stripe ────────┼─► PAID (ledger updated)
   │                  │
   ├─► Manual ────────┼─► PENDING_TRANSFER
   │                       │
   │                       │ markPayoutSent()
   │                       ▼
   │                     SENT
   │                       │
   │                       │ confirmPayoutReceived()
   │                       ▼
   │                     PAID (ledger updated)
   │
   └─► (error) ───────► FAILED
```

---

## Phase 1 Implementation Design (REVISED)

### **Core Principles**

1. **Durable Reservation:** Reserve funds in database BEFORE external Stripe call
2. **Single Transaction Scope:** All DB writes (status + ledger + reservation) atomic
3. **Concurrency Protection:** SELECT FOR UPDATE + conditional updates
4. **Idempotency Safety:** Stripe failures recoverable without double-transfer
5. **No Silent Failure:** Balance violations fail loudly, not post-alert

### **Reservation Lifecycle**

```
ELIGIBLE (no reservation)
   │
   │ executePayout() starts transaction
   ▼
PROCESSING + reservedAt set + totalPayoutReserved += netAmount
   │
   │ (transaction commits, funds now reserved)
   │
   ▼ Stripe transfer (external, uses idempotency)
   │
   ├─► SUCCESS → confirmPayoutCompletion()
   │      │
   │      └─► Single transaction:
   │            - Status PROCESSING → PAID
   │            - reservedAmount → 0
   │            - totalPayoutReserved -= netAmount
   │            - totalPaidOut += netAmount
   │            - Ledger entries written
   │
   ├─► DEFINITIVE FAIL → releaseReservation()
   │      │
   │      └─► Status PROCESSING → FAILED
   │          totalPayoutReserved -= netAmount
   │
   └─► UNCERTAIN (timeout) → Phase 2 recovery
          (reservation preserved until resolved)
```

### **Key Requirement Met**

> With $1,000 available and two $600 payouts:  
> - First payout: reserves $600 → available = $400  
> - Second payout: needs $600, available = $400 → FAIL before Stripe call  
> - No external transfer for second payout  
> - No negative balance possible

---

## Implementation Part A: `executePayout()` Stripe Path (REVISED)

### **Current Code (Lines 365-445, Vulnerable)**

```typescript
await assertSufficientBalance(Number(payout.netAmount)); // TOCTOU

const transfer = await stripe.transfers.create({ ... }, { idempotencyKey });

await prisma.payout.update({ status: 'PAID', ... }); // Separate

await Promise.all([  // NON-ATOMIC
  appendLedgerEntry({ type: 'PAYOUT_PAID', ... }),
  ...(tax > 0 ? [appendLedgerEntry({ type: 'TAX_WITHHELD', ... })] : []),
  incrementLedger({ totalPaidOut, totalReserved, totalTaxWithheld }),
]);
```

**Problems:**
1. Balance check before Stripe call (TOCTOU race - **REVIEWER PROBLEM 2**)
2. Status update separate from ledger writes
3. `Promise.all` allows partial failures
4. Post-payout alert insufficient to prevent loss

---

### **Fixed Code (Phase 1 - Durable Reservation)**

#### **Step 1: Reserve Funds in Database Transaction**

```typescript
export async function executePayout(
  payoutId: string,
  adminUserId: string,
): Promise<PayoutResult> {
  // 1a. Atomic status lock (unchanged)
  const locked = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ['ELIGIBLE', 'FAILED'] } },
    data: { status: 'PROCESSING' },
  });

  if (locked.count === 0) {
    const current = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!current) throw new Error('Payout not found');
    return { /* return current state */ };
  }

  await logTransition(payoutId, adminUserId, 'PAYOUT_PROCESSING', {
    lockedAt: new Date().toISOString()
  });

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { transactions: { select: { transactionId: true } } },
  });
  if (!payout) throw new Error('Payout not found after lock');

  const instructor = await prisma.provider.findUnique({ /* ... */ });
  const txCount = payout.transactions.length;
  const isStripe = payout.payoutMethod === 'stripe_connect' && payout.stripeAccountId;

  try {
    // 1b. RESERVE FUNDS IN DATABASE (before Stripe call)
    await reservePayoutFunds(payoutId, payout.netAmount);

    if (isStripe) {
      // 1c. Verify ownership (unchanged)
      const { verifyPayoutDestinationOwnership } = await import('./payout-security');
      const ownershipCheck = await verifyPayoutDestinationOwnership(
        stripe,
        payout.stripeAccountId!,
        payout.providerId
      );

      if (!ownershipCheck.valid) {
        // Release reservation on security failure
        await releasePayoutReservation(payoutId, payout.netAmount, 
          `Ownership verification failed: ${ownershipCheck.reason}`);
        throw new Error(/* ownership error */);
      }

      // 1d. STRIPE TRANSFER (funds already reserved)
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(toNumber(toDecimal(payout.netAmount)) * 100),
          currency: 'aud',
          destination: payout.stripeAccountId!,
          description: `DriveBook ${payout.payoutRef} - ${txCount} lesson(s)`,
          metadata: {
            payoutRef: payout.payoutRef,
            payoutId: payout.id,
            providerId: payout.providerId,
            transactionCount: String(txCount),
            taxWithheld: toFixed(toDecimal(payout.taxWithheld), 2),
            adminId: adminUserId,
            reservationId: payout.reservationId!, // Link to reservation
          },
        },
        { idempotencyKey: payout.idempotencyKey },
      );

      // 1e. CONVERT RESERVATION TO COMPLETED PAYOUT (atomic)
      await confirmPayoutCompletion(
        payoutId,
        transfer.id,
        payout,
        txCount,
        adminUserId
      );

      // 1f. Post-completion validation (should never fail)
      await assertNonNegativeBalance();

      await logTransition(payoutId, adminUserId, 'PAYOUT_PAID', {
        payoutRef: payout.payoutRef,
        stripeTransferId: transfer.id,
        transactionCount: txCount,
      });

      // 1g. Mark adjustments recovered (outside main transaction, OK to fail)
      await markAdjustmentsRecovered(payout.providerId, payoutId);

      // 1h. Send notifications
      await sendPayoutNotifications(instructor, payout, transfer.id);

      return {
        payoutId: payout.id,
        payoutRef: payout.payoutRef,
        status: 'PAID',
        grossAmount: toNumber(payout.grossAmount),
        taxWithheld: toNumber(payout.taxWithheld),
        netAmount: toNumber(payout.netAmount),
        gstAmount: toNumber(payout.gstAmount),
        stripeTransferId: transfer.id,
        transactionCount: txCount,
      };
      
    } else {
      // Manual/bank path (PENDING_TRANSFER state)
      await prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'PENDING_TRANSFER' },
      });

      await logTransition(payoutId, adminUserId, 'PAYOUT_PENDING_TRANSFER', {
        payoutRef: payout.payoutRef,
        payoutMethod: payout.payoutMethod,
      });

      return {
        payoutId: payout.id,
        payoutRef: payout.payoutRef,
        status: 'PENDING_TRANSFER',
        /* ... */
      };
    }

  } catch (error) {
    // On ANY error, release reservation and mark FAILED
    await releasePayoutReservation(
      payoutId,
      payout.netAmount,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}
```

---

#### **Step 2: Helper Function - Reserve Funds**

```typescript
/**
 * Atomically reserve funds for payout execution.
 * MUST be called BEFORE external Stripe transfer.
 * 
 * @throws Error if insufficient balance (after acquiring lock)
 */
async function reservePayoutFunds(
  payoutId: string,
  netAmount: Prisma.Decimal
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock PlatformLedger row
    const ledgerLocked = await tx.$queryRaw<Array<{
      totalCollected: any;
      totalPaidOut: any;
      totalRefunded: any;
      totalPayoutReserved: any;
    }>>`
      SELECT "totalCollected", "totalPaidOut", "totalRefunded", "totalPayoutReserved"
      FROM "PlatformLedger"
      WHERE key = 'default'
      FOR UPDATE
    `;
    
    if (ledgerLocked.length === 0) {
      throw new Error('PlatformLedger not found');
    }
    
    // Calculate AVAILABLE balance (excludes existing reservations)
    const ledger = ledgerLocked[0];
    const availableBalance = 
      Number(ledger.totalCollected) - 
      Number(ledger.totalPaidOut) - 
      Number(ledger.totalRefunded) -
      Number(ledger.totalPayoutReserved); // ← KEY: Subtract existing reservations
    
    const payoutAmount = Number(netAmount);
    
    if (payoutAmount > availableBalance) {
      throw new Error(
        `Insufficient balance: need $${payoutAmount.toFixed(2)}, ` +
        `available $${availableBalance.toFixed(2)} ` +
        `(after ${Number(ledger.totalPayoutReserved).toFixed(2)} reserved for other payouts)`
      );
    }
    
    // Generate unique reservation ID
    const reservationId = `RES_${Date.now()}_${payoutId.slice(0, 8)}`;
    
    // Update payout with reservation
    const updated = await tx.payout.updateMany({
      where: { 
        id: payoutId, 
        status: 'PROCESSING',
        reservedAt: null, // Guard: only reserve once
      },
      data: {
        reservedAt: new Date(),
        reservedAmount: netAmount,
        reservationId: reservationId,
      },
    });
    
    if (updated.count === 0) {
      throw new Error('Payout already reserved or not in PROCESSING state');
    }
    
    // Increment totalPayoutReserved
    await tx.platformLedger.update({
      where: { key: 'default' },
      data: {
        totalPayoutReserved: {
          increment: netAmount,
        },
      },
    });
  });
}
```

---

#### **Step 3: Helper Function - Confirm Completion**

```typescript
/**
 * Convert reservation to completed payout (PAID).
 * MUST be called after successful Stripe transfer.
 * All ledger accounting happens HERE in single transaction.
 */
async function confirmPayoutCompletion(
  payoutId: string,
  stripeTransferId: string,
  payout: Payout,
  txCount: number,
  adminUserId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock PlatformLedger
    await tx.$queryRaw`
      SELECT 1 FROM "PlatformLedger"
      WHERE key = 'default'
      FOR UPDATE
    `;
    
    // Conditional status update (guard against duplicate completion)
    const updated = await tx.payout.updateMany({
      where: { 
        id: payoutId, 
        status: 'PROCESSING',
        reservedAt: { not: null }, // Must have reservation
      },
      data: {
        status: 'PAID',
        stripeTransferId: stripeTransferId,
        paidAt: new Date(),
        failureReason: null,
        // Keep reservation metadata for audit trail
      },
    });
    
    if (updated.count === 0) {
      throw new Error('Payout already completed or reservation missing');
    }
    
    // Convert reservation → actual payout (atomic ledger update)
    await tx.platformLedger.update({
      where: { key: 'default' },
      data: {
        totalPayoutReserved: { decrement: payout.netAmount },
        totalPaidOut: { increment: payout.netAmount },
        totalReserved: { decrement: payout.grossAmount },
        totalTaxWithheld: { increment: payout.taxWithheld },
      },
    });
    
    // Write ledger entries
    await appendLedgerEntry({
      type: 'PAYOUT_PAID',
      amount: -toNumber(payout.netAmount),
      referenceId: payoutId,
      referenceType: 'PAYOUT',
      providerId: payout.providerId,
      description: `${payout.payoutRef} - net payout to instructor (Stripe)`,
      metadata: { 
        stripeTransferId: stripeTransferId, 
        txCount,
        reservationId: payout.reservationId,
      },
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
  });
}
```

---

#### **Step 4: Helper Function - Release Reservation**

```typescript
/**
 * Release reserved funds on payout failure.
 * Sets status to FAILED and decrements totalPayoutReserved.
 */
async function releasePayoutReservation(
  payoutId: string,
  netAmount: Prisma.Decimal,
  failureReason: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock PlatformLedger
    await tx.$queryRaw`
      SELECT 1 FROM "PlatformLedger"
      WHERE key = 'default'
      FOR UPDATE
    `;
    
    // Update payout status (conditional)
    const updated = await tx.payout.updateMany({
      where: { 
        id: payoutId, 
        status: 'PROCESSING',
        reservedAt: { not: null },
      },
      data: {
        status: 'FAILED',
        failureReason: failureReason,
        // Keep reservation metadata for audit
      },
    });
    
    if (updated.count === 0) {
      // Already failed or completed, no-op
      return;
    }
    
    // Release reservation
    await tx.platformLedger.update({
      where: { key: 'default' },
      data: {
        totalPayoutReserved: { decrement: netAmount },
      },
    });
  });
}
```

---

### **Key Changes from Previous Plan**

| Aspect | Old Plan | New Plan (Revised) |
|--------|----------|-------------------|
| **Balance protection** | SELECT FOR UPDATE + post-alert | Durable reservation BEFORE Stripe |
| **Concurrency** | Lock during transaction only | Reservation persists across Stripe call |
| **T11 scenario** | Both payouts reach Stripe, alert fires | Second payout fails at reservation, never reaches Stripe |
| **Failure recovery** | Status + ledger in separate ops | Single transaction converts reservation → PAID |
| **Schema** | No changes | Add `reservedAt`, `reservedAmount`, `reservationId`, `totalPayoutReserved` |



---

## Implementation Part B: `confirmPayoutReceived()` Manual Path (REVISED)

### **Current Code (Lines 639-676, Vulnerable)**

```typescript
const payout = await prisma.payout.findUnique({ ... });  // No lock
if (payout.status !== 'SENT') throw new Error(...);      // TOCTOU

await prisma.payout.update({ status: 'PAID', ... });     // Separate

await Promise.all([  // NON-ATOMIC
  appendLedgerEntry({ type: 'PAYOUT_PAID', ... }),
  ...(tax > 0 ? [appendLedgerEntry({ type: 'TAX_WITHHELD', ... })] : []),
  incrementLedger({ totalPaidOut, totalReserved, totalTaxWithheld }),
]);
```

**Problems:**
1. `findUnique` → check → `update` is NOT atomic (**REVIEWER PROBLEM 1**)
2. Two concurrent confirmations both see SENT, both proceed
3. Ledger written TWICE
4. `Promise.all` allows partial failures
5. Status update separate from ledger (**CRITICAL**)

---

### **Fixed Code (Phase 1 - Single Transaction)**

```typescript
export async function confirmPayoutReceived(
  payoutId: string,
  adminUserId: string,
) {
  // Read payout BEFORE transaction (validation only)
  const payout = await prisma.payout.findUnique({ 
    where: { id: payoutId },
    select: {
      id: true,
      status: true,
      providerId: true,
      netAmount: true,
      grossAmount: true,
      taxWithheld: true,
      payoutRef: true,
      bankReference: true,
      reservedAt: true, // Must have reservation
      reservedAmount: true,
    },
  });
  
  if (!payout) throw new Error('Payout not found');
  if (payout.status !== 'SENT') {
    throw new Error(`Cannot confirm: payout is ${payout.status}, expected SENT`);
  }
  if (!payout.reservedAt || !payout.reservedAmount) {
    throw new Error('Payout has no reservation - data integrity error');
  }
  
  // SINGLE TRANSACTION: Status + ALL ledger writes (addresses REVIEWER PROBLEM 1)
  await prisma.$transaction(async (tx) => {
    // Lock PlatformLedger
    await tx.$queryRaw`
      SELECT 1 FROM "PlatformLedger"
      WHERE key = 'default'
      FOR UPDATE
    `;
    
    // Conditional status update (atomic guard)
    const updated = await tx.payout.updateMany({
      where: { 
        id: payoutId, 
        status: 'SENT', // Guard: only confirm from SENT
        reservedAt: { not: null }, // Must have reservation
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        confirmedAt: new Date(),
        confirmedBy: adminUserId,
        failureReason: null,
        // Keep reservation metadata for audit trail
      },
    });
    
    if (updated.count === 0) {
      // Already confirmed or not in SENT state
      throw new Error('Payout already confirmed or not in SENT state');
    }
    
    // Convert reservation → actual payout (same as Stripe path)
    await tx.platformLedger.update({
      where: { key: 'default' },
      data: {
        totalPayoutReserved: { decrement: payout.netAmount },
        totalPaidOut: { increment: payout.netAmount },
        totalReserved: { decrement: payout.grossAmount },
        totalTaxWithheld: { increment: payout.taxWithheld },
      },
    });
    
    // Write ledger entries (atomic with status)
    await appendLedgerEntry({
      type: 'PAYOUT_PAID',
      amount: -Number(payout.netAmount),
      referenceId: payoutId,
      referenceType: 'PAYOUT',
      providerId: payout.providerId,
      description: `${payout.payoutRef} - net payout confirmed (bank transfer)`,
      metadata: { 
        bankReference: payout.bankReference, 
        confirmedBy: adminUserId,
        reservationId: payout.reservedAmount, // Track reservation
      },
    }, tx);
    
    if (Number(payout.taxWithheld) > 0) {
      await appendLedgerEntry({
        type: 'TAX_WITHHELD',
        amount: Number(payout.taxWithheld),
        referenceId: payoutId,
        referenceType: 'PAYOUT',
        providerId: payout.providerId,
        description: `${payout.payoutRef} - ATO withholding`,
      }, tx);
    }
  });
  
  // Post-transaction logging (outside transaction, OK to fail)
  await logTransition(payoutId, adminUserId, 'PAYOUT_CONFIRMED', {
    payoutRef: payout.payoutRef,
    grossAmount: payout.grossAmount,
    taxWithheld: payout.taxWithheld,
    netAmount: payout.netAmount,
    bankReference: payout.bankReference,
  });
}
```

---

### **Key Changes from Previous Plan**

| Aspect | Old Plan | New Plan (Revised) |
|--------|----------|-------------------|
| **Transaction scope** | Status update separate from ledger | EVERYTHING in single transaction |
| **Reviewer Problem 1** | Not addressed | ✅ FIXED: Status + ledger atomic |
| **Failure scenario** | Status PAID, ledger missing → retry fails | Status + ledger both roll back → retryable |
| **Guard mechanism** | `updateMany` before transaction | `updateMany` INSIDE transaction |
| **Ledger lock** | Lock only during ledger writes | Lock covers status + ledger |

---

### **Why This Solves Reviewer Problem 1**

**Old Plan Failure:**
```typescript
// Step 1: Update status (commit)
await prisma.payout.update({ status: 'PAID' });

// Step 2: Ledger writes (separate transaction - FAILS)
await prisma.$transaction(async (tx) => {
  // If this fails, payout = PAID but ledger = missing
});
```

**Result:** Payout PAID, ledger corrupt, retry impossible (no longer SENT)

**New Plan Success:**
```typescript
await prisma.$transaction(async (tx) => {
  // Update status
  await tx.payout.updateMany({ where: { status: 'SENT' }, data: { status: 'PAID' } });
  
  // Ledger writes
  await tx.platformLedger.update({ ... });
  await appendLedgerEntry({ ... }, tx);
  
  // If ANY step fails, entire transaction rolls back
  // Status remains SENT, ledger unchanged, retry possible
});
```

**Result:** Atomicity guaranteed by database transaction boundary



---

## Test Specifications (REVISED - Addresses Reviewer Feedback)

### **T5: Stripe Succeeds, Database Fails (IDEMPOTENCY RECOVERY)**

```typescript
it('T5 | Stripe succeeds but completion transaction fails - idempotency recovery', async () => {
  // Setup: Mock Stripe to succeed
  const mockTransfer = { id: 'tr_test123', amount: 50000 };
  mockStripe.transfers.create = vi.fn().mockResolvedValue(mockTransfer);
  
  // Setup: Mock confirmPayoutCompletion to throw on first call
  const originalConfirmCompletion = confirmPayoutCompletion;
  let callCount = 0;
  vi.mocked(confirmPayoutCompletion).mockImplementation(async (...args) => {
    if (callCount++ === 0) {
      throw new Error('Database connection lost during completion');
    }
    return originalConfirmCompletion(...args);
  });
  
  // First attempt: Stripe succeeds, completion transaction fails
  await expect(executePayout(payoutId, adminId)).rejects.toThrow(
    'Database connection lost during completion'
  );
  
  // Verify: Payout NOT marked PAID (still PROCESSING)
  let payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  expect(payout!.status).toBe('PROCESSING');
  expect(payout!.reservedAt).not.toBeNull(); // Reservation still active
  
  // Verify: NO ledger entries (transaction rolled back)
  let entries = await prisma.ledgerEntry.findMany({
    where: { referenceId: payoutId, type: 'PAYOUT_PAID' }
  });
  expect(entries.length).toBe(0);
  
  // Verify: totalPayoutReserved STILL active (not converted to totalPaidOut)
  let ledger = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  expect(Number(ledger!.totalPayoutReserved)).toBe(payoutAmount); // Still reserved
  expect(Number(ledger!.totalPaidOut)).toBe(initialPaidOut); // Not incremented
  
  // Retry: Same idempotencyKey → Stripe returns existing transfer (no double-transfer)
  mockStripe.transfers.create = vi.fn().mockResolvedValue(mockTransfer);
  
  const result = await executePayout(payoutId, adminId);
  
  // Verify: NOW marked PAID
  payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  expect(payout!.status).toBe('PAID');
  expect(payout!.stripeTransferId).toBe('tr_test123');
  
  // Verify: Ledger entries created EXACTLY ONCE
  entries = await prisma.ledgerEntry.findMany({
    where: { referenceId: payoutId, type: 'PAYOUT_PAID' }
  });
  expect(entries.length).toBe(1);
  
  // Verify: Reservation converted to totalPaidOut EXACTLY ONCE
  ledger = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  expect(Number(ledger!.totalPayoutReserved)).toBe(0); // Reservation released
  expect(Number(ledger!.totalPaidOut)).toBe(initialPaidOut + payoutAmount); // Incremented once
  
  // Verify: Stripe transfer.create called ONLY ONCE (idempotency worked)
  expect(mockStripe.transfers.create).toHaveBeenCalledTimes(1);
});
```

**Success Criteria:**
- ✅ Stripe idempotency prevents duplicate transfer
- ✅ Reservation preserved during failure (not lost)
- ✅ Completion transaction atomic (status + ledger together)
- ✅ Retry succeeds without double-accounting

---

### **T11: Concurrent Balance Race (DURABLE RESERVATION)**

**Addresses REVIEWER PROBLEM 2: "A negative balance is evidence of a failed control"**

```typescript
it('T11 | Two concurrent payouts - exactly ONE succeeds with durable reservation', async () => {
  // Setup: Balance = $1000, two payouts of $600 each
  await prisma.platformLedger.update({
    where: { key: 'default' },
    data: { 
      totalCollected: 1000, 
      totalPaidOut: 0, 
      totalRefunded: 0,
      totalPayoutReserved: 0, // Start with no reservations
    }
  });
  
  const payout1 = await buildPayout(instructor1Id, adminId, [tx1, tx2]); // $600
  const payout2 = await buildPayout(instructor2Id, adminId, [tx3, tx4]); // $600
  
  // Mock Stripe to succeed for both (we want to test DB-level protection)
  mockStripe.transfers.create = vi.fn()
    .mockResolvedValueOnce({ id: 'tr_payout1', amount: 60000 })
    .mockResolvedValueOnce({ id: 'tr_payout2', amount: 60000 });
  
  // Execute concurrently using ACTUAL parallel database connections
  const [result1, result2] = await Promise.allSettled([
    executePayout(payout1.payoutId, adminId),
    executePayout(payout2.payoutId, adminId)
  ]);
  
  // ⚠️ CRITICAL REQUIREMENT: Exactly ONE must succeed
  const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
  const failed = [result1, result2].filter(r => r.status === 'rejected');
  
  expect(succeeded.length).toBe(1);
  expect(failed.length).toBe(1);
  
  // Verify: Failed payout got "Insufficient balance" error AT RESERVATION
  const failedResult = failed[0] as PromiseRejectedResult;
  expect(failedResult.reason.message).toMatch(/Insufficient balance/i);
  expect(failedResult.reason.message).toMatch(/reserved for other payouts/i);
  
  // Verify: Failed payout NEVER reached Stripe
  // (If mockStripe.transfers.create called twice, test fails)
  expect(mockStripe.transfers.create).toHaveBeenCalledTimes(1); // ← KEY CHECK
  
  // Verify: Ledger balance correct (not overdraft)
  const ledger = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  const availableBalance = 
    Number(ledger!.totalCollected) - 
    Number(ledger!.totalPaidOut) -
    Number(ledger!.totalRefunded) -
    Number(ledger!.totalPayoutReserved);
  
  expect(Number(ledger!.totalPaidOut)).toBe(600); // Only one payout completed
  expect(Number(ledger!.totalPayoutReserved)).toBe(0); // No dangling reservations
  expect(availableBalance).toBe(400); // $1000 - $600 = $400 remaining
  
  // ⚠️ CRITICAL REQUIREMENT: Balance NEVER went negative
  expect(availableBalance).toBeGreaterThanOrEqual(0);
  
  // ⚠️ CRITICAL REQUIREMENT: NO negative balance alert (prevention, not detection)
  expect(sendAlert).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'NEGATIVE_BALANCE' })
  );
  
  // Verify: Failed payout is FAILED (not PROCESSING with lost reservation)
  const payoutStates = await prisma.payout.findMany({
    where: { id: { in: [payout1.payoutId, payout2.payoutId] } },
    select: { id: true, status: true, reservedAt: true, stripeTransferId: true },
  });
  
  const paidPayout = payoutStates.find(p => p.status === 'PAID');
  const failedPayout = payoutStates.find(p => p.status === 'FAILED');
  
  expect(paidPayout).toBeDefined();
  expect(paidPayout!.stripeTransferId).not.toBeNull();
  expect(paidPayout!.reservedAt).not.toBeNull(); // Audit trail preserved
  
  expect(failedPayout).toBeDefined();
  expect(failedPayout!.stripeTransferId).toBeNull(); // Never reached Stripe
  expect(failedPayout!.reservedAt).toBeNull(); // Reservation never created
});
```

**Success Criteria:**
- ✅ **Exactly one payout succeeds** (not both)
- ✅ **Second payout fails BEFORE Stripe call** (reservation fails)
- ✅ **Stripe called EXACTLY ONCE** (proves concurrency protection)
- ✅ **Balance never negative** (control succeeded)
- ✅ **NO alert fired** (prevention, not detection - addresses reviewer requirement)
- ✅ **Failed payout status = FAILED** (not stuck in PROCESSING)

---

### **T12: Concurrent confirmPayoutReceived (NEW TEST)**

**Tests REVIEWER PROBLEM 1 fix: atomic status + ledger**

```typescript
it('T12 | Two concurrent confirmations - only ONE succeeds', async () => {
  // Setup: Create manual payout in SENT state with reservation
  const payout = await buildPayout(instructorId, adminId, [tx1, tx2]);
  await executePayout(payout.payoutId, adminId); // Creates reservation
  await markPayoutSent(payout.payoutId, adminId, 'REF123'); // → SENT status
  
  // Verify: Reservation active, funds reserved
  let ledger = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  const initialReserved = Number(ledger!.totalPayoutReserved);
  const initialPaidOut = Number(ledger!.totalPaidOut);
  
  expect(initialReserved).toBeGreaterThan(0);
  
  // Execute: Two admins try to confirm simultaneously
  const [result1, result2] = await Promise.allSettled([
    confirmPayoutReceived(payout.payoutId, 'admin1'),
    confirmPayoutReceived(payout.payoutId, 'admin2')
  ]);
  
  // ⚠️ CRITICAL: Exactly ONE succeeds
  const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
  const failed = [result1, result2].filter(r => r.status === 'rejected');
  
  expect(succeeded.length).toBe(1);
  expect(failed.length).toBe(1);
  
  // Verify: Failed confirmation got "already confirmed" error
  const failedResult = failed[0] as PromiseRejectedResult;
  expect(failedResult.reason.message).toMatch(/already confirmed|not in SENT state/i);
  
  // Verify: Ledger entries created EXACTLY ONCE
  const entries = await prisma.ledgerEntry.findMany({
    where: { referenceId: payout.payoutId, type: 'PAYOUT_PAID' }
  });
  expect(entries.length).toBe(1);
  
  // Verify: Ledger totals updated EXACTLY ONCE
  ledger = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  expect(Number(ledger!.totalPayoutReserved)).toBe(0); // Reservation converted
  expect(Number(ledger!.totalPaidOut)).toBe(initialPaidOut + payoutAmount); // Incremented once
  
  // Verify: Payout status PAID (not stuck)
  const finalPayout = await prisma.payout.findUnique({ where: { id: payout.payoutId } });
  expect(finalPayout!.status).toBe('PAID');
  expect(finalPayout!.confirmedBy).toBeTruthy(); // One admin recorded
});
```

**Success Criteria:**
- ✅ **Atomic status + ledger** (single transaction)
- ✅ **Exactly one confirmation succeeds**
- ✅ **Ledger written exactly once** (not duplicated)
- ✅ **Reservation converted exactly once**



---

## Implementation Checklist (REVISED)

### **Phase 1A: Schema Migration**
- [ ] Add `reservedAt DateTime?` to Payout model
- [ ] Add `reservedAmount Decimal?` to Payout model
- [ ] Add `reservationId String? @unique` to Payout model
- [ ] Add `totalPayoutReserved Decimal @default(0)` to PlatformLedger model
- [ ] Run Prisma migration: `npx prisma migrate dev --name add-payout-reservation`
- [ ] Verify migration in database

### **Phase 1B: Implementation**
- [ ] Create `reservePayoutFunds()` helper function
- [ ] Create `confirmPayoutCompletion()` helper function (Stripe path)
- [ ] Create `releasePayoutReservation()` helper function
- [ ] Update `executePayout()` with reservation workflow
- [ ] Update `confirmPayoutReceived()` with single-transaction atomic writes
- [ ] Update `markPayoutSent()` to preserve reservation (PENDING_TRANSFER → SENT)
- [ ] Run existing test suite (ensure no regressions)

### **Phase 1C: Tests**
- [ ] Implement T5 (Stripe+DB failure recovery with idempotency)
- [ ] Implement T11 (concurrent balance race with durable reservation)
- [ ] Implement T12 (concurrent confirmPayoutReceived atomicity)
- [ ] Run PostgreSQL concurrent connection tests
- [ ] Verify all 3 new tests pass with 100% consistency

### **Phase 1D: Documentation & Commit**
- [ ] Document reservation lifecycle in code comments
- [ ] Update payout-service.ts JSDoc headers
- [ ] Add migration notes to CHANGELOG
- [ ] Commit Phase 1 implementation
- [ ] Update PH5-SCH-22a status: Phase 1 COMPLETE

---

## Phase 1 vs Phase 2 Distinction

### **Phase 1 Scope (Database Atomicity & Concurrency)**

✅ **What Phase 1 Delivers:**
1. Durable reservation system (funds locked before Stripe call)
2. Single-transaction atomic writes (status + ledger together)
3. Concurrency protection (SELECT FOR UPDATE + conditional updates)
4. Idempotent Stripe recovery (retry after partial failures)
5. Balance protection (second concurrent payout fails at reservation, not post-alert)

✅ **Financial Guarantees After Phase 1:**
- Balance never goes negative (prevention, not detection)
- Concurrent payouts cannot double-spend
- Partial failures recoverable without double-accounting
- Status transitions atomic with ledger writes

⚠️ **What Phase 1 Does NOT Solve:**
- Stripe network timeout recovery (outcome uncertain)
- Webhook-based confirmation
- Automated reconciliation
- UNCERTAIN status handling

---

### **Phase 2 Scope (Stripe Uncertainty & Recovery)**

**Deferred to Phase 2:**
1. Add `UNCERTAIN` status enum value
2. Design recovery workflow:
   - Query Stripe by metadata (payoutRef, providerId)
   - Match existing transfer to payout
   - Convert UNCERTAIN → PAID without duplicate transfer
3. Implement webhook confirmation handler
4. Build reconciliation automation
5. Admin UI for manual UNCERTAIN resolution

**Why Deferred:**
> The implementation plan must distinguish Phase 1 from Phase 2.  
> Do not mark the Stripe consistency problem resolved merely because an idempotency key exists.

**Phase 2 Prerequisite:**
- Phase 1 complete and deployed
- Recovery process designed and approved
- UNCERTAIN state added ONLY after recovery workflow ready

**Current Status:**
- Stripe idempotency prevents duplicate transfer
- Reservation preserved on timeout (not lost)
- **But:** No automated recovery if outcome unknown
- **Manual:** Admin must query Stripe and resolve manually

---

## Out of Scope (Explicitly)

- ❌ Booking completion ledger path (separate audit)
- ❌ Reconciliation cron job (separate audit)
- ❌ Multi-currency support
- ❌ Partial payout cancellation
- ❌ Payout scheduling/batching

---

## Sign-Off Requirements

**Before Implementation:**
- ✅ Reviewer approval of durable reservation design
- ✅ Reviewer confirmation confirmPayoutReceived() single-transaction fix
- ✅ Reviewer acceptance of T11 prevention vs detection approach
- ✅ Schema migration strategy confirmed

**After Implementation:**
- ✅ All 3 new tests passing (T5, T11, T12)
- ✅ Existing test suite passing (no regressions)
- ✅ Manual verification: concurrent payout execution
- ✅ Code review by second developer

**Success Criteria:**
1. Exactly one payout succeeds when balance insufficient (T11)
2. Stripe idempotency prevents duplicate transfers (T5)
3. Status + ledger atomic in single transaction (T12, confirmPayoutReceived)
4. Balance never goes negative in any scenario
5. No dangling reservations after failure

---

## Approval Gate

**Status:** AWAITING REVIEWER APPROVAL  
**Revised:** 2026-11-23  
**Addresses:** Reviewer Problems 1 & 2

**Reviewer Decision Required:**
- [ ] **Approve Phase 1 implementation** (proceed with code changes)
- [ ] **Request further revisions** (specify concerns)
- [ ] **Reject approach** (fundamental design issue)

Should I proceed with Phase 1 implementation?



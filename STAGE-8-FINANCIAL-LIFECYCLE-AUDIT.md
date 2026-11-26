# Stage 8: Database and Financial Lifecycle Audit

**Audit Date:** 2026-11-25  
**Code Base:** main @ `10b30fea1018494d78da71ca4bd692a50f54e8fa`  
**Auditor:** External audit + source verification  
**Scope:** Wallet-funded bulk booking financial lifecycle  
**Status:** 🟡 **SUBSTANTIALLY IMPROVED** — But not production-closed

---

## Executive Summary

The wallet-funded bulk booking path (`/api/client/bookings/create-bulk`) is **substantially stronger** than earlier Stage 6/7 findings suggested. Current main now:

✅ Creates multiple lesson bookings (not just one)  
✅ Uses instructor timezones for conversion  
✅ Links PDA bookings to wallet debit  
✅ Uses Serializable transaction isolation  
✅ Has strong PDA held-funds reconciliation  
✅ Includes recovery flow for financial records

However, **financial lifecycle is not yet production-closed**:

🔴 Global ledger integrity check is invalid (always returns true)  
🔴 Financial records completed **after** booking transaction (can remain pending indefinitely)  
🔴 No durable parent checkout/package record  
🔴 Standalone PDA endpoint remains unsafe  
🟠 Payout-readiness can be temporarily inconsistent

---

## Important Context

### Audit Scope Clarification

**This audit covers:**
- ✅ Wallet-funded bulk booking (`/api/client/bookings/create-bulk`)
- ✅ Authenticated CLIENT checkout flow
- ✅ Wallet debit lifecycle
- ✅ PDA funds-held reconciliation

**This audit does NOT cover:**
- ⏳ Stripe-paid public booking (`/api/public/bookings/bulk` + payment intent) — See Stage 9
- ⏳ Package purchase & wallet credit creation — See Stage 10
- ⏳ Payout eligibility verification — See Stage 11

### Reconciliation with Earlier Findings

| Earlier Finding (Stage 6/7) | Current Main Status |
|----------------------------|---------------------|
| Multiple lessons reduced to one booking | ❌ **Not true** — Wallet bulk path creates one Booking per lesson |
| Timezone conversion inconsistent | ✅ **Fixed** — Uses `localDateTimeToUTC()` with instructor timezone |
| PDA not linked to package payment | ✅ **Fixed** — PDA linked via `walletTransactionId` |
| PDA parent lesson not linked | 🟡 **Partially fixed** — PDA carries `parentBookingIndex`, validates matching provider |
| Guest cannot use standalone PDA API | 🔴 **Still true** — `/api/pda-bookings` requires CLIENT session |
| Standalone PDA unpaid/unlinked | 🔴 **Still true** — Creates `PENDING_PAYMENT`, not wallet-held lifecycle |
| PDA pickup/notes stripped | 🔴 **Still true** — Schema doesn't define pickup/notes |

**⚠️ Important Qualification:**  
Earlier Stage 6/7 findings **may still apply to Stripe "Book Now" path**. Do not mark closed globally until that path separately traced.

---

## Positive Controls Confirmed ✅

### 1. Wallet Checkout Uses Serializable Transaction

**Location:** `/lib/services/wallet-booking.ts` (presumed path)

**What's good:**
- Re-reads wallet transactions inside transaction
- Calculates balance using `Prisma.Decimal` (prevents floating-point errors)
- Checks slot conflicts per lesson
- Creates lesson and PDA records atomically
- Creates wallet debit atomically with bookings
- Retries on serialization failures

**Code pattern:**
```typescript
await prisma.$transaction(async (tx) => {
  // Re-read wallet transactions to get fresh balance
  const transactions = await tx.walletTransaction.findMany({ ... });
  const balance = computeWalletBalanceDecimal(transactions);
  
  // Check sufficient funds
  if (balance.lessThan(totalCost)) {
    throw new Error('INSUFFICIENT_FUNDS');
  }
  
  // Check slot conflicts per lesson
  for (const item of lessons) {
    const conflict = await tx.booking.findFirst({ ... });
    if (conflict) throw new Error('SLOT_TAKEN');
  }
  
  // Create all bookings
  const bookings = await Promise.all(lessons.map(item => 
    tx.booking.create({ ... })
  ));
  
  // Create PDA bookings
  const pdaBookings = await Promise.all(pdaItems.map(item =>
    tx.pDATestBooking.create({ ... })
  ));
  
  // Create wallet debit (single transaction for all)
  await tx.walletTransaction.create({
    type: 'DEBIT',
    amount: totalCost,
    metadata: {
      bookingIds: bookings.map(b => b.id),
      pdaBookingIds: pdaBookings.map(p => p.id),
    }
  });
}, {
  isolationLevel: 'Serializable',
  maxWait: 5000,
  timeout: 10000,
});
```

**Assessment:** ✅ **This is a strong design** — prevents race conditions on wallet balance.

---

### 2. Wallet Balance Source of Truth is Explicit

**Location:** Wallet helper functions

**What's good:**
- Authoritative balance derived from `WalletTransaction` records
- **Not** from cached `ClientWallet.balance` field
- Excludes expired credits
- Includes reconciliation function that detects cache drift
- Writes audit record when correcting drift

**Code pattern:**
```typescript
// ✅ CORRECT: Recalculate from transactions
function computeWalletBalanceDecimal(transactions: WalletTransaction[]): Decimal {
  return transactions
    .filter(tx => !tx.expiresAt || tx.expiresAt > new Date())
    .reduce((sum, tx) => {
      return tx.type === 'CREDIT' 
        ? sum.plus(tx.amount)
        : sum.minus(tx.amount);
    }, new Decimal(0));
}

// ❌ WRONG: Trust cached field
// const balance = wallet.balance; // Don't do this
```

**Assessment:** ✅ **Good financial hygiene** — prevents balance drift.

---

### 3. PDA Held-Funds Reconciliation is Comprehensive

**Location:** PDA reconciliation service

**What it checks:**
- Wallet debit amount
- PDA allocation on that debit
- Ledger-held amount
- Refunds issued
- Expected financial status
- Customer wallet account
- PDA funds-held account
- Wallet and customer linkage

**What it does:**
- Emits discrepancies (doesn't silently ignore)
- Returns detailed mismatch report
- Can be used for automated alerts

**Example discrepancies detected:**
```typescript
{
  pdaBookingId: 'pda-123',
  issues: [
    'Wallet debit shows $50 allocated to PDA, but ledger held shows $45',
    'PDA status is CONFIRMED but funds not released from held account',
    'Wallet transaction links to different customer than PDA booking'
  ]
}
```

**Assessment:** ✅ **One of the strongest parts of financial system**

---

### 4. PDA Refund Lifecycle Has Idempotency and Ownership Checks

**Location:** PDA refund handler

**What it validates:**
- Customer ownership (can't refund someone else's PDA)
- Idempotency key reuse for different PDA booking (rejects)
- Refund amount vs. remaining held amount
- Financial status transitions (CONFIRMED → PARTIALLY_REFUNDED → REFUNDED)

**What it creates:**
- Wallet refund transaction (CREDIT)
- Refund ledger records
- Updates `financialStatus`
- Links refund to original PDA booking

**Assessment:** ✅ **Directionally correct** — Has strong safeguards

---

## Critical Findings 🔴

### FIN-001: Global Ledger Integrity Check is Invalid

**Severity:** 🔴 **HIGH**

**Location:** Ledger integrity verification function

**Problem:**
```typescript
// ❌ BUG: Sets both from same aggregate
const totalDebits = totalAmount._sum.amount || 0;
const totalCredits = totalAmount._sum.amount || 0;

// Therefore difference is ALWAYS zero
const difference = totalDebits - totalCredits; // Always 0
const valid = difference === 0; // Always true
```

**Why This Matters:**

This does **NOT** prove double-entry integrity. It will **not** detect:
- One-sided manual entries
- Wrong debit/credit pairing
- Corrupt account strings
- Missing reversal entries
- Non-balanced custom entries

**Example of undetected error:**
```typescript
// Scenario: Manual entry creates debit without matching credit
await prisma.financialLedger.create({
  amount: 100,
  type: 'DEBIT',
  account: 'revenue',
  // ❌ No matching CREDIT entry created
});

// Current check: Still returns valid: true ✅ (WRONG!)
```

**What Should Happen:**
```typescript
// ✅ CORRECT: Separate aggregates
const totalDebits = await prisma.financialLedger.aggregate({
  where: { type: 'DEBIT' },
  _sum: { amount: true }
});

const totalCredits = await prisma.financialLedger.aggregate({
  where: { type: 'CREDIT' },
  _sum: { amount: true }
});

const valid = totalDebits._sum.amount === totalCredits._sum.amount;
```

**Or better: Per-transaction pair validation:**
```typescript
// Verify each transaction has matching debit/credit pair
const unmatchedEntries = await prisma.financialLedger.findMany({
  where: {
    pairId: { not: null },
  },
  select: { pairId: true, type: true, amount: true },
});

const pairs = _.groupBy(unmatchedEntries, 'pairId');

for (const [pairId, entries] of Object.entries(pairs)) {
  if (entries.length !== 2) {
    errors.push(`Pair ${pairId} has ${entries.length} entries (expected 2)`);
    continue;
  }
  
  const debit = entries.find(e => e.type === 'DEBIT');
  const credit = entries.find(e => e.type === 'CREDIT');
  
  if (!debit || !credit) {
    errors.push(`Pair ${pairId} missing debit or credit`);
  } else if (debit.amount !== credit.amount) {
    errors.push(`Pair ${pairId} amounts don't match: ${debit.amount} vs ${credit.amount}`);
  }
}
```

**Required Fix:** Rewrite as actual pair-level or account-level reconciliation

**Test Case:**
```typescript
it('detects unbalanced ledger entries', async () => {
  // Create unbalanced entry (debit without credit)
  await prisma.financialLedger.create({
    amount: 100,
    type: 'DEBIT',
    account: 'revenue',
  });
  
  const result = await verifyLedgerIntegrity();
  
  // ✅ Should detect imbalance
  expect(result.valid).toBe(false);
  expect(result.errors).toContain('Unmatched debit of $100');
});
```

---

### FIN-002: Financial Completion After Booking Transaction (Can Remain Pending)

**Severity:** 🔴 **HIGH**

**Location:** Wallet bulk booking route + post-commit recovery

**Problem Flow:**

```typescript
// Step 1: Booking transaction commits
const booking = await prisma.$transaction(async (tx) => {
  // Create bookings
  // Create wallet debit
  // All committed atomically
});

// ⚠️ DATABASE COMMIT HAPPENS HERE
// Bookings are now visible as CONFIRMED

// Step 2: Financial records (happens AFTER commit)
try {
  await completeWalletBookingFinancialRecords({
    bookings,
    walletTransactionId,
    // ... creates Transaction rows, ledger entries
  });
} catch (error) {
  // ❌ If this fails, booking is CONFIRMED but financial records PENDING
  return NextResponse.json({
    success: true,
    checkoutStatus: 'COMMITTED',
    financialRecordsStatus: 'PENDING',  // ⚠️
    message: 'Retry with same Idempotency-Key',
  }, { status: 503 });
}
```

**Why This Matters:**

Between commit and successful recovery:
- ✅ Bookings visible as `CONFIRMED`, `isPaid: true`
- ❌ `Transaction` records may be missing
- ❌ `FinancialLedger` entries may be missing
- ❌ Instructor payout calculations inconsistent
- ❌ Financial reports understate activity
- ❌ **If client never retries, pending state persists indefinitely**

**Example Scenario:**

```
10:00:00 — Booking transaction commits
10:00:01 — Customer sees "Booking confirmed!" in UI
10:00:02 — Financial completion starts
10:00:03 — Database connection drops (network issue)
10:00:04 — Financial completion fails
10:00:05 — API returns 503 "Retry with Idempotency-Key"
10:00:06 — Customer closes browser (happy, booking confirmed)
10:00:07+ — Financial records remain PENDING forever

Result:
- Booking appears in customer dashboard ✅
- Booking appears in instructor calendar ✅
- Instructor payout calculation: ❌ MISSING
- Financial report total revenue: ❌ UNDERSTATED
- Ledger balance check: ❌ IMBALANCED
```

**Current Recovery Logic:**

```typescript
// Recovery function (called on retry)
async function completeWalletBookingFinancialRecords(params) {
  // ✅ GOOD: Idempotent — checks if already complete
  const idempotencyRecord = await prisma.bookingIdempotencyKey.findUnique({ ... });
  
  if (idempotencyRecord.financialRecordsStatus === 'COMPLETED') {
    return; // Already done, safe to retry
  }
  
  // Create Transaction rows
  // Create ledger entries
  // Update idempotency record status
}
```

**But:** No automatic background worker to complete pending records.

**What's Missing:**

```typescript
// ❌ NOT IMPLEMENTED: Automatic recovery worker
// Should exist:

async function recoverPendingFinancialRecords() {
  const pending = await prisma.bookingIdempotencyKey.findMany({
    where: {
      financialRecordsStatus: 'PENDING',
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }, // Older than 5 min
    },
  });
  
  for (const record of pending) {
    try {
      await completeWalletBookingFinancialRecords(record);
      logger.info(`Auto-recovered financial records for ${record.bookingId}`);
    } catch (error) {
      logger.error(`Failed to auto-recover ${record.bookingId}:`, error);
      // Alert support team after N failures
    }
  }
}

// Run every 5 minutes
cron.schedule('*/5 * * * *', recoverPendingFinancialRecords);
```

**Required Fix:**  
Add automatic recovery worker or scheduled reconciliation that completes pending financial records without depending on user retry.

**Test Case:**
```typescript
it('auto-recovers pending financial records after commit', async () => {
  // Simulate: booking committed, financial completion failed
  const { bookingId, idempotencyKey } = await createBookingWithoutFinancialRecords();
  
  const record = await prisma.bookingIdempotencyKey.findUnique({
    where: { key: idempotencyKey },
  });
  expect(record.financialRecordsStatus).toBe('PENDING');
  
  // Run recovery worker
  await recoverPendingFinancialRecords();
  
  // ✅ Should now be complete
  const updated = await prisma.bookingIdempotencyKey.findUnique({
    where: { key: idempotencyKey },
  });
  expect(updated.financialRecordsStatus).toBe('COMPLETED');
  
  // Verify Transaction and ledger records exist
  const transactions = await prisma.transaction.findMany({
    where: { bookingId },
  });
  expect(transactions.length).toBeGreaterThan(0);
});
```

---

### FIN-003: No Durable Parent Checkout/Package Record

**Severity:** 🔴 **HIGH** (Architectural Gap)

**Current State:**

Relationships stored mainly in JSON metadata:

```typescript
// Wallet debit metadata contains all child IDs
{
  type: 'DEBIT',
  amount: 393.25,
  metadata: {
    bookingIds: ['booking-1', 'booking-2', 'booking-3', ...],
    pdaBookingIds: ['pda-1'],
    checkoutType: 'BULK_PACKAGE',
    packageHours: 6,
  }
}

// PDA can point to ONE parent lesson
{
  pdaTestBookingId: 'pda-1',
  parentBookingId: 'booking-1',  // Only one parent
}

// ❌ NO explicit parent checkout/package/batch entity
```

**Why This Matters:**

For a multi-lesson package, **financial parent is the wallet debit**, not a first-class database record.

This makes it harder to:
1. **Reconcile** one purchased package against all child lessons
   ```sql
   -- ❌ Current: Must parse JSON metadata
   SELECT * FROM "WalletTransaction" 
   WHERE metadata->>'bookingIds' LIKE '%booking-1%';
   
   -- ✅ Should be:
   SELECT * FROM "Booking"
   WHERE "checkoutId" = 'checkout-123';
   ```

2. **Cancel package coherently**
   ```typescript
   // ❌ Current: Must extract IDs from metadata, cancel each
   const metadata = walletTx.metadata as any;
   for (const id of metadata.bookingIds) {
     await cancelBooking(id);
   }
   
   // ✅ Should be:
   await cancelCheckout(checkoutId); // Cancels all children atomically
   ```

3. **Reschedule while preserving package context**
   ```typescript
   // ❌ Current: Rescheduling one lesson loses package linkage
   await updateBooking(bookingId, { startTime: newTime });
   // No way to know this was part of a 6-lesson package
   
   // ✅ Should be:
   const checkout = await getCheckout(checkoutId);
   console.log(`Rescheduling lesson 2 of ${checkout.totalLessons}`);
   ```

4. **Audit which bookings belonged to one checkout**
   ```sql
   -- ❌ Current: Complex JSON query
   SELECT "WalletTransaction".*, "Booking".*
   FROM "WalletTransaction"
   CROSS JOIN LATERAL jsonb_array_elements_text(
     "WalletTransaction".metadata->'bookingIds'
   ) AS bid
   JOIN "Booking" ON "Booking".id = bid::text;
   
   -- ✅ Should be:
   SELECT * FROM "Booking" WHERE "checkoutId" = 'checkout-123';
   ```

5. **Calculate remaining package entitlement**
   ```typescript
   // ❌ Current: Unclear
   // Is remaining entitlement based on:
   // - Remaining wallet balance?
   // - Remaining hours from metadata.packageHours?
   // - Count of unused bookingIds?
   
   // ✅ Should be:
   const checkout = await prisma.walletCheckout.findUnique({
     where: { id: 'checkout-123' },
     include: {
       bookings: {
         where: { status: { in: ['CONFIRMED', 'COMPLETED'] } }
       }
     }
   });
   const usedHours = checkout.bookings.reduce((sum, b) => sum + b.duration/60, 0);
   const remainingHours = checkout.packageHours - usedHours;
   ```

**Proposed Schema:**

```prisma
model WalletCheckout {
  id                String   @id @default(cuid())
  userId            String
  customerId        String?
  walletTransactionId String  @unique
  idempotencyKey    String?  @unique
  
  // Package details
  packageType       String   // 'CUSTOM', 'PACKAGE_6', etc.
  packageHours      Decimal
  totalAmount       Decimal
  discountApplied   Decimal?
  
  // Status
  status            String   // 'PENDING', 'COMPLETED', 'CANCELLED'
  createdAt         DateTime
  completedAt       DateTime?
  
  // Relationships
  user              User     @relation(fields: [userId], references: [id])
  customer          Customer? @relation(fields: [customerId], references: [id])
  walletTransaction WalletTransaction @relation(fields: [walletTransactionId], references: [id])
  bookings          Booking[]
  pdaBookings       PDATestBooking[]
  
  @@index([userId, createdAt])
  @@index([status])
}

// Update existing models
model Booking {
  // ... existing fields ...
  checkoutId        String?
  checkout          WalletCheckout? @relation(fields: [checkoutId], references: [id])
}

model PDATestBooking {
  // ... existing fields ...
  checkoutId        String?
  checkout          WalletCheckout? @relation(fields: [checkoutId], references: [id])
}
```

**Migration Strategy:**

```typescript
// Step 1: Add nullable checkoutId columns
// Step 2: Backfill historical data from metadata
async function backfillCheckoutRecords() {
  const walletDebits = await prisma.walletTransaction.findMany({
    where: {
      type: 'DEBIT',
      metadata: { path: ['bookingIds'], not: undefined },
    },
  });
  
  for (const debit of walletDebits) {
    const metadata = debit.metadata as any;
    
    // Create checkout record
    const checkout = await prisma.walletCheckout.create({
      data: {
        userId: debit.userId!,
        walletTransactionId: debit.id,
        packageHours: metadata.packageHours || 1,
        totalAmount: debit.amount,
        status: 'COMPLETED',
        createdAt: debit.createdAt,
        completedAt: debit.createdAt,
      },
    });
    
    // Link bookings
    if (metadata.bookingIds) {
      await prisma.booking.updateMany({
        where: { id: { in: metadata.bookingIds } },
        data: { checkoutId: checkout.id },
      });
    }
    
    // Link PDA bookings
    if (metadata.pdaBookingIds) {
      await prisma.pDATestBooking.updateMany({
        where: { id: { in: metadata.pdaBookingIds } },
        data: { checkoutId: checkout.id },
      });
    }
  }
}
```

**Required Fix:**  
Introduce durable parent record (`WalletCheckout` or `BookingBatch`), link all child bookings/PDA to it.

---

### FIN-004: Standalone PDA Endpoint Disconnected from Safe Bulk Flow

**Severity:** 🔴 **HIGH** (if still used by public UI)

**Location:** `/api/pda-bookings`

**Problem:**

This endpoint still:
- ✅ Requires CLIENT authentication
- ✅ Checks wallet balance
- ❌ Creates `PENDING_PAYMENT` status
- ❌ Does **NOT** create wallet-held lifecycle used by bulk checkout
- ❌ Does **NOT** atomically debit wallet with booking creation

**Code Pattern (presumed):**

```typescript
// /api/pda-bookings route
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check wallet balance (read-only)
  const wallet = await prisma.clientWallet.findUnique({ ... });
  if (wallet.balance < pdaPrice) {
    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
  }
  
  // ❌ Create PDA booking WITHOUT wallet debit
  const pdaBooking = await prisma.pDATestBooking.create({
    data: {
      status: 'PENDING_PAYMENT',  // ⚠️ Waiting for separate payment step
      price: pdaPrice,
      // ... other fields ...
    }
  });
  
  return NextResponse.json({ pdaBookingId: pdaBooking.id });
}
```

**Compare to Safe Bulk Flow:**

```typescript
// /api/client/bookings/create-bulk (wallet-funded)
await prisma.$transaction(async (tx) => {
  // Create PDA booking
  const pdaBooking = await tx.pDATestBooking.create({
    data: {
      status: 'CONFIRMED',  // ✅ Immediately confirmed
      price: pdaPrice,
    }
  });
  
  // ✅ Atomically create wallet debit with funds-held allocation
  await tx.walletTransaction.create({
    type: 'DEBIT',
    amount: pdaPrice,
    metadata: {
      pdaBookingIds: [pdaBooking.id],
      pdaFundsHeld: pdaPrice, // For refund tracking
    }
  });
  
  // ✅ Create ledger entries for funds-held
  await createLedgerEntriesIdempotently(tx, [
    { type: 'DEBIT', account: 'customer:wallet', amount: pdaPrice },
    { type: 'CREDIT', account: 'pda:funds-held', amount: pdaPrice },
  ]);
}, { isolationLevel: 'Serializable' });
```

**Why This Matters:**

If frontend still calls `/api/pda-bookings` during public checkout:
- ❌ Earlier PDA defects remain live (no wallet debit, no funds-held)
- ❌ Customer charged but PDA not confirmed
- ❌ Refund logic breaks (no funds-held to release)
- ❌ Financial reconciliation inconsistent

**Two Different Financial Semantics:**

| Aspect | Bulk Flow | Standalone PDA |
|--------|-----------|---------------|
| **Status after creation** | `CONFIRMED` | `PENDING_PAYMENT` |
| **Wallet debit** | ✅ Atomic with booking | ❌ Separate step |
| **Funds-held ledger** | ✅ Created immediately | ❌ Not created |
| **Refund linkage** | ✅ Tracks via `walletTransactionId` | ❌ No linkage |
| **Serializable tx** | ✅ Yes | ❌ No |

**Required Fix:**

Either:
1. **Retire standalone endpoint** from public booking flow
2. **Refactor it** to use same `executeWalletBookingTransaction()` service

**Verification Needed:**

```typescript
// Check: Does frontend still call this endpoint?
// File to inspect: /app/client-dashboard/pda-tests/book/page.tsx
// Look for: fetch('/api/pda-bookings')
```

**Test Case:**

```typescript
it('standalone PDA endpoint creates wallet debit atomically', async () => {
  const session = await createClientSession();
  
  // Get balance before
  const walletBefore = await getWalletBalance(session.user.id);
  
  // Book PDA via standalone endpoint
  const response = await fetch('/api/pda-bookings', {
    method: 'POST',
    headers: { Cookie: session.cookie },
    body: JSON.stringify({ configId: 'pda-config-1', testCentreId: 'centre-1' }),
  });
  
  const { pdaBookingId } = await response.json();
  
  // ✅ Should have wallet debit
  const walletTx = await prisma.walletTransaction.findFirst({
    where: {
      userId: session.user.id,
      type: 'DEBIT',
      metadata: { path: ['pdaBookingIds'], array_contains: pdaBookingId },
    },
  });
  
  expect(walletTx).toBeDefined(); // Currently fails ❌
  
  // ✅ Should have funds-held ledger entry
  const ledger = await prisma.financialLedger.findFirst({
    where: {
      pdaBookingId,
      account: 'pda:funds-held',
      type: 'CREDIT',
    },
  });
  
  expect(ledger).toBeDefined(); // Currently fails ❌
});
```

---

## Medium-Priority Findings 🟠

### FIN-005: Ledger Helpers Persist Different Field Sets

**Severity:** 🟠 MEDIUM

**Problem:**

```typescript
// LedgerEntry interface supports:
interface LedgerEntry {
  amount: Decimal;
  type: 'DEBIT' | 'CREDIT';
  account: string;
  pdaBookingId?: string;        // ✅ Supported
  pdaRefundId?: string;         // ✅ Supported
  walletTransactionId?: string; // ✅ Supported
  customerId?: string;          // ✅ Supported
  entryType?: string;           // ✅ Supported
  status?: string;              // ✅ Supported
  currency?: string;            // ✅ Supported
}

// But older helpers only persist subset:
function createLedgerEntry(entry) {
  return prisma.financialLedger.create({
    data: {
      amount: entry.amount,
      type: entry.type,
      account: entry.account,
      // ❌ Missing: pdaBookingId, walletTransactionId, etc.
    }
  });
}

// Newer helper persists full set:
function createLedgerEntriesIdempotently(entries) {
  return prisma.financialLedger.createMany({
    data: entries.map(e => ({
      amount: e.amount,
      type: e.type,
      account: e.account,
      pdaBookingId: e.pdaBookingId,            // ✅ Included
      walletTransactionId: e.walletTransactionId, // ✅ Included
      customerId: e.customerId,                // ✅ Included
      // ... all fields
    }))
  });
}
```

**Why This Matters:**

Different callers produce different record shapes:
- Reporting queries break (some records missing `pdaBookingId`)
- Reconciliation incomplete (can't link ledger → transaction)
- Audit searches fail (no `walletTransactionId` to filter by)

**Example:**

```sql
-- Query: Find all ledger entries for wallet transaction
SELECT * FROM "FinancialLedger"
WHERE "walletTransactionId" = 'wallet-tx-123';

-- Result: Only returns entries created by NEW helper
-- Entries created by OLD helper: missing (even though they're for same transaction)
```

**Required Fix:**  
Use one ledger-writing path, or make every helper persist complete schema.

---

### FIN-006: Existing Transaction Mismatch Silently Accepted

**Severity:** 🟠 MEDIUM

**Location:** Post-commit recovery

**Problem:**

```typescript
// Recovery: Check if Transaction already exists
const existingTx = await prisma.transaction.findFirst({
  where: {
    bookingId,
    type: 'BOOKING_PAYMENT',
  },
});

if (existingTx) {
  // ❌ Just update status, don't verify amounts match
  await prisma.transaction.update({
    where: { id: existingTx.id },
    data: { status: 'COMPLETED' },
  });
  return; // Done
}

// If doesn't exist, create it
await prisma.transaction.create({ ... });
```

**Why This Matters:**

A stale or incorrect transaction can remain while booking/ledger say something else:

```
Scenario:
1. Booking created: amount = $60, platformFee = $6
2. Transaction created: amount = $60, platformFee = $6
3. Booking manually updated: amount = $70, platformFee = $7
4. Recovery runs: finds existing Transaction, updates status
5. Result: Transaction shows $60, Booking shows $70 ❌
```

**What Should Happen:**

```typescript
if (existingTx) {
  // ✅ Verify amounts match
  if (
    existingTx.amount !== booking.price ||
    existingTx.platformFee !== booking.platformFee ||
    existingTx.providerPayout !== booking.providerPayout
  ) {
    throw new Error(
      `Transaction ${existingTx.id} amounts don't match booking ${bookingId}:
       Transaction: ${existingTx.amount} / ${existingTx.platformFee}
       Booking: ${booking.price} / ${booking.platformFee}`
    );
  }
  
  // Only update status if amounts match
  await prisma.transaction.update({ ... });
}
```

**Required Fix:**  
Compare financial fields when existing transaction found, fail reconciliation on mismatch.

---

### FIN-007: Payout-Readiness Temporarily Inconsistent

**Severity:** 🔴 **HIGH** (Operational Risk)

**Problem:**

```
Timeline:
10:00:00 — Booking transaction commits
            Booking: status = CONFIRMED, isPaid = true, paidAt = now
10:00:01 — Payout calculation job runs
            Finds: Booking.isPaid = true ✅
            Looks for: Transaction record... ❌ NOT FOUND
            Decision: Include in payout? OR Skip?
10:00:02 — Financial completion runs
            Creates: Transaction row
            Creates: Ledger entries
10:00:03 — Payout job runs again
            Finds: Transaction record ✅
            Decision: Include in payout ✅
```

**Why This Matters:**

Payout eligibility inconsistent depending on timing:
- Job after commit but before recovery: sees paid booking without Transaction
- Job after recovery: sees paid booking with Transaction
- Conversely, job reading only ledger/transaction tables may omit booking

**Current Code (presumed):**

```typescript
// ❌ BAD: Only checks isPaid
async function getPayoutEligibleBookings(instructorId) {
  return prisma.booking.findMany({
    where: {
      providerId: instructorId,
      isPaid: true,
      payoutStatus: 'PENDING',
    }
  });
}

// Result: May include bookings without Transaction records yet
```

**What Should Happen:**

```typescript
// ✅ GOOD: Check financial completion status
async function getPayoutEligibleBookings(instructorId) {
  // Option A: Check idempotency record
  const bookings = await prisma.booking.findMany({
    where: {
      providerId: instructorId,
      isPaid: true,
      payoutStatus: 'PENDING',
    },
    include: {
      // Check if financial records complete
      _count: {
        select: {
          transactions: { where: { type: 'BOOKING_PAYMENT', status: 'COMPLETED' } }
        }
      }
    }
  });
  
  // Only include bookings with completed financial records
  return bookings.filter(b => b._count.transactions > 0);
  
  // Option B: Add financialStatus field to Booking
  return prisma.booking.findMany({
    where: {
      providerId: instructorId,
      isPaid: true,
      financialStatus: 'COMPLETED',  // ✅ Explicit flag
      payoutStatus: 'PENDING',
    }
  });
}
```

**Required Fix:**  
Payout eligibility based on completed financial state, not only `Booking.isPaid`.

---

### FIN-008: Package Hours and Wallet Dollars Can Diverge

**Severity:** 🟠 MEDIUM to 🔴 HIGH (Product Decision)

**Problem:**

Current documentation states:
> "Wallet funds are not rate-locked. Each lesson is priced at the instructor's current hourly rate."

**Scenario:**

```
Customer buys 6-hour package:
- Instructor rate: $60/hour
- Package price: $360 (before discount/fees)
- Wallet credited: $360

Customer books first lesson (1 hour):
- Current rate: $60/hour
- Wallet debited: $60
- Remaining: $300 = 5 hours equivalent

Instructor changes rate to $70/hour:

Customer books second lesson (1 hour):
- Current rate: $70/hour
- Wallet debited: $70
- Remaining: $230 = 3.3 hours equivalent ❌

Customer support: "I bought 6 hours but can only book 5.3 hours?"
```

**Ambiguity:**

Is remaining entitlement:
- **Remaining wallet balance?** ($230)
- **Remaining hours from metadata?** (4 hours = 6 purchased - 2 used)
- **Hybrid conversion?** (unclear)

**Why This Matters:**

- Customer confusion ("I bought 6 hours")
- Support burden (explaining rate changes)
- Refund calculations (refund remaining hours or dollars?)
- Receipt clarity (show hours or dollars or both?)

**Current Receipt (presumed):**

```
Package: 6 hours
Price: $360
Used: 2 hours ($130)
Remaining: $230
```

Customer interprets "Remaining: $230" as "4 hours remaining" but it's actually ~3.3 hours at new rate.

**Required Fix:**

Decide package model:
1. **Hour-based entitlement** (rate-locked)
   - Buy "6 hours" = 6 future lessons regardless of rate
   - Wallet debits vary, but hour count decrements
   - Clearer for customer
   
2. **Dollar wallet balance** (not rate-locked)
   - Buy "$360 credit" = use at current rates
   - Hour equivalent varies
   - More flexible for platform

3. **Hybrid with explicit conversion**
   - Buy "6 hours at $60/hour = $360"
   - Lock rate for this package
   - Future packages use new rate

**Reflect decision in:**
- Financial records
- Receipts
- UI display ("X hours remaining" vs "X hours equivalent at current rate")
- Refund policy

---

### FIN-009: Lesson Receipt Wallet Balances May Be Wrong

**Severity:** 🟠 MEDIUM

**Location:** Receipt generation

**Problem:**

```typescript
// Calculate receipt balances from final remaining + later lesson prices
const walletAfter1 = finalRemaining + lesson2Price + lesson3Price + ...;
const walletAfter2 = finalRemaining + lesson3Price + ...;

// ❌ This doesn't account for PDA prices
// If checkout includes PDA, balances are wrong
```

**Example:**

```
Checkout: 2 lessons + 1 PDA
- Lesson 1: $60
- Lesson 2: $60
- PDA: $50
- Total debit: $170

Receipt for Lesson 1:
  Before: $500
  Charged: $60
  After: $440 ❌ WRONG (should be $330 after all items)

Receipt for Lesson 2:
  Before: $440 ❌ WRONG
  Charged: $60
  After: $380 ❌ WRONG

PDA receipt:
  Before: $380 ❌ WRONG
  Charged: $50
  After: $330 ✅ Correct (but earlier ones wrong)
```

**What Should Happen:**

```typescript
// Calculate from actual wallet debit allocation
const debitMetadata = walletTransaction.metadata as any;
const allItems = [
  ...debitMetadata.bookingIds.map(id => bookings.find(b => b.id === id)),
  ...debitMetadata.pdaBookingIds.map(id => pdaBookings.find(p => p.id === id)),
];

// Sort by creation order
allItems.sort((a, b) => a.createdAt - b.createdAt);

let runningBalance = walletBalanceBefore;
for (const item of allItems) {
  const itemPrice = item.price;
  const balanceBefore = runningBalance;
  runningBalance -= itemPrice;
  
  generateReceipt({
    item,
    balanceBefore,
    charged: itemPrice,
    balanceAfter: runningBalance,
  });
}
```

**Required Fix:**  
Calculate receipt balances from actual wallet debit allocation, including lessons and PDA.

---

### FIN-010: Receipt Architecture is Split

**Severity:** 🟠 MEDIUM

**Location:** Receipt services

**Problem:**

```typescript
// Receipt bridge with feature flag
function sendReceipt(params) {
  if (process.env.USE_NEW_RECEIPTS === 'true') {
    return newReceiptSystem.send(params);
  } else {
    return legacyReceiptSystem.send(params); // Default
  }
}

// But wallet bulk route bypasses bridge:
await sendWalletLessonReceipt({ ... }); // ❌ Calls legacy directly
```

**Why This Matters:**

Two receipt paths exist:
- Different data sources
- Different formatting
- Different financial presentation
- Potential inconsistencies

**Example:**

```
Customer books via:
- Dashboard wallet checkout → Legacy receipt (no platform fee shown)
- Voice AI bulk booking → New receipt (platform fee shown)

Customer confused: "Why do some receipts show fee and some don't?"
```

**Required Fix:**  
Choose one receipt system for wallet checkout, route all generation through it.

---

### FIN-011: Financial Service Uses @ts-nocheck

**Severity:** 🟠 MEDIUM

**Location:** Ledger service file header

**Problem:**

```typescript
// @ts-nocheck
// ❌ TypeScript checking disabled for entire file

export function createLedgerEntry(entry: LedgerEntry) {
  // ... financial logic ...
}
```

**Why This Matters:**

Disabling TypeScript in financial code removes protection from:
- Type mismatches (passing string where number expected)
- Missing required fields
- Wrong enum values
- Breaking API changes

**Example of undetected error:**

```typescript
// @ts-nocheck enabled:
createLedgerEntry({
  amount: "100.00",  // ❌ Should be Decimal, but no error shown
  type: 'DEBET',     // ❌ Typo in 'DEBIT', but no error shown
  account: null,     // ❌ Required field, but no error shown
});
```

**Required Fix:**  
Remove `@ts-nocheck`, add strict types to ledger service.

---

## Financial Lifecycle Map (Wallet Path) ✅

```
Existing wallet funds
        ↓
Create-bulk route validates provider eligibility
        ↓
Server recalculates lesson and PDA prices
        ↓
┌─────────────────────────────────────────┐
│   SERIALIZABLE TRANSACTION              │
│   ✅ Strong transactional core           │
├─────────────────────────────────────────┤
│  • Re-read wallet transactions          │
│  • Calculate balance (Decimal)          │
│  • Create each lesson Booking           │
│  • Create each PDATestBooking           │
│  • Check slot conflicts                 │
│  • Create WalletTransaction DEBIT       │
│  • Store booking/PDA IDs in metadata    │
└─────────────────────────────────────────┘
        ↓
Booking idempotency record saved as PENDING
        ↓
⚠️ DATABASE COMMIT HAPPENS HERE
        ↓
┌─────────────────────────────────────────┐
│   POST-COMMIT FINANCIAL COMPLETION      │
│   ⚠️ Can fail and remain PENDING         │
├─────────────────────────────────────────┤
│  • Write lesson ledger/payment records  │
│  • Write Transaction rows               │
│  • Write PDA funds-held ledger records  │
│  • Mark idempotency financialRecords    │
│    status = COMPLETED                   │
└─────────────────────────────────────────┘
        ↓
Notifications and receipts
```

**Assessment:** Strong transactional core, but parent-record and recovery gaps remain.

---

## Still Not Closed from Earlier Audit ⏳

| Item | Status | Reference |
|------|--------|-----------|
| **Stripe "Book Now" flow** | ⏳ **Stage 9 audit required** | See `CRITICAL-FINDINGS-PUBLIC-STRIPE-BOOKING.md` |
| **Payout eligibility** | ⏳ **Stage 11 audit required** | Positive controls exist, but completion timing unverified |
| **Package purchase** | ⏳ **Stage 10 audit required** | Wallet credit creation + package-hour allocation needs tracing |
| **PDA public UI integration** | ⏳ **Needs verification** | Check if frontend calls `/api/pda-bookings` before wallet checkout |
| **Global financial reconciliation** | 🔴 **FIN-001 blocking** | Ledger integrity check invalid |
| **Refund/reschedule semantics** | ⏳ **Policy decision** | Mixed lesson+PDA checkout cancellation needs package-level policy |

---

## Recommended Next Audit Order

### Priority 1: Stage 9 — Stripe Payment Path 🔴
**Why first:** Highest-risk public-facing flow

Trace non-wallet public payment end-to-end:
- Book Now route
- PaymentIntent creation
- Amount calculation
- Client confirmation token
- Webhook handler
- Metadata ownership
- Transaction/ledger writes
- Duplicate events
- Confirmation page verification

**Reference:** `CRITICAL-FINDINGS-PUBLIC-STRIPE-BOOKING.md` (already documented)

---

### Priority 2: Fix FIN-001 and FIN-002 🔴
**Why second:** Blocks financial integrity

- Fix global ledger integrity check (FIN-001)
- Add automatic recovery worker (FIN-002)
- Add `financialStatus` field to Booking (FIN-007 related)

**Estimated time:** 1-2 days

---

### Priority 3: Stage 10 — Package Purchase & Wallet Credit 🟠
**Why third:** Foundation for understanding entitlement model

Trace:
- Package purchase
- Stripe payment
- Wallet credit creation
- Package hours allocation
- Instructor rate changes impact
- Expiry handling
- Refund treatment

---

### Priority 4: Stage 11 — Payout Eligibility 🟠
**Why fourth:** Revenue recognition

Verify payouts only include:
- Paid bookings
- Non-refunded
- Ledger-recorded
- Transaction-recorded
- Not chargeback-pending
- Not incomplete financial-recovery state

---

### Priority 5: Stage 12 — Financial Reconciliation Tests 🟡
**Why last:** Comprehensive verification

Add or verify reconciliation for:
- Lesson bookings
- PDA bookings
- Wallet balances
- Transaction rows
- FinancialLedger rows
- Stripe charges/refunds
- Instructor payable balances

---

## Bottom Line

**Wallet-funded checkout:**
- ✅ **Strong transactional foundation**
- ✅ **Much better PDA handling** than earlier audit described
- ✅ **Good idempotency and recovery patterns**
- ⚠️ **But:** Financial completion asynchronous after commit
- ⚠️ **But:** Global ledger integrity check invalid
- ⚠️ **But:** No durable parent checkout record

**Standalone PDA endpoint:**
- 🔴 **Still unsafe** if used by public checkout
- 🔴 **Disconnected** from wallet-held lifecycle

**Stripe-paid public booking:**
- 🔴 **Still blocked** pending Stage 9 audit
- 🔴 **4 critical defects** documented

**Financial lifecycle:**
- ✅ **Strong components**
- ⚠️ **Incomplete end-to-end closure**

**Verdict:**
> **Wallet-funded bulk booking: Improved, but not production-closed**

---

## Summary Table: All Findings

| ID | Finding | Severity | Status | Priority |
|----|---------|----------|--------|----------|
| FIN-001 | Global ledger integrity check invalid | 🔴 HIGH | Open | P0 |
| FIN-002 | Financial completion can remain pending | 🔴 HIGH | Open | P0 |
| FIN-003 | No durable parent checkout record | 🔴 HIGH | Open | P1 |
| FIN-004 | Standalone PDA endpoint disconnected | 🔴 HIGH | Open | P1 |
| FIN-005 | Ledger helpers persist different fields | 🟠 MEDIUM | Open | P2 |
| FIN-006 | Transaction mismatch silently accepted | 🟠 MEDIUM | Open | P2 |
| FIN-007 | Payout-readiness temporarily inconsistent | 🔴 HIGH | Open | P1 |
| FIN-008 | Package hours/dollars can diverge | 🟠 MEDIUM | Open | P2 (policy) |
| FIN-009 | Receipt balances wrong with PDA | 🟠 MEDIUM | Open | P3 |
| FIN-010 | Receipt architecture split | 🟠 MEDIUM | Open | P3 |
| FIN-011 | Financial service uses @ts-nocheck | 🟠 MEDIUM | Open | P3 |

---

**Document Status:** ✅ **STAGE 8 AUDIT COMPLETE**  
**Next Action:** Stage 9 (Stripe payment path) + Fix FIN-001/FIN-002  
**Last Updated:** 2026-11-25

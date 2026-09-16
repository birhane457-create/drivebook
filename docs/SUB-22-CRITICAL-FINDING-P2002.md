# SUB-22 Critical Finding: P2002 Recovery Inside Transaction

**Date:** 2026-09-11  
**Severity:** ⚠️ **HIGH** - Requires database verification  
**Status:** 🔬 **UNVERIFIED**

---

## Issue Description

The current Step 5 implementation catches P2002 (unique constraint violation) and attempts to query the database **inside the same Prisma transaction** that just hit the constraint error.

### Code Location
`app/api/stripe/webhook/route.ts` lines ~1560-1575 (approximate)

### Questionable Pattern

```typescript
await prisma.$transaction(async (tx) => {
  // ... 
  try {
    const updateResult = await tx.subscription.updateMany({...});
    // ...
  } catch (err: any) {
    if (err.code === 'P2002' || err.code === '23505') {
      // ⚠️ CRITICAL: Querying tx AFTER constraint violation
      const existingRow = await tx.subscription.findFirst({
        where: { providerId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] }}
      });
      
      if (existingRow?.stripeSubscriptionId === subscription.id) {
        // Idempotent success
      } else {
        // Throw conflict error
      }
    }
  }
}, { isolationLevel: 'Serializable' });
```

---

## Why This Is Questionable

### PostgreSQL Transaction Abort Behavior

1. **Unique constraint violations CAN abort the current PostgreSQL transaction**
2. **After abort, subsequent queries in the same transaction may fail or return stale data**
3. **Prisma's behavior in this scenario is unverified**

### Unproven Assumptions

The code assumes:
- ✅ `catch` block executes (this is safe)
- ❓ `tx.subscription.findFirst()` **after P2002** returns correct current state
- ❓ Transaction is still usable for reads after constraint violation
- ❓ `existingRow` reflects the actual database state (not pre-conflict state)

**None of these are proven without actual database testing.**

---

## Why P2002 Recovery Is Critical (Not Just Defensive)

### The Race Scenario

```
Initial state: provider P → TRIAL subscription, stripeSubscriptionId = NULL

Concurrent webhooks:
  Webhook A → sub_stripe_A
  Webhook B → sub_stripe_B

Execution:
  1. Both see stripeSubscriptionId: null TRIAL row
  2. Both execute updateMany() to claim it
  3. ONE wins (gets count=1)
  4. ONE loses (gets count=0, tries create())
  5. Loser's create() hits P2002 on partial unique index
  6. **P2002 branch must correctly identify winner**
```

### Why This Matters

- `updateMany()` **does NOT prevent** the race when both try to claim the same NULL trial
- One succeeds with `updateMany()`, the other falls through to `create()`
- **Partial unique index is the final invariant** that catches the loser's `create()`
- **P2002 recovery MUST work correctly** or system behavior is undefined

**This is NOT defensive code - it's a critical part of the correctness story.**

---

## What Needs To Be Verified

### 1. Transaction State After P2002

**Question:** After catching P2002 inside a Prisma transaction with `isolationLevel: 'Serializable'`, is `tx.subscription.findFirst()` safe to use?

**Test:**
```typescript
await prisma.$transaction(async (tx) => {
  try {
    await tx.subscription.create({ data: { /* will violate unique */ }});
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Can we safely query here?
      const result = await tx.subscription.findFirst({...});
      // Does 'result' reflect actual DB state or stale/aborted state?
    }
  }
}, { isolationLevel: 'Serializable' });
```

**Expected Answer:** Needs real database test with PostgreSQL + Prisma

### 2. Stripe ID Verification Logic

**Question:** Does `existingRow?.stripeSubscriptionId` correctly identify the winner's Stripe ID?

**Test Cases:**
- Winner = sub_A, Loser = sub_B → `existingRow.stripeSubscriptionId` should be `sub_A`
- Verify loser sees winner's ID, not NULL or stale value
- Verify error message includes both IDs for debugging

### 3. HTTP Response Correctness

**Question:** What HTTP status does the losing webhook return?

**Requirement:**
- Winner: 200 OK
- Loser (different ID): 409 or 500 (NOT 200)
- Loser (same ID): 200 OK (idempotent)

**Stripe's behavior depends on this.** If loser returns 200, Stripe won't retry.

---

## Current Test Coverage

❌ **INSUFFICIENT**

- `sub-22-concurrent.test.ts` uses `simulateWebhookTransaction()`
- Does NOT exercise actual `POST /api/stripe/webhook`
- Does NOT test Prisma transaction abort behavior
- Does NOT verify HTTP responses
- Does NOT use real PostgreSQL with partial unique indexes

---

## Recommended Next Steps

### 1. Code-Level Test Correction (PRIORITY)

Modify `app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts`:
- Replace `simulateWebhookTransaction()` with actual HTTP POST
- Exercise full production path including Stripe signature verification
- Verify HTTP status codes (200, 409, 500)

### 2. Database-Level Verification

Run tests against **safe staging PostgreSQL database** with:
- Partial unique indexes applied (migration run)
- SERIALIZABLE isolation level
- Actual Prisma $transaction behavior
- Real P2002 constraint violations

### 3. Evidence Collection

Record:
- Loser's `findFirst()` result after P2002
- Winner vs. Loser Stripe IDs in logs
- HTTP status codes returned
- Webhook event records
- Final database state

### 4. Alternative Approach (If P2002 Recovery Fails)

If `tx.subscription.findFirst()` after P2002 proves unsafe:

**Option A:** Catch P2002 outside transaction, then re-query
```typescript
try {
  await prisma.$transaction(async (tx) => { /* ... */ });
} catch (err: any) {
  if (err.code === 'P2002') {
    // Query outside aborted transaction
    const existingRow = await prisma.subscription.findFirst({...});
  }
}
```

**Option B:** Use advisory locks or conditional upserts
**Option C:** Accept P2002 as idempotent success (rely on index alone)

---

## Impact Assessment

### If P2002 Recovery Works Correctly
- ✅ Different Stripe IDs produce controlled error
- ✅ System prevents duplicate subscriptions
- ✅ Webhook responses guide Stripe retry behavior

### If P2002 Recovery Fails
- ❌ Loser might see stale/NULL Stripe ID
- ❌ Conflict detection logic fails
- ❌ Error messages misleading
- ❌ HTTP responses incorrect
- ❌ Stripe retry behavior unpredictable

---

## Conclusion

**The P2002 recovery logic is architecturally questionable and MUST be verified with actual database tests before production deployment.**

Documentation cannot resolve this. Only real PostgreSQL + Prisma + SERIALIZABLE isolation testing can prove correctness.

**Status:** SUB-22 Step 5 remains UNVERIFIED until P2002-inside-transaction behavior is tested.

---

**Next Action:** Modify tests to POST to real webhook route, run against staging database, record actual behavior.

**NO MORE DOCUMENTATION UNTIL TESTS RUN.**

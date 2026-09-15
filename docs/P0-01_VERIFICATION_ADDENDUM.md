# P0-01 Verification Addendum - Concurrent Race Condition

**Date**: 2026-09-11  
**Verifier**: Independent Source Review (Human Auditor)  
**Status**: ⚠️ **CONCURRENT RACE CONDITION IDENTIFIED**

---

## Summary

The original P0-01 ownership vulnerability **IS FIXED** at source level. However, independent verification revealed a **concurrent double-credit race condition** that was missed in the initial analysis.

---

## What Was Verified ✅

### Ownership Security - SOURCE VERIFIED

The cross-user PaymentIntent theft attack is **genuinely blocked**:

1. ✅ `/api/client/wallet-add` requires authenticated session
2. ✅ Retrieves PaymentIntent from Stripe (doesn't trust client input)
3. ✅ Requires `metadata.userId` present
4. ✅ Requires `metadata.userId === authenticated user.id`
5. ✅ Additionally checks `metadata.walletId` when present
6. ✅ Missing or mismatched ownership fails closed with 403
7. ✅ PaymentIntent status must be 'succeeded'
8. ✅ Stripe's `amount_received` must match requested amount
9. ✅ PaymentIntent creation stamps `userId` in metadata

**Original Attack Blocked**:
```
User A → User B's succeeded PaymentIntent → User A wallet ❌ BLOCKED
```

---

## What Was NOT Verified ⚠️

### Concurrent Double-Credit Race Condition

**File**: `app/api/client/wallet-add/route.ts`  
**Lines**: 189-212 (idempotency check)

**Current Implementation**:
```typescript
// Line 189: Idempotency check OUTSIDE transaction
const existingTransaction = await prisma.walletTransaction.findFirst({
  where: {
    walletId: wallet.id,
    status: 'CONFIRMED',
    type: 'CREDIT',
    metadata: {
      path: ['stripePaymentIntentId'],
      equals: paymentIntentId
    }
  }
});

if (existingTransaction) {
  // Already credited - return duplicate response
  return NextResponse.json({ success: true, duplicate: true, ... });
}

// Line 218: Transaction starts AFTER the check
const result = await prisma.$transaction(async (tx) => {
  const walletTx = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'CREDIT',
      amount: amount,
      status: 'CONFIRMED',
      metadata: {
        stripePaymentIntentId: paymentIntentId,
        // ...
      }
    }
  });
  return { walletTx };
});
```

**Race Condition**:
```
Time    Request A                              Request B
----    ---------                              ---------
T0      findFirst(pi_123) → NULL               
T1                                             findFirst(pi_123) → NULL
T2      $transaction { create(...) }           
T3                                             $transaction { create(...) }
T4      ✅ Credit +$100                         ✅ Credit +$100
        
Result: DOUBLE CREDIT ($200 total from one $100 payment)
```

**Root Cause**: 
- Check-then-act pattern (TOCTOU - Time Of Check, Time Of Use)
- No database-level uniqueness constraint on `stripePaymentIntentId` in JSON metadata
- No advisory lock to serialize concurrent requests for same PaymentIntent

---

## Test Analysis

### Kiro's Test Claim
"prevents duplicate credits from concurrent/repeated requests"

### Actual Test Implementation
**File**: `app/api/client/__tests__/wallet-ownership.test.ts`

**What the test does**:
```typescript
// Sequential calls, NOT concurrent
await POST(...)
await POST(...)
```

**What the test verifies**:
- Logic correctness (ownership checks)
- Sequential replay protection

**What the test DOES NOT verify**:
- ❌ Genuine concurrent requests (Promise.all)
- ❌ Database race conditions
- ❌ Real HTTP concurrency

---

## Impact Assessment

### Severity: **MEDIUM** (downgraded from CRITICAL)

**Why not CRITICAL**:
1. Requires legitimate PaymentIntent (attacker must pay)
2. Requires precise timing (narrow race window)
3. Attack cost = Payment amount (no free money, just double-credit)
4. Each attack attempt costs the attacker real money

**Why MEDIUM**:
1. Financial impact: Attacker gets 2x credit for 1x payment
2. Platform loss: Real financial loss (not just accounting error)
3. Reproducible: Attack can be repeated
4. No audit trail flags this as suspicious

### Attack Scenario

**Attacker**: Malicious user with programming knowledge

**Steps**:
1. Create PaymentIntent for $100, complete payment
2. Write script to call `/api/client/wallet-add` concurrently:
   ```javascript
   await Promise.all([
     fetch('/api/client/wallet-add', { body: { paymentIntentId: 'pi_123', amount: 100 }}),
     fetch('/api/client/wallet-add', { body: { paymentIntentId: 'pi_123', amount: 100 }})
   ]);
   ```
3. If race succeeds: Wallet credited $200 for $100 payment
4. Repeat with multiple PaymentIntents

**Expected Success Rate**: 
- Low (narrow race window)
- But non-zero with sufficient attempts
- Increases with server load

---

## Recommended Fixes

### Option 1: Database Unique Constraint (Preferred)

**Add unique index on stripePaymentIntentId**:

```sql
-- Migration
CREATE UNIQUE INDEX wallet_transaction_stripe_payment_intent_unique
ON "WalletTransaction" ((metadata->>'stripePaymentIntentId'))
WHERE metadata->>'stripePaymentIntentId' IS NOT NULL;
```

**Effect**: 
- Second concurrent insert will fail with unique constraint violation
- Handle gracefully and return duplicate response
- Database-level enforcement (foolproof)

### Option 2: Move Check Inside Transaction

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Check inside transaction with SELECT FOR UPDATE
  const existingTransaction = await tx.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      status: 'CONFIRMED',
      type: 'CREDIT',
      metadata: {
        path: ['stripePaymentIntentId'],
        equals: paymentIntentId
      }
    }
  });

  if (existingTransaction) {
    return { walletTx: existingTransaction, duplicate: true };
  }

  // Create only if not found
  const walletTx = await tx.walletTransaction.create({
    data: { /* ... */ }
  });
  
  return { walletTx, duplicate: false };
}, {
  isolationLevel: 'Serializable'  // Important!
});
```

**Effect**:
- Serializable isolation prevents phantom reads
- Both transactions see each other's changes
- One will succeed, other will see existing transaction

### Option 3: Advisory Lock (PostgreSQL-specific)

```typescript
await prisma.$transaction(async (tx) => {
  // Acquire lock for this PaymentIntent
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentIntentId}))`;
  
  // Now safe to check and create
  const existingTransaction = await tx.walletTransaction.findFirst({ /* ... */ });
  if (existingTransaction) return { /* duplicate */ };
  
  const walletTx = await tx.walletTransaction.create({ /* ... */ });
  return { walletTx };
});
```

**Effect**:
- Only one transaction at a time can process given PaymentIntent
- Other transactions wait for lock release
- First transaction wins, others see existing record

---

## Recommended Testing

### Test 1: Concurrent POST Requests

```typescript
test('prevents double-credit from concurrent requests', async () => {
  const paymentIntentId = 'pi_test_concurrent_123';
  
  // Mock Stripe to return same succeeded PaymentIntent
  mockStripe.paymentIntents.retrieve.mockResolvedValue({
    id: paymentIntentId,
    status: 'succeeded',
    amount_received: 10000,
    metadata: { userId: 'user-123', walletId: 'wallet-123' }
  });

  // Fire two concurrent requests
  const [response1, response2] = await Promise.all([
    POST(createRequest({ paymentIntentId, amount: 100 })),
    POST(createRequest({ paymentIntentId, amount: 100 }))
  ]);

  // One should succeed, one should return duplicate
  const results = [await response1.json(), await response2.json()];
  const successes = results.filter(r => r.success && !r.duplicate);
  const duplicates = results.filter(r => r.duplicate);

  expect(successes.length).toBe(1);
  expect(duplicates.length).toBe(1);

  // Verify only ONE wallet transaction created
  const transactions = await prisma.walletTransaction.findMany({
    where: { metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId }}
  });
  expect(transactions.length).toBe(1);
});
```

### Test 2: High-Concurrency Stress Test

```typescript
test('prevents double-credit under high concurrency (10 requests)', async () => {
  const paymentIntentId = 'pi_test_stress_456';
  
  // Fire 10 concurrent requests
  const requests = Array(10).fill(null).map(() => 
    POST(createRequest({ paymentIntentId, amount: 100 }))
  );
  
  const responses = await Promise.all(requests);
  const results = await Promise.all(responses.map(r => r.json()));
  
  // Exactly ONE should succeed (not duplicate)
  const successes = results.filter(r => r.success && !r.duplicate);
  expect(successes.length).toBe(1);
  
  // Verify database has exactly ONE transaction
  const count = await prisma.walletTransaction.count({
    where: { metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId }}
  });
  expect(count).toBe(1);
});
```

---

## Updated Verdict

### P0-01: Wallet PaymentIntent Ownership

**Ownership Security**: ✅ **SOURCE VERIFIED - CLOSED**  
- Original cross-user attack is blocked
- Fail-closed implementation is correct
- No bypass routes exist

**Replay Protection**: ⚠️ **CONCURRENT RACE IDENTIFIED - OPEN**  
- Sequential replay is handled
- Concurrent replay has race condition
- Requires fix + concurrent test verification

**Overall Status**: ⚠️ **PARTIAL CLOSE**

### Classification

| Issue | Status | Severity | Notes |
|-------|--------|----------|-------|
| P0-01A: Cross-user PaymentIntent theft | ✅ CLOSED | CRITICAL (was) | Fixed, verified |
| P0-01B: Concurrent double-credit race | ⚠️ OPEN | MEDIUM | Identified in review |

---

## Closure Criteria (Updated)

P0-01 can be fully closed when:

1. ✅ Ownership security verified (DONE)
2. ⚠️ Concurrent race condition fixed (PENDING)
3. ⚠️ Database constraint added OR transaction pattern fixed (PENDING)
4. ⚠️ Concurrent integration tests added and passing (PENDING)
5. ⚠️ Fix deployed to production (PENDING)

---

## Verification Methodology Validation

This finding validates the verification framework's core principle:

> **Kiro's report → inspect source → challenge the claim → execute/verify tests → close**

**Lesson Learned**:
- Source inspection alone is insufficient for concurrency issues
- Tests must actually test what they claim to test
- "90% confidence" is useful evidence, not closure criterion
- Independent verification caught what automated tools missed

---

## Recommended Next Steps

1. **Immediate**: Document P0-01B as new finding (MEDIUM severity)
2. **Short-term**: Implement Option 1 (database constraint) for bulletproof fix
3. **Testing**: Add concurrent integration tests before closing
4. **Audit**: Review other wallet routes for similar TOCTOU patterns
5. **Production**: Monitor for duplicate `stripePaymentIntentId` in wallet transactions

---

**Verified By**: Human Auditor (Independent Source Review)  
**Date**: 2026-09-11  
**Confidence**: HIGH (based on source inspection + race condition analysis)

---

**End of Addendum**

# P0-01B Fix Implementation Plan

**Finding**: Concurrent Wallet Credit Race Condition  
**Severity**: MEDIUM  
**Priority**: HIGH (financial vulnerability)  
**Target**: Production deployment

---

## Quick Summary

**Problem**: Two simultaneous requests can both credit wallet from same PaymentIntent

**Root Cause**: Check-then-act pattern (TOCTOU) with no database uniqueness constraint

**Solution**: Add database unique constraint + handle constraint violations gracefully

---

## Implementation Steps

### Step 1: Database Migration

Create a unique index on `stripePaymentIntentId` in the `WalletTransaction` metadata.

**File**: `prisma/migrations/YYYYMMDDHHMMSS_add_wallet_transaction_payment_intent_unique/migration.sql`

```sql
-- Add unique constraint on stripePaymentIntentId in metadata
-- This prevents duplicate wallet credits from the same PaymentIntent
-- Even if concurrent requests race through the application check

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS 
  wallet_transaction_stripe_payment_intent_unique
ON "WalletTransaction" ((metadata->>'stripePaymentIntentId'))
WHERE 
  metadata->>'stripePaymentIntentId' IS NOT NULL
  AND status = 'CONFIRMED'
  AND type = 'CREDIT';

-- Note: Using CONCURRENTLY to avoid locking the table during production deployment
-- Note: Partial index (WHERE clause) for performance - only indexes relevant rows
```

**Rationale**:
- `CONCURRENTLY`: Allows online index creation without blocking writes
- Partial index: Only indexes CONFIRMED CREDIT transactions with PaymentIntent
- JSON operator `->>'`: Extracts text value from JSONB metadata
- Database-level enforcement is foolproof (application bugs can't bypass it)

---

### Step 2: Update Application Code

Handle unique constraint violations gracefully in the wallet-add route.

**File**: `app/api/client/wallet-add/route.ts`

**Change**: Wrap transaction in try-catch and handle duplicate key error

```typescript
// Around line 218 - wrap the transaction
try {
  const result = await prisma.$transaction(async (tx) => {
    // Existing transaction code...
    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: amount,
        status: 'CONFIRMED',
        description: `Added ${amount.toFixed(2)} credits via ${paymentIntentId ? 'Stripe' : 'manual'}`,
        metadata: {
          stripePaymentIntentId: paymentIntentId,
          type: 'wallet_topup',
          verifiedAmount: true
        }
      }
    });

    return { walletTx };
  });

  // Continue with existing success logic...
  
} catch (error: any) {
  // P0-01B FIX: Handle concurrent race condition
  // If database constraint prevents duplicate, treat as idempotent
  if (error.code === 'P2002' && error.meta?.target?.includes('wallet_transaction_stripe_payment_intent_unique')) {
    console.warn(`[P0-01B] Concurrent duplicate detected for PaymentIntent ${paymentIntentId} - handled by DB constraint`);
    
    // Fetch the existing transaction that won the race
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

    if (!existingTransaction) {
      // Shouldn't happen, but fail safe
      throw new Error('Constraint violation but transaction not found');
    }

    const newBalance = await getWalletBalance(user.id);
    
    return NextResponse.json({
      success: true,
      duplicate: true,
      message: 'This payment has already been processed',
      wallet: {
        balance: newBalance.balance,
        totalPaid: newBalance.totalPaid,
        creditsRemaining: newBalance.balance
      },
      transaction: {
        id: existingTransaction.id,
        amount: existingTransaction.amount,
        createdAt: existingTransaction.createdAt
      }
    });
  }
  
  // Re-throw other errors
  throw error;
}
```

**Key Points**:
- Prisma error code `P2002` = unique constraint violation
- Check `error.meta.target` to confirm it's our specific constraint
- Return idempotent response (same as application-level duplicate check)
- Log the event for monitoring

---

### Step 3: Prisma Schema Update (Optional Documentation)

Update the schema to document the constraint (Prisma doesn't support unique on JSON fields directly, so this is for documentation only).

**File**: `prisma/schema.prisma`

Add comment to `WalletTransaction` model:

```prisma
model WalletTransaction {
  // ... existing fields ...
  
  // Metadata stores PaymentIntent ID for idempotency
  // Database has unique constraint: wallet_transaction_stripe_payment_intent_unique
  // Prevents duplicate credits from concurrent requests (P0-01B fix)
  metadata Json?
  
  // ... rest of model ...
}
```

---

### Step 4: Add Concurrent Integration Tests

Create new test file for concurrent scenarios.

**File**: `app/api/client/__tests__/wallet-concurrent.test.ts`

```typescript
/**
 * Integration tests for P0-01B: Concurrent wallet credit protection
 * 
 * These tests verify that concurrent requests using the same PaymentIntent
 * result in only ONE wallet credit, not multiple.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../wallet-add/route';
import { prisma } from '@/lib/prisma';

describe('P0-01B: Concurrent wallet credit protection', () => {
  
  beforeEach(async () => {
    // Clean up test data
    await prisma.walletTransaction.deleteMany({
      where: { metadata: { path: ['type'], equals: 'wallet_topup' } }
    });
  });

  it('prevents double-credit from 2 concurrent requests', async () => {
    const paymentIntentId = 'pi_concurrent_test_001';
    const userId = 'test-user-123';
    
    // Mock authenticated session
    const session = createMockSession(userId);
    
    // Mock Stripe PaymentIntent
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: paymentIntentId,
      status: 'succeeded',
      amount_received: 10000,
      metadata: { userId, walletId: 'wallet-123' }
    });

    // Fire 2 concurrent requests with same PaymentIntent
    const [response1, response2] = await Promise.all([
      POST(createRequest({ paymentIntentId, amount: 100 }, session)),
      POST(createRequest({ paymentIntentId, amount: 100 }, session))
    ]);

    const result1 = await response1.json();
    const result2 = await response2.json();

    // Both should return success
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // One should be original, one should be duplicate
    const successes = [result1, result2].filter(r => !r.duplicate);
    const duplicates = [result1, result2].filter(r => r.duplicate);

    expect(successes.length).toBe(1);
    expect(duplicates.length).toBe(1);

    // Verify only ONE database record
    const transactions = await prisma.walletTransaction.count({
      where: {
        metadata: {
          path: ['stripePaymentIntentId'],
          equals: paymentIntentId
        },
        status: 'CONFIRMED',
        type: 'CREDIT'
      }
    });

    expect(transactions).toBe(1);

    // Verify wallet balance is correct (1x credit, not 2x)
    const balance = await getWalletBalance(userId);
    expect(balance.balance).toBe(100); // Not 200!
  });

  it('prevents double-credit from 10 concurrent requests (stress test)', async () => {
    const paymentIntentId = 'pi_stress_test_002';
    const userId = 'test-user-456';

    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: paymentIntentId,
      status: 'succeeded',
      amount_received: 10000,
      metadata: { userId, walletId: 'wallet-456' }
    });

    // Fire 10 simultaneous requests
    const requests = Array(10).fill(null).map(() =>
      POST(createRequest({ paymentIntentId, amount: 100 }, createMockSession(userId)))
    );

    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.json()));

    // All should succeed
    expect(results.every(r => r.success)).toBe(true);

    // Exactly ONE should not be duplicate
    const successes = results.filter(r => !r.duplicate);
    expect(successes.length).toBe(1);

    // Database should have exactly ONE record
    const count = await prisma.walletTransaction.count({
      where: {
        metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId }
      }
    });

    expect(count).toBe(1);
  });

  it('allows separate PaymentIntents to credit separately', async () => {
    const userId = 'test-user-789';

    // Two different PaymentIntents, both valid
    mockStripe.paymentIntents.retrieve
      .mockResolvedValueOnce({
        id: 'pi_003',
        status: 'succeeded',
        amount_received: 10000,
        metadata: { userId, walletId: 'wallet-789' }
      })
      .mockResolvedValueOnce({
        id: 'pi_004',
        status: 'succeeded',
        amount_received: 10000,
        metadata: { userId, walletId: 'wallet-789' }
      });

    // Fire concurrent requests with DIFFERENT PaymentIntents
    const [response1, response2] = await Promise.all([
      POST(createRequest({ paymentIntentId: 'pi_003', amount: 100 }, createMockSession(userId))),
      POST(createRequest({ paymentIntentId: 'pi_004', amount: 100 }, createMockSession(userId)))
    ]);

    const result1 = await response1.json();
    const result2 = await response2.json();

    // Both should succeed (not duplicates)
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.duplicate).toBeUndefined();
    expect(result2.duplicate).toBeUndefined();

    // Should have TWO database records
    const count = await prisma.walletTransaction.count({
      where: {
        metadata: {
          path: ['type'],
          equals: 'wallet_topup'
        },
        status: 'CONFIRMED'
      }
    });

    expect(count).toBe(2);

    // Wallet balance should be $200
    const balance = await getWalletBalance(userId);
    expect(balance.balance).toBe(200);
  });
});
```

---

### Step 5: Deployment Checklist

#### Pre-Deployment

- [ ] Review code changes
- [ ] Run local tests (including new concurrent tests)
- [ ] Verify TypeScript compiles
- [ ] Check Prisma migration is valid
- [ ] Test migration on staging database
- [ ] Monitor staging for 24 hours

#### Deployment

- [ ] Deploy database migration first (CREATE INDEX CONCURRENTLY)
- [ ] Wait for index creation to complete (may take minutes on large tables)
- [ ] Verify index exists: `\d+ "WalletTransaction"` in psql
- [ ] Deploy application code
- [ ] Monitor logs for constraint violations
- [ ] Monitor Sentry/error tracking for P2002 errors

#### Post-Deployment

- [ ] Run concurrent test in production (staging first)
- [ ] Monitor wallet transaction creation rate
- [ ] Check for any failed requests
- [ ] Review audit logs for anomalies
- [ ] Update security tracker: P0-01B → CLOSED

---

### Step 6: Rollback Plan

If issues arise:

**Immediate Rollback** (Application Only):
```bash
git revert <commit-hash>
git push origin main
```

**Full Rollback** (Including Database):
```sql
-- Drop the constraint if causing issues
DROP INDEX CONCURRENTLY wallet_transaction_stripe_payment_intent_unique;
```

**Monitoring**:
- Check error rates before/after deployment
- Monitor duplicate transaction attempts
- Track PaymentIntent IDs that hit constraint

---

## Testing Strategy

### Unit Tests ✅ (Already exist)
- Logic verification (ownership checks)

### Integration Tests ⏳ (Need to add)
- Concurrent request simulation
- Database constraint verification
- Error handling verification

### Manual Tests ⏳ (Before production)
1. Create PaymentIntent in Stripe
2. Fire concurrent curl requests to wallet-add
3. Verify only one credit occurs
4. Check both requests return success
5. Verify one response has `duplicate: true`

---

## Monitoring & Alerts

### Metrics to Track

1. **Constraint Violations**
   - Counter: `wallet_add_concurrent_duplicate_detected`
   - Alert if rate > 1 per minute

2. **PaymentIntent Reuse Attempts**
   - Log every constraint hit
   - Review for suspicious patterns

3. **Wallet Balance Discrepancies**
   - Compare ledger balance to wallet transaction sum
   - Alert on mismatch

### Log Search Queries

```
# Find constraint violations
message:"P0-01B Concurrent duplicate detected"

# Find Prisma P2002 errors
error.code:"P2002" AND target:"wallet_transaction_stripe_payment_intent_unique"

# Find suspicious rapid requests
path:"/api/client/wallet-add" | stats count by session.user.id
```

---

## Success Criteria

P0-01B can be marked ✔️ CLOSED when:

1. ✅ Database constraint deployed to production
2. ✅ Application code handles constraint gracefully
3. ✅ Concurrent integration tests pass
4. ✅ Manual concurrent test succeeds
5. ✅ Deployed for 7 days with no issues
6. ✅ No false positive constraint violations

---

## Timeline Estimate

- **Step 1** (Migration): 1 hour dev + 30 min review
- **Step 2** (App code): 2 hours dev + 1 hour review  
- **Step 3** (Schema doc): 15 minutes
- **Step 4** (Tests): 3 hours dev + 1 hour review
- **Step 5** (Deployment): 2 hours (staged)
- **Step 6** (Monitoring): 7 days observation

**Total**: ~2 days dev + 1 week monitoring

---

## Risk Assessment

**Risk**: MEDIUM  
**Impact if unfixed**: Financial loss from double-credits  
**Impact if fix fails**: Legitimate payments might be rejected  
**Mitigation**: Staging testing + gradual rollout + monitoring

---

**Implementation Owner**: TBD  
**Reviewer**: Security Team  
**Target Date**: TBD

---

**End of Implementation Plan**

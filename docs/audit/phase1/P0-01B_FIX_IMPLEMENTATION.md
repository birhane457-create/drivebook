# P0-01B Fix Implementation: Concurrent Double-Credit Prevention

**Date**: 2026-09-11  
**Finding**: P0-01B - Concurrent race condition in wallet credit endpoint  
**Severity**: MEDIUM (financial impact)

---

## Problem Statement

The wallet credit endpoint (`/api/client/wallet-add/route.ts`) has a TOCTOU (Time-Of-Check-Time-Of-Use) race condition:

```typescript
// Line 189: Check OUTSIDE transaction
const existingTransaction = await prisma.walletTransaction.findFirst({
  where: { metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId } }
});

if (existingTransaction) {
  return NextResponse.json({ error: 'Payment already processed' }, { status: 409 });
}

// Line 218: Create INSIDE transaction - RACE WINDOW HERE
await prisma.$transaction(async (tx) => {
  await tx.walletTransaction.create({
    data: {
      walletId,
      amount,
      type: 'CREDIT',
      status: 'COMPLETED',
      metadata: { stripePaymentIntentId: paymentIntentId, ... }
    }
  });
});
```

**Attack Scenario**:
- Two genuinely concurrent requests arrive with same `paymentIntentId`
- Both pass the `findFirst` check (no transaction exists yet)
- Both create wallet transactions
- Result: Same PaymentIntent credits wallet twice

**Impact**: Direct financial loss (double credits for single payment)

---

## Solution: Database Unique Constraint

### Approach

Add a **unique index** on `metadata->>'stripePaymentIntentId'` at the database level.

**Why this works**:
- Database enforces uniqueness atomically
- No application-level race condition possible
- Second concurrent insert will fail with unique violation
- Fail-safe: even if application code changes, DB constraint holds

**Alternatives considered**:
1. ❌ Move check inside transaction - still has small race window
2. ❌ PostgreSQL advisory locks - adds complexity, requires cleanup
3. ✅ Database unique constraint - foolproof, simple, permanent

### Implementation

#### Migration SQL

File: `prisma/migrations/20260911000000_add_wallet_transaction_payment_intent_unique/migration.sql`

```sql
-- P0-01B: Add unique constraint on stripePaymentIntentId to prevent concurrent double-credit
-- This blocks two simultaneous requests from crediting the same PaymentIntent twice

-- Create unique index on the JSON field metadata->>'stripePaymentIntentId'
-- This provides database-level enforcement (foolproof vs application-level check)
CREATE UNIQUE INDEX "WalletTransaction_stripePaymentIntentId_unique" 
ON "WalletTransaction" ((metadata->>'stripePaymentIntentId'))
WHERE (metadata->>'stripePaymentIntentId') IS NOT NULL;

-- Note: The WHERE clause ensures we only index non-null payment intents
-- This allows other wallet transactions (manual credits, deducts) without stripePaymentIntentId
```

#### Prisma Schema Comment

File: `prisma/schema.prisma` (lines 369-385)

```prisma
model WalletTransaction {
  id          String       @id @default(cuid())
  walletId    String
  amount      Decimal      @db.Decimal(12, 2)
  type        String
  description String?
  status      String       @default("PENDING")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  metadata    Json?
  bookingId   String?
  wallet      ClientWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
}

// NOTE: WalletTransaction has a unique index on metadata->>'stripePaymentIntentId'
// See migration: 20260911000000_add_wallet_transaction_payment_intent_unique
// This prevents P0-01B concurrent double-credit attacks
```

**Note**: Prisma doesn't support expression indexes in schema syntax, so we document it with a comment.

---

## Application Code Changes

### Error Handling in wallet-add Route

The application needs to handle the unique violation gracefully:

**File**: `app/api/client/wallet-add/route.ts`

**Current behavior** (line 189-193):
```typescript
const existingTransaction = await prisma.walletTransaction.findFirst({...});
if (existingTransaction) {
  return NextResponse.json({ error: 'Payment already processed' }, { status: 409 });
}
```

**After migration** (no code change needed):
- First request: Creates transaction successfully
- Concurrent request: Database throws unique violation error
- Prisma propagates as `PrismaClientKnownRequestError` (code `P2002`)

**Recommended enhancement** (optional):
```typescript
try {
  await prisma.$transaction(async (tx) => {
    await tx.walletTransaction.create({...});
    // ... rest of transaction
  });
} catch (error) {
  if (error.code === 'P2002' && error.meta?.target?.includes('stripePaymentIntentId')) {
    // Concurrent request detected - payment already processed
    return NextResponse.json({ 
      error: 'Payment already processed',
      code: 'PAYMENT_ALREADY_CREDITED'
    }, { status: 409 });
  }
  throw error;
}
```

---

## Testing Requirements

### Test 1: Genuine Concurrent Requests

**File**: `__tests__/integration/wallet-concurrent-credit.test.mjs`

```javascript
// Test: Two simultaneous requests with same paymentIntentId
// Expected: One succeeds (200), one fails (409)

const paymentIntentId = 'pi_test_concurrent_' + Date.now();

const [result1, result2] = await Promise.all([
  POST('/api/client/wallet-add', { paymentIntentId }),
  POST('/api/client/wallet-add', { paymentIntentId })
]);

// One must succeed, one must fail
const responses = [result1, result2].sort((a, b) => a.status - b.status);
expect(responses[0].status).toBe(200);  // Success
expect(responses[1].status).toBe(409);  // Conflict
```

### Test 2: Database Constraint Verification

```sql
-- Verify index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'WalletTransaction' 
AND indexname = 'WalletTransaction_stripePaymentIntentId_unique';

-- Verify uniqueness enforcement
BEGIN;
INSERT INTO "WalletTransaction" (id, "walletId", amount, type, status, metadata, "createdAt", "updatedAt")
VALUES ('test1', 'wallet1', 100, 'CREDIT', 'COMPLETED', '{"stripePaymentIntentId":"pi_duplicate"}', NOW(), NOW());

-- This should fail with unique violation
INSERT INTO "WalletTransaction" (id, "walletId", amount, type, status, metadata, "createdAt", "updatedAt")
VALUES ('test2', 'wallet1', 100, 'CREDIT', 'COMPLETED', '{"stripePaymentIntentId":"pi_duplicate"}', NOW(), NOW());
ROLLBACK;
```

### Test 3: Existing Test Update

**File**: `__tests__/security/p0-01-wallet-bypass.test.mjs` (line ~130)

**Current test** (INCORRECT - sequential):
```javascript
test('prevents duplicate credits from concurrent/repeated requests', async () => {
  const res1 = await request.post('/api/client/wallet-add').send({...});
  const res2 = await request.post('/api/client/wallet-add').send({...});  // Sequential!
  expect(res2.status).toBe(409);
});
```

**Fixed test** (CORRECT - concurrent):
```javascript
test('prevents duplicate credits from genuinely concurrent requests', async () => {
  const paymentIntentId = 'pi_test_concurrent_' + Date.now();
  
  // Use Promise.all for true concurrency
  const [res1, res2] = await Promise.all([
    request.post('/api/client/wallet-add').send({ paymentIntentId, ... }),
    request.post('/api/client/wallet-add').send({ paymentIntentId, ... })
  ]);
  
  // One succeeds, one fails
  const statuses = [res1.status, res2.status].sort();
  expect(statuses).toEqual([200, 409]);
});
```

---

## Deployment Steps

### 1. Run Migration

```bash
cd "e:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook"
npx prisma migrate deploy
```

**Expected output**:
```
Applying migration `20260911000000_add_wallet_transaction_payment_intent_unique`
Database schema is up to date!
```

### 2. Verify Index Created

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'WalletTransaction' 
AND indexname = 'WalletTransaction_stripePaymentIntentId_unique';
```

**Expected result**:
```
indexname                                      | indexdef
-----------------------------------------------|--------------------------------------------------
WalletTransaction_stripePaymentIntentId_unique | CREATE UNIQUE INDEX ... ON "WalletTransaction" ...
```

### 3. Run Integration Tests

```bash
npm test -- wallet-concurrent-credit.test.mjs
npm test -- p0-01-wallet-bypass.test.mjs
```

### 4. Monitor Production

After deployment, monitor for:
- `P2002` errors in logs (indicates concurrent attempts blocked)
- Wallet transaction creation success rate
- User reports of "payment already processed" errors

**Expected behavior**:
- Occasional `P2002` errors are GOOD (blocking actual concurrent attacks)
- Users should not see errors (retries should work)

---

## Rollback Plan

If the migration causes issues:

### Option 1: Drop Index

```sql
DROP INDEX "WalletTransaction_stripePaymentIntentId_unique";
```

### Option 2: Prisma Migrate Rollback

```bash
# Create rollback migration
npx prisma migrate dev --name rollback_payment_intent_unique --create-only

# Edit the generated migration file:
DROP INDEX IF EXISTS "WalletTransaction_stripePaymentIntentId_unique";

# Apply rollback
npx prisma migrate deploy
```

---

## Success Criteria

- ✅ Migration applies successfully to production database
- ✅ Unique index is created and queryable
- ✅ Genuine concurrent requests are blocked (one succeeds, one fails)
- ✅ Existing wallet credit flow works normally
- ✅ No performance degradation (index adds <1ms to lookups)
- ✅ Integration tests pass
- ✅ P0-01B can be marked CLOSED

---

## References

- **P0-01 Verification**: `docs/P0-01_VERIFICATION.md`
- **P0-01A Fix**: Cross-user ownership bypass (FIXED)
- **P0-01B Addendum**: `docs/P0-01_VERIFICATION_ADDENDUM.md`
- **PostgreSQL JSON Indexing**: https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING
- **Prisma Error Codes**: https://www.prisma.io/docs/reference/api-reference/error-reference#p2002

---

**Status**: ✅ IMPLEMENTED (awaiting deployment)  
**Next**: Write concurrent integration test (Task #2)

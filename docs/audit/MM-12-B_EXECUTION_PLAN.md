# MM-12-B: Hostile Attack/Race Verification — Execution Plan

**Status:** Ready for execution  
**Prerequisites:** MM-12-A complete (commit 565c1a54)  
**Database:** Isolated PostgreSQL (localhost:5433/drivebook_test)

---

## Critical Notes

### Why This Is Different From INT-M-03A Tests

The MM-12-B tests have a **fundamental challenge** that INT-M-03A didn't face:

**INT-M-03A:** Tested a standalone migration script  
- Script runs independently
- No authentication required
- Easy to execute in isolated environment

**MM-12:** Tests HTTP route handlers  
- Routes require NextAuth session
- Session validation happens at getServerSession()
- Cannot easily mock sessions in integration tests

###  Three Approaches for MM-12-B

#### Approach 1: Service-Layer Tests (RECOMMENDED)
Extract the core wallet logic into testable service functions, test those directly.

**Pros:**
- No HTTP/session mocking needed
- Fast execution
- Clear demonstration of race conditions
- Tests the actual financial logic

**Cons:**
- Requires small refactor to extract service layer
- Doesn't test the full HTTP request path

#### Approach 2: HTTP Integration Tests with Test Auth
Create a test-only auth bypass for integration testing.

**Pros:**
- Tests complete HTTP path
- Realistic request simulation

**Cons:**
- Requires test-specific auth mechanism
- Security risk if accidentally deployed
- More complex setup

#### Approach 3: Manual cURL Testing
Use actual admin credentials and cURL to demonstrate vulnerabilities.

**Pros:**
- No code changes needed
- Tests production code exactly

**Cons:**
- Not automated
- Requires production-like environment
- Harder to demonstrate concurrent races

---

## Recommended: Service-Layer Approach

### Step 1: Extract Wallet Service Functions

Create `lib/services/admin-wallet-service.ts`:

```typescript
/**
 * Admin wallet service — testable core logic without HTTP concerns
 */

export async function adminAddCredit(params: {
  userId: string;
  amount: number;
  reason: string;
  staffMemberId: string;
  idempotencyKey?: string; // Future: for fix implementation
}): Promise<{
  transactionId: string;
  previousBalance: number;
  newBalance: number;
}> {
  const { userId, amount, reason, staffMemberId, idempotencyKey } = params;

  // Get or create wallet
  const wallet = await getOrCreateWallet(userId);
  
  // Read balance before
  const balanceBefore = await getWalletBalance(userId);
  
  // VULNERABLE: No idempotency check here
  
  // Create transaction
  const walletTx = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'CREDIT',
      amount,
      status: 'CONFIRMED',
      description: reason,
      metadata: {
        staffMemberId,
        idempotencyKey, // Currently unused, but will be checked post-fix
      },
    },
  });
  
  // Read balance after
  const newBalance = await getWalletBalance(userId);
  
  return {
    transactionId: walletTx.id,
    previousBalance: balanceBefore.balance,
    newBalance: newBalance.balance,
  };
}

export async function adminDeductCredit(params: {
  userId: string;
  amount: number;
  reason: string;
  staffMemberId: string;
  idempotencyKey?: string;
}): Promise<{
  transactionId: string;
  previousBalance: number;
  newBalance: number;
}> {
  const { userId, amount, reason, staffMemberId, idempotencyKey } = params;

  const wallet = await getOrCreateWallet(userId);
  const balanceBefore = await getWalletBalance(userId);

  // VULNERABLE: Balance check not atomic with transaction create
  if (balanceBefore.balance < amount) {
    throw new Error(`Insufficient balance: available ${balanceBefore.balance}, requested ${amount}`);
  }

  // VULNERABLE: No idempotency check

  const walletTx = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount,
      type: 'DEBIT',
      status: 'CONFIRMED',
      description: reason,
      metadata: {
        staffMemberId,
        idempotencyKey,
      },
    },
  });

  const newBalance = await getWalletBalance(userId);

  return {
    transactionId: walletTx.id,
    previousBalance: balanceBefore.balance,
    newBalance: newBalance.balance,
  };
}
```

### Step 2: Update Route Handlers to Use Service

Refactor `app/api/admin/clients/[id]/wallet/add-credit/route.ts`:

```typescript
import { adminAddCredit } from '@/lib/services/admin-wallet-service';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const check = await checkPermission(session, PERM.FINANCE_CREDITS_MANAGE);
    if (!check.allowed) return check.response;

    const { amount, reason } = await req.json();
    
    // ... validation ...

    const result = await adminAddCredit({
      userId,
      amount,
      reason,
      staffMemberId: session!.user!.id,
      idempotencyKey: req.headers.get('Idempotency-Key') || undefined,
    });

    // ... audit log, receipt email ...

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: result.newBalance,
      },
    });
  } catch (error) {
    // ... error handling ...
  }
}
```

### Step 3: Write Service-Layer Tests

Now the MM-12-B tests can call the service functions directly:

```typescript
it('B1: Sequential duplicate credit → both create ledger entries', async () => {
  const userId = testUser.id;
  const staffId = testAdmin.id;

  // First credit
  const result1 = await adminAddCredit({
    userId,
    amount: 50,
    reason: 'Test Credit',
    staffMemberId: staffId,
  });

  // Second identical credit (should be idempotent, but isn't)
  const result2 = await adminAddCredit({
    userId,
    amount: 50,
    reason: 'Test Credit',
    staffMemberId: staffId,
  });

  const balance = await getWalletBalance(userId);

  // VULNERABLE BASELINE
  expect(balance.balance).toBe(100); // Should be 50
});
```

### Step 4: Concurrent Race Tests

```typescript
it('B7: Two $50 debits against $60 balance → negative balance (TOCTOU)', async () => {
  const userId = testUser.id;
  const staffId = testAdmin.id;

  // Setup: Credit $60
  await adminAddCredit({
    userId,
    amount: 60,
    reason: 'Setup',
    staffMemberId: staffId,
  });

  // Launch two $50 debits concurrently
  const [result1, result2] = await Promise.allSettled([
    adminDeductCredit({
      userId,
      amount: 50,
      reason: 'Debit A',
      staffMemberId: staffId,
    }),
    adminDeductCredit({
      userId,
      amount: 50,
      reason: 'Debit B',
      staffMemberId: staffId,
    }),
  ]);

  const balance = await getWalletBalance(userId);

  console.log(`Final balance: $${balance.balance}`);
  console.log(`Debit A: ${result1.status}`);
  console.log(`Debit B: ${result2.status}`);

  // VULNERABLE: Both might succeed → negative balance
  // FIXED: One succeeds, one fails → balance $10
});
```

---

## Test Execution Commands

### Prerequisites
```bash
# Start Docker PostgreSQL
docker run --name drivebook-test-db -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=drivebook_test -p 5433:5432 -d postgres:15

# Sync schema
DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test npx prisma db push --skip-generate
```

### Run Tests
```bash
DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test npm run test:integration -- mm-12b
```

---

## Expected Baseline Results (BEFORE FIX)

| Test | Expected Result | Demonstrates |
|---|---|---|
| B1 | Balance $100 (should be $50) | Sequential duplicate creates 2 transactions |
| B2 | 2 audit entries | Both operations logged |
| B3 | Balance $70 | Different amounts both succeed (legitimate) |
| B4 | Balance $150 (should be $75) | Concurrent duplicate creates 2 transactions |
| B5 | Balance $120 (should be $60) | Delay doesn't prevent race |
| B6 | Balance $60 (should be $20) | Three concurrent all succeed |
| B7 | Balance < $0 OR one 400 error | TOCTOU race or timing-dependent failure |
| B8 | Second debit fails (400) | Sequential respects balance check |
| B9 | Success count 2 or 3 | Race window varies |
| B10 | Balance $200 (should be $100) | Retry creates duplicate |
| B11 | No idempotency mechanism found | Confirms vulnerability root cause |
| B13 | Balance $125 | Two distinct adjustments succeed (correct) |

---

## Success Criteria for MM-12-B

✅ **MM-12-B is complete when:**
1. Service layer extracted (admin-wallet-service.ts)
2. Route handlers refactored to use service
3. All 14 tests written and execute against isolated database
4. Test output demonstrates vulnerable baseline
5. Execution evidence captured (test output + commit SHA)
6. Evidence document created showing actual test results

❌ **Do NOT proceed to MM-12-C until:**
- All tests execute successfully
- Baseline vulnerabilities are demonstrable
- Test output is captured in evidence file

---

## Alternative: Manual cURL Testing (If Service Refactor Not Acceptable)

If extracting the service layer is not acceptable for the audit timeline, document manual testing:

```bash
# Sequential duplicate
curl -X POST http://localhost:3000/api/admin/clients/USER_ID/wallet/add-credit \
  -H "Cookie: next-auth.session-token=ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "reason": "Test"}'

# Run twice, check database for duplicate transactions
```

**Drawback:** Cannot easily demonstrate concurrent races without test harness.

---

**Recommendation:** Proceed with service-layer approach (Step 1-4) for complete, automated, repeatable evidence.

**Next Artifact:** Service extraction + test execution evidence

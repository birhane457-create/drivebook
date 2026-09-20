# P0-01 Test Remediation Plan

**Finding:** P0-01 Wallet Ownership Bypass  
**Status:** SOURCE VERIFIED (commit 28e75f73)  
**Next Gate:** TEST VERIFIED → CLOSED  
**Date:** 2026-09-15

---

## Independent Verification Findings

### ✅ Source Verification (PASSED)

**Reviewer:** User (independent)  
**Commit:** 28e75f73  
**Date:** 2026-09-15

**Verified:**
- Core ownership control correctly placed after Stripe PaymentIntent retrieval and before wallet transaction creation
- Route requires: `metadata.userId` exists AND equals `session.user.id`
- Belt-and-braces check: If `metadata.walletId` exists, must equal authenticated user's wallet
- Mismatch/missing metadata returns 403 (fail-closed design)
- Vercel deployment: SUCCESS

**Conclusion:** Principal P0-01 cross-user wallet-credit vulnerability is addressed in source code.

---

## ⚠️ Test Evidence Gaps (BLOCKING CLOSURE)

### Gap 1: Test File Internal Inconsistency

**File:** `app/api/client/wallet-add/__tests__/p0-01-ownership.test.ts`

**Issue:**
Test labeled "Nonexistent wallet" actually tests **successful** automatic wallet creation:

```typescript
it('creates wallet if user exists but wallet missing', async () => {
  // ... test setup ...
  expect(response.status).toBe(200); // SUCCESS, not rejection
});
```

**Impact:** Test summary claims "8 negative-path scenarios" but this test validates a **positive path** (auto-creation). The test suite misrepresents its coverage.

**Required Fix:**
1. Relabel test as positive-path validation: `"Auto-creates missing wallet for authenticated user"`
2. Add actual negative-path test: Attempt to credit nonexistent *other user's* wallet → should fail
3. Update test suite summary to accurately reflect negative vs. positive test counts

---

### Gap 2: Destructive Global Database Operations

**File:** `app/api/client/wallet-add/__tests__/p0-01-ownership.test.ts`  
**Lines:** beforeAll hook

**Issue:**
```typescript
beforeAll(async () => {
  await prisma.walletTransaction.deleteMany({});
  await prisma.clientWallet.deleteMany({});
});
```

**Impact:** 
- Global destructive operation with NO record-scoped cleanup
- Unsafe for shared/staging databases
- Cannot run in parallel with other tests
- Risk of data loss if pointed at wrong database

**Required Fix:**
1. **Immediate:** Add database environment validation
   ```typescript
   if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL?.includes('test')) {
     throw new Error('FATAL: Test database not configured');
   }
   ```

2. **Production-ready:** Replace global deleteMany with test-scoped cleanup:
   ```typescript
   const testUserIds = []; // Track created test users
   afterEach(async () => {
     await prisma.walletTransaction.deleteMany({
       where: { wallet: { userId: { in: testUserIds } } }
     });
     await prisma.clientWallet.deleteMany({
       where: { userId: { in: testUserIds } }
     });
   });
   ```

3. **Best practice:** Use database transactions with rollback:
   ```typescript
   let tx;
   beforeEach(async () => {
     tx = await prisma.$begin();
   });
   afterEach(async () => {
     await tx.$rollback();
   });
   ```

---

### Gap 3: Metadata Stamping VERIFIED ✅

**Status:** VERIFIED via source inspection

**Files Verified:**
1. `app/api/payments/create-intent/route.ts` (lines 113-156): **✅ userId stamped correctly**
   ```typescript
   // handleWalletPaymentIntent function:
   const paymentIntent = await stripeService.createPaymentIntent({
     amount: paymentAmount,
     transactionId: transaction.id,
     walletId: transaction.walletId,
     userId,          // ✅ VERIFIED: P0-01 owner stamp
     customerEmail,
     description: transaction.description || 'Package purchase',
   });
   ```

2. `lib/services/stripe.ts` (lines 69-91): **✅ metadata.userId stamped in PaymentIntent**
   ```typescript
   // Wallet/package purchase path:
   } else if (transactionId || walletId) {
     if (transactionId) metadata.transactionId = transactionId;
     if (walletId) metadata.walletId = walletId;
     if (userId) metadata.userId = userId;  // ✅ VERIFIED
     metadata.type = 'wallet_purchase';
   }
   ```

**Conclusion:**
Wallet top-up PaymentIntents correctly stamp `metadata.userId` during creation. The fail-closed control in wallet-add route will NOT reject legitimate payments.

**Test Required:**
End-to-end test: User creates payment intent → completes payment → calls wallet-add → SUCCESS (not 403)

**Staging Verification Command:**
```sql
-- After legitimate wallet top-up, verify PaymentIntent has metadata:
SELECT 
  pi.id,
  pi.metadata->>'userId' as stamped_user_id,
  pi.metadata->>'walletId' as stamped_wallet_id,
  s.user_id as session_user_id
FROM stripe_payment_intents pi
JOIN sessions s ON pi.customer = s.stripe_customer_id
WHERE pi.status = 'succeeded'
  AND pi.created_at > NOW() - INTERVAL '1 hour'
ORDER BY pi.created_at DESC
LIMIT 10;
```

Expected: `stamped_user_id` matches `session_user_id` for all legitimate top-ups.

---

### Gap 4: Bypass Route Verification - **CRITICAL P0-01 BYPASS FOUND** 🚨

**Status:** ⚠️ BYPASS IDENTIFIED - P0-01 FIX INCOMPLETE

**Bypass Route Found:**
`app/api/stripe/webhook/route.ts` (lines 518-535) - **checkout.session.completed** handler

**Vulnerability:**
The webhook handler credits wallets based on Stripe Checkout Session metadata WITHOUT verifying that the authenticated user matches the session creator:

```typescript
// app/api/stripe/webhook/route.ts ~line 518
await tx.walletTransaction.create({
  data: {
    walletId: wallet.id,
    type: 'CREDIT',
    amount: amountPaid,
    description: `Package purchase – ${hours ?? '?'} hours via Stripe Checkout`,
    status: 'CONFIRMED',
    metadata: {
      stripePaymentIntentId: payment_intent,  // ⚠️ NO OWNERSHIP CHECK
      // ...
    },
  },
});
```

**Attack Scenario:**
1. Attacker creates Stripe Checkout Session via legitimate UI flow
2. Attacker manipulates session metadata to include victim's `userId`
3. Attacker completes payment
4. Webhook credits VICTIM's wallet (not attacker's)
5. Attacker can also credit their own wallet with victim's payment

**Root Cause:**
Webhook trusts `checkoutSession.metadata.userId` without verification. The fix applied to `/api/client/wallet-add` does NOT protect this alternate credit path.

**Required Fix (HIGH PRIORITY):**
```typescript
// In checkout.session.completed handler, BEFORE wallet credit:

// Retrieve the actual PaymentIntent to get verified metadata
const paymentIntent = await stripe.paymentIntents.retrieve(
  typeof payment_intent === 'string' ? payment_intent : payment_intent.id
);

// CRITICAL: Verify metadata.userId matches the wallet being credited
if (!paymentIntent.metadata?.userId) {
  logger.error('P0-01-BYPASS: Missing userId in PaymentIntent metadata', {
    paymentIntentId: paymentIntent.id,
    checkoutSessionId: checkoutSession.id,
  });
  throw new Error('Missing userId metadata - wallet credit blocked');
}

if (paymentIntent.metadata.userId !== userId) {
  logger.error('P0-01-BYPASS: userId mismatch in checkout webhook', {
    paymentIntentMetadataUserId: paymentIntent.metadata.userId,
    checkoutSessionUserId: userId,
    paymentIntentId: paymentIntent.id,
  });
  throw new Error('Ownership verification failed - wallet credit blocked');
}

// Only AFTER verification:
await tx.walletTransaction.create({ /* ... */ });
```

**Additional Routes Requiring Review:**

1. **`app/api/payments/verify/route.ts`** (lines 216-252)
   - Two wallet credit paths after PaymentIntent verification
   - **STATUS:** Needs ownership review (session-based, may be safe)

2. **`app/api/admin/clients/[id]/wallet/add-credit/route.ts`** (line 74)
   - Admin manual wallet credit
   - **STATUS:** Requires ADMIN role check (separate audit area)

3. **Refund paths** (various files)
   - Wallet credits from booking cancellations/refunds
   - **STATUS:** Different threat model (refunding existing transactions, not creating new value)

**Impact on P0-01 Closure:**
❌ **BLOCKING** - P0-01 CANNOT be marked CLOSED until:
1. Webhook bypass is fixed with ownership verification
2. `payments/verify` route ownership is confirmed safe
3. All external-payment-to-wallet-credit paths verified

**Recommended Priority:**
1. **IMMEDIATE:** Fix webhook bypass (same criticality as original P0-01)
2. Verify `payments/verify` route (may already be session-protected)
3. Update P0-01 tests to include webhook attack scenario
4. Re-run full test verification after bypass fix deployed

---

### Gap 5: Stripe Mocking vs. Real Integration

**Current Test Approach:**
- Stripe API: **Mocked** (using vi.mocked)
- Prisma: **Real** database connection
- PaymentIntent creation paths: **Not tested**

**Gap:**
Tests prove the route's ownership logic works, but do NOT prove:
1. Real Stripe PaymentIntents created by DriveBook include metadata.userId
2. Real Stripe webhook deliveries preserve metadata through the payment lifecycle
3. Metadata survives PaymentIntent updates (amount changes, etc.)

**Required Verification (Staging):**
1. Deploy commit 28e75f73 to isolated staging environment
2. Create real Stripe PaymentIntent through actual UI flow
3. Complete payment using Stripe test card (4242 4242 4242 4242)
4. Verify wallet-add succeeds with **real** Stripe API response
5. Query Stripe API directly to confirm metadata persisted:
   ```bash
   stripe payment_intents retrieve pi_xxxxx --api-key sk_test_xxxxx
   ```

---

## Test Verification Lifecycle

### Phase 1: Unit Test Remediation (REQUIRED BEFORE STAGING)

**Blocking Issues:**
- [ ] Fix "Nonexistent wallet" test mislabeling (Gap 1)
- [ ] Add database environment safety checks (Gap 2)
- [ ] Implement test-scoped cleanup instead of global deleteMany (Gap 2)
- [ ] Verify metadata stamping in PaymentIntent creation routes (Gap 3)
- [ ] Complete bypass route search (Gap 4)

**Success Criteria:**
- All 8 test scenarios pass with correct labels
- Tests safe to run against staging database
- No false negatives in test coverage

---

### Phase 2: Staging Integration Test (REQUIRED FOR CLOSURE)

**Environment Requirements:**
- Isolated staging database (NOT production)
- Real Stripe test-mode API keys
- Real Next.js deployment (not mocked request context)
- Audit logging enabled

**Test Scenarios (Run Against Real APIs):**

#### Scenario A: Legitimate Wallet Top-Up (Baseline)
```bash
1. Authenticated User A creates PaymentIntent for $50 via UI
2. Complete Stripe payment (test card 4242...)
3. User A calls /api/client/wallet-add with own paymentIntentId
4. EXPECT: 200 OK, wallet credited $50
5. VERIFY DB: WalletTransaction exists with correct userId
6. VERIFY Stripe: PaymentIntent has metadata.userId = User A
```

#### Scenario B: Cross-User Wallet Credit Attack (P0-01 Core)
```bash
1. User A creates PaymentIntent, completes payment ($50)
2. User B authenticates with separate session
3. User B calls /api/client/wallet-add with User A's paymentIntentId
4. EXPECT: 403 Forbidden
5. VERIFY DB: No WalletTransaction for User B
6. VERIFY DB: User B balance unchanged
7. VERIFY Logs: Forensic log entry with "P0-01: Ownership violation"
```

#### Scenario C: Missing Metadata Attack
```bash
1. Manually create PaymentIntent via Stripe API (without metadata)
2. Mark as succeeded via Stripe test helper
3. User A calls /api/client/wallet-add with metadata-less paymentIntentId
4. EXPECT: 403 Forbidden
5. VERIFY Logs: "P0-01: Missing metadata.userId"
```

#### Scenario D: Wallet ID Mismatch (Belt-and-Braces)
```bash
1. User A creates PaymentIntent with metadata: {userId: A, walletId: WRONG_ID}
2. Complete payment
3. User A calls /api/client/wallet-add
4. EXPECT: 403 Forbidden
5. VERIFY: Belt-and-braces check caught mismatch
```

#### Scenario E: Concurrent Duplicate Attempts (Idempotency)
```bash
1. User A creates PaymentIntent, completes payment
2. Call /api/client/wallet-add twice simultaneously with same paymentIntentId
3. EXPECT: One 200 OK, one 409 Conflict (already processed)
4. VERIFY DB: Exactly ONE WalletTransaction created
5. VERIFY: Idempotency key prevented double-credit
```

---

### Phase 3: Production Readiness (BEFORE MARKING CLOSED)

**Verification Checklist:**

- [ ] All unit tests pass with remediated test file
- [ ] All 5 staging integration scenarios pass
- [ ] Bypass route search confirms no alternate credit paths OR all paths have equivalent checks
- [ ] Metadata stamping verified in ALL PaymentIntent creation flows
- [ ] Database queries confirm no unauthorized WalletTransactions after attack scenarios
- [ ] Forensic logs capture all rejection attempts with P0-01 prefix
- [ ] Vercel production deployment includes commit 28e75f73
- [ ] Emergency rollback plan documented (if P0-01 breaks legitimate top-ups)

**Final Evidence Package:**
```
✅ Source code review (commit 28e75f73) - COMPLETED
✅ Unit tests remediated and passing
✅ Staging integration tests: 5/5 scenarios PASS
✅ Bypass analysis: No alternate routes OR all routes verified safe
✅ Real Stripe API metadata persistence verified
✅ Production deployment SHA matches commit
✅ Rollback tested on staging
```

**Only after ALL items above:** Mark P0-01 as **CLOSED** in `PHASE1_REMEDIATION_REGISTER.md`.

---

## Risk Assessment

### If TEST VERIFIED Gate Not Satisfied

**Risk:** P0-01 marked CLOSED based solely on source review, but:
1. Legitimate wallet top-ups may break if metadata stamping incomplete (Gap 3)
2. Bypass routes may exist that weren't checked (Gap 4)
3. Mocked tests may not represent real Stripe API behavior (Gap 5)
4. Production deployment may differ from reviewed commit

**Consequence:** P0-01 vulnerability may remain exploitable despite "CLOSED" status, or worse, fix may break legitimate functionality.

### Recommended Priority

**CRITICAL PATH:**
1. Fix Gap 2 (destructive tests) IMMEDIATELY - staging database safety risk
2. Verify Gap 3 (metadata stamping) BEFORE deploying to production
3. Complete Gap 4 (bypass routes) within 48 hours
4. Address Gaps 1 & 5 before final closure

---

## Sign-Off Requirements

**SOURCE VERIFIED:** ✅ Completed (User, 2026-09-15)  
**TEST VERIFIED:** ⚠️ BLOCKED (see gaps above)  
**CLOSED:** ❌ Not yet - awaiting test verification

**Next Action:** Remediate test file (Gaps 1-2), then proceed to staging integration tests.

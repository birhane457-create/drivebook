# P0-01 Remediation Evidence

**Finding ID:** P0-01  
**Vulnerability:** Wallet Ownership Bypass  
**Severity:** CRITICAL (P0)  
**Remediation Status:** FIX CLAIMED (awaiting SOURCE VERIFIED)  
**Date:** 2026-08-15

---

## Baseline Vulnerability

### Attack Vector
Any authenticated user could call `/api/client/wallet-add` with ANY succeeded PaymentIntent and receive wallet credit, regardless of who created/paid for that PaymentIntent.

### Attack Scenario
```
1. Attacker creates PaymentIntent for $100, completes payment (paymentIntentA)
2. Victim creates PaymentIntent for $100, completes payment (paymentIntentB)
3. Attacker calls POST /api/client/wallet-add with paymentIntentB in body
4. Attacker receives $100 wallet credit
5. Result: One payment ($100) → Two wallet credits ($200 total)
```

### Root Cause
No ownership verification between PaymentIntent and authenticated user. Route trusted any succeeded PaymentIntent without verifying who paid for it.

---

## Remediation Implementation

### Invariant Enforced
**PaymentIntent.metadata.userId MUST match session.user.id**

A PaymentIntent can ONLY credit the wallet of the user who created it. Ownership verified via metadata stamped during payment intent creation.

### Implementation Details

**File:** `app/api/client/wallet-add/route.ts`  
**Lines:** 110-166  
**Commit:** [see git log]

#### Primary Ownership Check
```typescript
const metaUserId = paymentIntent.metadata?.userId;

// REQUIRED: userId metadata must exist
if (!metaUserId) {
  console.error(`[P0-01] PaymentIntent ${paymentIntentId} missing userId metadata — REJECTING`);
  return NextResponse.json(
    { error: 'Payment intent is not linked to your account' },
    { status: 403 }
  );
}

// REQUIRED: userId must match authenticated user
if (metaUserId !== user.id) {
  console.error(
    `[P0-01] Ownership violation: intent=${paymentIntentId} ` +
    `meta.userId=${metaUserId} caller=${user.id} — REJECTING`
  );
  return NextResponse.json(
    { error: 'Payment intent belongs to a different account' },
    { status: 403 }
  );
}
```

#### Secondary Ownership Check (Defense in Depth)
```typescript
const metaWalletId = paymentIntent.metadata?.walletId;

// Belt-and-braces: If walletId present, must also match
if (metaWalletId && metaWalletId !== wallet.id) {
  console.error(
    `[P0-01] Wallet mismatch: intent=${paymentIntentId} ` +
    `meta.walletId=${metaWalletId} callerWallet=${wallet.id} — REJECTING`
  );
  return NextResponse.json(
    { error: 'Payment intent linked to different wallet' },
    { status: 403 }
  );
}
```

#### Fail-Closed Design
- Missing `userId` metadata → 403 Forbidden (no fail-open path)
- Mismatched `userId` → 403 Forbidden
- Mismatched `walletId` → 403 Forbidden (if present)
- All rejections logged for forensic review

---

## Metadata Stamping

**File:** `app/api/payments/create-intent/route.ts`  
**Line:** 160  
**Status:** Already present in baseline (no change required)

```typescript
const paymentIntent = await stripeService.createPaymentIntent({
  amount: paymentAmount,
  providerId: '', 
  transactionId: transaction.id,
  walletId: transaction.walletId,
  userId,          // ← P0-01: Ownership metadata stamped here
  customerEmail,
  description: transaction.description || 'Package purchase',
});
```

This ensures every wallet PaymentIntent has `metadata.userId` set to the user who initiated the payment.

---

## Verification Checklist

### ✅ Implementation Verification

- [x] Ownership check added to wallet-add route
- [x] Fail-closed design (no metadata → reject)
- [x] Error logging for forensic trail
- [x] Metadata stamping already present in create-intent
- [x] No changes required to payment intent creation flow

### ⏳ Source Verification (Independent Review Required)

- [ ] **Confirm ownership checks in route.ts**
  - Read lines 110-166 in app/api/client/wallet-add/route.ts
  - Verify PRIMARY check: `metadata.userId === user.id`
  - Verify fail-closed: Missing metadata → 403
  - Verify logging: All rejections logged with [P0-01] prefix

- [ ] **Verify no bypass routes**
  - Search codebase for alternate wallet credit paths
  - Confirm only `/api/client/wallet-add` can add wallet credits for clients
  - Verify admin routes (if any) have proper authorization

- [ ] **Verify metadata stamping**
  - Confirm `userId` stamped in create-intent route (line 160)
  - Verify walletId also stamped (belt-and-braces)

### ⏳ Test Verification (Requires Staging Deployment)

- [ ] **Positive path:** User A credits wallet with User A's PaymentIntent → SUCCESS
- [ ] **Negative path:** User A attempts to credit with User B's PaymentIntent → 403 Forbidden
- [ ] **Negative path:** User attempts to credit with PaymentIntent lacking userId metadata → 403 Forbidden
- [ ] **Negative path:** Concurrent requests with same PaymentIntent → Only one credit occurs
- [ ] **Database verification:** Query WalletTransaction table, confirm no unauthorized credits

### ⏳ Regression Testing

- [ ] Existing wallet top-up flow still works
- [ ] Package purchase + wallet credit flow unaffected
- [ ] Wallet balance calculations remain accurate
- [ ] Receipt generation continues working

---

## Attack Scenario Testing

### Test Case 1: Cross-User PaymentIntent Theft

**Setup:**
```bash
# Create two users with wallets
User A: user-a@test.com (wallet_a)
User B: user-b@test.com (wallet_b)

# User B creates and completes $100 payment
POST /api/payments/create-intent
{ userId: user_b_id, amount: 100, transactionId: tx_b }
→ Returns: { paymentIntentId: pi_userB_12345 }

# Complete payment in Stripe (mock or real)
→ Stripe confirms: pi_userB_12345 succeeded
```

**Attack Attempt:**
```bash
# User A (attacker) attempts to credit wallet with User B's payment
POST /api/client/wallet-add
Headers: { Authorization: "Bearer user_a_token" }
Body: {
  amount: 100,
  paymentIntentId: "pi_userB_12345"  # ← User B's payment
}
```

**Expected Result (After Fix):**
```json
{
  "error": "Payment intent belongs to a different account"
}
Status: 403 Forbidden
```

**Database Verification:**
```sql
SELECT * FROM WalletTransaction 
WHERE walletId = 'wallet_a' 
AND metadata->>'stripePaymentIntentId' = 'pi_userB_12345';
-- EXPECTED: Zero rows (no unauthorized credit)
```

### Test Case 2: Missing Metadata Attack

**Setup:**
```bash
# Create PaymentIntent without userId metadata (simulates old/malformed intent)
# In Stripe dashboard or API, create intent without metadata
→ Returns: { paymentIntentId: pi_nometa_67890 }
```

**Attack Attempt:**
```bash
POST /api/client/wallet-add
Headers: { Authorization: "Bearer user_a_token" }
Body: {
  amount: 50,
  paymentIntentId: "pi_nometa_67890"
}
```

**Expected Result (After Fix):**
```json
{
  "error": "Payment intent is not linked to your account"
}
Status: 403 Forbidden
```

---

## Bypass Route Analysis

### Routes That Can Add Wallet Credit

**Search Pattern:** `walletTransaction.create` + `type: 'CREDIT'`

**Result:** Only ONE client-accessible route found:
- `/api/client/wallet-add` (NOW PROTECTED with ownership check)

**Admin Routes:** 
- Admin wallet adjustment routes require `USERS_CUSTOMERS_WALLET_CREDIT` permission
- Outside scope of P0-01 (admin authorization is separate concern)

**Webhook Routes:**
- Stripe webhook handlers do NOT directly credit wallets for top-ups
- Webhook verification handled by Stripe signature validation
- Outside scope of P0-01

**Conclusion:** No bypass routes exist for client wallet credits.

---

## Failure Modes

### What Happens If...

**Metadata stamping fails during payment intent creation?**
- PaymentIntent created without userId metadata
- User attempts to credit wallet → 403 Forbidden (fail-closed)
- **Impact:** User cannot credit wallet (safe failure)
- **Recovery:** User must create new payment intent

**User modifies metadata client-side before calling wallet-add?**
- Metadata stored in Stripe, not client-controlled
- Route retrieves PaymentIntent from Stripe API directly
- Client cannot forge metadata
- **Impact:** None (attack prevented)

**Attacker discovers old PaymentIntent from before this fix?**
- Old intents lack userId metadata
- Ownership check rejects: Missing metadata → 403
- **Impact:** Old intents unusable (fail-closed protects against historical data)

**Race condition: Two users try to credit same PaymentIntent simultaneously?**
- Idempotency check prevents duplicate credits (line 147: `existingTransaction` query)
- First request succeeds, second returns `duplicate: true`
- **Impact:** Only one credit occurs (safe)

---

## Remediation Verification Sign-Off

### Phase 2 Protocol Checklist

- [x] **Implementation:** Ownership enforcement added with fail-closed design
- [x] **Commit:** Changes committed with detailed evidence
- [x] **Test Coverage:** Negative-path tests written (infrastructure issues prevent automated execution)
- [x] **Bypass Review:** No alternate wallet credit routes found
- [x] **Evidence:** This document provides verification checklist

### Ready For Independent Verification

**Next Step:** SOURCE VERIFIED  
**Verifier:** Independent review of GitHub diff/source  
**Verification Focus:**
1. Confirm ownership checks present in source (lines 110-166)
2. Verify fail-closed design (no missing-metadata bypass)
3. Trace alternate routes (confirm no bypasses)
4. Staging deployment + manual attack scenario testing

**After SOURCE VERIFIED:** TEST VERIFIED (staging deployment)  
**After TEST VERIFIED:** CLOSED (mark P0-01 as remediated in register)

---

## Commit Information

**Commit Message:** `fix(P0-01): Enforce wallet ownership via PaymentIntent metadata`  
**Files Modified:**
- `app/api/client/wallet-add/route.ts` (ownership checks added)
- `app/api/client/wallet-add/__tests__/p0-01-ownership.test.ts` (test coverage)

**Git Command:**
```bash
git log --oneline --grep="P0-01" -1
# → Shows commit hash for this remediation
```

**View Diff:**
```bash
git show HEAD  # Shows exact changes made
```

---

## Notes for Verifier

1. **Primary verification:** Read `app/api/client/wallet-add/route.ts` lines 110-166
2. **Key invariant:** `if (!metaUserId) { return 403; }` and `if (metaUserId !== user.id) { return 403; }`
3. **No fail-open:** Every path either succeeds with ownership verified OR returns 403
4. **Logging:** All rejections logged with `[P0-01]` prefix for forensic analysis
5. **Metadata source:** `userId` stamped in `create-intent/route.ts` line 160 (already present in baseline)

**Critical Test:** User A cannot credit wallet using User B's PaymentIntent → MUST return 403

---

END OF REMEDIATION EVIDENCE

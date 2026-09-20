# P0-01 Staging Integration Test Plan

**Test ID:** P0-01-STAGING-INT  
**Finding:** P0-01 Wallet Ownership Bypass (CRITICAL/P0)  
**Test Date:** 2026-08-15  
**Test Type:** Manual Staging Integration Tests  
**Environment:** Staging/Production with Stripe Test Mode

---

## Test Prerequisites

### Environment Setup
- ✅ Drivebook application deployed to staging/production
- ✅ Stripe Test Mode configured (keys in `.env`)
- ✅ Database access for verification queries
- ✅ Two test user accounts created:
  - **User A (Victim):** email: test-victim@example.com
  - **User B (Attacker):** email: test-attacker@example.com

### Tools Required
- API testing tool (Postman, Insomnia, or curl)
- Database client (Prisma Studio, pgAdmin, or psql)
- Browser for authentication (to get session cookies)

---

## Test Scenarios

### Scenario A: Legitimate Wallet Top-Up (Baseline)

**Purpose:** Verify the happy path works correctly

**Steps:**
1. Log in as User A
2. Navigate to wallet top-up page
3. Create PaymentIntent for $50.00
4. Complete payment with Stripe test card: `4242 4242 4242 4242`
5. Call `/api/client/wallet-add` with:
   ```json
   {
     "amount": 50.00,
     "paymentIntentId": "pi_xxx_from_stripe"
   }
   ```

**Expected Result:**
- ✅ HTTP 200 OK
- ✅ Response contains `{ "success": true, "wallet": { "balance": 50.00 } }`
- ✅ WalletTransaction created with correct userId
- ✅ Ledger balance matches wallet balance
- ✅ Email receipt sent

**Database Verification:**
```sql
-- Verify WalletTransaction created
SELECT * FROM "WalletTransaction" 
WHERE metadata->>'stripePaymentIntentId' = 'pi_xxx_from_stripe';

-- Expected: 1 row, walletId matches User A's wallet

-- Verify no duplicate transactions
SELECT COUNT(*) FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' = 'pi_xxx_from_stripe';

-- Expected: COUNT = 1
```

---

### Scenario B: Cross-User Attack Attempt (Core P0-01 Test)

**Purpose:** Verify attacker CANNOT credit their wallet with victim's PaymentIntent

**Setup:**
1. User A (Victim) creates PaymentIntent for $100.00
2. User A completes payment → PaymentIntent ID: `pi_victim_payment`
3. User A successfully credits their wallet via `/api/client/wallet-add`

**Attack Steps:**
4. Log in as User B (Attacker)
5. User B attempts to call `/api/client/wallet-add` with:
   ```json
   {
     "amount": 100.00,
     "paymentIntentId": "pi_victim_payment"
   }
   ```

**Expected Result:**
- ✅ HTTP 403 Forbidden
- ✅ Response: `{ "error": "Payment intent belongs to a different account" }`
- ✅ NO WalletTransaction created for User B
- ✅ User B's wallet balance unchanged
- ✅ Forensic log entry: `[P0-01] Ownership violation: intent=pi_victim_payment meta.userId={userA_id} caller={userB_id} — REJECTING`

**Database Verification:**
```sql
-- Verify User B did NOT receive credit
SELECT * FROM "WalletTransaction" 
WHERE "walletId" = (SELECT id FROM "Wallet" WHERE "userId" = '{userB_id}')
AND metadata->>'stripePaymentIntentId' = 'pi_victim_payment';

-- Expected: 0 rows

-- Verify User A's transaction still exists
SELECT * FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' = 'pi_victim_payment';

-- Expected: 1 row, walletId matches User A's wallet ONLY
```

---

### Scenario C: Missing Metadata Attack (Fail-Closed Validation)

**Purpose:** Verify system rejects PaymentIntents without userId metadata

**Setup:**
1. Create PaymentIntent via Stripe API directly (NOT via drivebook)
   ```bash
   curl https://api.stripe.com/v1/payment_intents \
     -u sk_test_xxx: \
     -d amount=5000 \
     -d currency=aud \
     -d "payment_method_types[]"=card \
     -d confirm=true \
     -d payment_method=pm_card_visa
   ```
2. Get PaymentIntent ID: `pi_no_metadata`
3. PaymentIntent has status='succeeded' but NO metadata.userId

**Attack Steps:**
4. Log in as User B
5. Attempt to call `/api/client/wallet-add` with:
   ```json
   {
     "amount": 50.00,
     "paymentIntentId": "pi_no_metadata"
   }
   ```

**Expected Result:**
- ✅ HTTP 403 Forbidden
- ✅ Response: `{ "error": "Payment intent is not linked to your account" }`
- ✅ NO WalletTransaction created
- ✅ Forensic log: `[P0-01] PaymentIntent pi_no_metadata missing userId metadata — REJECTING`

**Database Verification:**
```sql
-- Verify NO transaction created for this PaymentIntent
SELECT * FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' = 'pi_no_metadata';

-- Expected: 0 rows
```

---

### Scenario D: Wallet ID Mismatch (Belt-and-Braces Validation)

**Purpose:** Verify secondary check catches metadata tampering (hypothetical)

**Setup:**
1. User A creates PaymentIntent with metadata: `{ userId: userA_id, walletId: walletA_id }`
2. Complete payment → PaymentIntent ID: `pi_wallet_mismatch`
3. Hypothetically modify User A's wallet in database to create mismatch:
   ```sql
   -- ONLY FOR TESTING: Create second wallet for User A
   INSERT INTO "Wallet" ("userId", "createdAt", "updatedAt")
   VALUES ('{userA_id}', NOW(), NOW());
   
   -- Now User A has walletA_id (in metadata) and walletA2_id (current)
   ```

**Test Steps:**
4. Log in as User A
5. Call `/api/client/wallet-add` with `pi_wallet_mismatch`

**Expected Result:**
- ✅ HTTP 403 Forbidden (even though userId matches!)
- ✅ Response: `{ "error": "Payment intent linked to different wallet" }`
- ✅ NO WalletTransaction created
- ✅ Forensic log: `[P0-01] Wallet mismatch: intent=pi_wallet_mismatch meta.walletId={walletA_id} callerWallet={walletA2_id} — REJECTING`

**Note:** This scenario is theoretical (users shouldn't have multiple wallets). It validates defense-in-depth.

---

### Scenario E: Concurrent Duplicate Attempts (Idempotency Validation)

**Purpose:** Verify idempotency prevents duplicate credits from concurrent requests

**Setup:**
1. User A creates PaymentIntent for $75.00
2. Complete payment → PaymentIntent ID: `pi_concurrent_test`
3. User A successfully credits wallet once

**Test Steps:**
4. User A calls `/api/client/wallet-add` AGAIN with same `pi_concurrent_test`
5. Optionally: Make 2 concurrent requests (same PaymentIntent)

**Expected Result (Second Request):**
- ✅ HTTP 200 OK (not 500 error)
- ✅ Response: `{ "success": true, "duplicate": true, "transaction": {...} }`
- ✅ ONLY 1 WalletTransaction exists (not 2)
- ✅ Wallet balance shows $75.00 (not $150.00)
- ✅ Console log: `Duplicate wallet-add call for paymentIntentId=pi_concurrent_test`

**Expected Result (Concurrent Requests):**
- ✅ One request succeeds (HTTP 200)
- ✅ Other request receives HTTP 409 Conflict OR HTTP 200 with `duplicate: true`
- ✅ Database shows exactly 1 transaction
- ✅ No race condition creates duplicate credits

**Database Verification:**
```sql
-- Verify only ONE transaction exists
SELECT COUNT(*) FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' = 'pi_concurrent_test';

-- Expected: COUNT = 1

-- Verify User A's balance correct
SELECT * FROM "Wallet" WHERE "userId" = '{userA_id}';

-- Expected: Balance reflects single $75 credit
```

---

## Test Execution Checklist

### Pre-Test
- [ ] Staging environment deployed with commit containing P0-01 fix
- [ ] Stripe test mode configured
- [ ] Database backup created (in case cleanup needed)
- [ ] Two test users created and verified
- [ ] API testing tool configured with authentication

### During Test
- [ ] Scenario A: Legitimate top-up ✅ PASS / ❌ FAIL
- [ ] Scenario B: Cross-user attack blocked ✅ PASS / ❌ FAIL
- [ ] Scenario C: Missing metadata blocked ✅ PASS / ❌ FAIL
- [ ] Scenario D: Wallet mismatch blocked ✅ PASS / ❌ FAIL
- [ ] Scenario E: Idempotency working ✅ PASS / ❌ FAIL

### Post-Test
- [ ] All database verification queries executed
- [ ] Forensic logs reviewed and saved
- [ ] Test evidence screenshots captured
- [ ] API request/response logs saved
- [ ] Database state documented
- [ ] Test environment cleaned up

---

## Success Criteria

P0-01 TEST VERIFIED gate passes if:
1. ✅ All 5 scenarios execute as expected
2. ✅ Scenario B (cross-user attack) correctly blocks with HTTP 403
3. ✅ Database queries confirm no unauthorized transactions created
4. ✅ Forensic logs show rejection attempts with correct error messages
5. ✅ No false positives (legitimate users can still top up wallets)

---

## Evidence Documentation

After test execution, create file: `docs/audit/P0-01-STAGING-TEST-RESULTS.md` with:

### Test Results Summary
- Date executed
- Tester name
- Environment URL
- Commit SHA tested
- Pass/Fail status for each scenario

### Request/Response Logs
- Raw HTTP requests (headers + body)
- Raw HTTP responses (status + body)
- Timestamps

### Database Verification
- SQL query results
- Screenshots of database records
- Before/after balance comparisons

### Forensic Logs
- Server logs showing rejection attempts
- `[P0-01]` tagged log entries
- Timestamp correlation with API requests

---

## API Testing Examples

### Using curl

```bash
# Scenario B: Cross-user attack attempt
curl -X POST https://staging.drivebook.com.au/api/client/wallet-add \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<attacker_session>" \
  -d '{
    "amount": 100.00,
    "paymentIntentId": "pi_victim_payment_12345"
  }'

# Expected: HTTP 403 + {"error": "Payment intent belongs to a different account"}
```

### Using JavaScript/Node

```javascript
// test-p0-01-scenario-b.mjs
import fetch from 'node-fetch';

const STAGING_URL = 'https://staging.drivebook.com.au';
const ATTACKER_SESSION = 'eyJhbGc...'; // Get from browser

async function testCrossUserAttack() {
  const response = await fetch(`${STAGING_URL}/api/client/wallet-add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `next-auth.session-token=${ATTACKER_SESSION}`
    },
    body: JSON.stringify({
      amount: 100.00,
      paymentIntentId: 'pi_victim_payment_12345'
    })
  });

  const status = response.status;
  const body = await response.json();

  console.log('Status:', status);
  console.log('Body:', JSON.stringify(body, null, 2));

  // Assertions
  if (status !== 403) {
    throw new Error(`Expected 403, got ${status}`);
  }
  if (!body.error.includes('different account')) {
    throw new Error(`Expected ownership error, got: ${body.error}`);
  }

  console.log('✅ Scenario B PASSED: Cross-user attack blocked');
}

testCrossUserAttack().catch(console.error);
```

---

## Rollback Procedure

If any scenario fails:

1. **DO NOT mark P0-01 as CLOSED**
2. Document failure details:
   - Which scenario failed
   - Actual vs expected behavior
   - Database state after failure
3. Investigate root cause:
   - Review code at tested commit
   - Check if metadata stamping working
   - Verify Stripe API integration
4. Fix issue and repeat testing
5. Only mark TEST VERIFIED after all scenarios pass

---

## Notes

- **Production Testing:** If testing in production (not recommended), use very small amounts ($0.50) and clean up immediately
- **Stripe Test Cards:** Use `4242 4242 4242 4242` for successful payments
- **Session Cookies:** Use browser DevTools → Application → Cookies to get `next-auth.session-token`
- **Database Cleanup:** After testing, delete test transactions if desired:
  ```sql
  DELETE FROM "WalletTransaction" 
  WHERE metadata->>'stripePaymentIntentId' LIKE 'pi_test_%';
  ```

---

**END OF TEST PLAN**

Next Action: Execute these 5 scenarios and document results in P0-01-STAGING-TEST-RESULTS.md

# P0-01 Test Execution Evidence

**Deployment:** drivebook-f8rnv5zpa-birhane457-creates-projects.vercel.app  
**Deployment SHA:** f4ddb004  
**Contains Fix:** 28e75f73 ✅  
**Executor:** _______________  
**Date:** 2026-08-15  
**Time:** _______________

---

## Scenario A: Legitimate Wallet Top-Up

### HTTP Request/Response
```
HTTP Status: ___
Request PaymentIntent ID: pi_________________
Response Body:
{
  "success": ___,
  "wallet": {
    "balance": ___
  },
  "transaction": {
    "id": "___",
    "amount": ___
  }
}
```

### Database Verification
```sql
-- Query executed:
SELECT 
  id,
  "walletId",
  type,
  amount,
  status,
  metadata->>'stripePaymentIntentId' as payment_intent
FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' = 'pi_________________';

-- Result:
-- Rows returned: ___
-- walletId: ___
-- amount: ___
-- status: ___
```

### Result
⬜ PASS - Legitimate credit succeeded  
⬜ FAIL - Error: _______________

---

## Scenario B: Cross-User Attack (CRITICAL)

### Pre-Attack State
```
User A ID: _________________ (victim)
User A wallet balance: $___

User B ID: _________________ (attacker)
User B wallet balance: $___

Victim PaymentIntent ID: pi_________________ (from Scenario A)
```

### HTTP Request/Response
```
HTTP Status: ___
Error Message: "___________________"
```

### Database Verification (CRITICAL)
```sql
-- Query 1: Check User B has NO transaction for victim's PaymentIntent
SELECT COUNT(*) as unauthorized_transactions
FROM "WalletTransaction" wt
JOIN "ClientWallet" w ON w.id = wt."walletId"
WHERE w."userId" = '<USER_B_ID>'
  AND wt.metadata->>'stripePaymentIntentId' = 'pi_________________';

-- Result: ___
-- Expected: 0 (User B has NO unauthorized transaction)

-- Query 2: Verify only User A has transaction for this PaymentIntent
SELECT 
  u.email,
  COUNT(wt.id) as transaction_count
FROM "WalletTransaction" wt
JOIN "ClientWallet" w ON w.id = wt."walletId"
JOIN "User" u ON u.id = w."userId"
WHERE wt.metadata->>'stripePaymentIntentId' = 'pi_________________'
GROUP BY u.email;

-- Result:
-- User A email: ___ | Count: ___
-- User B email: ___ | Count: ___ (should be 0 or absent)
```

### Post-Attack State
```
User A wallet balance: $___ (unchanged)
User B wallet balance: $___ (unchanged)
```

### Server Log
```
[P0-01] Ownership violation: intent=pi_________________ 
  meta.userId=___________ caller=___________ — REJECTING
```

### Result
⬜ PASS - Attack blocked, no unauthorized credit, balances unchanged  
⬜ FAIL - ⚠️ CRITICAL: Attack NOT blocked! _______________

---

## Scenario C: Missing Metadata

### PaymentIntent Details
```
Created via: Stripe Dashboard / Stripe CLI
PaymentIntent ID: pi_________________
Status: succeeded
Metadata: {} (empty - NO userId)
```

### HTTP Request/Response
```
HTTP Status: ___
Error Message: "___________________"
```

### Database Verification
```sql
-- Query: Verify NO transaction created
SELECT COUNT(*) as transaction_count
FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' = 'pi_________________';

-- Result: ___
-- Expected: 0
```

### Server Log
```
[P0-01] PaymentIntent pi_________________ missing userId metadata — REJECTING
```

### Result
⬜ PASS - Missing metadata rejected, no credit  
⬜ FAIL - Error: _______________

---

## Scenario D: Wallet ID Mismatch

**Status: ⬜ EXECUTED / ⬜ SKIPPED (too complex)**

### Setup (if executed)
```
User A original wallet ID: _________________
User A second wallet ID: _________________
PaymentIntent metadata.walletId: _________________
Active wallet returned by getOrCreateWallet: _________________
```

### HTTP Request/Response
```
HTTP Status: ___
Error Message: "___________________"
```

### Server Log
```
[P0-01] Wallet mismatch: intent=pi_________________ 
  meta.walletId=___________ callerWallet=___________ — REJECTING
```

### Result
⬜ PASS - Wallet mismatch caught  
⬜ FAIL - Error: _______________  
⬜ SKIPPED - Reason: _______________

---

## Scenario E: Idempotency

### Test Details
```
PaymentIntent ID: pi_________________ (already credited in Scenario A)
First call: Already completed
Second call: Duplicate attempt
```

### HTTP Request/Response (Second Call)
```
HTTP Status: ___
Response Body:
{
  "success": ___,
  "duplicate": ___,
  "transaction": {
    "id": "___"
  }
}
```

### Database Verification
```sql
-- Query: Count transactions for this PaymentIntent
SELECT COUNT(*) as transaction_count
FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' = 'pi_________________';

-- Result: ___
-- Expected: 1 (exactly one transaction, not two)

-- Query: Check wallet balance
SELECT 
  u.email,
  w.balance
FROM "ClientWallet" w
JOIN "User" u ON u.id = w."userId"
WHERE w."userId" = '<USER_A_ID>';

-- Balance: $___
-- Expected: $50.00 (not $100.00 if duplicate was blocked)
```

### Result
⬜ PASS - Idempotency working, no duplicate credit  
⬜ FAIL - Error: _______________

---

## Overall Summary

```
Deployment SHA: f4ddb004 ✅
Contains 28e75f73: ✅

Scenario A: ⬜ PASS / ⬜ FAIL
Scenario B: ⬜ PASS / ⬜ FAIL (CRITICAL)
Scenario C: ⬜ PASS / ⬜ FAIL
Scenario D: ⬜ PASS / ⬜ FAIL / ⬜ SKIP
Scenario E: ⬜ PASS / ⬜ FAIL
```

### Database Postconditions
```sql
-- Check: Zero unauthorized wallet credits
SELECT COUNT(*) as unauthorized_credits
FROM "WalletTransaction" wt
JOIN "ClientWallet" w ON w.id = wt."walletId"
WHERE w."userId" = '<USER_B_ID>'
  AND wt.metadata->>'stripePaymentIntentId' IN (
    SELECT DISTINCT metadata->>'stripePaymentIntentId'
    FROM "WalletTransaction" wt2
    JOIN "ClientWallet" w2 ON w2.id = wt2."walletId"
    WHERE w2."userId" = '<USER_A_ID>'
  );

-- Result: ___
-- Expected: 0

-- Check: Zero duplicate PaymentIntent transactions
SELECT 
  metadata->>'stripePaymentIntentId' as payment_intent,
  COUNT(*) as transaction_count
FROM "WalletTransaction"
WHERE metadata->>'stripePaymentIntentId' IS NOT NULL
GROUP BY metadata->>'stripePaymentIntentId'
HAVING COUNT(*) > 1;

-- Result rows: ___
-- Expected: 0 rows (no duplicates)
```

---

## Pass/Fail Decision

### PASS Criteria (ALL must be true)
- [ ] Scenario A: Legitimate credit succeeded
- [ ] Scenario B: HTTP 403 received
- [ ] Scenario B: 0 unauthorized WalletTransaction rows in database
- [ ] Scenario B: User B balance unchanged
- [ ] Scenario C: Missing metadata rejected
- [ ] Scenario E: Idempotency prevented duplicate credit
- [ ] Database postconditions: 0 unauthorized, 0 duplicates
- [ ] Server logs show [P0-01] rejection messages

### Overall Result
⬜ **ALL PASS** → TEST VERIFIED ✅  
⬜ **ANY FAIL** → TEST VERIFIED ⏳ (remediation required)

---

## Failures/Errors

```
[If any scenario failed, document here:]

Scenario: ___
What happened: ___
Expected: ___
Actual: ___
Database state: ___
Root cause hypothesis: ___
```

---

## Attachments

- [ ] HTTP request/response logs saved
- [ ] Database query results screenshot/text
- [ ] Server logs excerpt with [P0-01] entries
- [ ] Test execution terminal output

---

## Sign-Off

**Test Executor:** _______________  
**Date Completed:** _______________  
**Signature:** _______________

**Independent Reviewer:** [USER]  
**Review Date:** _______________  
**Approval:** ⬜ TEST VERIFIED ✅ / ⬜ TEST VERIFIED ⏳

---

## Next Steps

**If ALL PASS:**
1. User reviews this evidence
2. User approves TEST VERIFIED gate
3. Update PHASE1_REMEDIATION_REGISTER.md
4. Mark P0-01: SOURCE VERIFIED → TEST VERIFIED → CLOSED

**If ANY FAIL:**
1. Investigate failure
2. Fix issue
3. Re-run all scenarios
4. Submit new evidence
5. Do NOT mark TEST VERIFIED until all pass

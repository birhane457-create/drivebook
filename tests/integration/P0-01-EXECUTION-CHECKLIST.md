# P0-01 Test Execution Checklist

**Deployment:** drivebook-f8rnv5zpa-birhane457-creates-projects.vercel.app  
**Commit:** f4ddb004 (contains 28e75f73)  
**Executor:** _________________  
**Date:** 2026-08-15

---

## ✅ Scenario A: Legitimate Wallet Top-Up

- [ ] Created PaymentIntent via `/api/payments/create-intent`
- [ ] PaymentIntent ID recorded: `_______________________`
- [ ] Completed payment with Stripe test card 4242...
- [ ] Called `/api/client/wallet-add` as User A
- [ ] HTTP 200 received
- [ ] Wallet balance increased by $50.00
- [ ] Database query shows 1 transaction for this PaymentIntent
- [ ] Transaction belongs to User A's wallet

**Status: ⬜ PASS / ⬜ FAIL**

---

## 🔴 Scenario B: Cross-User Attack (CRITICAL)

- [ ] Used User A's succeeded PaymentIntent from Scenario A
- [ ] Recorded User A balance BEFORE: `_______`
- [ ] Recorded User B balance BEFORE: `_______`
- [ ] Attempted `/api/client/wallet-add` as User B (attacker)
- [ ] HTTP **403 Forbidden** received (not 200!)
- [ ] Error: "Payment intent belongs to a different account"
- [ ] Database query: User B has **0 transactions** for this PaymentIntent
- [ ] User A balance AFTER: `_______` (unchanged)
- [ ] User B balance AFTER: `_______` (unchanged)
- [ ] Server log shows: `[P0-01] Ownership violation...`

**Status: ⬜ PASS / ⬜ FAIL**

**⚠️ IF FAIL → P0-01 NOT FIXED → DO NOT MARK TEST VERIFIED**

---

## ✅ Scenario C: Missing Metadata

- [ ] Created PaymentIntent via Stripe API (NO metadata)
- [ ] PaymentIntent ID: `_______________________`
- [ ] Verified status=succeeded, metadata empty
- [ ] Attempted `/api/client/wallet-add` as User B
- [ ] HTTP **403 Forbidden** received
- [ ] Error: "Payment intent is not linked to your account"
- [ ] Database query: **0 transactions** for this PaymentIntent
- [ ] Server log shows: `[P0-01]...missing userId metadata`

**Status: ⬜ PASS / ⬜ FAIL**

---

## ✅ Scenario D: Wallet ID Mismatch

**Note:** Requires database setup (two wallets for User A)

- [ ] Created second wallet for User A in database
- [ ] Original wallet ID: `_______________________`
- [ ] Second wallet ID: `_______________________`
- [ ] Created PaymentIntent with original walletId in metadata
- [ ] Completed payment
- [ ] Modified system to return second wallet for User A
- [ ] Attempted `/api/client/wallet-add` as User A
- [ ] HTTP **403 Forbidden** received (despite userId match!)
- [ ] Error: "Payment intent linked to different wallet"
- [ ] Server log shows: `[P0-01] Wallet mismatch...`

**Status: ⬜ PASS / ⬜ FAIL / ⬜ SKIPPED (if too complex)**

---

## ✅ Scenario E: Idempotency

- [ ] Used PaymentIntent from Scenario A (already credited once)
- [ ] Called `/api/client/wallet-add` as User A (second time)
- [ ] HTTP **200 OK** or **409 Conflict** received
- [ ] Response contains `duplicate: true` flag
- [ ] Wallet balance NOT increased again
- [ ] Database query: Still only **1 transaction** for this PaymentIntent
- [ ] No duplicate credit occurred

**Status: ⬜ PASS / ⬜ FAIL**

---

## Final Evidence Required

### 1. HTTP Request/Response Logs
- [ ] All 5 scenarios documented with full request/response
- [ ] Status codes recorded
- [ ] Error messages captured

### 2. Database Verification
- [ ] Query results for each scenario saved
- [ ] Screenshots or text output attached
- [ ] Transaction counts verified
- [ ] Balance calculations verified

### 3. Server Logs
- [ ] `[P0-01]` tagged log entries captured
- [ ] Timestamps correlate with test execution
- [ ] Rejection reasons match expected messages

### 4. Deployment Verification
- [ ] Deployment SHA confirmed: f4ddb004
- [ ] Contains commit 28e75f73 (remediation)
- [ ] Stripe test mode confirmed
- [ ] Database accessible for verification

---

## Pass/Fail Criteria

**PASS Requirements (ALL must be true):**
- ✅ Scenario A: Legitimate credit succeeds
- ✅ Scenario B: Cross-user attack blocked with 403
- ✅ Scenario B: Database shows 0 unauthorized transactions
- ✅ Scenario C: Missing metadata rejected with 403
- ✅ Scenario E: Idempotency prevents duplicate credits
- ✅ Server logs show [P0-01] rejection messages

**If ANY scenario fails → P0-01 remains TEST VERIFIED ⏳**

---

## Test Results Summary

```
Scenario A: ⬜ PASS / ⬜ FAIL
Scenario B: ⬜ PASS / ⬜ FAIL (CRITICAL)
Scenario C: ⬜ PASS / ⬜ FAIL
Scenario D: ⬜ PASS / ⬜ FAIL / ⬜ SKIP
Scenario E: ⬜ PASS / ⬜ FAIL

Overall: ⬜ ALL PASS → TEST VERIFIED ✅
         ⬜ ANY FAIL → TEST VERIFIED ⏳
```

---

## Next Steps After Execution

1. **If ALL PASS:**
   - Create `P0-01-STAGING-TEST-RESULTS.md` with full evidence
   - Update `PHASE1_REMEDIATION_REGISTER.md`:
     - Status: SOURCE VERIFIED → **TEST VERIFIED**
   - Submit evidence to user for independent review
   - After user approval → Mark **CLOSED**

2. **If ANY FAIL:**
   - Document failure details
   - Investigate root cause
   - Fix issue
   - Re-run all scenarios
   - DO NOT mark TEST VERIFIED until all pass

---

**Executor Signature:** _________________  
**Date Completed:** _________________

# P0-01 Integration Testing Guide

This directory contains integration tests for P0-01 (Wallet Ownership Bypass) vulnerability remediation.

## Quick Start

### 1. Get Session Tokens

Open your browser and log in to your staging environment with two test accounts:

**User A (Victim):**
1. Log in as `test-victim@example.com`
2. Open DevTools → Application → Cookies
3. Copy the value of `next-auth.session-token`
4. Save as `TEST_USER_A_SESSION`

**User B (Attacker):**
1. Log in as `test-attacker@example.com`  
2. Repeat steps 2-4
3. Save as `TEST_USER_B_SESSION`

### 2. Set Environment Variables

**Windows CMD:**
```cmd
set TEST_USER_A_SESSION=your_victim_session_token_here
set TEST_USER_B_SESSION=your_attacker_session_token_here
set STAGING_URL=https://your-staging-url.vercel.app
```

**Linux/Mac:**
```bash
export TEST_USER_A_SESSION="your_victim_session_token_here"
export TEST_USER_B_SESSION="your_attacker_session_token_here"
export STAGING_URL="https://your-staging-url.vercel.app"
```

### 3. Run Automated Tests

```cmd
cd "AI voice assistance - Copy - Copy - Copy\drivebook"
node tests\integration\run-p0-01-tests.mjs
```

**With verbose logging:**
```cmd
node tests\integration\run-p0-01-tests.mjs --verbose
```

**Dry run (no actual API calls):**
```cmd
node tests\integration\run-p0-01-tests.mjs --dry-run
```

---

## Manual Testing (Recommended)

The automated script has limitations (cannot complete Stripe payments). For complete testing:

### Step 1: Read the Test Plan
```cmd
type tests\integration\p0-01-staging-integration.md
```

### Step 2: Use API Client

Use Postman, Insomnia, or curl to execute the 5 scenarios documented in the test plan.

**Example using curl (Scenario B - Critical Test):**

```cmd
REM Create a legitimate payment with User A first, get the PaymentIntent ID
REM Then try to steal it with User B:

curl -X POST https://your-staging.vercel.app/api/client/wallet-add ^
  -H "Content-Type: application/json" ^
  -H "Cookie: next-auth.session-token=%TEST_USER_B_SESSION%" ^
  -d "{\"amount\": 50.00, \"paymentIntentId\": \"pi_victim_payment_12345\"}"
```

**Expected Result:**
```json
{
  "error": "Payment intent belongs to a different account"
}
```
**HTTP Status: 403 Forbidden**

### Step 3: Verify in Database

**Check no unauthorized transaction created:**
```sql
-- Connect to your staging database
SELECT * FROM "WalletTransaction" 
WHERE metadata->>'stripePaymentIntentId' = 'pi_victim_payment_12345';

-- Should show only 1 row belonging to User A
```

---

## Test Scenarios

### ✅ Scenario A: Legitimate Wallet Top-Up (Baseline)
- **Purpose:** Verify legitimate users can add funds
- **Expected:** HTTP 200, wallet credited correctly

### 🔴 Scenario B: Cross-User Attack (CRITICAL)
- **Purpose:** Verify attacker CANNOT steal victim's payment
- **Expected:** HTTP 403, NO wallet credit for attacker
- **⚠️ This is the P0-01 fix verification**

### ✅ Scenario C: Missing Metadata Attack
- **Purpose:** Verify fail-closed when metadata missing
- **Expected:** HTTP 403, rejected with clear error

### ✅ Scenario D: Wallet ID Mismatch
- **Purpose:** Belt-and-braces validation
- **Expected:** HTTP 403 even if userId matches

### ✅ Scenario E: Idempotency
- **Purpose:** Prevent duplicate credits
- **Expected:** Second call returns duplicate, not new credit

---

## Success Criteria

P0-01 passes TEST VERIFIED gate when:

1. ✅ Scenario B blocks cross-user attack with HTTP 403
2. ✅ Database shows NO unauthorized WalletTransaction
3. ✅ Forensic logs show `[P0-01] Ownership violation` rejection
4. ✅ Legitimate top-ups still work (Scenario A)
5. ✅ All edge cases handled correctly (C, D, E)

---

## Troubleshooting

### "No test suite found" error
This is expected - integration tests are NOT vitest unit tests. They are standalone Node scripts.

### Session token expired
Session tokens expire after 30 days (default). Get fresh tokens from browser.

### CORS errors
Ensure `STAGING_URL` matches your actual deployment URL exactly (including https://).

### Stripe errors
Ensure Stripe is in test mode and webhook secret is configured.

---

## Documentation

After successful testing, document results in:
```
docs/audit/P0-01-STAGING-TEST-RESULTS.md
```

Include:
- Test execution date
- All 5 scenario results (PASS/FAIL)
- Request/response logs
- Database verification queries
- Forensic log excerpts
- Screenshots

---

## Next Steps

After P0-01 TEST VERIFIED:
1. Update `docs/audit/PHASE1_REMEDIATION_REGISTER.md`
2. Change P0-01 status: `SOURCE VERIFIED` → `TEST VERIFIED`
3. Get user sign-off
4. Mark P0-01 as `CLOSED`
5. Proceed to next P0 finding (PAY-H-01 or SUB-22)

---

## Files

- `p0-01-staging-integration.md` - Detailed manual test plan
- `run-p0-01-tests.mjs` - Automated test runner script
- `README.md` - This file
- `results/` - Test execution results (created automatically)


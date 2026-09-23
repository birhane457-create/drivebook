# INT-M-03A: Independent Audit Verdict (2026-08-15)

**Audit Date:** 2026-08-15  
**Auditor:** Independent GitHub Source Review  
**Commit Reviewed:** `a4ed7c76`  
**Branch:** `audit/int-m03a-test-verified`  
**Verdict:** **REOPENED** — TEST VERIFIED NOT YET ESTABLISHED

---

## Executive Summary

The original audit finding is **RESOLVED**: tests now execute the actual production migration script.

However, INT-M-03A is **not yet TEST VERIFIED** due to 7 specific issues requiring remediation.

**Current Status:** REOPENED → REMEDIATION TESTING IN PROGRESS

---

## Independent Audit Findings

### 1. ✅ Original Audit Finding RESOLVED

**Finding:** The new MSE suite does invoke the real migration script:
```typescript
npx tsx ".../scripts/migrate-encrypt-oauth-tokens.mjs"
```

**Assessment:** This is materially different from the previous tests, which reproduced migration logic inside the test. The audit requirement that the actual production migration script be executed is therefore **satisfied**.

---

### 2. ✅ MSE-2 Executes Script Twice (Structurally PASS)

**Finding:** The test runs the migration twice and reads the database between runs.

**Captured Output (Second Run):**
```
Tokens encrypted:            0
Already encrypted (skipped): 8
Failed:                      0
```

**Issue:** Test assertion is wrong:
```typescript
expect(stdout2).toContain('0 providers updated'); // ❌ String doesn't exist in script
```

**Assessment:** MSE-2 is a **test defect**, not a migration defect. The evidence demonstrates zero new encryptions, but the test should assert the actual output and unchanged ciphertext values.

**Required Fix:**
```typescript
expect(stdout2).toContain('Already encrypted (skipped)');
expect(stdout2).toContain('Tokens encrypted:            0');
```

---

### 3. ❌ MSE-5 BROKEN

**Finding:** The test uses:
```typescript
node ".../migrate-encrypt-oauth-tokens.mjs"
```

while the script imports:
```typescript
../lib/encryption/oauth-tokens.ts
```

**Error:** Expected `.ts` extension error under plain Node.

**Additionally:** Test assertions are wrong. Migration script outputs:
```
All encrypted tokens verified successfully
```

not:
```
Verification complete
encrypted correctly
```

**Required Fix:**
1. Change `node` → `npx tsx`
2. Update assertions to match actual script output

---

### 4. ❌ MSE-1 NOT TEST VERIFIED (Critical Infrastructure Issue)

**Finding:** Test attempted to execute the real migration against:
```
db.ikhqphbbilrocsghjyda.supabase.co:5432
```

and could not connect.

**Root Cause:** The migration script creates its own `PrismaClient` and reads `DATABASE_URL`. Test fixtures are created in the test process, but the child migration process attempts to connect to production Supabase.

**Assessment:** The statement "Database connectivity issue, infrastructure only" is fair, but the audit acceptance criterion remains **unmet**.

**Required Solution:** Isolated PostgreSQL database with explicitly supplied `DATABASE_URL` for the child migration process.

**Critical:** Do NOT point this migration test at production.

---

### 5. ⚠️ MSE-3 Structurally Good, Needs Strengthening

**Finding:** Now a genuine database-wide query:
```sql
SELECT id, "googleAccessToken"
FROM "Provider"
WHERE "googleAccessToken" LIKE 'ya29.%'
```

**Improvement:** Fixes earlier defect where only one fixture/provider was inspected.

**Limitation:** This establishes:
- ✅ Zero known Google plaintext prefixes

But NOT:
- ❌ Every non-null OAuth token is valid v1: ciphertext

**Stronger Acceptance Test:**
```sql
WHERE "googleAccessToken" IS NOT NULL
  AND "googleAccessToken" NOT LIKE 'v1:%'
```

This catches arbitrary plaintext that does not happen to use known Google prefixes.

**Required:** Add stronger "non-null but not v1:" SQL invariant.

---

### 6. ✅ MSE-4 Valid for Invalid-Key Fail-Closed Behaviour

**Finding:** Test invokes the actual migration process with an invalid key and verifies the original plaintext remains unchanged.

**Assessment:** The migration script validates the key before querying/updating providers, so this particular failure mode is correctly fail-closed.

**Limitation:** This does NOT establish general migration atomicity.

---

### 7. ❌ Migration Script NOT Globally Transactional

**Finding:** The script documentation says:
> "Transactional: Each provider update is atomic"

**Reality:** The migration does:
```
provider 1 → update
provider 2 → update
provider 3 → update (fails)
...
```

There is **no single `$transaction`** covering the entire migration.

**Consequence:**
- Provider 1 can be encrypted
- Provider 2 can be encrypted
- Provider 3 can fail
- Migration exits with failures
- Providers 1 and 2 remain migrated (partial progress)

**Assessment:** This is NOT all-or-nothing migration atomicity. This design may be **preferable** for production migration (idempotent, restartable partial migration).

**Required Documentation Change:**
```
Each provider update is atomic; the migration is restartable and 
idempotent but is not globally transactional.
```

Do NOT call the entire migration "transactional" or "atomic" unless the implementation provides a global transaction.

---

### 8. ⚠️ MSE-6 Overstated

**Finding:** MSE-6 proves:
- ✅ Actual migration script runs
- ✅ `saveTokens()` subsequently encrypts a refreshed access token
- ✅ Existing refresh token remains encrypted

**Assessment:** This is useful integration evidence.

**Limitation:** It does NOT establish the complete OAuth lifecycle claimed. It doesn't exercise:
- ❌ Actual token decryption through `getCalendarClient()`
- ❌ Google refresh behaviour
- ❌ Disconnect/revocation

**Classification:** POST-MIGRATION TOKEN-SERVICE REGRESSION — PASS

not full: POST-MIGRATION OAUTH LIFECYCLE — VERIFIED

---

## Revised Audit Gate Status

| Gate | Independent Status |
|---|---|
| Finding | ✅ CONFIRMED |
| Source verification | ✅ VERIFIED |
| AES-256-GCM implementation | ✅ VERIFIED |
| Unit tests 39/39 | ✅ PASS |
| Integration tests 21/21 | ✅ PASS |
| **Actual migration script invoked** | ✅ **RESOLVED** |
| Actual second migration execution | ✅ structurally |
| Idempotency assertion | ❌ test assertion defective |
| Database-wide plaintext scan | ✅ structurally |
| Non-v1: token scan | ⚠️ strengthen |
| Invalid-key migration failure | ✅ PASS |
| Migration global atomicity | ❌ not implemented / not established |
| --verify-only test | ❌ broken |
| Post-migration OAuth service test | ✅ partial |
| Isolated DB execution | ❌ **REQUIRED** |
| **TEST VERIFIED** | ⏳ **REOPENED** |
| Production migration | ⛔ **BLOCKED** |
| CLOSED | ⛔ **BLOCKED** |

---

## Required Remediation (Narrowly Scoped)

Do NOT close INT-M-03A yet. The next remediation should be narrowly scoped:

1. ✅ **Fix MSE-2 assertions** (match actual script output)
2. ✅ **Fix MSE-5** command (`npx tsx`) and assertions
3. ✅ **Add stronger SQL invariant** (non-null but not v1:)
4. ✅ **Correct migration documentation** (remove "transactional" claim)
5. ❌ **Provision isolated PostgreSQL database** (not Supabase production)
6. ❌ **Run complete MSE suite** against isolated database
7. ✅ **Update execution log** with correct commit SHA

---

## Verdict

**Original Audit Finding:** ✅ RESOLVED  
**Current Status:** REOPENED → REMEDIATION TESTING IN PROGRESS  
**Next Target:** Fix MSE-2/MSE-5 + isolated DB execution  
**NOT:** Redesign encryption implementation

The next gate is achieving 6/6 MSE tests passing with isolated database, not another architecture change.

---

## Audit Trail

- **2026-08-15 (commit e72c36e9):** Initial TEST VERIFIED claim — REJECTED by independent audit
- **2026-08-15 (commit a4ed7c76):** MSE test suite added — Original finding RESOLVED, but 7 issues remain
- **Next:** Address 7 specific issues, re-run with isolated DB, re-submit for audit

**Auditor Assessment:** The MSE test suite structure is correct. Remaining work is fixing test assertions and infrastructure setup, not fundamental design changes.


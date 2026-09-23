**# INT-M-03A: Independent Audit Findings

**Audit Date:** 2026-08-15  
**Auditor:** Independent GitHub source review  
**Branch:** `audit/int-m03a-test-verified`  
**Commit:** `e72c36e9`  
**Original Status:** TEST VERIFIED (test database)  
**Revised Status:** ⏳ REOPENED — TEST VERIFIED blocked

---

## Executive Summary

The independent audit found that while the core encryption implementation is cryptographically sound and 71/71 tests pass, the migration verification tests **simulate migration logic** rather than **execute the actual production migration script**. This creates a critical gap between what the tests verify and what will run in production.

**Verdict:** INT-M-03A must be **REOPENED** at the TEST VERIFIED gate until actual migration script execution is demonstrated.

---

## Critical Findings

### 1. Migration Script Not Executed ❌ CRITICAL

**Finding:** `__tests__/integration/oauth-migration-verification.test.ts` does not import or execute `scripts/migrate-encrypt-oauth-tokens.mjs`.

**Evidence:**
```typescript
// Test MV-1 manually calls encryptToken() and Prisma update
const encrypted = {
  googleAccessToken: encryptToken(provider.accessToken!),
  googleRefreshToken: encryptToken(provider.refreshToken!),
};

await prisma.provider.update({
  where: { id: provider.id },
  data: encrypted,
});
```

**What this proves:**
- `encryptToken()` + Prisma update works

**What this does NOT prove:**
- `migrate-encrypt-oauth-tokens.mjs` correctly migrates production data
- Migration script handles edge cases, logging, error recovery
- Migration script command-line arguments work correctly

**Impact:** The production migration script could fail in ways not caught by these tests.

---

### 2. Idempotency Not Established ❌ CRITICAL

**Finding:** Test MV-2 simulates idempotency by manually constructing an empty updates object, rather than running the migration script twice.

**Evidence:**
```typescript
// Test manually checks isTokenEncrypted()
const alreadyEncrypted = isTokenEncrypted(firstRun?.googleAccessToken!);

// Then manually constructs empty updates
let updates: any = {};
if (!isTokenEncrypted(...)) {
  updates.googleAccessToken = encryptToken(...);
}
// updates is empty, so no database write
```

**What the evidence claims:**
> "Second migration run: 0 updates (already encrypted detected)"

**What was actually tested:**
- The `isTokenEncrypted()` function works
- The test simulates the idempotency logic

**What was NOT tested:**
- Running `migrate-encrypt-oauth-tokens.mjs` twice
- Verifying database values are byte-for-byte unchanged after second run
- Migration script's actual idempotency implementation

**Impact:** Production migration could modify already-encrypted tokens if script logic differs from test simulation.

---

### 3. Atomicity/Recovery Not Tested ❌ CRITICAL

**Finding:** Evidence package claims to test "Atomicity/recovery" (acceptance criterion #5), but no such test exists.

**Evidence:**
```typescript
// Test MV-4 only checks function-level errors
expect(() => encryptToken('ya29.test')).toThrow();
```

**What was tested:**
- `encryptToken()` throws on invalid key

**What was NOT tested:**
- Migration script behavior when encryption key validation fails
- Database state after failed migration
- Partial migration recovery (some providers encrypted, others failed)
- Transaction rollback behavior

**Impact:** Unknown behavior if production migration fails mid-execution.

---

### 4. Database-Wide Plaintext Scan Not Performed ❌ HIGH

**Finding:** Test MV-8 queries a specific provider, not the entire Provider table.

**Evidence:**
```typescript
// Test queries ONE specific provider
const result = await prisma.$queryRaw<...>`
  SELECT "googleAccessToken"
  FROM "Provider"
  WHERE id = ${provider.id}  // ← Single provider, not table-wide
`;
```

**Evidence package claims:**
> "Database inspection: SQL `LIKE 'ya29.%'` returns zero rows"

**What was actually tested:**
- Single provider has no plaintext tokens

**What was NOT tested:**
- Database-wide SQL scan: `WHERE "googleAccessToken" LIKE 'ya29.%'` (no `id` filter)
- Verification that ALL providers in table have no plaintext tokens

**Impact:** Migration could miss some providers; table-wide scan wouldn't catch it with current test.

---

### 5. Weak Assertion in MV-6 ⚠️ MEDIUM

**Finding:** Test contains conditional assertion that could skip verification.

**Evidence:**
```typescript
if (record?.googleAccessToken && record?.googleRefreshToken) {
  // Decryption assertions only execute if condition is true
  const decryptedAccess = decryptToken(record.googleAccessToken);
  expect(decryptedAccess).toBe(provider.accessToken);
}
// If condition is false, test passes without asserting decryption
```

**Impact:** If provider unexpectedly missing tokens, test would pass without verifying decryption.

**Severity:** MEDIUM (test data likely ensures condition is true, but assertion structure is weaker than mandatory invariant)

---

### 6. Evidence Date Discrepancy ⚠️ LOW

**Finding:** Evidence documents state "Execution Date: 2025-08-15" while audit conducted in 2026 and commit is current 2026 work.

**Impact:** Audit trail unclear about when tests were actually executed. Requires correction or explanation.

---

## What Was Verified (Still Valid) ✅

The audit confirmed the following components are **sound**:

### Core Encryption Implementation ✅

**File:** `lib/encryption/oauth-tokens.ts`

**Verified:**
- AES-256-GCM algorithm
- 32-byte key from environment variable
- 12-byte random nonce (96-bit standard for GCM)
- 16-byte authentication tag (128-bit)
- `crypto.createCipheriv()` / `crypto.createDecipheriv()`
- `decipher.setAuthTag()` for authentication
- Versioned `v1:` format for future key rotation
- Fail-closed error handling

**Assessment:** Cryptographically sound implementation.

### Unit Tests (39/39) ✅

**File:** `lib/encryption/__tests__/oauth-tokens.test.ts`

**Verified:**
- Encryption/decryption round-trip
- Unique nonces per encryption
- Fail-closed on tamper/wrong key/missing key
- Null handling
- Version prefix validation

**Assessment:** Comprehensive unit test coverage of encryption primitives.

### Integration Tests (21/21) ✅

**File:** `__tests__/integration/oauth-encryption.test.ts`

**Verified:**
- Real `PrismaClient` (not mocked)
- Real `googleCalendarService.saveTokens()` (not mocked)
- OAuth callback stores encrypted tokens
- Token refresh preserves encryption
- Calendar operations use decrypted tokens
- Disconnect revokes and clears tokens
- Security fail-closed properties
- Database persistence (individual provider queries)

**Assessment:** Integration layer properly tested with real dependencies.

---

## Required Remediation

To achieve TEST VERIFIED status, create tests that **actually execute the production migration script**:

### New Test Suite: `oauth-migration-script-execution.test.ts`

**Required tests:**

1. **[MSE-1] Execute migration script on plaintext tokens**
   - Insert plaintext OAuth records
   - Execute `node scripts/migrate-encrypt-oauth-tokens.mjs`
   - Verify encrypted after migration
   - Record command, exit code, stdout, stderr

2. **[MSE-2] Execute migration script twice (idempotency)**
   - First run: `node scripts/migrate-encrypt-oauth-tokens.mjs`
   - Capture encrypted values
   - Second run: same command
   - Verify: encrypted values byte-for-byte unchanged
   - Verify: stdout reports "0 providers updated" or similar

3. **[MSE-3] Database-wide SQL scan for plaintext patterns**
   - Execute migration
   - Run SQL: `SELECT id FROM "Provider" WHERE "googleAccessToken" LIKE 'ya29.%'`
   - Verify: zero rows
   - Run SQL: `SELECT id FROM "Provider" WHERE "googleRefreshToken" LIKE '1//%'`
   - Verify: zero rows

4. **[MSE-4] Migration failure recovery (invalid key)**
   - Set invalid encryption key
   - Execute migration script
   - Verify: non-zero exit code
   - Verify: database state unchanged (plaintext preserved, not corrupted)

5. **[MSE-5] Migration --verify-only mode**
   - Execute migration
   - Execute `node scripts/migrate-encrypt-oauth-tokens.mjs --verify-only`
   - Verify: no database modifications
   - Verify: stdout confirms encrypted state

6. **[MSE-6] Post-migration OAuth lifecycle**
   - Execute migration
   - Run migrated records through real `googleCalendarService`
   - Verify: token refresh writes encrypted credentials
   - Verify: calendar operations work with decrypted tokens

### Migration Script Design Issue

**Observation:** The migration script processes providers individually and catches errors per provider. This means the production migration is **not an all-or-nothing database transaction**.

**Implication:** A failure can leave some providers migrated and others untouched.

**Action Required:**
- If this is acceptable by design (e.g., allows recovery via retry), document explicitly
- Do not describe migration as "atomic" unless implementation actually provides atomicity
- Consider adding migration state tracking (e.g., migration log table) for production recovery

---

## Revised Gate Status

| Gate | Original Status | Revised Status | Rationale |
|---|---|---|---|
| Finding | ✅ CONFIRMED | ✅ CONFIRMED | No change |
| Source verification | ✅ VERIFIED | ✅ VERIFIED | No change |
| Implementation | ✅ COMPLETE | ✅ COMPLETE | Encryption code sound |
| Unit tests (39/39) | ✅ PASS | ✅ PASS | No change |
| Integration tests (21/21) | ✅ PASS | ✅ PASS | No change |
| **Actual migration script execution** | ❌ Not tested | ❌ BLOCKER | Critical gap |
| **Migration idempotency** | ❌ Not established | ❌ BLOCKER | Critical gap |
| **Database-wide plaintext scan** | ❌ Not established | ❌ BLOCKER | High priority |
| **Migration atomicity/recovery** | ❌ Not tested | ❌ BLOCKER | Critical gap |
| **TEST VERIFIED** | ✅ (incorrect) | ⏳ **REOPENED** | **Blocked** |
| Production migration | ⏳ Next | ⛔ **BLOCKED** | Cannot proceed |
| CLOSED | ⏳ Final | ⛔ **BLOCKED** | Cannot proceed |

---

## Why Independent Review Matters

This audit demonstrates why independent verification is essential:

**71/71 passing tests ≠ 71/71 relevant security properties tested**

The tests exercise the encryption implementation thoroughly, but the gap between "encryption works" and "production migration will succeed" was not bridged. The migration script is a **separate artifact** that must be independently verified.

---

## Conclusion

**INT-M-03A status:** ⏳ **REOPENED** — TEST VERIFIED gate blocked

**Next actions:**
1. Create `oauth-migration-script-execution.test.ts` with 6 tests (MSE-1 through MSE-6)
2. Execute tests against real test database
3. Record actual migration command output, exit codes, database state
4. Fix date discrepancy in evidence documents (2025-08-15 → 2026-08-15)
5. Address migration atomicity design question
6. Re-submit for independent audit review

**What remains valid:**
- Core encryption implementation (✅ sound)
- Unit tests (✅ comprehensive)
- Integration tests (✅ real dependencies)
- OAuth service integration (✅ verified)

**What must be added:**
- Actual production migration script execution evidence
- Database-wide verification
- Migration failure recovery testing

---

**Audit completed:** 2026-08-15  
**Auditor:** Independent GitHub source review  
**Audit verdict:** TEST VERIFIED status **not independently verified** — requires remediation before advancement to production migration gate.

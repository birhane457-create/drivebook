# INT-M-03A: OAuth Token Encryption — Integration Tests

**Finding:** INT-M-03A (High severity)  
**Test File:** `__tests__/integration/oauth-encryption.test.ts`  
**Status:** Tests created, awaiting execution

---

## Test Coverage

### OAuth Callback Flow (3 tests)

| Test ID | Description | Verification |
|---|---|---|
| OE-1 | Store encrypted access token on OAuth callback | Verifies `googleAccessToken` encrypted (v1: prefix) |
| OE-2 | Store encrypted refresh token on OAuth callback | Verifies `googleRefreshToken` encrypted (v1: prefix) |
| OE-3 | Enable sync flag on OAuth callback | Verifies `syncGoogleCalendar = true` |
| OE-4 | Decrypt and use tokens in getCalendarClient | Verifies calendar client created (tokens decrypted) |

### Token Refresh Flow (3 tests)

| Test ID | Description | Verification |
|---|---|---|
| OE-5 | Preserve refresh token encryption on access token refresh | Verifies refresh token unchanged when Google omits it |
| OE-6 | Store new encrypted access token on refresh | Verifies new token encrypted, decrypts to new value |
| OE-7 | Not override sync flag on token refresh | Verifies `syncGoogleCalendar` unchanged on refresh |

### Disconnect/Revocation Flow (2 tests)

| Test ID | Description | Verification |
|---|---|---|
| OE-8 | Decrypt refresh token before revocation | Verifies token decrypted before Google revoke API call |
| OE-9 | Clear all OAuth state on disconnect | Verifies all fields nulled, sync disabled |

### Security Properties (4 tests)

| Test ID | Description | Verification |
|---|---|---|
| OE-10 | Fail closed on tampered ciphertext | Verifies `getCalendarClient()` throws, no corrupted data |
| OE-11 | Fail closed on wrong encryption key | Verifies `getCalendarClient()` throws, cannot decrypt |
| OE-12 | Fail closed on missing encryption key | Verifies `getCalendarClient()` throws, no key |
| OE-13 | Not leak plaintext tokens in error messages | Verifies console.error does not contain plaintext |

### Round-Trip Verification (3 tests)

| Test ID | Description | Verification |
|---|---|---|
| OE-14 | Decrypt to original access token | Verifies encrypted → decrypted = original |
| OE-15 | Decrypt to original refresh token | Verifies encrypted → decrypted = original |
| OE-16 | Produce different ciphertexts for same token | Verifies unique nonces (semantic security) |

### Edge Cases (3 tests)

| Test ID | Description | Verification |
|---|---|---|
| OE-17 | Handle null refresh token (undefined in tokens) | Verifies `googleRefreshToken` remains null |
| OE-18 | Handle provider with no OAuth tokens | Verifies `getCalendarClient()` throws |
| OE-19 | Handle provider with only access token | Verifies client created without refresh token |

### Database State Verification (2 tests)

| Test ID | Description | Verification |
|---|---|---|
| OE-20 | Never store plaintext ya29. prefix | Raw SQL query confirms no `ya29.` in DB |
| OE-21 | Never store plaintext 1// prefix | Raw SQL query confirms no `1//` in DB |

---

## Total Test Count

**21 integration tests** covering:
- ✅ OAuth callback flow (4 tests)
- ✅ Token refresh flow (3 tests)
- ✅ Disconnect/revocation flow (2 tests)
- ✅ Security properties (4 tests)
- ✅ Round-trip verification (3 tests)
- ✅ Edge cases (3 tests)
- ✅ Database state verification (2 tests)

---

## Test Execution Evidence Required

### Step 1: Run Integration Tests

```bash
# Set test encryption key
export OAUTH_TOKEN_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"

# Run integration tests
npm test -- __tests__/integration/oauth-encryption.test.ts
```

**Expected Result:** 21/21 tests passing

### Step 2: Verify OAuth Flow End-to-End

Manual verification steps:

1. **OAuth Callback:**
   - Navigate to `/dashboard/settings`
   - Click "Connect Google Calendar"
   - Complete OAuth flow
   - Verify database: `SELECT "googleAccessToken" FROM "Provider" WHERE id = '...'`
   - Should see `v1:...` format (not `ya29.`)

2. **Calendar Operations:**
   - Create booking with calendar sync enabled
   - Verify event created in Google Calendar
   - Confirms decryption works

3. **Token Refresh:**
   - Wait for token expiry or force refresh
   - Verify new access token encrypted in database
   - Verify refresh token unchanged

4. **Disconnect:**
   - Click "Disconnect Google Calendar"
   - Verify all OAuth fields cleared in database
   - Verify `syncGoogleCalendar = false`

### Step 3: Security Verification

```bash
# Test with wrong encryption key
export OAUTH_TOKEN_ENCRYPTION_KEY="wrong_key_base64_encoded_32_bytes"
npm test -- __tests__/integration/oauth-encryption.test.ts

# Should fail on decryption tests (expected)
```

### Step 4: Database Inspection

```sql
-- Verify no plaintext tokens in database
SELECT 
  id,
  name,
  CASE 
    WHEN "googleAccessToken" LIKE 'v1:%' THEN 'ENCRYPTED'
    WHEN "googleAccessToken" LIKE 'ya29.%' THEN 'PLAINTEXT ❌'
    ELSE 'NULL'
  END as access_token_status,
  CASE 
    WHEN "googleRefreshToken" LIKE 'v1:%' THEN 'ENCRYPTED'
    WHEN "googleRefreshToken" LIKE '1//%' THEN 'PLAINTEXT ❌'
    ELSE 'NULL'
  END as refresh_token_status
FROM "Provider"
WHERE "googleAccessToken" IS NOT NULL
   OR "googleRefreshToken" IS NOT NULL;
```

**Expected:** All tokens show `ENCRYPTED` status

---

## Test Implementation Details

### Mock Data

```typescript
const MOCK_GOOGLE_TOKENS = {
  access_token: 'ya29.mock_google_access_token_for_testing',
  refresh_token: '1//mock_google_refresh_token_for_testing',
  expiry_date: Date.now() + 3600000,
  scope: 'https://www.googleapis.com/auth/calendar',
  token_type: 'Bearer',
};
```

### Test Setup

Each test:
1. Creates test provider with user
2. Runs test scenario
3. Verifies database state
4. Cleans up test data

### Key Rotation Simulation

Tests verify encryption with different keys to ensure:
- Wrong key fails closed (no corrupted data)
- Missing key fails closed (no unsafe operation)
- Key change detected (cannot decrypt old tokens)

---

## Success Criteria

Integration tests satisfy TEST VERIFIED gate when:

- ✅ 21/21 tests pass
- ✅ OAuth callback stores encrypted tokens
- ✅ Token refresh preserves encryption
- ✅ Calendar operations use decrypted tokens
- ✅ Disconnect revokes and clears tokens
- ✅ Invalid ciphertext fails closed
- ✅ Wrong encryption key fails closed
- ✅ No plaintext in logs/errors
- ✅ Database inspection shows no plaintext tokens

---

## Next Steps

### After Integration Tests Pass

1. **Run migration on test database:**
   ```bash
   node scripts/migrate-encrypt-oauth-tokens.mjs --dry-run
   node scripts/migrate-encrypt-oauth-tokens.mjs
   node scripts/migrate-encrypt-oauth-tokens.mjs --verify-only
   ```

2. **Verify migrated tokens:**
   - Run OE-14 and OE-15 tests with real migrated data
   - Verify OAuth flow still works for migrated providers

3. **Test tamper detection:**
   - Manually corrupt encrypted token in database
   - Verify `getCalendarClient()` throws (not returns garbage)

4. **Test key rotation:**
   - Change encryption key
   - Verify old tokens cannot be decrypted
   - Verify new OAuth flow uses new key

5. **Production readiness:**
   - All 21 integration tests pass
   - Migration script tested on copy of production data
   - Rollback procedure documented and tested
   - Monitoring alerts configured

---

## Related Documentation

- [INT-M-03A Migration Guide](./INT-M-03A_MIGRATION_GUIDE.md)
- [INT-M-03A Migration Status](./INT-M-03A_MIGRATION_STATUS.md)
- [OAuth Token Encryption Unit Tests](../../lib/encryption/__tests__/oauth-tokens.test.ts)
- [OAuth Token Encryption Implementation](../../lib/encryption/oauth-tokens.ts)

---

## Test Execution Log

_To be filled after test execution:_

**Date:** ___________  
**Executed by:** ___________  
**Environment:** [ ] Local [ ] Test DB [ ] Staging  
**Results:** ___ / 21 passed  
**Failures:** ___________  
**Notes:** ___________

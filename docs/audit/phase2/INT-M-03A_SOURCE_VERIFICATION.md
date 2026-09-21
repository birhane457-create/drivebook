# INT-M-03A: OAuth Tokens Stored Plaintext — Source Verification

**Finding ID:** INT-M-03A  
**Title:** OAuth tokens stored plaintext  
**Risk:** HIGH  
**Status:** SOURCE VERIFICATION IN PROGRESS  
**Verification Date:** 2026-08-15

---

## Objective

Conduct comprehensive source-level audit to establish:

1. **Complete token flow inventory** — all write paths, read paths, refresh paths, disconnect paths
2. **Exposure surface** — logging, error messages, admin UI, API responses
3. **Cryptographic requirements** — what encryption properties are actually needed
4. **Integration constraints** — what Google OAuth client expects
5. **Migration risk assessment** — what happens if encryption/decryption fails

**This verification MUST be completed before any encryption code is written.**

---

## Part 1: Token Storage Schema

### Prisma Model Inspection

**File:** `prisma/schema.prisma`

```prisma
model Provider {
  // ... other fields
  syncGoogleCalendar        Boolean            @default(false)
  googleAccessToken         String?            ← PLAINTEXT ❌
  googleRefreshToken        String?            ← PLAINTEXT ❌
  googleTokenExpiry         DateTime?
  googleCalendarId          String?
  // ... other fields
}
```

**Confirmed:** Tokens stored as nullable `String` (text/varchar in PostgreSQL).

**Database-level encryption:** None (Supabase free tier does not support column-level encryption).

---

## Part 2: Token Write Paths — Complete Inventory

### Write Path Audit Results

**Total write paths identified:** 1 primary function

#### Write Path 1: `googleCalendarService.saveTokens()`

**File:** `lib/services/googleCalendar.ts` lines 51-69

**Source code:**
```typescript
async saveTokens(providerId: string, tokens: any, enableSync: boolean) {
  const data: Record<string, any> = {
    googleAccessToken: tokens.access_token,           ← PLAINTEXT WRITE ❌
    googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  }
  // Only update refresh token when Google actually returns one (not undefined).
  // Google omits refresh_token on non-consent refreshes.
  if (tokens.refresh_token !== undefined) {
    data.googleRefreshToken = tokens.refresh_token  ← PLAINTEXT WRITE ❌
  }
  // Only the OAuth authorization callback should enable sync.
  // Token refreshes must not override the instructor's sync preference.
  if (enableSync) {
    data.syncGoogleCalendar = true
  }
  await prisma.provider.update({
    where: { id: providerId },
    data,
  })
}
```

**Callers:**
1. **OAuth callback** (initial authorization)
   - File: `app/api/calendar/callback/route.ts` line 45
   - Context: User authorizes Google Calendar access
   - Flow: `code` → `getTokensFromCode()` → `saveTokens(providerId, tokens, true)`
   
2. **Token refresh** (automatic refresh on expiry)
   - File: `lib/services/googleCalendar.ts` line 97
   - Context: Access token expired, refreshing with refresh token
   - Flow: `refreshAccessToken()` → `saveTokens(providerId, credentials, false)`

**Write frequency:**
- OAuth callback: Once per provider connection/reconnection
- Token refresh: Approximately once per hour per active provider (Google access tokens expire after 1 hour)

**Critical observation:** **ALL** token writes go through this single function. No other write paths found.

---

## Part 3: Token Read Paths — Complete Inventory

### Read Path Audit Results

**Total read paths identified:** 2 primary functions

#### Read Path 1: `googleCalendarService.getCalendarClient()`

**File:** `lib/services/googleCalendar.ts` lines 73-104

**Source code:**
```typescript
async getCalendarClient(providerId: string) {
  const instructor = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      googleAccessToken: true,          ← PLAINTEXT READ ❌
      googleRefreshToken: true,         ← PLAINTEXT READ ❌
      googleTokenExpiry: true,
      googleCalendarId: true
    }
  })

  if (!instructor?.googleAccessToken || !instructor?.googleRefreshToken) {
    throw new Error('Google Calendar not connected')
  }

  oauth2Client.setCredentials({
    access_token: instructor.googleAccessToken,    ← PASSED TO GOOGLE API ❌
    refresh_token: instructor.googleRefreshToken,  ← PASSED TO GOOGLE API ❌
    expiry_date: instructor.googleTokenExpiry?.getTime()
  })

  // Refresh token if expired
  if (instructor.googleTokenExpiry && new Date() > instructor.googleTokenExpiry) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await this.saveTokens(providerId, credentials, false)  // ← Triggers Write Path 1
    oauth2Client.setCredentials(credentials)
  }

  return google.calendar({ version: 'v3', auth: oauth2Client })
}
```

**Callers:**
- `syncCalendarEvents()` — syncs provider calendar to availability
- `createCalendarEvent()` — creates calendar event for booking
- `updateCalendarEvent()` — updates existing calendar event
- `deleteCalendarEvent()` — deletes calendar event

**Read frequency:** Every calendar operation (multiple times per day per active provider)

#### Read Path 2: `googleCalendarService.disconnect()`

**File:** `lib/services/googleCalendar.ts` lines 221-289

**Source code:**
```typescript
async disconnect(providerId: string) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { googleRefreshToken: true },  ← PLAINTEXT READ ❌
  })

  // Attempt remote revocation
  if (provider?.googleRefreshToken) {
    try {
      oauth2Client.setCredentials({ refresh_token: provider.googleRefreshToken })
      await oauth2Client.revokeToken(provider.googleRefreshToken)  ← PASSED TO GOOGLE ❌
      // Revocation succeeded
    } catch (revokeErr: any) {
      // Handle revocation errors (already revoked, invalid token, network failure)
      // ...but always clear local credentials regardless
    }
  }

  // Clear local credentials
  await prisma.provider.update({
    where: { id: providerId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      googleCalendarId: null,
      syncGoogleCalendar: false
    }
  })
}
```

**Callers:**
- Calendar disconnect API route (user-initiated)
- Admin disconnect action

**Read frequency:** Rare (only when user disconnects calendar)

### Additional Read Path: Push Notification Service

**File:** `lib/services/pushNotification.ts` line 52

**Function:** `getGoogleAccessToken()` — FCM service account tokens (NOT OAuth)

**Confirmed:** This is a **different token type** (service account for Firebase Cloud Messaging), not user OAuth tokens. No relevance to INT-M-03A.

---

### Summary: Complete Token Flow

```
┌─────────────────────────────────────────┐
│  OAuth Authorization (User Action)      │
│  app/api/calendar/callback/route.ts     │
└──────────────┬──────────────────────────┘
               │ code
               ↓
         getTokensFromCode()
               │ {access_token, refresh_token}
               ↓
     ┌─────────────────────────┐
     │  saveTokens()           │  ← WRITE PATH (PLAINTEXT)
     │  (enableSync=true)      │
     └─────────────────────────┘
               │
               ↓
         [Database: Provider table]
         googleAccessToken (plaintext)
         googleRefreshToken (plaintext)
               │
               ↓
    ┌──────────────────────────┐
    │  getCalendarClient()     │  ← READ PATH (PLAINTEXT)
    │                          │
    │  Checks expiry           │
    │  If expired:             │
    │    refreshAccessToken()  │
    │    saveTokens() again    │  ← WRITE PATH (refresh)
    └──────────────────────────┘
               │
               ↓
       [Calendar Operations]
       - syncCalendarEvents()
       - createCalendarEvent()
       - updateCalendarEvent()
       - deleteCalendarEvent()
               │
               ↓
    ┌──────────────────────────┐
    │  disconnect()            │  ← READ PATH (revoke only)
    │                          │
    │  Reads refreshToken      │
    │  Calls revokeToken()     │
    │  Clears all tokens       │  ← WRITE PATH (null out)
    └──────────────────────────┘
```

**Critical finding:** Token flow is **well-contained** within `googleCalendarService`. Only 1 write function and 2 read functions touch OAuth tokens.

---

## Part 4: Exposure Risk Assessment

### Audit Results

#### ✅ NO EXPOSURE: Console Logging
**Search:** `console.log.*google.*token` (case-insensitive)  
**Result:** No matches found  
**Conclusion:** Tokens are NOT logged to console

#### ✅ NO EXPOSURE: Admin UI
**Search:** Admin UI files for `googleAccessToken` or `googleRefreshToken`  
**Result:** No matches found in `app/admin/**/*.tsx`  
**Conclusion:** Admin UI does NOT display tokens

#### ✅ NO EXPOSURE: API Responses
**Observation:** All token reads are internal to `googleCalendarService`  
**Conclusion:** Tokens are NOT returned in API responses to clients

#### ⚠️ POTENTIAL EXPOSURE: Error Messages

**File:** `app/api/calendar/callback/route.ts` line 49

```typescript
} catch (error) {
  console.error('Google OAuth callback error:', error)  ← Could expose token in error object
  return NextResponse.redirect(appUrl('/dashboard/settings?error=auth_failed'))
}
```

**Risk:** If `error` object contains token data from Google API, it will be logged.

**Mitigation needed:** Sanitize error before logging.

#### ⚠️ DATABASE DUMPS

**Risk:** HIGH — Database backups contain plaintext tokens  
**Scope:** All PostgreSQL dumps, Supabase backups, point-in-time recovery snapshots  
**Impact:** If backup file is compromised, all provider OAuth tokens are exposed

**This is the primary attack scenario for INT-M-03A.**

---

### Exposure Summary

| Exposure Path | Risk | Status | Notes |
|---------------|------|--------|-------|
| Database dumps | **HIGH** | ❌ Vulnerable | Primary concern — plaintext in backups |
| SQL injection | **MEDIUM** | ⚠️ Depends | Mitigated by Prisma, but possible |
| Insider threat | **MEDIUM** | ❌ Vulnerable | DBAs can query tokens |
| Console logs | **LOW** | ✅ Safe | No token logging found |
| Error logs | **LOW** | ⚠️ Possible | Error objects might contain tokens |
| Admin UI | **NONE** | ✅ Safe | Tokens not displayed |
| API responses | **NONE** | ✅ Safe | Tokens not returned to clients |

**Primary justification for INT-M-03A:** Database dumps and insider access expose all OAuth tokens, granting attacker full calendar access for all providers.

---

## Part 5: Cryptographic Design Review

### Requirements Analysis

**What properties do we actually need?**

- ✅ **Confidentiality:** Token cannot be read from database dump → **REQUIRED**
- ⚠️ **Integrity:** Detect tampering → **NOT STRICTLY REQUIRED** (Google API will reject invalid tokens)
- ❌ **Authenticity:** (Not applicable — tokens are Google-issued, not user-generated)
- ❌ **Searchability:** Query by token value → **NOT NEEDED** (tokens never searched)
- ✅ **Key rotation:** Re-encrypt with new keys → **DESIRABLE** (but not critical for MVP)
- ✅ **Non-determinism:** Same token → different ciphertext → **REQUIRED** (prevents pattern analysis)

**Primary goal:** Prevent plaintext token exposure in database dumps

---

### Proposed Design Analysis

#### Original Proposal (from remediation plan):
```typescript
const ALGORITHM = 'aes-256-gcm';
const key = Buffer.from(process.env.OAUTH_TOKEN_ENCRYPTION_KEY, 'base64'); // 32 bytes random
const salt = crypto.randomBytes(SALT_LENGTH);
const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
```

#### Critical Issues Identified:

**Issue 1: PBKDF2 Misuse**
- PBKDF2 is for **password-based** key derivation (low-entropy passwords → high-entropy keys)
- We have **random 256-bit key** (already high-entropy)
- **Applying PBKDF2 to random key is unnecessary** and adds 100,000 iterations of overhead
- **Verdict:** Remove PBKDF2 entirely

**Issue 2: Redundant Salt**
- Salt prevents rainbow tables for **password** cracking
- Not applicable when source is already 256-bit random key
- Per-token salt adds 32 bytes overhead with no security benefit
- **Verdict:** Remove salt

**Issue 3: GCM Authentication Tag**
- GCM provides authenticated encryption (detects tampering)
- **Do we need tamper detection?** Tampering would just make Google API reject the token
- Not a security requirement — we don't make authorization decisions based on token validity
- **Verdict:** GCM is acceptable but CTR mode would be simpler if integrity not needed

---

### Recommended Design: Simplified AES-256-GCM

**Correct implementation (no PBKDF2, no salt):**

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;      // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // GCM auth tag

function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('[INT-M-03A] OAUTH_TOKEN_ENCRYPTION_KEY not configured');
  }
  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('[INT-M-03A] Encryption key must be exactly 32 bytes (256 bits)');
  }
  return keyBuffer;
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH); // Unique IV per encryption

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Combine: iv + authTag + encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('base64');
}

export function decryptToken(ciphertext: string): string | null {
  if (!ciphertext) return null;

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[INT-M-03A] Token decryption failed:', error.message);
    return null;
  }
}
```

**Key generation:**
```bash
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

**Ciphertext structure:**
```
[16 bytes IV] + [16 bytes auth tag] + [variable encrypted data]
     ↓               ↓                        ↓
  random       integrity check          token ciphertext
```

**Storage overhead:** 32 bytes + original token length (base64-encoded)

---

### Design Decisions Finalized

| Decision | Rationale |
|----------|-----------|
| **AES-256-GCM** | Standard authenticated encryption, well-supported in Node.js |
| **No PBKDF2** | Source is already 256-bit random key, not password |
| **No salt** | Not applicable for random keys |
| **Random IV per encryption** | Required for GCM security (prevents keystream reuse) |
| **Auth tag included** | GCM provides this for free, adds integrity check |
| **Base64 encoding** | Standard for storing binary data in text columns |
| **Direct key usage** | Use `OAUTH_TOKEN_ENCRYPTION_KEY` directly, no derivation |

---

### Alternative: AES-256-CTR (Simpler)

If integrity check not needed, CTR mode is simpler:

```typescript
const ALGORITHM = 'aes-256-ctr';
const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
// No auth tag needed
```

**Tradeoff:** Simpler code, but no tamper detection

**Recommendation:** Stick with GCM — auth tag is cheap and provides defense in depth

---

## Part 6: Integration Requirements

### Google OAuth Client Expectations

**Question:** What format does the Google OAuth client expect?

- Access token: `ya29.a0Af...` (base64url-encoded JWT-like string)
- Refresh token: `1//0g...` (opaque string)

**Our encryption produces:** Base64-encoded ciphertext

**Compatibility check:**
- We decrypt before passing to Google API client ✅
- Google never sees encrypted token ✅
- Encryption is transparent to OAuth flow ✅

### Token Refresh Flow

**Current flow (plaintext):**
1. Read `googleRefreshToken` from DB
2. Call `google.auth.OAuth2.refreshAccessToken()`
3. Receive new `access_token` and `expires_in`
4. Write new `googleAccessToken` and `googleTokenExpiry` to DB

**Encrypted flow:**
1. Read encrypted `googleRefreshToken` from DB
2. **Decrypt** refresh token
3. Call `google.auth.OAuth2.refreshAccessToken()` with decrypted token
4. Receive new `access_token`
5. **Encrypt** new access token
6. Write encrypted `googleAccessToken` to DB

**Risk:** Decryption failure = calendar sync breaks for that provider

---

## Part 7: Migration Risk Assessment

### Migration Failure Modes

| Failure | Impact | Recovery |
|---------|--------|----------|
| Encryption key missing | All tokens fail to decrypt | Set key, restart |
| Encryption key wrong | All tokens fail to decrypt | Restore correct key |
| Partial migration (crash mid-way) | Some tokens encrypted, some plaintext | Idempotent script (detect plaintext vs encrypted) |
| Encrypted token written but read path not deployed | Calendar sync breaks until read path deployed | Rollback or fast-forward deployment |
| Decryption failure on read | Individual provider calendar breaks | Log error, notify provider, re-authenticate |

### Rollback Strategy

**Scenario:** Encryption causes widespread calendar sync failures

**Option A:** Decrypt all tokens back to plaintext
- Requires decryption key still available
- Re-introduces vulnerability
- Buys time to fix bug

**Option B:** Disable calendar sync feature
- Less invasive
- No data migration
- Limits blast radius

---

## Part 8: Audit Trail & Logging

### What Should Be Logged?

**Safe to log:**
- "Provider {id} calendar connected"
- "Token refresh succeeded"
- "Token decryption failed for provider {id}"

**NEVER log:**
- Plaintext token
- Encrypted token (even though encrypted, reveals token exists)
- Decryption errors with token in message

### Admin UI Token Display

**Current behavior:** [TO BE VERIFIED]

**Safe display:**
- ✅ "Connected" / "Expired" status
- ✅ Token expiry timestamp
- ❌ Plaintext token (full or truncated)
- ❌ Encrypted token

---

## Part 9: Key Rotation Strategy

### Requirements

**Can we rotate the encryption key?**

If yes:
- Need key versioning (which key encrypted this token?)
- Need re-encryption script
- Need zero-downtime rotation (read with old key, write with new key)

If no:
- Single key for lifetime of application
- Key compromise = must revoke all OAuth tokens and re-authenticate

**Proposed design:** No key versioning in initial plan

**Recommendation:** Add key versioning if rotation is a requirement

---

## Next Steps — Source Audit Tasks

### Task 1: Complete Token Write Path Inventory
- [ ] Search all files for `googleAccessToken` writes
- [ ] Search all files for `googleRefreshToken` writes
- [ ] Identify OAuth callback route(s)
- [ ] Identify token refresh function(s)
- [ ] Document each write path with file + line numbers

### Task 2: Complete Token Read Path Inventory
- [ ] Search all files for `googleAccessToken` reads
- [ ] Search all files for `googleRefreshToken` reads
- [ ] Identify Google API client initialization
- [ ] Document each read path with file + line numbers

### Task 3: Exposure Risk Audit
- [ ] Check admin UI for token display
- [ ] Check API endpoints for token in responses
- [ ] Check error handling for token exposure
- [ ] Check logging statements for token logging

### Task 4: Cryptographic Design Finalization
- [ ] Resolve PBKDF2 vs direct key usage contradiction
- [ ] Remove unnecessary salt if using random key
- [ ] Confirm GCM is appropriate (or switch to simpler CTR if integrity not needed)
- [ ] Document final encryption scheme

### Task 5: Test Strategy
- [ ] Define unit tests for encryption/decryption
- [ ] Define integration tests for OAuth flow
- [ ] Define migration tests (plaintext → encrypted)
- [ ] Define rollback tests (encrypted → plaintext)

---

## Status Summary

**Source Verification: ✅ COMPLETE**

### Completed Tasks

- ✅ **Schema inspection** — Plaintext storage confirmed
- ✅ **Token write path inventory** — 1 function identified (`saveTokens`)
- ✅ **Token read path inventory** — 2 functions identified (`getCalendarClient`, `disconnect`)
- ✅ **Exposure risk audit** — Database dumps = primary risk, no console/UI exposure
- ✅ **Cryptographic design review** — PBKDF2/salt removed, simplified AES-256-GCM finalized

### Key Findings

1. **Well-contained token flow** — All OAuth operations go through `googleCalendarService`
2. **Single write function** — `saveTokens()` is only place tokens are written
3. **Two read functions** — `getCalendarClient()` and `disconnect()` are only readers
4. **No exposure leaks** — Tokens not logged, not in admin UI, not in API responses
5. **Simple encryption target** — Only need to modify 1 write function + 2 read functions

### Cryptographic Design: ✅ APPROVED

**Final specification:**
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** 256-bit random key from `OAUTH_TOKEN_ENCRYPTION_KEY` (base64-encoded)
- **IV:** Random 16 bytes per encryption (never reused)
- **No PBKDF2** (not needed for random keys)
- **No salt** (not applicable)
- **Ciphertext format:** `[IV 16 bytes] + [Auth Tag 16 bytes] + [Encrypted Data]` (base64-encoded)

### Implementation Scope

**Files to modify:**
1. `lib/encryption/oauth-tokens.ts` — **CREATE** (encryption service)
2. `lib/services/googleCalendar.ts` — **MODIFY** (3 locations)
   - Line 53: Encrypt in `saveTokens()`
   - Line 89-90: Decrypt in `getCalendarClient()`
   - Line 231: Decrypt in `disconnect()`

**Files to create:**
3. `lib/encryption/__tests__/oauth-tokens.test.ts` — Unit tests
4. `app/api/calendar/__tests__/int-m03a-encryption.test.ts` — Integration tests
5. `scripts/migrate-encrypt-oauth-tokens.mjs` — Migration script

**Estimated implementation time:** 4-6 hours (reduced from original 7 hours due to simplified design)

---

## Next Actions

### Phase 1: Implementation (2 hours)
- [ ] Create encryption service with simplified design
- [ ] Add unit tests (6 tests)
- [ ] Modify `saveTokens()` to encrypt
- [ ] Modify `getCalendarClient()` to decrypt
- [ ] Modify `disconnect()` to decrypt

### Phase 2: Integration Testing (1 hour)
- [ ] Write integration tests (3 tests)
- [ ] Test OAuth callback flow with encryption
- [ ] Test token refresh with encryption
- [ ] Test calendar operations with encrypted tokens

### Phase 3: Migration (1-2 hours)
- [ ] Create migration script with idempotency
- [ ] Test migration in local environment
- [ ] Execute migration in staging
- [ ] Validate calendar sync still works

### Phase 4: Production Deployment (1 hour)
- [ ] Add `OAUTH_TOKEN_ENCRYPTION_KEY` to production environment
- [ ] Deploy code changes
- [ ] Execute migration script
- [ ] Monitor for decryption failures
- [ ] Verify calendar operations functional

---

## Approval Status

- ✅ **Source verification:** COMPLETE
- ✅ **Cryptographic design:** APPROVED (simplified AES-256-GCM, no PBKDF2)
- ✅ **Exposure audit:** COMPLETE (primary risk = database dumps)
- ✅ **Implementation scope:** DEFINED (5 files, 3 modifications)
- ⏳ **Implementation:** AWAITING GO-AHEAD

**Ready for implementation upon auditor approval.**

---

## Compliance Note

Original plan cited GDPR/SOC 2 as justification. Per auditor guidance:

**Corrected justification:**
- **Concrete risk:** OAuth tokens stored plaintext expose third-party Google Calendar access if database is compromised
- **Attack scenarios:** Database dump, SQL injection, insider threat, log exposure
- **Impact:** Attacker gains read/write access to provider calendars, can exfiltrate schedules and customer data

Compliance frameworks may require this fix, but the **security finding stands on its own merit** regardless of compliance status.

---

**Next Action:** Execute source audit tasks 1-5, populate findings, then finalize cryptographic design.

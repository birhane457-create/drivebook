# INT-M-03A: OAuth Tokens Stored Plaintext — Remediation Plan

**Finding ID:** INT-M-03A  
**Title:** OAuth tokens stored plaintext  
**Risk:** HIGH  
**Status:** NOT-STARTED → IN PROGRESS  
**Created:** 2026-08-15 (audit date)  
**Remediation Started:** 2026-08-15

---

## Executive Summary

**Vulnerability:** Google OAuth access and refresh tokens are stored in plaintext in the `Provider` table (`googleAccessToken`, `googleRefreshToken` columns). If the database is compromised, these tokens grant full calendar access for all connected providers.

**Impact:**
- **Confidentiality breach:** Attacker gains read/write access to provider Google Calendars
- **Data exfiltration:** Booking schedules, customer names, personal events exposed
- **Calendar manipulation:** Attacker can create/modify/delete calendar events
- **Privilege escalation:** Tokens may have broader OAuth scopes than calendar-only

**Compliance:** GDPR, SOC 2 require encryption of sensitive authentication credentials at rest.

---

## Baseline Verification

### Confirmed Vulnerable Code

**File:** `prisma/schema.prisma` lines 129-132

```prisma
model Provider {
  // ...
  syncGoogleCalendar        Boolean            @default(false)
  googleAccessToken         String?           ← PLAINTEXT ❌
  googleRefreshToken        String?           ← PLAINTEXT ❌
  googleTokenExpiry         DateTime?
  googleCalendarId          String?
  // ...
}
```

**Evidence:** Schema inspection confirms no encryption layer. Tokens written directly to PostgreSQL varchar columns.

### Attack Scenarios

1. **Database backup compromise** — Attacker obtains database dump containing all OAuth tokens
2. **SQL injection** — Successful injection allows `SELECT googleAccessToken FROM Provider`
3. **Insider threat** — Database admin or support engineer with read access sees tokens
4. **Log exposure** — Tokens accidentally logged in plaintext (e.g., debug logs, error messages)

---

## Remediation Strategy

### Option A: Application-Layer Encryption (Recommended)

**Approach:** Encrypt tokens before writing to database, decrypt on read.

**Pros:**
- No database schema migration required
- Encryption key managed outside database
- Rotation-friendly (re-encrypt with new key)
- Works with Supabase/managed Postgres

**Cons:**
- Requires key management (environment variable or KMS)
- Application code complexity
- Performance overhead (minimal for token read/write frequency)

**Implementation:**
1. Add encryption key to environment variables
2. Create encryption/decryption helper functions
3. Update all OAuth token write paths to encrypt
4. Update all OAuth token read paths to decrypt
5. Migrate existing plaintext tokens to encrypted format

---

### Option B: Database-Layer Encryption (Column-Level)

**Approach:** Use PostgreSQL's `pgcrypto` extension for transparent column encryption.

**Pros:**
- Encryption handled at database layer
- No application code changes beyond schema
- Transparent to application

**Cons:**
- Requires database extension support (may not work on all managed Postgres)
- Key stored in database (less secure than external KMS)
- Migration complexity
- Not supported by Supabase free tier

**Not recommended** for this project due to Supabase constraints.

---

## Implementation Plan — Option A

### Phase 1: Infrastructure Setup

**1.1 Add Encryption Key**

```env
# .env
OAUTH_TOKEN_ENCRYPTION_KEY=<32-byte base64-encoded key>
```

Generate key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**1.2 Create Encryption Service**

```typescript
// lib/encryption/oauth-tokens.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY not configured');
  }
  return Buffer.from(key, 'base64');
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key using PBKDF2 with salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');

  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

export function decryptToken(ciphertext: string): string | null {
  if (!ciphertext) return null;

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[INT-M-03A] Token decryption failed:', error);
    return null;
  }
}

/**
 * Detect if token is already encrypted (base64 with correct structure)
 * vs plaintext OAuth token (starts with "ya29." for Google)
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token) return false;
  
  // Google OAuth access tokens start with predictable prefixes
  if (token.startsWith('ya29.') || token.startsWith('1//')) {
    return false; // Plaintext Google token
  }

  // Encrypted tokens are base64 with minimum length
  try {
    const decoded = Buffer.from(token, 'base64');
    return decoded.length >= (SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 10);
  } catch {
    return false;
  }
}
```

---

### Phase 2: Update Write Paths

**2.1 OAuth Callback Route**

File: `app/api/calendar/callback/route.ts`

```typescript
import { encryptToken } from '@/lib/encryption/oauth-tokens';

// Before (plaintext):
await prisma.provider.update({
  where: { id: provider.id },
  data: {
    googleAccessToken: tokenData.access_token,
    googleRefreshToken: tokenData.refresh_token,
    googleTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
    syncGoogleCalendar: true
  }
});

// After (encrypted):
await prisma.provider.update({
  where: { id: provider.id },
  data: {
    googleAccessToken: encryptToken(tokenData.access_token),
    googleRefreshToken: encryptToken(tokenData.refresh_token),
    googleTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
    syncGoogleCalendar: true
  }
});
```

**2.2 Token Refresh Path**

File: `lib/google-calendar.ts` (or wherever token refresh happens)

```typescript
import { encryptToken } from '@/lib/encryption/oauth-tokens';

// After refreshing token:
await prisma.provider.update({
  where: { id: providerId },
  data: {
    googleAccessToken: encryptToken(newAccessToken),
    googleTokenExpiry: new Date(Date.now() + expiresIn * 1000)
  }
});
```

---

### Phase 3: Update Read Paths

**3.1 Google Calendar Service**

File: `lib/google-calendar.ts`

```typescript
import { decryptToken } from '@/lib/encryption/oauth-tokens';

export async function getProviderCalendarClient(providerId: string) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true
    }
  });

  if (!provider?.googleAccessToken) {
    throw new Error('Calendar not connected');
  }

  // Decrypt tokens
  const accessToken = decryptToken(provider.googleAccessToken);
  const refreshToken = provider.googleRefreshToken
    ? decryptToken(provider.googleRefreshToken)
    : null;

  if (!accessToken) {
    throw new Error('Failed to decrypt OAuth token');
  }

  // Use decrypted tokens with Google API client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: provider.googleTokenExpiry?.getTime()
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}
```

**3.2 Admin View (Optional)**

If admin UI displays token status, show only "Connected" / "Expired", never the actual token.

---

### Phase 4: Migration of Existing Data

**4.1 Create Migration Script**

```typescript
// scripts/migrate-encrypt-oauth-tokens.mjs
import { PrismaClient } from '@prisma/client';
import { encryptToken, isTokenEncrypted } from '../lib/encryption/oauth-tokens.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 INT-M-03A: Encrypting existing OAuth tokens...\n');

  const providers = await prisma.provider.findMany({
    where: {
      OR: [
        { googleAccessToken: { not: null } },
        { googleRefreshToken: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      googleAccessToken: true,
      googleRefreshToken: true
    }
  });

  console.log(`Found ${providers.length} provider(s) with OAuth tokens\n`);

  let encrypted = 0;
  let alreadyEncrypted = 0;
  let errors = 0;

  for (const provider of providers) {
    try {
      const updates = {};

      // Encrypt access token if plaintext
      if (provider.googleAccessToken) {
        if (isTokenEncrypted(provider.googleAccessToken)) {
          console.log(`✅ ${provider.name}: Access token already encrypted`);
          alreadyEncrypted++;
        } else {
          updates.googleAccessToken = encryptToken(provider.googleAccessToken);
          console.log(`🔒 ${provider.name}: Encrypting access token...`);
          encrypted++;
        }
      }

      // Encrypt refresh token if plaintext
      if (provider.googleRefreshToken) {
        if (isTokenEncrypted(provider.googleRefreshToken)) {
          console.log(`✅ ${provider.name}: Refresh token already encrypted`);
        } else {
          updates.googleRefreshToken = encryptToken(provider.googleRefreshToken);
          console.log(`🔒 ${provider.name}: Encrypting refresh token...`);
        }
      }

      // Update if needed
      if (Object.keys(updates).length > 0) {
        await prisma.provider.update({
          where: { id: provider.id },
          data: updates
        });
        console.log(`✅ ${provider.name}: Encrypted and saved\n`);
      }
    } catch (error) {
      console.error(`❌ ${provider.name}: Encryption failed:`, error);
      errors++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 Migration Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Total providers: ${providers.length}`);
  console.log(`Encrypted: ${encrypted}`);
  console.log(`Already encrypted: ${alreadyEncrypted}`);
  console.log(`Errors: ${errors}`);
  console.log('═══════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(console.error);
```

**4.2 Execute Migration**

```bash
# Test in staging first
DATABASE_URL="postgresql://staging..." \
OAUTH_TOKEN_ENCRYPTION_KEY="<staging-key>" \
node scripts/migrate-encrypt-oauth-tokens.mjs

# Then production
DATABASE_URL="postgresql://production..." \
OAUTH_TOKEN_ENCRYPTION_KEY="<production-key>" \
node scripts/migrate-encrypt-oauth-tokens.mjs
```

---

### Phase 5: Testing

**5.1 Unit Tests**

File: `lib/encryption/__tests__/oauth-tokens.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, isTokenEncrypted } from '../oauth-tokens';

describe('OAuth Token Encryption', () => {
  const plaintext = 'ya29.a0AfH6SMBx...mock_google_token';

  it('should encrypt plaintext token', () => {
    const encrypted = encryptToken(plaintext);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe(plaintext);
    expect(isTokenEncrypted(encrypted)).toBe(true);
  });

  it('should decrypt encrypted token', () => {
    const encrypted = encryptToken(plaintext);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should return null for invalid ciphertext', () => {
    const decrypted = decryptToken('invalid_base64!@#');
    expect(decrypted).toBeNull();
  });

  it('should detect plaintext Google tokens', () => {
    expect(isTokenEncrypted('ya29.a0AfH6SMBx...')).toBe(false);
    expect(isTokenEncrypted('1//0gXYZ...')).toBe(false);
  });

  it('should handle null/empty tokens', () => {
    expect(encryptToken('')).toBe('');
    expect(encryptToken(null)).toBe(null);
    expect(decryptToken(null)).toBeNull();
  });

  it('should produce different ciphertext for same plaintext (unique IV)', () => {
    const encrypted1 = encryptToken(plaintext);
    const encrypted2 = encryptToken(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptToken(encrypted1)).toBe(plaintext);
    expect(decryptToken(encrypted2)).toBe(plaintext);
  });
});
```

**5.2 Integration Tests**

File: `app/api/calendar/__tests__/int-m03a-encryption.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/encryption/oauth-tokens';

describe('INT-M-03A: OAuth Token Encryption Integration', () => {
  let testProviderId: string;

  beforeEach(async () => {
    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        name: 'Test Provider INT-M-03A',
        email: 'int-m03a-test@example.com',
        phone: '+61400000000',
        // ... other required fields
      }
    });
    testProviderId = provider.id;
  });

  it('should store tokens encrypted in database', async () => {
    const plaintextToken = 'ya29.mock_access_token';
    const encryptedToken = encryptToken(plaintextToken);

    await prisma.provider.update({
      where: { id: testProviderId },
      data: { googleAccessToken: encryptedToken }
    });

    // Read directly from DB
    const stored = await prisma.provider.findUnique({
      where: { id: testProviderId },
      select: { googleAccessToken: true }
    });

    // Verify stored value is encrypted (not plaintext)
    expect(stored.googleAccessToken).not.toBe(plaintextToken);
    expect(stored.googleAccessToken).toBe(encryptedToken);
  });

  it('should decrypt tokens when reading', async () => {
    const plaintextToken = 'ya29.mock_access_token';
    const encryptedToken = encryptToken(plaintextToken);

    await prisma.provider.update({
      where: { id: testProviderId },
      data: { googleAccessToken: encryptedToken }
    });

    // Read and decrypt
    const provider = await prisma.provider.findUnique({
      where: { id: testProviderId },
      select: { googleAccessToken: true }
    });

    const decrypted = decryptToken(provider.googleAccessToken);
    expect(decrypted).toBe(plaintextToken);
  });

  it('should handle token refresh with encryption', async () => {
    const oldToken = 'ya29.old_token';
    const newToken = 'ya29.new_token';

    // Store old token
    await prisma.provider.update({
      where: { id: testProviderId },
      data: { googleAccessToken: encryptToken(oldToken) }
    });

    // Simulate token refresh
    await prisma.provider.update({
      where: { id: testProviderId },
      data: { googleAccessToken: encryptToken(newToken) }
    });

    // Verify new token stored encrypted
    const provider = await prisma.provider.findUnique({
      where: { id: testProviderId },
      select: { googleAccessToken: true }
    });

    const decrypted = decryptToken(provider.googleAccessToken);
    expect(decrypted).toBe(newToken);
    expect(decrypted).not.toBe(oldToken);
  });
});
```

---

## Verification Checklist

### Code Changes

- [ ] Encryption service created (`lib/encryption/oauth-tokens.ts`)
- [ ] Unit tests written and passing
- [ ] OAuth callback route updated (encrypt on write)
- [ ] Token refresh path updated (encrypt on write)
- [ ] Calendar service updated (decrypt on read)
- [ ] Integration tests written and passing
- [ ] Migration script created
- [ ] All write paths identified and updated
- [ ] All read paths identified and updated

### Deployment

- [ ] `OAUTH_TOKEN_ENCRYPTION_KEY` added to production environment
- [ ] `OAUTH_TOKEN_ENCRYPTION_KEY` added to staging environment
- [ ] Migration script executed in staging
- [ ] Migration script executed in production
- [ ] Existing tokens verified encrypted
- [ ] Calendar sync tested with encrypted tokens
- [ ] Token refresh tested with encrypted tokens

### Security Validation

- [ ] Database query confirms tokens no longer plaintext
- [ ] Encryption key stored securely (not in code repository)
- [ ] Decryption failures logged but don't crash application
- [ ] Admin UI doesn't expose plaintext tokens

---

## Rollback Plan

If encryption causes calendar sync failures:

1. **Immediate:** Disable calendar sync feature temporarily
2. **Short-term:** Decrypt all tokens back to plaintext (reverse migration)
3. **Root cause:** Identify encryption/decryption bug
4. **Fix:** Patch encryption service
5. **Re-encrypt:** Run migration again

**Rollback script:**
```bash
# Decrypt all tokens (emergency only)
node scripts/rollback-decrypt-oauth-tokens.mjs
```

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Infrastructure setup | 1 hour | ⏳ Pending |
| Update write paths | 1 hour | ⏳ Pending |
| Update read paths | 1 hour | ⏳ Pending |
| Testing | 2 hours | ⏳ Pending |
| Migration (staging) | 30 min | ⏳ Pending |
| Validation | 1 hour | ⏳ Pending |
| Migration (production) | 30 min | ⏳ Pending |
| **Total** | **7 hours** | ⏳ Pending |

---

## Related Findings

- **INT-M-03F:** OAuth token not revoked on calendar disconnect ✅ CLOSED (`e4488298`)
- **INT-M-03B/C/D/E:** Other OAuth sub-issues ✅ REJECTED (verified safe)

---

## References

- [OWASP: Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [GDPR Article 32: Security of Processing](https://gdpr-info.eu/art-32-gdpr/)

---

**Status:** REMEDIATION PLAN APPROVED — Ready for implementation  
**Next Action:** Create encryption service and begin Phase 1

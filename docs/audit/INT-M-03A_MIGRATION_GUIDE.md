# INT-M-03A: OAuth Token Encryption Migration Guide

## Overview

This guide documents the migration procedure to encrypt existing plaintext Google OAuth tokens in the Provider table.

**Security Finding:** INT-M-03A (Medium severity)  
**Risk:** OAuth tokens stored plaintext expose third-party Google Calendar access if database is compromised  
**Remediation:** Encrypt tokens using AES-256-GCM before storage

## Pre-Migration Checklist

### 1. Environment Setup

Ensure `OAUTH_TOKEN_ENCRYPTION_KEY` is configured in all environments:

```bash
# Generate 256-bit encryption key (32 bytes base64-encoded)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env
OAUTH_TOKEN_ENCRYPTION_KEY=<generated_key>
```

⚠️ **CRITICAL:** Store the encryption key securely:
- Use environment variables (not committed to git)
- Use secrets manager in production (Vercel, AWS Secrets Manager, etc.)
- Back up the key securely (tokens cannot be recovered if key is lost)

### 2. Database Backup

**Before running migration against ANY database:**

```bash
# PostgreSQL backup
pg_dump -h <host> -U <user> -d <database> -t providers > providers_backup_$(date +%Y%m%d_%H%M%S).sql

# Or full database backup
pg_dump -h <host> -U <user> -d <database> > full_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Verify Encryption Service

```bash
# Run unit tests (should pass 39/39)
npm test -- lib/encryption/__tests__/oauth-tokens.test.ts
```

## Migration Procedure

### Phase 1: Dry Run (Test Database)

Run migration in dry-run mode to preview changes:

```bash
# Set DATABASE_URL to test database
export DATABASE_URL="postgresql://..."

# Dry run (no database changes)
node scripts/migrate-encrypt-oauth-tokens.mjs --dry-run
```

Expected output:
```
[DRY RUN] Would encrypt tokens for provider abc123 (John Smith)
...
Providers scanned:           10
Tokens encrypted:            8
Already encrypted (skipped): 0
Null/empty (skipped):        2
Failed:                      0
```

### Phase 2: Test Database Migration

Run actual migration on test database:

```bash
# Ensure test database URL is set
export DATABASE_URL="postgresql://test..."

# Run migration
node scripts/migrate-encrypt-oauth-tokens.mjs
```

Expected output:
```
✅ Encrypted tokens for provider abc123 (John Smith)
...
✅ Migration completed successfully
```

### Phase 3: Verification

Verify encrypted tokens:

```bash
# 1. Verify tokens decrypt successfully
node scripts/migrate-encrypt-oauth-tokens.mjs --verify-only

# 2. Test OAuth flow (integration tests)
npm test -- __tests__/integration/oauth-flow.test.ts

# 3. Database inspection (ensure no plaintext tokens)
psql $DATABASE_URL -c "
  SELECT 
    id,
    name,
    CASE 
      WHEN \"googleAccessToken\" LIKE 'v1:%' THEN 'ENCRYPTED'
      WHEN \"googleAccessToken\" LIKE 'ya29.%' THEN 'PLAINTEXT'
      ELSE 'NULL'
    END as access_token_status,
    CASE 
      WHEN \"googleRefreshToken\" LIKE 'v1:%' THEN 'ENCRYPTED'
      WHEN \"googleRefreshToken\" LIKE '1//%' THEN 'PLAINTEXT'
      ELSE 'NULL'
    END as refresh_token_status
  FROM providers
  WHERE \"googleAccessToken\" IS NOT NULL
     OR \"googleRefreshToken\" IS NOT NULL;
"
```

All tokens should show `ENCRYPTED` status.

### Phase 4: Staging/Production Migration

**Only after successful test database migration and verification:**

1. Schedule maintenance window (optional, migration is non-disruptive)
2. Ensure encryption key configured in production environment
3. Create production database backup
4. Run dry-run against production:
   ```bash
   export DATABASE_URL="postgresql://production..."
   node scripts/migrate-encrypt-oauth-tokens.mjs --dry-run
   ```
5. Run actual migration:
   ```bash
   node scripts/migrate-encrypt-oauth-tokens.mjs
   ```
6. Verify encrypted tokens:
   ```bash
   node scripts/migrate-encrypt-oauth-tokens.mjs --verify-only
   ```
7. Monitor application logs for OAuth errors

## Migration Properties

### Idempotency

Running the migration multiple times is safe:

```bash
# First run: encrypts 10 tokens
node scripts/migrate-encrypt-oauth-tokens.mjs
# Tokens encrypted: 10

# Second run: skips already-encrypted tokens
node scripts/migrate-encrypt-oauth-tokens.mjs
# Already encrypted (skipped): 10
```

### Atomicity

Each provider update is transactional. If migration fails midway:
- Successfully encrypted providers remain encrypted
- Failed providers remain plaintext
- No partially-encrypted state

Re-run migration to complete:
```bash
node scripts/migrate-encrypt-oauth-tokens.mjs
```

### Fail-Closed

If encryption fails for any token:
- Error is logged with provider ID (not token value)
- Plaintext token is NOT written back to database
- Migration continues with other providers
- Exit code indicates failures

## Rollback/Recovery Procedures

### Scenario 1: Migration Fails (Encryption Errors)

**Symptom:** Migration exits with failures

**Recovery:**
1. Review error logs (provider IDs, not token values)
2. Fix root cause (key configuration, code bug)
3. Re-run migration (idempotent, will retry failed providers)

**No database rollback needed** (failed providers remain plaintext)

### Scenario 2: Encryption Key Lost

**Symptom:** Cannot decrypt tokens after migration

**Recovery Options:**

**Option A: Key Recovery (if backed up)**
1. Restore encryption key from secure backup
2. Verify: `node scripts/migrate-encrypt-oauth-tokens.mjs --verify-only`

**Option B: Database Restore + Re-encrypt**
1. Restore database from pre-migration backup
2. Generate new encryption key
3. Re-run migration with new key

**Option C: Provider Re-authorization (if no backup)**
1. OAuth tokens cannot be recovered without key
2. Providers must disconnect and reconnect Google Calendar
3. New tokens will be encrypted with new key

### Scenario 3: Wrong Key Used

**Symptom:** Tokens encrypted but decryption fails

**Recovery:**
1. Restore database from backup (before migration)
2. Use correct encryption key
3. Re-run migration

### Scenario 4: Need to Decrypt All Tokens

**Use Case:** Migrating to different encryption scheme

**Procedure:**
```bash
# 1. Ensure correct key is set
export OAUTH_TOKEN_ENCRYPTION_KEY="<original_key>"

# 2. Create custom decrypt-all script
node scripts/decrypt-oauth-tokens.mjs  # (not included, create if needed)

# 3. Verify all tokens are plaintext
# 4. Implement new encryption
# 5. Re-encrypt with new scheme
```

## Database Inspection

### Check token encryption status:

```sql
-- Count encrypted vs plaintext tokens
SELECT 
  COUNT(*) FILTER (WHERE "googleAccessToken" LIKE 'v1:%') as encrypted_access,
  COUNT(*) FILTER (WHERE "googleAccessToken" LIKE 'ya29.%') as plaintext_access,
  COUNT(*) FILTER (WHERE "googleRefreshToken" LIKE 'v1:%') as encrypted_refresh,
  COUNT(*) FILTER (WHERE "googleRefreshToken" LIKE '1//%') as plaintext_refresh,
  COUNT(*) FILTER (WHERE "googleAccessToken" IS NULL) as null_access,
  COUNT(*) FILTER (WHERE "googleRefreshToken" IS NULL) as null_refresh
FROM providers;
```

### Find providers with plaintext tokens:

```sql
-- Identify providers needing migration
SELECT 
  id,
  name,
  email,
  "syncGoogleCalendar",
  CASE 
    WHEN "googleAccessToken" LIKE 'ya29.%' THEN 'PLAINTEXT'
    WHEN "googleAccessToken" LIKE 'v1:%' THEN 'ENCRYPTED'
    ELSE 'NULL'
  END as access_status
FROM providers
WHERE "googleAccessToken" LIKE 'ya29.%'
   OR "googleRefreshToken" LIKE '1//%';
```

### Verify encrypted token format:

```sql
-- Check token format (should all start with v1:)
SELECT 
  id,
  name,
  LENGTH("googleAccessToken") as access_token_length,
  SUBSTRING("googleAccessToken", 1, 20) as access_token_prefix,
  SPLIT_PART("googleAccessToken", ':', 1) as version
FROM providers
WHERE "googleAccessToken" IS NOT NULL
LIMIT 10;
```

## Monitoring Post-Migration

### Application Logs

Monitor for OAuth errors after migration:

```bash
# Search logs for decryption failures
grep "INT-M-03A" logs/application.log | grep "decryption failed"

# Search logs for OAuth callback failures
grep "OAuth callback" logs/application.log | grep "error"
```

### Database Queries

Check for new plaintext tokens (should not appear after migration):

```sql
-- Alert if new plaintext tokens appear
SELECT 
  id,
  name,
  "createdAt",
  "updatedAt"
FROM providers
WHERE ("googleAccessToken" LIKE 'ya29.%' 
    OR "googleRefreshToken" LIKE '1//%')
  AND "updatedAt" > NOW() - INTERVAL '1 hour';
```

## Troubleshooting

### Error: "Encryption key not configured"

**Cause:** `OAUTH_TOKEN_ENCRYPTION_KEY` not set

**Fix:**
```bash
export OAUTH_TOKEN_ENCRYPTION_KEY="<your_key>"
node scripts/migrate-encrypt-oauth-tokens.mjs
```

### Error: "Encryption key must be exactly 32 bytes"

**Cause:** Invalid key size

**Fix:** Generate new 256-bit key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Error: "Token decryption failed" (post-migration)

**Possible Causes:**
1. Wrong encryption key in environment
2. Token corrupted in database
3. Token encrypted with different key

**Diagnosis:**
```bash
# Verify key is correct
node scripts/migrate-encrypt-oauth-tokens.mjs --verify-only
```

### Migration hangs or times out

**Cause:** Large number of providers or slow database

**Fix:** Add batching to migration script or increase timeout

## Security Notes

### Key Rotation

To rotate encryption keys:

1. Generate new key
2. Create decrypt-then-reencrypt migration script
3. Run migration with old key (decrypt) → new key (encrypt)
4. Update environment with new key
5. Verify all tokens decrypt with new key

### Key Storage Best Practices

**Development:**
- `.env` file (not committed to git)
- `.env.local` for local overrides

**Production:**
- Vercel: Environment Variables (encrypted at rest)
- AWS: Secrets Manager or Parameter Store
- Heroku: Config Vars
- Azure: Key Vault

**Never:**
- Commit keys to git
- Log keys to console
- Store in plaintext files
- Share via unencrypted channels

## Success Criteria

Migration is complete when:

- ✅ All providers scanned
- ✅ All plaintext tokens encrypted
- ✅ Zero failures reported
- ✅ Verification passes (all tokens decrypt successfully)
- ✅ OAuth flow works (integration tests pass)
- ✅ Database inspection shows no plaintext tokens
- ✅ Application logs show no decryption errors
- ✅ Token refresh works
- ✅ Disconnect/revocation works

## Related Documentation

- [INT-M-03A Remediation Plan](./INT-M-03A_REMEDIATION_PLAN.md)
- [INT-M-03A Source Verification](./INT-M-03A_SOURCE_VERIFICATION.md)
- [OAuth Token Encryption Implementation](../../lib/encryption/oauth-tokens.ts)
- [Unit Tests](../../lib/encryption/__tests__/oauth-tokens.test.ts)

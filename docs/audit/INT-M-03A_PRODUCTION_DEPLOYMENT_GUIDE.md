# INT-M-03A Production Deployment Guide

## Current Status

**Gate:** TEST VERIFIED → [PRODUCTION VERIFICATION] → CLOSED  
**Do NOT execute production migration yet**

---

## Tested Commits (Preserve These)

| Artifact | Commit SHA | Description |
|---|---|---|
| **Tested Implementation** | `ec928470` | Core encryption code + migration script |
| **Evidence Package** | `a81c2aa6` | Final execution report + test evidence |
| **Tracker Update** | `76199729` | AUDIT-MASTER-TRACKER.md TEST VERIFIED status |

**Branch:** audit/int-m03a-test-verified  
**Repository:** https://github.com/birhane457-create/drivebook

---

## Pre-Production Checklist

### 1. Environment Variable Verification

**Action:** Confirm `OAUTH_TOKEN_ENCRYPTION_KEY` exists in production environment

- [ ] Key exists in production .env or environment variables
- [ ] Key is exactly 32 bytes (64 hex characters)
- [ ] Key is the same key used by the application code
- [ ] Key is NOT printed or exposed in logs/evidence

**Verification Command (safe - no key exposure):**
```bash
# Check key exists and length (do NOT print the key)
node -e "const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY; console.log('Key exists:', !!key); console.log('Key length:', key?.length || 0); console.log('Expected: 64 hex chars');"
```

**Expected Output:**
```
Key exists: true
Key length: 64
Expected: 64 hex chars
```

---

### 2. Database Backup/Recovery Position

**Action:** Establish backup before migration

- [ ] Full database backup created
- [ ] Backup timestamp recorded: `__________________`
- [ ] Backup restoration procedure tested
- [ ] Recovery point objective (RPO) documented
- [ ] Rollback procedure documented (see Section 6)

**Backup Command (example - adjust for your database):**
```bash
# PostgreSQL example
pg_dump $DATABASE_URL > backup_pre_oauth_migration_$(date +%Y%m%d_%H%M%S).sql
```

---

### 3. Current Production OAuth Token Population

**Action:** Measure current production token count

- [ ] Total Provider rows: `__________________`
- [ ] Providers with non-null `googleAccessToken`: `__________________`
- [ ] Providers with non-null `googleRefreshToken`: `__________________`
- [ ] Sample token format verified (should be plaintext currently)

**Measurement Query (safe - no token exposure):**
```sql
-- Total providers
SELECT COUNT(*) as total_providers FROM "Provider";

-- Providers with OAuth tokens
SELECT 
  COUNT(*) FILTER (WHERE "googleAccessToken" IS NOT NULL) as access_token_count,
  COUNT(*) FILTER (WHERE "googleRefreshToken" IS NOT NULL) as refresh_token_count,
  COUNT(*) FILTER (WHERE "googleAccessToken" LIKE 'v1:%') as already_encrypted_count
FROM "Provider";
```

**Record Results Here:**
```
Total providers: ___________
Access tokens: ___________
Refresh tokens: ___________
Already encrypted: ___________ (should be 0)
```

---

### 4. Migration Command and Revision

**Action:** Document exact migration execution

**Migration Script Location:**
```
scripts/migrate-encrypt-oauth-tokens.mjs
```

**Tested Git Revision:**
```
ec928470
```

**Migration Command (DRY RUN FIRST):**
```bash
# Step 1: Dry run (no changes)
npx tsx scripts/migrate-encrypt-oauth-tokens.mjs --dry-run

# Step 2: Actual migration (only after dry run succeeds)
npx tsx scripts/migrate-encrypt-oauth-tokens.mjs

# Step 3: Verification (no changes, validates encryption)
npx tsx scripts/migrate-encrypt-oauth-tokens.mjs --verify-only
```

**Environment Requirements:**
- Production DATABASE_URL
- Production OAUTH_TOKEN_ENCRYPTION_KEY
- Node.js with tsx available
- Sufficient database connection pool

---

### 5. Rollback/Recovery Procedure

**Action:** Document rollback steps BEFORE migration

**Rollback Scenario 1: Migration Script Fails Mid-Execution**
- Migration is per-provider atomic
- Failed providers remain plaintext
- Successful providers already encrypted
- **Action:** Re-run migration script (idempotent - skips encrypted tokens)

**Rollback Scenario 2: Application Cannot Decrypt Tokens After Migration**
- **Root Cause:** Wrong encryption key in production
- **Immediate Action:** Restore database from backup (Section 2)
- **Recovery Time:** [Document based on backup size]
- **Data Loss Window:** From backup timestamp to rollback execution

**Rollback Scenario 3: Need to Revert to Pre-Migration Code**
- Encrypted tokens are backwards-incompatible with old code
- **Action:** Database restore required (Section 2)
- **Do NOT revert code without restoring database**

**Emergency Rollback Command:**
```bash
# Restore from backup (PostgreSQL example)
psql $DATABASE_URL < backup_pre_oauth_migration_YYYYMMDD_HHMMSS.sql
```

---

### 6. Production Execution Monitoring

**Action:** Monitor during migration execution

**Metrics to Monitor:**
- [ ] Migration script stdout/stderr captured
- [ ] Database CPU/connection pool utilization
- [ ] Migration duration (expected: ~1-2 seconds per provider)
- [ ] Error count (expected: 0)
- [ ] Providers encrypted count matches --dry-run prediction

**Execution Evidence Capture:**
```bash
# Capture full output
npx tsx scripts/migrate-encrypt-oauth-tokens.mjs 2>&1 | tee production-migration-output.txt
```

---

### 7. Post-Migration Verification

**Action:** Validate migration success

#### Step 7.1: Run --verify-only Mode
```bash
npx tsx scripts/migrate-encrypt-oauth-tokens.mjs --verify-only
```

**Expected Output:**
- All tokens successfully decrypt
- No errors reported
- Exit code: 0

#### Step 7.2: Database-Wide Invariant Check

**Query (safe - no token exposure):**
```sql
-- Confirm ALL OAuth tokens are now encrypted
SELECT 
  COUNT(*) FILTER (
    WHERE "googleAccessToken" IS NOT NULL 
    AND "googleAccessToken" NOT LIKE 'v1:%'
  ) as plaintext_access_tokens,
  COUNT(*) FILTER (
    WHERE "googleRefreshToken" IS NOT NULL 
    AND "googleRefreshToken" NOT LIKE 'v1:%'
  ) as plaintext_refresh_tokens,
  COUNT(*) FILTER (
    WHERE "googleAccessToken" LIKE 'v1:%'
  ) as encrypted_access_tokens,
  COUNT(*) FILTER (
    WHERE "googleRefreshToken" LIKE 'v1:%'
  ) as encrypted_refresh_tokens
FROM "Provider";
```

**Expected Results:**
- `plaintext_access_tokens`: **0**
- `plaintext_refresh_tokens`: **0**
- `encrypted_access_tokens`: [matches Section 3 count]
- `encrypted_refresh_tokens`: [matches Section 3 count]

#### Step 7.3: Application-Level Verification

**Action:** Test Google Calendar integration with encrypted tokens

- [ ] Select a provider with encrypted tokens
- [ ] Trigger Google Calendar sync operation
- [ ] Verify calendar sync succeeds
- [ ] Check application logs for decryption errors (expected: none)

**Test Scenarios:**
1. Provider with existing calendar sync → should continue working
2. New provider connecting calendar → should encrypt on save
3. Provider refreshing OAuth tokens → should encrypt refreshed tokens

---

### 8. Post-Migration Evidence Package

**Action:** Create production execution evidence

**Required Evidence:**
1. Pre-migration token count (Section 3)
2. Migration stdout/stderr (Section 6)
3. Post-migration invariant check results (Section 7.2)
4. --verify-only output (Section 7.1)
5. Application-level test results (Section 7.3)
6. Migration duration and any errors

**Evidence File:** `docs/audit/INT-M-03A_PRODUCTION_EXECUTION_EVIDENCE.md`

**Template:**
```markdown
# INT-M-03A Production Execution Evidence

**Execution Date:** YYYY-MM-DD
**Executed By:** [Name/Role]
**Git Revision:** ec928470
**Database:** [Production database identifier - NO connection strings]

## Pre-Migration State
- Total providers: ___
- OAuth tokens: ___
- Already encrypted: ___ (should be 0)

## Migration Execution
- Start time: ___
- End time: ___
- Duration: ___
- Providers encrypted: ___
- Errors: ___ (should be 0)

## Post-Migration Verification
- --verify-only: [PASS/FAIL]
- Invariant check: [PASS/FAIL]
- Application test: [PASS/FAIL]

## Migration Output
[Attach production-migration-output.txt - redact any tokens if present]

## Verification Query Results
[Attach Section 7.2 query results]

## Conclusion
INT-M-03A production migration: [SUCCESS/FAILED]
Ready for CLOSED status: [YES/NO]
```

---

## Production Migration Execution Steps

**Execute in this exact order:**

1. ✅ Complete Pre-Production Checklist (Sections 1-5)
2. ✅ Create database backup
3. ✅ Record current token population
4. ✅ Run dry-run mode: `--dry-run`
5. ✅ Verify dry-run output matches expected count
6. ⚠️ **DECISION POINT:** Proceed with migration? [YES/NO]
7. ✅ Execute migration: `npx tsx scripts/migrate-encrypt-oauth-tokens.mjs`
8. ✅ Capture output to file
9. ✅ Run verification: `--verify-only`
10. ✅ Execute invariant check query
11. ✅ Test application-level calendar sync
12. ✅ Create production execution evidence
13. ✅ Update INT-M-03A status to CLOSED in AUDIT-MASTER-TRACKER.md

---

## Important Security Notes

### DO NOT:
- Print or log the `OAUTH_TOKEN_ENCRYPTION_KEY`
- Print or log actual OAuth tokens (plaintext or encrypted)
- Share database connection strings in evidence
- Commit production credentials to git
- Run migration without backup
- Revert code without restoring database

### DO:
- Redact any tokens from captured output
- Use safe queries that count/validate without exposing values
- Keep backup secure and accessible
- Test rollback procedure before migration
- Monitor application logs during migration
- Preserve tested commit SHAs (ec928470, a81c2aa6, 76199729)

---

## After Production Verification Passes

**Update AUDIT-MASTER-TRACKER.md:**

```markdown
| INT-M-03A | OAuth tokens stored plaintext | HIGH | CONFIRMED | VERIFIED | `ec928470` | 6 MSE tests + Production migration successful | ✅ CLOSED | `INT-M-03A_PRODUCTION_EXECUTION_EVIDENCE.md` | INT-M-03A |
```

**Then:** Return to audit master tracker and select next highest-priority unresolved finding.

---

## Contact/Escalation

**If migration fails or unexpected issues arise:**
1. DO NOT proceed with further steps
2. Document exact error and state
3. Execute rollback procedure (Section 5)
4. Create incident report with evidence
5. Return INT-M-03A to FIX-VERIFIED status pending investigation

---

**Document Version:** 1.0  
**Created:** 2026-08-15  
**Branch:** audit/int-m03a-test-verified  
**Status:** Ready for production deployment planning

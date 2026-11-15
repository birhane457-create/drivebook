# OTP Security Fixes — Production Hardening

**Date:** 2026-11-14  
**Priority:** HIGH (Security)  
**Status:** Code fixed, production verification required  

---

## Issues Identified

### ISSUE-1: Redis Failure Falls Through to In-Memory (SECURITY)
**Severity:** HIGH  
**Location:** `app/api/verifications/otp/route.ts` lines 74-77

**Problem:**
When Redis is configured but unavailable (network failure, Upstash outage, etc.), the rate limiter silently falls back to an in-memory Map. On multi-instance deployments (Vercel serverless, Kubernetes, etc.), each instance maintains its own in-memory limiter, effectively multiplying the rate limit by the number of active instances.

**Attack Vector:**
1. Attacker triggers Redis connection failure (or waits for transient outage)
2. OTP requests distribute across multiple serverless instances
3. Each instance allows 3 OTP requests per hour independently
4. Effective limit becomes `3 × N instances` instead of 3 globally

**Impact:**
- SMS/email cost amplification
- OTP brute-force attack becomes feasible (expanded keyspace)
- Rate limit policy effectively disabled during Redis downtime

---

### ISSUE-2: Hardcoded OTP Secret Fallback (SECURITY)
**Severity:** HIGH  
**Location:**
- `app/api/verifications/otp/route.ts` line 133
- `app/api/verifications/otp/confirm/route.ts` line 75

**Problem:**
When `OTP_HASH_SECRET` environment variable is missing, both routes fall back to the hardcoded string `'dev-otp-secret-change-in-prod'`. The comment says this is for development, but the code does not enforce that restriction. If production deploys without `OTP_HASH_SECRET` configured, OTP hashes become predictable.

**Attack Vector:**
1. Attacker observes that production is using the fallback secret (inferred from behavior or leaked DB)
2. Attacker requests OTP for target phone/email
3. Attacker generates all possible 6-digit OTP hashes using the known secret
4. Attacker submits pre-computed hashes to confirm endpoint
5. Bypass authentication for any account

**Impact:**
- Complete bypass of OTP verification if secret is not configured
- Known-plaintext attack becomes trivial
- Production deployment with missing env var is silently insecure

---

## Fixes Applied

### Fix 1: Redis Failure Fails Closed in Production
**File:** `app/api/verifications/otp/route.ts` lines 74-83

**Before:**
```typescript
    } catch (err) {
      console.error('[OTP RATE LIMIT] Redis check failed, falling back to in-memory:', err);
      // Fall through to in-memory
    }
```

**After:**
```typescript
    } catch (err) {
      console.error('[OTP RATE LIMIT] Redis check failed:', err);
      // CRITICAL: Fail closed in production to prevent rate limit bypass on multi-instance deployments
      // In development, fall through to in-memory for local testing
      if (process.env.NODE_ENV === 'production') {
        return { 
          allowed: false, 
          retryAfter: 60 // Conservative retry — forces client to wait rather than bypass rate limits
        };
      }
      // Development only: fall through to in-memory
      console.warn('[OTP RATE LIMIT] Development mode: falling back to in-memory limiter');
    }
```

**Behavior Change:**
- **Production:** Redis failure denies OTP request with 429 status (fail-closed)
- **Development:** Falls back to in-memory for local testing (existing behavior)

**Rationale:** In production, temporary OTP service unavailability is preferable to a security bypass that could enable large-scale abuse or cost amplification.

---

### Fix 2: OTP Secret Enforcement in Production
**Files:**
- `app/api/verifications/otp/route.ts` lines 141-157
- `app/api/verifications/otp/confirm/route.ts` lines 74-88

**Before (both files):**
```typescript
const otpSecret = process.env.OTP_HASH_SECRET || 'dev-otp-secret-change-in-prod';
const otpHash = crypto.createHmac('sha256', otpSecret).update(otp).digest('hex');
```

**After (OTP send):**
```typescript
const otpSecret = process.env.OTP_HASH_SECRET;
if (!otpSecret) {
  console.error('[OTP] CRITICAL: OTP_HASH_SECRET not configured');
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'OTP service temporarily unavailable. Please try again later.' },
      { status: 503 }
    );
  }
  // Development only: use hardcoded fallback with warning
  console.warn('[OTP] Development mode: using insecure hardcoded OTP secret');
}
const otpHash = crypto.createHmac('sha256', otpSecret || 'dev-otp-secret-local-only').update(otp).digest('hex');
```

**After (OTP confirm):**
```typescript
const otpSecret = process.env.OTP_HASH_SECRET;
if (!otpSecret) {
  console.error('[OTP CONFIRM] CRITICAL: OTP_HASH_SECRET not configured');
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'OTP verification temporarily unavailable. Please try again later.' },
      { status: 503 }
    );
  }
  // Development only: use hardcoded fallback with warning
  console.warn('[OTP CONFIRM] Development mode: using insecure hardcoded OTP secret');
}
const submittedHash = crypto.createHmac('sha256', otpSecret || 'dev-otp-secret-local-only').update(data.code).digest('hex');
```

**Behavior Change:**
- **Production:** Missing `OTP_HASH_SECRET` returns 503 (service unavailable)
- **Development:** Uses fallback with explicit warning logged

**Rationale:** Production must not silently use an insecure fallback. Failing fast with 503 alerts operators to the misconfiguration immediately.

---

## Production Verification Required

### Environment Variables to Verify

The following environment variables **MUST** be configured in the Vercel production environment:

1. **`OTP_HASH_SECRET`** (CRITICAL)
   - Purpose: Secret key for HMAC-SHA256 OTP hashing
   - Requirements: 
     - Minimum 32 characters (256 bits recommended)
     - Cryptographically random (use `openssl rand -base64 32`)
     - Never committed to source control
     - Unique per environment (staging, production)
   - Verification: Check Vercel environment variables dashboard (value should be redacted)

2. **`UPSTASH_REDIS_REST_URL`** (REQUIRED)
   - Purpose: Redis connection endpoint for rate limiting
   - Format: `https://your-db-name.upstash.io`
   - Verification: Must not contain placeholder text like `your-database`

3. **`UPSTASH_REDIS_REST_TOKEN`** (REQUIRED)
   - Purpose: Redis authentication token
   - Verification: Check Vercel environment variables dashboard (value should be redacted)

4. **`NODE_ENV`** (AUTOMATIC)
   - Value: `production`
   - Verification: Automatically set by Vercel for production deployments

---

## Verification Checklist

### Pre-Deployment Verification
- [ ] `OTP_HASH_SECRET` configured in Vercel production environment
- [ ] `UPSTASH_REDIS_REST_URL` configured and valid (not placeholder)
- [ ] `UPSTASH_REDIS_REST_TOKEN` configured
- [ ] Verify values are NOT committed to source control
- [ ] Confirm staging environment has separate `OTP_HASH_SECRET`

### Post-Deployment Verification

#### Test 1: Normal OTP Flow
- [ ] Request OTP for test email/phone
- [ ] Verify OTP received via email/SMS
- [ ] Confirm OTP within 5-minute window
- [ ] Verify confirmation returns valid token
- [ ] Check logs: No "OTP_HASH_SECRET not configured" errors
- [ ] Check logs: No "Development mode" warnings

#### Test 2: Rate Limiting
- [ ] Request 3 OTPs for same identifier within 1 hour
- [ ] Verify 4th request returns 429 status
- [ ] Check logs: Redis limiter being used (not in-memory fallback)
- [ ] Verify rate limit persists across multiple requests (not per-instance)

#### Test 3: Redis Failure Behavior (Manual)
- [ ] Temporarily revoke Upstash Redis token in Vercel
- [ ] Attempt OTP request
- [ ] Verify returns 429 status (fail-closed, not fallback)
- [ ] Check logs: "Redis check failed" error logged
- [ ] Check logs: NO "falling back to in-memory" message
- [ ] Restore Redis token

#### Test 4: Missing OTP Secret (Pre-Production Only)
- [ ] Create staging deployment WITHOUT `OTP_HASH_SECRET`
- [ ] Attempt OTP request
- [ ] Verify returns 503 status (service unavailable)
- [ ] Check logs: "CRITICAL: OTP_HASH_SECRET not configured" error
- [ ] Verify production deployment ALWAYS has secret configured

#### Test 5: Security Properties
- [ ] Verify OTP stored in DB is hashed (not plaintext)
- [ ] Verify same OTP hashes to same value (deterministic HMAC)
- [ ] Verify failed attempts are tracked (3-strike lockout)
- [ ] Verify timing-safe comparison used in confirm route

---

## Deployment Instructions

### 1. Generate OTP Secret
```bash
openssl rand -base64 32
```

**Example output:** `Xm8F2kP9vL3nQ7wY1jR4tC6hG5sD8aE0uI2oN7pM9vB=`

### 2. Configure Vercel Environment Variables
```
# Vercel Dashboard > Project > Settings > Environment Variables

OTP_HASH_SECRET=<output from openssl command>
UPSTASH_REDIS_REST_URL=https://your-redis-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
```

**Apply to:** Production (separate secrets for staging recommended)

### 3. Deploy and Verify
1. Commit OTP security fixes
2. Push to GitHub
3. Wait for Vercel deployment SUCCESS
4. Run verification checklist above
5. Monitor logs for 24 hours for any OTP-related errors

---

## Risk Assessment

### Before Fixes
- **Redis failure:** Rate limit bypass on multi-instance deployments (HIGH)
- **Missing secret:** Predictable OTP hashes enable complete bypass (HIGH)
- **Combined risk:** Attacker could abuse OTP system at scale with low cost

### After Fixes
- **Redis failure:** OTP service temporarily unavailable (acceptable degradation)
- **Missing secret:** Production deployment fails fast with 503 (prevents silent insecurity)
- **Combined risk:** Significantly reduced — both vulnerabilities require misconfiguration

---

## Testing Requirements

### Automated Tests (Recommended)
Create test file: `__tests__/integration/otp-security.test.ts`

**Test Coverage:**
1. OTP rate limiting enforced (3 per hour)
2. Missing `OTP_HASH_SECRET` returns 503 in production
3. Redis failure returns 429 in production (fail-closed)
4. Development mode falls back gracefully with warnings
5. OTP stored as hash (not plaintext)
6. Timing-safe comparison prevents enumeration

### Manual Production Tests
- Normal OTP flow (end-to-end)
- Rate limit enforcement (cross-instance)
- Redis failure behavior (controlled outage test)
- Environment variable validation

---

## Rollback Plan

If OTP fixes cause issues:

1. **Immediate:** Revert commits to previous stable version
2. **Temporary:** Set `NODE_ENV=development` in Vercel (NOT RECOMMENDED — disables security)
3. **Proper Fix:** Debug root cause, fix, re-deploy

**Note:** Reverting to previous code re-introduces both security vulnerabilities.

---

## Documentation Updates Required

### 1. DEVELOPER_ONBOARDING.md
- Add `OTP_HASH_SECRET` to required environment variables
- Add Upstash Redis setup instructions

### 2. .env.example
```bash
# OTP Security (REQUIRED in production)
OTP_HASH_SECRET=generate-with-openssl-rand-base64-32

# Upstash Redis (REQUIRED for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

### 3. Deployment Checklist
- Add OTP secret verification step
- Add Redis configuration verification step

---

## Related Findings

- **Phase 4 Audit:** OTP security identified as next priority after Option B
- **Option B:** Subscription validation fixes complete and verified
- **Phase 3:** Core functionality audit did not cover OTP routes (out of scope)

---

## Status: Awaiting Production Verification

**Code Changes:** ✅ Complete (2 files modified)  
**Environment Config:** ⏳ Pending verification  
**Deployment:** ⏳ Pending commit and push  
**Testing:** ⏳ Verification checklist pending  

**Blocker:** Production environment variable verification cannot be completed from repository inspection

---

**Next Steps:**
1. Commit OTP security fixes
2. Verify Vercel production environment variables
3. Deploy to production
4. Run verification checklist
5. Monitor for 24 hours
6. Mark as COMPLETE after verification

---

**Last Updated:** 2026-11-14 (fixes applied, awaiting commit)

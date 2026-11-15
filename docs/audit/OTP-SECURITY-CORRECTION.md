# OTP Security — Remaining Defect Correction

**Date:** 2026-11-14  
**Original Commit:** c0d74ad7 (incomplete)  
**Status:** Correction in progress  

---

## Independent Review Finding

**Issue:** Redis missing/misconfigured still falls through to in-memory limiter in production

### What c0d74ad7 Fixed
✅ Redis **operation failure** (connection error, timeout, etc.) fails closed in production  
✅ Missing `OTP_HASH_SECRET` returns 503 in production

### What c0d74ad7 Missed
❌ Redis **not configured** (missing env vars or placeholder URL) still allows in-memory fallback in production

---

## The Defect

### Current Code Behavior

```typescript
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN &&
  !process.env.UPSTASH_REDIS_REST_URL.includes('your-database')
);

async function checkOtpRateLimit(key: string) {
  if (isUpstashConfigured) {
    try {
      // Redis operations
      return { allowed: true };
    } catch (err) {
      // NOW FIXED: Production returns { allowed: false } ✅
      if (process.env.NODE_ENV === 'production') {
        return { allowed: false, retryAfter: 60 };
      }
    }
  }
  
  // DEFECT: Falls through to in-memory even in production
  // if isUpstashConfigured === false
  const entry = memRateLimitMap.get(key);
  // ... in-memory logic
}
```

### Problem Scenarios

**Scenario 1: Missing UPSTASH_REDIS_REST_URL**
- `isUpstashConfigured` = `false`
- Function skips Redis block entirely
- Falls through to in-memory limiter
- **Production behavior:** Multi-instance rate limit bypass

**Scenario 2: Missing UPSTASH_REDIS_REST_TOKEN**
- `isUpstashConfigured` = `false`
- Same as Scenario 1
- **Production behavior:** Multi-instance rate limit bypass

**Scenario 3: Placeholder URL (contains "your-database")**
- `isUpstashConfigured` = `false`
- Same as Scenario 1
- **Production behavior:** Multi-instance rate limit bypass

**Scenario 4: Redis Connection Fails (Already Fixed)**
- `isUpstashConfigured` = `true`
- Enters Redis block, operation throws error
- Catch block returns `{ allowed: false }` in production ✅
- **Production behavior:** Fail-closed (correct)

---

## The Correction

### Add Early Production Check

Insert before the `if (isUpstashConfigured)` block:

```typescript
async function checkOtpRateLimit(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const resendDelayMs = 60 * 1000;
  const maxPerHour = 3;

  // CRITICAL: Production must use Redis for rate limiting
  // In-memory fallback only allowed in development
  if (!isUpstashConfigured) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[OTP RATE LIMIT] CRITICAL: Redis not configured in production');
      return {
        allowed: false,
        retryAfter: 60
      };
    }
    // Development only: log warning before falling through to in-memory
    console.warn('[OTP RATE LIMIT] Development mode: Redis not configured, using in-memory fallback');
  }

  if (isUpstashConfigured) {
    // ... existing Redis logic
  }
  
  // In-memory fallback (development only after check above)
  const entry = memRateLimitMap.get(key);
  // ...
}
```

### Key Changes

1. **Check `!isUpstashConfigured` before Redis block**
2. **In production:** Return `{ allowed: false, retryAfter: 60 }` immediately
3. **In development:** Log warning, then continue to in-memory fallback
4. **Benefit:** Both "Redis not configured" AND "Redis operation failed" now fail closed in production

---

## Complete Production Enforcement Matrix

| Condition | Production Behavior | Development Behavior |
|-----------|---------------------|----------------------|
| Redis env vars missing | ✅ Deny (429) | ⚠️ In-memory fallback with warning |
| Redis env vars have placeholder | ✅ Deny (429) | ⚠️ In-memory fallback with warning |
| Redis connection fails | ✅ Deny (429) | ⚠️ In-memory fallback with warning |
| Redis operation times out | ✅ Deny (429) | ⚠️ In-memory fallback with warning |
| Redis working normally | ✅ Allow (if under limit) | ✅ Allow (if under limit) |
| OTP_HASH_SECRET missing | ✅ Deny (503) | ⚠️ Hardcoded fallback with warning |

---

## Why This Matters

### Security Impact
**Without this fix:** Production deployment with missing/misconfigured Redis variables silently uses in-memory rate limiting. On multi-instance serverless (Vercel, AWS Lambda, etc.), each instance maintains independent limits, effectively multiplying the rate limit:

- Intended: 3 OTP requests per hour globally
- Actual: 3 × N instances per hour
- With 10 concurrent instances: 30 requests per hour

**Attack scenario:**
1. Attacker spreads requests across many serverless instances (easy with load balancer)
2. Each instance allows 3 requests independently
3. SMS/email costs amplified 10×
4. OTP brute-force becomes feasible

### Cost Impact
- SMS cost: ~$0.05/message × 30 requests/hour × 24 hours = $36/day for single target
- Email cost: negligible but reputation risk
- Database write load: 10× amplification

---

## Verification After Fix

### Test 1: Redis Not Configured (Staging)
```bash
# Remove Redis env vars temporarily
vercel env rm UPSTASH_REDIS_REST_URL --environment=staging
vercel env rm UPSTASH_REDIS_REST_TOKEN --environment=staging

# Deploy to staging
git push staging

# Test OTP request
curl -X POST https://staging.drivebook.com.au/api/verifications/otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"login"}'

# Expected: HTTP 429
# Expected log: "CRITICAL: Redis not configured in production"

# Restore env vars
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### Test 2: Redis Placeholder URL (Staging)
```bash
# Set placeholder URL
vercel env add UPSTASH_REDIS_REST_URL="https://your-database-url.upstash.io"

# Test OTP request
# Expected: HTTP 429
# Expected log: "CRITICAL: Redis not configured in production"
```

### Test 3: Development Fallback Still Works
```bash
# Local development (no .env file or missing Redis vars)
npm run dev

# Test OTP request to localhost:3000
# Expected: HTTP 200 (uses in-memory)
# Expected log: "Development mode: Redis not configured, using in-memory fallback"
```

---

## Files Modified

1. **app/api/verifications/otp/route.ts** (lines 43-48 added)
   - Add early production check before Redis block
   - Log critical error in production
   - Log warning in development

2. **docs/audit/OTP-SECURITY-CORRECTION.md** (NEW)
   - This document

3. **docs/audit/OTP-SECURITY-FIXES.md** (updated status section)
   - Mark c0d74ad7 as incomplete
   - Note remaining defect

---

## Commit Message (Recommended)

```
fix: Enforce Redis configuration check in OTP rate limiting

Critical correction to c0d74ad7:
- Production now denies OTP requests when Redis not configured
- Prevents silent fallback to in-memory on missing/misconfigured env vars
- Development preserves in-memory fallback with warning

Security impact:
- Closes multi-instance rate limit bypass when Redis vars missing
- Both "not configured" and "operation failed" now fail closed in production

Testing:
- Verify production with missing Redis vars returns 429
- Verify development still allows in-memory fallback
```

---

## Status

**Defect:** Redis not-configured detection  
**Severity:** HIGH (security — rate limit bypass)  
**Original Commit:** c0d74ad7 (incomplete)  
**Correction:** Code ready, awaiting commit  
**Production Verification:** Required after deployment  

**Next:** Commit correction, deploy, run verification checklist

---

**Last Updated:** 2026-11-14 (correction code ready)

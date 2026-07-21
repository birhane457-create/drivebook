# Rate Limiting Configuration

**Purpose:** Protect platform against abuse, brute force attacks, and resource exhaustion across all API endpoints.

**Status:** ✅ AS IS (Fully Implemented) | ⏳ AS IT SHOULD BE (Recommendations)

---

## AS IS: Current Implementation

### Architecture

**Backend:** Upstash Redis (distributed) with in-memory fallback for development.

**Location:** `lib/ratelimit.ts`

**Fail Modes:**
- Production: Fails open for non-critical endpoints, fails closed for financial operations
- Development: Fails open (allows requests if limiter unavailable)

### Rate Limiters Defined (11 total)

| Limiter | Endpoint(s) | Limit | Window | Purpose |
|---------|------------|-------|--------|---------|
| `bookingRateLimit` | `/api/bookings` | 10 | 1 min | Prevent spam booking creation per instructor |
| `bookingActionRateLimit` | Check-in, check-out, cancel, reschedule | 10 | 1 min | Prevent automation abuse on financial actions |
| `webhookRateLimit` | Stripe webhooks | 100 | 1 min | Prevent webhook spam/replay attacks per IP |
| `bulkBookingRateLimit` | Bulk booking endpoints | 5 | 1 min | More restrictive for bulk operations per client |
| `payoutRateLimit` | Payout endpoints | 5 | 1 min | Financial operations per admin |
| `bulkPayoutRateLimit` | Bulk payout endpoints | 2 | 1 min | Platform-wide (extremely restrictive) |
| `walletRateLimit` | Wallet operations | 20 | 1 min | Prevent wallet manipulation per user |
| `adminActionRateLimit` | Admin actions (approve, suspend, etc.) | 30 | 1 min | General admin operations per admin |
| `apiRateLimit` | General API protection | 100 | 1 min | Default API protection per user |
| `authRateLimit` | Login attempts | 5 | 15 min | Brute force prevention per IP |
| `reviewRateLimit` | `POST /api/reviews` | 10 | 1 hr | Prevent review spam per user |
| `setupTokenRateLimit` | `GET /api/auth/verify-setup-token` | 20 | 15 min | Prevent setup-token enumeration per IP |

### Upstash Configuration

**Setup Required:**
1. Create free account at https://upstash.com
2. Create Redis database (select closest region)
3. Add to `.env`:
   ```
   UPSTASH_REDIS_REST_URL=https://[region]-[token].upstash.io
   UPSTASH_REDIS_REST_TOKEN=[token]
   ```

**Feature:** Sliding window rate limiting with analytics enabled

**Analytics:** Requests tracked globally, can view metrics in Upstash dashboard

### In-Memory Fallback (Development Only)

**Trigger:** When Upstash credentials missing or set to placeholder values

**Behavior:**
- Stores request timestamps in memory (not production-safe)
- Auto-cleanup every ~1% of requests (probabilistic)
- Accurate for single-process development

**Warning:** ⚠️ NOT SAFE FOR PRODUCTION — Use Upstash in production

### Helper Functions

#### `checkRateLimit(limiter, identifier)` — Fail Open
Returns `{ success: true }` if rate limiter fails. For non-critical endpoints.

**Response Headers (on success):**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2026-06-14T12:30:45.000Z
```

**Response on limit exceeded:**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait 47 seconds before trying again."
}
```

#### `checkRateLimitStrict(limiter, identifier)` — Fail Closed
Rejects requests if rate limiter fails (except in development). For financial operations.

**Behavior:**
- Production with Upstash: Rejects if service unavailable
- Development without Upstash: Allows requests (fails open for development)

#### `getRateLimitIdentifier(userId?, ipAddress?, prefix?)` — Identifier Generation

**Logic:**
1. Use `userId` if available (authenticated users)
2. Fall back to `ipAddress` (unauthenticated/IP-based rate limiting)
3. Fall back to `"anonymous"` (shouldn't happen)
4. Optional `prefix` for rate limit grouping (e.g., `"booking:userId"`)

**Usage Example:**
```typescript
const identifier = getRateLimitIdentifier(userId, ipAddress, 'booking');
// Result: "booking:user_123" or "booking:192.168.1.1"
```

### Current Usage in Codebase

| File | Limiter Used | Identifier |
|------|--------------|-----------|
| `app/api/bookings/route.ts` | `bookingRateLimit` | userId (instructor creating booking) |
| `app/api/instructor/earnings/this-week/route.ts` | `apiRateLimit` | userId |
| `app/api/payments/create-intent/route.ts` | `apiRateLimit` | userId |
| `app/api/stripe/webhook/route.ts` | `webhookRateLimit` | IP address |
| `app/api/auth/mobile-login/route.ts` | `authRateLimit` | IP address |
| `app/api/reviews/route.ts` | `reviewRateLimit` | userId |
| `app/api/auth/verify-setup-token/route.ts` | `setupTokenRateLimit` | IP address |

---

## AS IT SHOULD BE: Recommendations & Improvements

### 1. Per-Endpoint Configuration (High Priority)

**Issue:** All limiters hardcoded in `lib/ratelimit.ts`. Changing any limit requires code change + deployment.

**Recommendation:**
- Move rate limit config to `PlatformSettings` table
- Allow admins to adjust limits from admin dashboard without code deployment
- Cache config in-memory with 5-minute TTL to avoid database hit on every request

**Implementation Example:**
```typescript
// Move to PlatformSettings model
model PlatformSettings {
  ...
  bookingRateLimit: 10          // requests
  bookingRateLimitWindow: 60    // seconds
  authRateLimitAttempts: 5
  authRateLimitWindow: 900      // 15 minutes
  ...
}
```

### 2. Per-User Custom Limits (Medium Priority)

**Issue:** All users get same limits. Premium users, high-volume instructors may need different limits.

**Recommendation:**
- Add rate limit override to `Instructor` and `User` models
- Allow admins to set custom limits for specific users
- Useful for: bulk operations, testing, high-volume instructors

**Example:**
```typescript
model Instructor {
  customBookingRateLimit?: number;    // null = use default
  customRateLimitReason?: string;
}
```

### 3. Adaptive Rate Limiting (Low Priority)

**Issue:** Fixed limits don't adapt to traffic patterns or abuse patterns.

**Recommendation:**
- Monitor 404 errors, 401 errors, spike in requests
- Temporarily lower limits if abuse detected
- Auto-restore after abuse stops (configurable window)
- Alert admins when adaptive limits triggered

### 4. Better Observability (High Priority)

**Issue:** Rate limit metrics not visible. Can't see which endpoints are hitting limits most.

**Recommendation:**
- Log rate limit events (not every hit, but every limit exceeded)
- Create dashboard showing: endpoint, limit, identifier, timestamp
- Alert if specific user/IP repeatedly hitting limits (brute force indicator)

**Log Format:**
```json
{
  "timestamp": "2026-06-14T12:30:45Z",
  "limiter": "bookingRateLimit",
  "identifier": "user_123",
  "limit": 10,
  "windowMs": 60000,
  "exceeded": true,
  "waitSeconds": 47
}
```

### 5. Graceful Degradation for Stripe Webhooks (Medium Priority)

**Issue:** Stripe webhooks rejected if rate limited. Webhook retries may cascade.

**Recommendation:**
- Use idempotency key (already in schema) to deduplicate webhook retries
- Queue webhook for retry instead of immediate rejection (use Bull queue)
- Never rate limit Stripe webhook endpoint (use IP allowlist instead)

### 6. Per-Tier Rate Limits (Low Priority)

**Issue:** All instructors (BASIC/PRO/BUSINESS) get same booking limits. Premium tiers should get higher.

**Recommendation:**
- Base booking limit on subscription tier
- BASIC: 10 bookings/min
- PRO: 20 bookings/min
- BUSINESS: 50 bookings/min

**Implementation:**
```typescript
const tierLimits = {
  BASIC: 10,
  PRO: 20,
  STUDIO: 30,
  BUSINESS: 50,
};
const limit = tierLimits[instructor.subscriptionTier] || 10;
```

---

## Implementation Checklist

- [ ] Add rate limit config fields to `PlatformSettings`
- [ ] Create admin page for rate limit tuning (`/admin/rate-limiting`)
- [ ] Implement config caching with TTL
- [ ] Add rate limit event logging
- [ ] Create rate limit metrics dashboard
- [ ] Document rate limit status page endpoint
- [ ] Add rate limit testing to test suite
- [ ] Set up alerts for repeated limit violations
- [ ] Document rate limit recovery for end-users
- [ ] Add rate limit headers to all API responses (already done)

---

## Testing

### Manual Test (Development)

```bash
# Without Upstash configured, in-memory limiter used
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer token" \
  -d '{"instructorId":"...", ...}'

# Repeat 11 times in same minute → should see rate limit error on 11th
# Response on 11th request:
# {
#   "success": false,
#   "error": "Rate limit exceeded. Please wait 58 seconds before trying again.",
#   "headers": { "X-RateLimit-Remaining": "0", ... }
# }
```

### Load Test (Upstash Enabled)

```bash
# Use Artillery or similar
artillery quick --count 20 --num 15 \
  -p POST \
  -H 'Authorization: Bearer token' \
  http://localhost:3000/api/bookings
```

---

## Security Notes

**Brute Force Prevention:** Auth limiter uses IP + 5 attempts / 15 min. Works across multiple devices per IP (coffee shop scenario).

**Distributed Attacks:** Upstash Redis is distributed. Limits work across multiple server instances automatically.

**DDoS Considerations:** 
- Rate limiting is layer-1 (application). For DDoS, use CDN (Cloudflare) or WAF.
- Rate limits protect application layer, CDN protects network layer.

**Webhook Replay:** Stripe webhook limiter set to 100/min per IP. Stripe retry policy: exponential backoff up to 3 days. Sufficient buffer.

---

## References

- **Upstash Docs:** https://upstash.com/docs/redis/features/ratelimiting
- **Upstash Ratelimit Library:** `npm install @upstash/ratelimit`
- **Environment Variables:** `.env` (requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`)
- **Code Location:** `lib/ratelimit.ts`


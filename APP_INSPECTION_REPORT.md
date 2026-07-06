# DriveBook Application Inspection Report
**Date:** January 7, 2025  
**Inspector:** Kiro AI  
**Status:** Complete

---

## Executive Summary

The voice service architecture is solid, but **4 critical API routes are missing** from the Next.js app that the voice service expects to exist. Additionally, one known bug in Redis session recovery remains unfixed.

### Health Score: 7/10

**Strengths:**
- Well-architected voice service with clear separation of concerns
- Comprehensive prompt system with modular intent handlers
- Proper Twilio signature validation
- Session recovery mechanism in place
- Recent fix: dedicated vs general line routing ✅

**Critical Gaps:**
- 4 API routes referenced but not implemented
- Voice service auth not validated server-side
- Redis session bug still present
- OTP secret missing from env example (security risk)

---

## CRITICAL Issues (Must Fix Before Production)

### 1. Missing API Route: `/api/voice/instructors/lookup` ❌
**Severity:** BLOCKER  
**File:** Referenced in `drivebook-hybrid/services/drivebook-api-client.js:65`  
**Used by:** `instructor-service.js` → `voice-webhook.js` on every call

**Impact:** Voice service cannot identify which instructor owns a dialled number. All dedicated instructor lines will fail with voicemail fallback.

**Fix:**
```typescript
// app/api/voice/instructors/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.VOICE_SERVICE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) {
    return NextResponse.json({ error: 'Missing phone parameter' }, { status: 400 })
  }

  const instructor = await prisma.instructor.findFirst({
    where: { phone },
    select: {
      id: true,
      name: true,
      phone: true,
      hourlyRate: true,
      serviceAreas: true,
      copilotAgentEndpoint: true,
      baseLatitude: true,
      baseLongitude: true,
      serviceRadiusKm: true,
    }
  })

  if (!instructor) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(instructor)
}
```

---

### 2. Missing API Route: `/api/public/bookings/:id/timeline` ❌
**Severity:** BLOCKER  
**File:** Referenced in `main-app-proxy.js:276`, `contract.test.js:220-232`  
**Used by:** Lookup module when caller asks "what happened to my booking?"

**Impact:** AI cannot read booking history aloud to callers.

**Fix:**
```typescript
// app/api/public/bookings/[id]/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.nextUrl.searchParams.get('token')
  const bookingId = params.id

  // Verify booking exists and token matches
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { instructor: { select: { name: true } } }
  })

  if (!booking || booking.paymentToken !== token) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const events = [
    {
      timestamp: booking.createdAt,
      description: `Booking created`,
    }
  ]

  if (booking.status === 'CONFIRMED' && booking.paidAt) {
    events.push({
      timestamp: booking.paidAt,
      description: `Payment received`,
    })
  }

  if (booking.cancelledAt) {
    events.push({
      timestamp: booking.cancelledAt,
      description: `Booking cancelled`,
    })
  }

  events.push({
    timestamp: booking.startTime,
    description: `Lesson scheduled with ${booking.instructor.name}`,
  })

  return NextResponse.json({ events: events.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )})
}
```

---

### 3. Missing API Route: `/api/bookings/:id/cancellation-policy` ❌
**Severity:** BLOCKER  
**File:** Referenced in `main-app-proxy.js:281`, `contract.test.js:205-216`  
**Used by:** Cancellation module to calculate refund before cancelling

**Impact:** AI cannot tell caller exact refund amount before cancelling. Will default to generic policy explanation or guess.

**Fix:**
```typescript
// app/api/bookings/[id]/cancellation-policy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { package: true }
  })

  if (!booking) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const canCancel = ['PENDING_PAYMENT', 'CONFIRMED', 'PENDING'].includes(booking.status)
  const isPendingPayment = booking.status === 'PENDING_PAYMENT'
  const now = new Date()
  const lessonStart = new Date(booking.startTime)
  const hoursUntilLesson = (lessonStart.getTime() - now.getTime()) / (1000 * 60 * 60)

  let refundPercentage = 0
  let refundAmount = 0

  if (!isPendingPayment && canCancel) {
    if (hoursUntilLesson >= 48) {
      refundPercentage = 100
    } else if (hoursUntilLesson >= 24) {
      refundPercentage = 50
    }
    refundAmount = Math.round((booking.totalPrice || 0) * (refundPercentage / 100))
  }

  return NextResponse.json({
    canCancel,
    isPendingPayment,
    refundPercentage,
    refundAmount,
    hoursUntilLesson: Math.round(hoursUntilLesson * 10) / 10,
    reason: !canCancel ? 'Booking cannot be cancelled' : 
            isPendingPayment ? 'Payment not yet received' :
            hoursUntilLesson < 24 ? 'Less than 24 hours notice' :
            hoursUntilLesson < 48 ? '24-48 hours notice' : 
            '48+ hours notice'
  })
}
```

---

### 4. Missing API Route: `/api/notifications/sms` ❌
**Severity:** HIGH (workaround exists)  
**File:** Referenced in `drivebook-api-client.js:127`  
**Impact:** SMS sending via API is broken, but voice service has direct Twilio client so SMS still works

**Fix:** (Lower priority — voice service doesn't actually use this method currently)

---

## HIGH Priority Issues

### 5. Redis Bug: `minutesAgo()` Always Returns 0 🔴
**File:** `drivebook-hybrid/services/voice-session-service.js:243-252`  
**Status:** NOT FIXED  
**Impact:** Recovery prompt always says "just before" instead of accurate time

**Fix:**
```javascript
// In saveSession() — add createdAt timestamp
async function saveSession(phoneNumber, data) {
  const key = normalisePhone(phoneNumber);
  const timestamp = Date.now();

  if (usingRedis && redisClient) {
    const existing = await redisGet(key) || {};
    await redisSet(key, { 
      ...existing, 
      ...data, 
      phoneNumber: key,
      createdAt: existing.createdAt || timestamp  // preserve original if exists
    });
    return;
  }

  // Map fallback
  const existing = sessionMap.get(key) || {};
  sessionMap.set(key, {
    ...existing,
    ...data,
    phoneNumber: key,
    expiresAt: Date.now() + SESSION_TTL_MS,
    createdAt: existing.createdAt || timestamp  // preserve original if exists
  });
}

// In minutesAgo() — use createdAt
function minutesAgo(session) {
  if (session.createdAt) {
    const elapsed = Date.now() - session.createdAt;
    return Math.round((elapsed / 60000) * 10) / 10;
  }
  // Legacy fallback for old sessions without createdAt
  if (session.expiresAt) {
    const remaining = session.expiresAt - Date.now();
    const elapsed = SESSION_TTL_MS - remaining;
    return Math.round((elapsed / 60000) * 10) / 10;
  }
  return 0;
}
```

---

### 6. Voice Service Auth Not Validated Server-Side ⚠️
**Problem:** Voice service sends `x-api-key` header but Next.js app has no middleware to validate it

**Fix:** Create voice service auth middleware
```typescript
// lib/middleware/voiceServiceAuth.ts
import { NextRequest, NextResponse } from 'next/server'

export function requireVoiceServiceAuth(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.VOICE_SERVICE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null  // Auth passed
}
```

Then apply it to all `/api/voice/*` routes in the route handlers.

---

### 7. Missing Environment Variable: `OTP_HASH_SECRET` 🔒
**File:** `app/api/verifications/otp/route.ts:82`  
**Risk:** Production uses default secret 'dev-otp-secret-change-in-prod'

**Fix:** Add to `.env.example`:
```env
# OTP Verification Secret (generate with: openssl rand -hex 32)
OTP_HASH_SECRET="your-32-char-hex-secret"
```

---

## MEDIUM Priority Issues

### 8. Deprecated Route Still Callable: `/api/voice/bookings` ⚠️
**File:** `app/api/voice/bookings/route.ts`  
**Status:** Returns 410 GONE correctly ✅  
**Cleanup needed:** Remove route file or update `drivebook-api-client.js:86` to not call it

---

### 9. Contract Tests Pass Against Missing Routes ⚠️
**File:** `drivebook-hybrid/tests/contract.test.js`  
**Problem:** Tests for timeline and cancellation-policy routes pass because they mock responses

**Fix:** Either implement routes (already covered above) or mark tests as skipped:
```javascript
it.skip('should get booking cancellation policy', ...)
it.skip('should get booking timeline', ...)
```

---

### 10. Config Mismatch: `COPILOT_BASE_URL` Default
**File:** `.env.example` says `localhost:3002`, `utils/config.js` defaults to `localhost:3001`  
**Impact:** Minor confusion during setup  
**Fix:** Make them consistent (probably 3002 for copilot, 3001 is voice service)

---

## MINOR Issues

### 11. Unused Generated Code: `generated-server/` Directory
**Location:** `drivebook-hybrid/generated-server/`  
**Recommendation:** Delete or document its purpose

---

### 12. Bug Status Summary (from earlier analysis)

| Bug | Status | Notes |
|-----|--------|-------|
| #1: POST vs GET for availability slots | ✅ FIXED | `drivebook-api-client.js` now uses GET correctly |
| #2: Redis minutesAgo() returns 0 | ❌ NOT FIXED | See fix #5 above |
| #3: createBooking() calls deprecated route | ⚠️ PARTIALLY ADDRESSED | Route returns 410 but method still calls it |

---

## Architecture Health ✅

**What's Working Well:**
- Modular prompt system with clear intent separation
- Dual storage backend (Map/Redis) with automatic failover
- Session recovery on call-back within 10 minutes
- Payment status polling with 2-attempt limit (prevents webhook racing)
- Idempotency keys on all write operations
- Twilio signature validation (except in test/dev)
- Dedicated vs general line routing (just implemented ✅)

**Security Posture:**
- ✅ Twilio signature validation in production
- ✅ OTP verification before cancel/reschedule
- ✅ Payment tokens scoped per booking
- ⚠️ Voice service auth not validated (fix #6)
- ⚠️ OTP secret missing from env example (fix #7)

---

## Deployment Checklist

Before going live with voice service:

- [ ] Implement 4 missing API routes (fixes #1-4)
- [ ] Fix Redis minutesAgo() bug (fix #5)
- [ ] Add voice service auth middleware (fix #6)
- [ ] Add `OTP_HASH_SECRET` to `.env.example` (fix #7)
- [ ] Set `REDIS_URL` for persistent sessions in production
- [ ] Set `COPILOT_BASE_URL` to actual AI agent endpoint
- [ ] Set `SKIP_TWILIO_VALIDATION=false` in production
- [ ] Verify all Twilio numbers are provisioned and mapped to instructors in DB
- [ ] Test end-to-end: dedicated line → general line → booking → cancel → reschedule
- [ ] Test session recovery: hang up mid-booking → call back → resumes
- [ ] Test payment webhook delay: pay → immediately call back → status polling works

---

## Estimated Fix Time

| Priority | Task | Time |
|----------|------|------|
| CRITICAL | Implement 3 missing routes | 2-3 hours |
| HIGH | Fix Redis minutesAgo() bug | 30 mins |
| HIGH | Voice service auth middleware | 1 hour |
| MEDIUM | Add OTP_HASH_SECRET to env | 10 mins |
| MINOR | Cleanup deprecated route/method | 20 mins |
| **TOTAL** | | **4-5 hours** |

---

## Conclusion

The application is **nearly production-ready** for voice service. The core architecture is solid and the recent dedicated/general line routing fix closes a major gap. The 4 missing API routes are straightforward to implement — they're all read-only or use existing business logic.

**Recommended path forward:**
1. Implement the 3 critical missing routes today (2-3 hours)
2. Fix the Redis bug while you're in voice-session-service.js (30 mins)
3. Add voice auth middleware and OTP secret to env (1 hour)
4. Deploy to staging and run the testing checklist above
5. Go live with voice service

Once these fixes are in, the system is production-grade.

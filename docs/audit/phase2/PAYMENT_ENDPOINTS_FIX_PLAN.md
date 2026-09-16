# Payment Endpoints Security Fix Plan

**Date:** 2026-09-11 20:53:30

---

## 🎯 Decision: Simplify verify/route.ts to Read-Only

**Rationale:**
- Webhook handler is now fully secured (all P0 fixes applied)
- Webhook is the single source of truth for financial operations
- verify route should only poll Stripe status, never mutate wallet/booking
- Eliminates double-crediting risk entirely
- Simpler = more secure

---

## 🔴 CRITICAL Fixes (Priority 1 - Do Immediately)

### Fix 1: create-intent - Move PaymentIntent creation inside lock transaction
**File:** `app/api/payments/create-intent/route.ts`
**Lines:** 148-194
**Issue:** PaymentIntent created outside transaction → orphan risk if DB update fails

**Fix:**
\\\	ypescript
const dedupeResult = await prisma.\(async (tx) => {
  await tx.\\SELECT pg_advisory_xact_lock(hashtext(\))\;
  
  const freshBooking = await tx.booking.findUnique({...});
  // ... validation checks ...
  
  if (existingIntent && reusable) {
    return { status: 'reuse', clientSecret: ... };
  }
  
  // Create PaymentIntent INSIDE transaction
  const paymentIntent = await stripeService.createPaymentIntent({...});
  
  // Update booking INSIDE same transaction
  await tx.booking.update({
    where: { id: bookingId },
    data: { paymentIntentId: paymentIntent.paymentIntentId }
  });
  
  return { status: 'created', clientSecret: paymentIntent.clientSecret, amount: paymentIntent.amount };
}, {
  isolationLevel: 'Serializable',  // ✅ Add SERIALIZABLE
  maxWait: 5000,
  timeout: 10000
});
\\\

**Impact:** Prevents orphaned PaymentIntents in Stripe

---

### Fix 2: create-intent - Reject client-supplied amount for wallet payments
**File:** `app/api/payments/create-intent/route.ts`
**Lines:** 52-54

**Current (vulnerable):**
\\\	ypescript
const paymentAmount = amount || transaction.amount;
\\\

**Fix:**
\\\	ypescript
// Always use transaction.amount - never trust client
const paymentAmount = transaction.amount;

if (amount && amount !== transaction.amount) {
  return NextResponse.json({ 
    error: 'Amount mismatch - expected \' 
  }, { status: 400 });
}
\\\

**Impact:** Prevents amount manipulation attacks

---

### Fix 3: verify - Simplify to read-only status check
**File:** `app/api/payments/verify/route.ts`
**Entire file**

**Replace POST handler with:**
\\\	ypescript
export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId, bookingId, paymentToken } = await req.json();

    if (!paymentIntentId || !bookingId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validate auth: require paymentToken OR session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !paymentToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If paymentToken provided, validate it
    if (paymentToken) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { paymentToken: true }
      });
      
      if (booking?.paymentToken !== paymentToken) {
        return NextResponse.json({ error: 'Invalid payment token' }, { status: 403 });
      }
    }

    // ✅ READ ONLY: Just check Stripe status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify PI belongs to this booking
    if (paymentIntent.metadata?.bookingId !== bookingId) {
      return NextResponse.json({ 
        error: 'Payment intent does not match booking' 
      }, { status: 400 });
    }

    // Check current booking status from DB
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, isPaid: true }
    });

    // Return status - let webhook handle all mutations
    return NextResponse.json({
      stripeStatus: paymentIntent.status,
      bookingStatus: booking?.status,
      isPaid: booking?.isPaid,
      amountReceived: paymentIntent.amount_received,
      message: paymentIntent.status === 'succeeded' 
        ? 'Payment confirmed. Processing your booking...' 
        : 'Payment in progress'
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
\\\

**Remove GET handler entirely** or restrict to SUPER_ADMIN only with heavy logging

**Impact:** 
- Eliminates double-crediting risk
- Eliminates amount manipulation risk  
- Eliminates unauthorized wallet crediting
- Single source of truth (webhook)

---

### Fix 4: create-intent - Add rate limiting
**File:** `app/api/payments/create-intent/route.ts`
**Lines:** 13 (after imports)

**Add:**
\\\	ypescript
import { checkRateLimitStrict } from '@/lib/ratelimit';
import { getRateLimitIdentifier } from '@/lib/utils/request';

// Rate limit config
const createIntentRateLimit = {
  requests: 10,
  window: 60, // 10 requests per minute per user/IP
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, transactionId } = body;

    // ✅ Rate limiting BEFORE any logic
    const session = await getServerSession(authOptions);
    const rateLimitId = getRateLimitIdentifier(
      session?.user?.id, 
      req.headers.get('x-forwarded-for'),
      'create_intent'
    );
    
    const rateLimitResult = await checkRateLimitStrict(
      createIntentRateLimit, 
      rateLimitId
    );
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          }
        }
      );
    }

    // ... rest of handler
\\\

**Impact:** Prevents Stripe API abuse

---

## 🟡 HIGH Priority Fixes (Priority 2 - Do Soon)

### Fix 5: Remove all `as any` casts
**Files:** Both files
**Issue:** Bypasses TypeScript safety

**Fix:** Update Prisma schema or create proper types
\\\	ypescript
// BEFORE:
const booking = await (prisma.booking.findUnique as any)({...}) as any;

// AFTER:
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  include: { 
    customer: { include: { user: true } },
    provider: { select: { user: true } }
  }
});
\\\

---

### Fix 6: Hash paymentToken in DB
**File:** `app/api/payments/create-intent/route.ts`
**Issue:** Plain text tokens in DB

**Fix:** Hash with crypto before storing, compare hashes
\\\	ypescript
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// When creating booking:
const plainToken = generateToken();
const hashedToken = hashToken(plainToken);
await prisma.booking.create({
  data: { ...data, paymentToken: hashedToken }
});

// When validating:
const hashedInput = hashToken(paymentToken);
if (booking.paymentToken !== hashedInput) {
  return 403;
}
\\\

---

## 📋 Implementation Order

1. ✅ **Fix 3 first** (simplify verify to read-only) - eliminates most critical risks
2. ✅ **Fix 1** (move PaymentIntent inside transaction) - prevents orphans
3. ✅ **Fix 2** (reject client amount for wallet) - prevents manipulation
4. ✅ **Fix 4** (rate limiting) - prevents abuse
5. Fix 5 (type safety) - code quality
6. Fix 6 (hash tokens) - long-term security

---

## ✅ Testing Checklist

After fixes:
- [ ] Test booking payment flow (book now)
- [ ] Test wallet payment flow (book later)
- [ ] Test concurrent PaymentIntent creation (same bookingId)
- [ ] Test webhook → verify race condition (verify should just report status)
- [ ] Test amount manipulation (should be rejected)
- [ ] Test rate limiting (11th request should fail)
- [ ] Test unauthenticated verify access (should require paymentToken)
- [ ] Verify no orphaned PaymentIntents in Stripe after crashes

---

Generated: 2026-09-11

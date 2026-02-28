# 🔍 SUBSCRIPTION PAYMENT INTEGRATION AUDIT

**Date:** February 26, 2026  
**Status:** ⚠️ ISSUES FOUND  
**Priority:** HIGH

---

## 🚨 CRITICAL ISSUES FOUND

### Issue #1: Duplicate Webhook Handlers ⚠️
**Severity:** HIGH  
**Impact:** Race conditions, duplicate processing

**Problem:**
```
/api/payments/webhook/route.ts
  - Handles: payment_intent.succeeded
  - Handles: customer.subscription.* (lines 44-51)

/api/subscriptions/webhook/route.ts
  - Handles: customer.subscription.* (entire file)
```

**Why This is Bad:**
- Stripe sends events to ONE webhook URL
- If both are configured, events processed twice
- If only one configured, other handler never runs
- Creates confusion about which handler is "real"

**Fix Required:**
Consolidate all Stripe events into ONE webhook handler.

---

### Issue #2: No Idempotency Protection ❌
**Severity:** CRITICAL  
**Impact:** Duplicate subscription charges, incorrect status

**Problem:**
```typescript
// app/api/subscriptions/webhook/route.ts
async function handleSubscriptionUpdate(subscription: any) {
  // No check if already processed
  await prisma.instructor.update({ ... });
  await prisma.subscription.update({ ... });
}
```

**Why This is Bad:**
- Stripe retries webhooks on failure
- Same event could be processed multiple times
- Could charge customer twice
- Could create duplicate subscription records

**Fix Required:**
Add idempotency key check before processing.

---

### Issue #3: No Audit Logging ❌
**Severity:** HIGH  
**Impact:** No forensic trail for disputes

**Problem:**
- Subscription changes not logged
- Can't track who upgraded/downgraded
- Can't prove what happened in disputes
- No security monitoring

**Fix Required:**
Add audit logging for all subscription events.

---

### Issue #4: Missing Rate Limiting ❌
**Severity:** MEDIUM  
**Impact:** Webhook abuse possible

**Problem:**
- No rate limiting on webhook endpoints
- Attacker could spam webhooks
- Could cause database overload
- No protection against replay attacks

**Fix Required:**
Add rate limiting to webhook endpoints.

---

### Issue #5: Inconsistent Webhook Verification ⚠️
**Severity:** MEDIUM  
**Impact:** Security inconsistency

**Problem:**
```typescript
// payments/webhook - Strict verification
if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
  event = stripe.webhooks.constructEvent(...)
}

// subscriptions/webhook - Lenient verification
if (process.env.STRIPE_WEBHOOK_SECRET) {
  // Different logic
}
```

**Fix Required:**
Unify webhook verification logic.

---

### Issue #6: No Transaction Wrapper ⚠️
**Severity:** MEDIUM  
**Impact:** Partial updates possible

**Problem:**
```typescript
// Multiple database operations not atomic
await prisma.instructor.update({ ... });
await prisma.subscription.update({ ... });
// If second fails, first succeeds = inconsistent state
```

**Fix Required:**
Wrap in `prisma.$transaction()`.

---

## 📊 SECURITY ASSESSMENT

| Security Layer | Status | Risk |
|---------------|--------|------|
| Webhook Signature Verification | ⚠️ Inconsistent | Medium |
| Idempotency Protection | ❌ Missing | Critical |
| Rate Limiting | ❌ Missing | Medium |
| Audit Logging | ❌ Missing | High |
| Atomic Operations | ⚠️ Partial | Medium |
| Error Handling | ✅ Present | Low |

**Overall Security Score:** 40% ⚠️

---

## 🔧 RECOMMENDED FIXES

### Fix #1: Consolidate Webhooks (CRITICAL)

**Option A: Single Webhook (Recommended)**
```typescript
// app/api/stripe/webhook/route.ts
export async function POST(req: NextRequest) {
  const event = await verifyWebhook(req);
  
  switch (event.type) {
    // Booking payments
    case 'payment_intent.succeeded':
      await handleBookingPayment(event.data.object);
      break;
    
    // Subscription events
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;
    
    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object);
      break;
    
    case 'invoice.payment_succeeded':
      await handleInvoicePayment(event.data.object);
      break;
    
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }
}
```

**Option B: Separate Webhooks with Different URLs**
```
Stripe Dashboard:
  Webhook 1: /api/payments/webhook
    - payment_intent.* events only
  
  Webhook 2: /api/subscriptions/webhook
    - customer.subscription.* events only
    - invoice.* events only
```

---

### Fix #2: Add Idempotency Protection (CRITICAL)

```typescript
async function handleSubscriptionUpdate(subscription: any) {
  const idempotencyKey = `subscription_${subscription.id}_${subscription.updated}`;
  
  // Check if already processed
  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey }
  });
  
  if (existing) {
    console.log('Event already processed:', idempotencyKey);
    return; // Skip duplicate
  }
  
  // Process in transaction
  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await tx.webhookEvent.create({
      data: {
        idempotencyKey,
        eventType: 'subscription.updated',
        stripeEventId: subscription.id,
        processedAt: new Date()
      }
    });
    
    // Update subscription
    await tx.instructor.update({ ... });
    await tx.subscription.update({ ... });
  });
}
```

**Schema Addition Required:**
```prisma
model WebhookEvent {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  idempotencyKey  String   @unique
  eventType       String
  stripeEventId   String
  processedAt     DateTime @default(now())
  metadata        Json?
}
```

---

### Fix #3: Add Audit Logging (HIGH)

```typescript
import { logSubscriptionAction } from '@/lib/services/auditLogger';

async function handleSubscriptionUpdate(subscription: any) {
  // ... process subscription
  
  // Log the change
  await logSubscriptionAction({
    instructorId: metadata.instructorId,
    action: 'SUBSCRIPTION_UPDATED',
    metadata: {
      tier: metadata.tier,
      status: subscription.status,
      amount: subscription.items.data[0].price.unit_amount / 100,
      stripeSubscriptionId: subscription.id
    }
  });
}
```

---

### Fix #4: Add Rate Limiting (MEDIUM)

```typescript
import { webhookRateLimit, checkRateLimitStrict } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const rateLimitId = getRateLimitIdentifier(
    undefined,
    req.headers.get('x-forwarded-for'),
    'webhook'
  );
  
  const rateLimitResult = await checkRateLimitStrict(webhookRateLimit, rateLimitId);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many webhook requests' },
      { status: 429 }
    );
  }
  
  // Process webhook...
}
```

**Add to lib/ratelimit.ts:**
```typescript
export const webhookRateLimit = createRateLimiter(100, '1 m');
```

---

### Fix #5: Unify Webhook Verification (MEDIUM)

```typescript
async function verifyStripeWebhook(req: NextRequest): Promise<Stripe.Event> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  
  if (!sig) {
    throw new Error('Missing stripe-signature header');
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set - webhook not verified!');
    return JSON.parse(body);
  }
  
  try {
    return stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook verification failed:', err.message);
    throw new Error('Invalid webhook signature');
  }
}
```

---

### Fix #6: Add Transaction Wrapper (MEDIUM)

```typescript
async function handleSubscriptionUpdate(subscription: any) {
  await prisma.$transaction(async (tx) => {
    // All updates in one transaction
    await tx.instructor.update({ ... });
    await tx.subscription.update({ ... });
    await tx.webhookEvent.create({ ... });
  }, {
    maxWait: 5000,
    timeout: 10000
  });
}
```

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1: Critical (Must Fix Before Launch)
1. ✅ Decide on webhook architecture (single vs separate)
2. ✅ Add idempotency protection
3. ✅ Add transaction wrappers
4. ✅ Test with Stripe CLI

### Phase 2: High Priority (Fix This Week)
1. Add audit logging
2. Unify webhook verification
3. Add comprehensive error handling
4. Test retry scenarios

### Phase 3: Medium Priority (Nice to Have)
1. Add rate limiting
2. Add monitoring/alerting
3. Add webhook event dashboard
4. Document webhook setup

---

## 🧪 TESTING CHECKLIST

### Idempotency Tests
- [ ] Send same webhook twice → Only processed once
- [ ] Verify no duplicate subscriptions created
- [ ] Check WebhookEvent table has unique keys

### Subscription Flow Tests
- [ ] Create subscription → Instructor updated
- [ ] Update subscription → Commission rate changed
- [ ] Cancel subscription → Status updated
- [ ] Payment failed → Status set to PAST_DUE

### Error Handling Tests
- [ ] Invalid signature → 400 error
- [ ] Missing metadata → Logged and skipped
- [ ] Database error → Webhook retried by Stripe
- [ ] Partial failure → Transaction rolled back

### Rate Limiting Tests
- [ ] 101 webhooks in 1 minute → 101st gets 429
- [ ] Verify rate limit headers present

---

## 📋 STRIPE DASHBOARD CONFIGURATION

### Current Setup (Needs Review)
```
Webhook Endpoints:
  1. https://yourdomain.com/api/payments/webhook
     Events: payment_intent.*, customer.subscription.*
  
  2. https://yourdomain.com/api/subscriptions/webhook
     Events: customer.subscription.*, invoice.*
```

### Recommended Setup (Option A)
```
Webhook Endpoints:
  1. https://yourdomain.com/api/stripe/webhook
     Events: ALL (or specific list)
     
Remove:
  - /api/payments/webhook
  - /api/subscriptions/webhook
```

### Recommended Setup (Option B)
```
Webhook Endpoints:
  1. https://yourdomain.com/api/payments/webhook
     Events: payment_intent.succeeded, payment_intent.payment_failed
  
  2. https://yourdomain.com/api/subscriptions/webhook
     Events: customer.subscription.*, invoice.*
     
Update: Remove subscription events from payments webhook
```

---

## 🚀 DEPLOYMENT PLAN

### Step 1: Add Idempotency (Critical)
1. Add WebhookEvent model to schema
2. Run migration
3. Update webhook handlers
4. Test with Stripe CLI

### Step 2: Consolidate or Separate (Critical)
1. Choose architecture (A or B)
2. Update webhook handlers
3. Update Stripe dashboard
4. Test all event types

### Step 3: Add Audit Logging (High)
1. Extend audit logger for subscriptions
2. Add logging to all handlers
3. Verify logs created

### Step 4: Add Rate Limiting (Medium)
1. Add webhook rate limiter
2. Apply to all webhook endpoints
3. Test rate limit behavior

---

## 📊 RISK ASSESSMENT

### Before Fixes
| Risk | Likelihood | Impact | Overall |
|------|-----------|--------|---------|
| Duplicate subscription charges | High | Critical | 🔴 Critical |
| Race conditions | Medium | High | 🟠 High |
| No audit trail | High | Medium | 🟠 High |
| Webhook abuse | Low | Medium | 🟡 Medium |

### After Fixes
| Risk | Likelihood | Impact | Overall |
|------|-----------|--------|---------|
| Duplicate subscription charges | Low | Critical | 🟢 Low |
| Race conditions | Low | High | 🟢 Low |
| No audit trail | None | Medium | 🟢 None |
| Webhook abuse | Low | Medium | 🟢 Low |

---

## 🎓 LESSONS LEARNED

### What Went Wrong
1. **Webhook Duplication** - Created two handlers without clear separation
2. **No Idempotency** - Didn't consider Stripe retry behavior
3. **No Audit Trail** - Forgot subscriptions are financial events too

### Best Practices
1. **One Webhook Per Stripe Account** - Easier to manage
2. **Always Use Idempotency** - Webhooks can be retried
3. **Log Everything Financial** - Subscriptions = money
4. **Test with Stripe CLI** - Catch issues before production

---

## 📚 RELATED DOCUMENTS

- `PHASE_3_SECURITY_COMPLETE.md` - Booking security fixes
- `CRITICAL_FIXES_DEPLOYED.md` - Client-side fixes
- `FOUNDER_VALIDATION_AUDIT.md` - Financial integrity audit

---

## ✅ COMPLETION CRITERIA

- [ ] Webhook architecture decided
- [ ] Idempotency protection added
- [ ] Audit logging implemented
- [ ] Transaction wrappers added
- [ ] Rate limiting applied
- [ ] All tests passing
- [ ] Stripe dashboard configured
- [ ] Documentation updated

---

**Document Created:** February 26, 2026  
**Status:** Issues Identified - Fixes Required  
**Priority:** HIGH - Fix before processing real subscriptions

---

## 🎯 RECOMMENDATION

**DO NOT process real subscription payments until these fixes are applied.**

The current implementation has critical vulnerabilities that could lead to:
- Duplicate charges
- Inconsistent subscription status
- No audit trail for disputes
- Race conditions

**Estimated Fix Time:** 4-6 hours  
**Risk Level:** HIGH if not fixed  
**Impact:** Could lose money and customer trust

---

**Next Action:** Implement fixes in priority order (Phase 1 first)

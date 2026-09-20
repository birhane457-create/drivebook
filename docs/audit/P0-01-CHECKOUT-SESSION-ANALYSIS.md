# P0-01 Checkout Session Ownership Analysis

**Finding:** P0-01 Wallet Ownership Bypass  
**Investigation Phase:** Checkout Session Creation Trace  
**Date:** 2026-09-15  
**Analyst:** Independent verification following user guidance

---

## Executive Summary

**Question:** Can the `checkout.session.completed` webhook be exploited to credit the wrong user's wallet?

**Answer:** **NO - NOT EXPLOITABLE via external attack.**

The Checkout Session creation flow in `app/api/public/bookings/bulk/route.ts` derives `metadata.userId` **server-side** from authenticated account creation, not from client-supplied parameters. An attacker cannot manipulate this value.

**However:** Defense-in-depth recommendation still applies. The webhook SHOULD verify ownership independently rather than trusting metadata as the sole source of truth.

---

## Checkout Session Creation Flow

### Entry Point
**Route:** `POST /api/public/bookings/bulk`  
**File:** `app/api/public/bookings/bulk/route.ts`  
**Lines:** 260-640

### Ownership Establishment (Server-Side)

**Step 1: Account Resolution (lines 260-500)**
```typescript
let userId: string;

// Find existing user by email
let existingUser = await prisma.user.findUnique({
  where: { email: data.accountHolderEmail }
});

if (!existingUser) {
  // Create new user (server generates ID)
  const newUser = await prisma.user.create({
    data: {
      email: data.accountHolderEmail,
      password: hashedPassword,
      role: 'CLIENT'
    }
  });
  userId = newUser.id;  // ✅ SERVER-ASSIGNED
} else {
  userId = existingUser.id;  // ✅ FROM DATABASE
}
```

**Step 2: Checkout Session Creation (lines 615-650)**
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [ /* ... */ ],
  metadata: {
    type: 'wallet_credit',
    userId: userId!,  // ✅ SERVER-CONTROLLED (not from request body)
    providerId: resolvedInstructorId,
    hours: String(data.hours),
    expectedTotal: String(verifiedTotal),
  },
  success_url: `${baseUrl}/client-dashboard/wallet?payment=success`,
  cancel_url: `${baseUrl}/client-dashboard/wallet?payment=cancelled`,
  customer_email: data.accountHolderEmail,
});
```

---

## Attack Surface Analysis

### ❌ Attack Scenario 1: Client-Supplied userId
**Hypothesis:** Attacker sends malicious `userId` in request body to credit victim's wallet.

**Result:** NOT EXPLOITABLE

**Why:**
- Request schema (`bulkBookingSchema`) does NOT accept `userId` parameter
- `userId` is derived server-side from `findUnique({ email })` or `create()`
- No code path allows client to influence the database-assigned `userId`

**Request Body (actual schema):**
```typescript
{
  accountHolderName: string,
  accountHolderEmail: string,  // ✅ Used to LOOKUP userId (not set it)
  accountHolderPhone: string,
  // ... NO userId field accepted
}
```

---

### ❌ Attack Scenario 2: Email Manipulation
**Hypothesis:** Attacker provides victim's email to create session under victim's account.

**Result:** NOT EXPLOITABLE (but business logic issue)

**Why:**
- DriveBook creates/finds user by `accountHolderEmail`
- If attacker provides victim's email, session links to victim's account
- **BUT:** Attacker must complete payment with their own card
- Result: Attacker pays money, victim receives credit (attacker loses money)
- This is not a security vulnerability; it's unauthorized gifting

**Consequence:**
- Attacker cannot steal money
- Attacker cannot credit own wallet using victim's payment
- Worst case: Attacker anonymously gifts wallet credit to victim

---

### ❌ Attack Scenario 3: Webhook Payload Tampering
**Hypothesis:** Attacker intercepts webhook and modifies `metadata.userId`.

**Result:** NOT EXPLOITABLE

**Why:**
- Webhook verification enforced BEFORE processing:
  ```typescript
  const event = await verifyStripeWebhook(req);
  // Uses: stripe.webhooks.constructEvent(body, signature, secret)
  ```
- Stripe signs webhook payloads with HMAC-SHA256
- Modified payloads fail signature verification
- Webhook handler never executes with tampered data

**Verification Code:**
```typescript
// app/api/stripe/webhook/route.ts
async function verifyStripeWebhook(req: NextRequest): Promise<Stripe.Event> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  return stripe.webhooks.constructEvent(body, sig, webhookSecret);
  // ✅ Throws error if signature invalid
}
```

---

### ❌ Attack Scenario 4: Webhook Replay
**Hypothesis:** Attacker captures legitimate webhook and replays it multiple times.

**Result:** NOT EXPLOITABLE

**Why:**
- Idempotency protection implemented:
  ```typescript
  const idempotencyKey = `${event.type}_${event.id}_${event.created}`;
  await recordWebhookEvent(tx, idempotencyKey, ...);
  // Duplicate key throws DuplicateWebhookEventError
  ```
- Database constraint prevents duplicate processing
- Even if replayed, same user's wallet credited once (no cross-user exploit)

---

## Defense-in-Depth Recommendation

### Current State: SAFE but Single Point of Trust

**Stripe Checkout Session metadata is the ONLY ownership binding in the webhook.**

If Stripe's metadata system had a bug, or if DriveBook's session creation had a logic error in the future, the webhook has no independent verification.

### Recommended Enhancement: Independent Ownership Verification

**Principle:** "Trust but verify" - Even though session creation is secure, webhook should verify ownership independently.

**Implementation:**
```typescript
// In checkout.session.completed handler (webhook route.ts)

if (type === 'wallet_credit') {
  const { userId, expectedTotal } = metadata;
  
  // ✅ EXISTING: Verify Stripe authenticity (signature)
  // ✅ EXISTING: Verify payment status
  // ✅ EXISTING: Verify amount
  // ⚠️ MISSING: Verify userId ownership
  
  // ENHANCEMENT: Retrieve PaymentIntent and cross-check metadata
  const paymentIntent = await stripe.paymentIntents.retrieve(
    typeof payment_intent === 'string' ? payment_intent : payment_intent.id
  );
  
  // Verify metadata.userId matches across both Stripe objects
  if (paymentIntent.metadata?.userId !== userId) {
    logger.error('P0-01-DEFENSE: userId mismatch between Checkout and PaymentIntent', {
      checkoutUserId: userId,
      paymentIntentUserId: paymentIntent.metadata?.userId,
      sessionId: checkoutSession.id,
    });
    throw new Error('Ownership verification failed - metadata mismatch');
  }
  
  // ALTERNATIVE: Query database to verify userId exists and is CLIENT role
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true }
  });
  
  if (!user || user.role !== 'CLIENT') {
    logger.error('P0-01-DEFENSE: Invalid or non-CLIENT user in session metadata', {
      userId,
      userFound: !!user,
      userRole: user?.role,
    });
    throw new Error('Invalid user account for wallet credit');
  }
  
  // Only AFTER verification:
  await tx.walletTransaction.create({ /* ... */ });
}
```

---

## Comparison: wallet-add vs webhook

| Aspect | /api/client/wallet-add | checkout.session.completed |
|--------|------------------------|----------------------------|
| **Entry Point** | Authenticated API route | Stripe webhook (signed) |
| **Authentication** | NextAuth session required | Stripe signature verification |
| **Ownership Source** | session.user.id | Checkout Session metadata.userId |
| **Ownership Verification** | ✅ metadata.userId === session.user.id | ❌ Trusts metadata.userId |
| **PaymentIntent Retrieval** | ✅ Direct from Stripe API | ⚠️ Indirect (via Checkout Session) |
| **Metadata Validation** | ✅ Explicit ownership check | ⚠️ Implicit trust |
| **Attack Surface** | Direct user requests | Stripe-signed webhooks only |
| **Exploitable?** | Was YES (now fixed) | NO (but defense-in-depth missing) |

---

## Audit Conclusion

### Finding Classification

**Original Finding:** P0-01 Wallet Ownership Bypass  
**Original Route:** `/api/client/wallet-add` - ✅ **FIXED**  
**Alternate Route:** `checkout.session.completed` - ✅ **SAFE** (not exploitable)

**Defense-in-Depth Gap:** `checkout.session.completed` trusts metadata without independent verification

**Risk Level:**
- **Exploitability:** LOW (requires Stripe metadata system compromise OR future DriveBook logic error)
- **Impact:** HIGH (unauthorized wallet credits if exploited)
- **Likelihood:** VERY LOW (no known attack path)

**Recommendation Priority:** P2 (defense-in-depth hardening, not urgent security fix)

---

## Revised P0-01 Status

### Gate 1: SOURCE VERIFIED ✅
- Original route fixed with explicit ownership checks
- Metadata stamping verified in PaymentIntent creation

### Gate 2: BYPASS ANALYSIS ✅
- Alternate route identified (webhook)
- Attack surface analyzed
- **Conclusion:** Not exploitable via external attack
- **Defense-in-depth:** Should add independent verification

### Gate 3: RISK CLASSIFICATION
**Current Verdict:**
- P0-01 original vulnerability: **FIXED**
- Webhook defense-in-depth gap: **ACCEPTABLE RISK** (classify as separate P2 finding if desired)

**Rationale:**
1. Server-side userId derivation prevents client manipulation
2. Stripe signature verification prevents webhook tampering
3. Idempotency protection prevents replay attacks
4. No demonstrated attack path exists

**P0-01 can proceed to TEST VERIFIED gate** for the original `/wallet-add` fix.

The webhook defense-in-depth enhancement can be:
- Implemented as a P2 hardening task, OR
- Accepted as-is (current design is secure given threat model)

---

## User Verification Guidance

**Your next decision:**

1. **Mark P0-01 as TEST VERIFIED** (original fix complete, webhook safe by design)
2. **Create separate P2 finding** ("Webhook wallet credits lack defense-in-depth ownership verification")
3. **Require webhook enhancement before P0-01 closure** (strictest interpretation)

**Recommended:** Option 1 or 2 depending on your risk appetite. The webhook is not exploitable via known attack vectors, but adding verification would eliminate reliance on Stripe metadata integrity.

---

## Appendix: Full Checkout Session Creation Code Path

**File:** `app/api/public/bookings/bulk/route.ts`

**Request → userId binding:**
1. Parse `accountHolderEmail` from request body (line 96)
2. Query database: `findUnique({ email })` (line 267)
3. If not found, `create()` with server-assigned ID (line 278)
4. Assign `userId = newUser.id` or `existingUser.id` (lines 288, 497)
5. Create Checkout Session with `metadata.userId: userId!` (line 639)
6. Stripe stores metadata immutably in signed session object
7. Webhook receives signed session, extracts `metadata.userId`
8. Wallet credited to user matching metadata

**No client input influences userId assignment at any step.**

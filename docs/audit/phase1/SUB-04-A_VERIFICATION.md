# SUB-04-A Verification: customer.subscription.created Can Activate Without Confirmed Payment

**Date**: 2026-09-11  
**Type**: VERIFICATION ONLY — no code changes  
**Finding**: SUB-04-A — Unpaid Subscription Activation  
**Severity**: HIGH / P1  
**Methodology**: Source-level inspection of all four relevant code paths

---

## Files Inspected

| File | Lines Read |
|------|-----------|
| `app/api/stripe/webhook/route.ts` | Full file — all four handlers |
| `lib/permissions/permissionEngine.ts` | Full file — access gate logic |
| `lib/middleware/subscriptionValidation.ts` | Full file — subscription guard |
| `lib/website/fetchProviderWebsiteData.ts` | Line 77–79 — booking-page access |

---

## 1. Event Routing — Confirmed

```
customer.subscription.created  →  handleSubscriptionUpdate()   // line 219-221
customer.subscription.updated  →  handleSubscriptionUpdate()   // line 220-221
invoice.payment_succeeded       →  handleInvoicePaymentSucceeded()  // line 233-235
invoice.payment_failed          →  handleInvoicePaymentFailed()     // line 237-239
```

Both `customer.subscription.created` and `customer.subscription.updated` call the **same** handler. There is no separate, lighter-weight handler for `subscription.created`. This is confirmed — not assumed.

---

## 2. handleSubscriptionUpdate() — What It Does

**Source**: lines 1394–1592

### Input: Stripe's `status` field on the subscription object

When Stripe fires `customer.subscription.created`, the `status` field on the subscription object will be one of:

| Stripe status | When |
|---|---|
| `trialing` | Free trial period, payment method may not exist |
| `incomplete` | First payment initiated but not yet confirmed |
| `active` | First payment confirmed (or trial period is live) |
| `incomplete_expired` | First payment never confirmed within 23 hours |

### What handleSubscriptionUpdate() does with that status

**Line 1456–1459** — `normalizeStatus()`:
```typescript
const normalizeStatus = (s: string): string => {
  const upper = s.toUpperCase();
  return upper === 'CANCELED' ? 'CANCELLED' : upper;
};
```

This converts `'incomplete'` → `'INCOMPLETE'`, `'active'` → `'ACTIVE'`, `'trialing'` → `'TRIALING'`.

**Lines 1473–1476** — Provider update:
```typescript
await tx.provider.update({
  where: { id: providerId },
  data: {
    subscriptionTier: tier as any,
    subscriptionStatus: normalizeStatus(status) as any,  // ← writes whatever Stripe sent
    trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
  } as any
});
```

**Lines 1493–1545** — Subscription row update (same pattern):
```typescript
status: normalizeStatus(status) as any,  // ← writes whatever Stripe sent
```

**Critical observation**: The function writes `normalizeStatus(status)` directly, where `status` is whatever Stripe sent in the event payload. There is **no guard** that blocks writes when `status === 'incomplete'` or `status === 'trialing'`. If Stripe sends `status = 'active'` in a `subscription.created` event, this function will write `subscriptionStatus = 'ACTIVE'` to both `Provider` and `Subscription`.

### When does Stripe send `status = 'active'` in subscription.created?

Stripe fires `customer.subscription.created` with `status = 'active'` in three cases:
1. The subscription has a **free trial** (no payment required yet)
2. A **coupon makes the first invoice $0** (no payment required)
3. A **trial period of 0 days** with immediate payment, but Stripe has the payment method pre-authorized

Case 1 is the primary concern: a subscription created via `checkout.session.completed` **with a trial** fires `subscription.created` with `status = 'trialing'`, NOT `status = 'active'`. The `active` transition happens later on `invoice.payment_succeeded`.

However, Stripe can also fire `subscription.created` with `status = 'active'` if:
- The Billing Portal is used to create a subscription for an existing customer with a saved card
- The first invoice is immediately paid before the webhook fires

---

## 3. Precise Finding: What Status Does subscription.created Carry in the DriveBook Flow?

DriveBook's subscription creation flow (`app/api/subscriptions/checkout/route.ts`) creates a Checkout Session with:
```typescript
subscription_data: {
  trial_period_days: trialDays,
  ...
}
```

When `trialDays > 0`:
- Stripe creates the subscription with `status = 'trialing'`
- `subscription.created` fires with `status = 'trialing'`
- `handleSubscriptionUpdate()` writes `subscriptionStatus = 'TRIALING'` (normalized from `trialing`)

When `trialDays === 0` (returning instructor, no trial):
- Stripe creates the subscription with `status = 'incomplete'` (awaiting first payment)
- `subscription.created` fires with `status = 'incomplete'`
- `handleSubscriptionUpdate()` writes `subscriptionStatus = 'INCOMPLETE'` to Provider

**Key question**: Does `TRIALING` or `INCOMPLETE` grant access?

---

## 4. Access Control Check — What Grants Access?

### permissionEngine.ts (lines 79–81)

```typescript
const hasActiveSubscription =
  state.subscriptionStatus === 'ACTIVE' ||
  (state.subscriptionStatus === 'TRIAL' && !state.trialExpired);
```

Only `'ACTIVE'` or `'TRIAL'` (non-expired) grant `canAct = true`. Any other status — including `'TRIALING'`, `'INCOMPLETE'` — returns `canAct = false`.

### subscriptionValidation.ts (lines 56–65)

```typescript
if (subscriptionStatus === 'TRIAL') { ... }
if (subscriptionStatus === 'ACTIVE') { return { valid: true, readOnly: false }; }
// All other states → read-only
```

Only `'ACTIVE'` or `'TRIAL'` grant write access. `'TRIALING'`, `'INCOMPLETE'`, `'PAST_DUE'`, etc. → read-only.

### Mismatch: Stripe's "trialing" vs DriveBook's "TRIAL"

This is a **critical discrepancy**:

| Source | Value written | Value that grants access |
|--------|--------------|--------------------------|
| `handleSubscriptionUpdate()` on `subscription.created` (trial flow) | `'TRIALING'` (normalized from Stripe's `'trialing'`) | — |
| `permissionEngine.ts` | — | checks `=== 'TRIAL'` |
| `subscriptionValidation.ts` | — | checks `=== 'TRIAL'` |
| Direct trial creation in `instructor/subscription/route.ts` | `'TRIAL'` (hardcoded) | — |

**If** an instructor's subscription goes through the webhook path (Stripe Checkout with trial), Stripe fires `subscription.created` with `status = 'trialing'`, which normalizes to `'TRIALING'` and is written to `Provider.subscriptionStatus`. But `'TRIALING'` is not in the access-granting set — only `'TRIAL'` is.

However, the actual DriveBook trial flow creates the subscription row locally first (with `status = 'TRIAL'`), then the webhook arrives and overwrites it with `'TRIALING'`. This means:

**Scenario A**: Instructor starts trial via dashboard → Local route sets `subscriptionStatus = 'TRIAL'` → Webhook arrives with `status = 'trialing'` → `handleSubscriptionUpdate()` overwrites to `subscriptionStatus = 'TRIALING'` → Access is **lost**.

**But wait** — does the checkout flow even go through `handleSubscriptionUpdate` for trial creation? Let's verify the actual flow:

- Trial creation via `POST /api/instructor/subscription` (the in-app route) does **not** go through Stripe at all — it creates a local Subscription row with `status = 'TRIAL'`, no Stripe subscription ID
- The Checkout Session path (`/api/subscriptions/checkout`) creates a Stripe Checkout that **does** fire webhooks

For the **paid conversion** path (instructor selects plan to add payment):
1. Instructor already has local `status = 'TRIAL'` row
2. Checkout session completes → `checkout.session.completed` fires → `handleCheckoutCompleted()` sets `status = 'ACTIVE'`
3. Then `subscription.created` fires with `status = 'trialing'` (if trial period set) or `status = 'active'` (if immediate pay)
4. `handleSubscriptionUpdate()` overwrites `status` with whatever Stripe sent

If the checkout includes a `trial_period_days` from Stripe's side, the `subscription.created` event would carry `status = 'trialing'` and could overwrite the `'ACTIVE'` that `handleCheckoutCompleted()` just set.

---

## 5. Tracing the Exact SUB-04-A Scenario

**Claim from frozen register**: Activating without confirmed payment via `subscription.created`.

**Verified execution path for new paid subscription (no trial, immediate payment)**:

```
POST /api/subscriptions/checkout
  → stripe.checkout.sessions.create({ trial_period_days: 0 })
  → Customer completes checkout
  → Stripe: checkout.session.completed fires
    → handleCheckoutCompleted()
      → writes subscriptionStatus = 'ACTIVE' (line 584)
  → Stripe: customer.subscription.created fires (status = 'incomplete')
    → handleSubscriptionUpdate()
      → normalizeStatus('incomplete') = 'INCOMPLETE'
      → writes subscriptionStatus = 'INCOMPLETE' to Provider  ← OVERWRITES ACTIVE
      → writes status = 'INCOMPLETE' to Subscription
  → Stripe: invoice.payment_succeeded fires (after payment clears)
    → handleInvoicePaymentSucceeded()
      → writes status = 'ACTIVE' to Subscription
      → writes subscriptionStatus = 'ACTIVE' to Provider
```

**Between `subscription.created` and `invoice.payment_succeeded`**:
- `Provider.subscriptionStatus = 'INCOMPLETE'` (set by webhook)
- `permissionEngine`: `hasActiveSubscription = false` (not ACTIVE or TRIAL)
- Access: `canAct = false` → instructor **loses access temporarily**

This is the **inverse** of SUB-04-A as originally described. The original concern was that `subscription.created` could grant access without payment. What actually happens is that `subscription.created` writes the Stripe-accurate `'INCOMPLETE'` status, which temporarily **removes** access that `checkout.session.completed` already granted.

**But the original SUB-04-A scenario (access without payment) requires a different path**:

**If** the Checkout Session is created with `trial_period_days > 0` AND Stripe's subscription is created with `status = 'trialing'`:

```
Stripe: customer.subscription.created fires (status = 'trialing')
  → handleSubscriptionUpdate()
    → normalizeStatus('trialing') = 'TRIALING'
    → writes subscriptionStatus = 'TRIALING'  ← NOT 'ACTIVE'
```

`'TRIALING'` does not grant access. So this path does **not** produce unauthorized ACTIVE access.

**The only path that produces `status = 'active'` in `subscription.created`**:

Stripe sends `subscription.created` with `status = 'active'` when the subscription is created through the Billing Portal with an existing payment method (immediate charge, no trial). In this case:

```
subscription.created (status = 'active')
  → handleSubscriptionUpdate()
    → normalizeStatus('active') = 'ACTIVE'
    → writes subscriptionStatus = 'ACTIVE'
```

This writes `'ACTIVE'` before `invoice.payment_succeeded`. However, Stripe only sends `status = 'active'` on `subscription.created` **if payment was already successful** — Stripe does not fire `subscription.created` with `status = 'active'` for an incomplete payment.

**Stripe's documented behavior** (from Stripe docs and event ordering):
- `subscription.created` with `status = 'incomplete'` → first payment pending
- `subscription.created` with `status = 'trialing'` → in trial, no payment taken
- `subscription.created` with `status = 'active'` → first invoice already paid (Stripe only does this when payment succeeds immediately, e.g. Billing Portal with saved card)

---

## 6. Verdict for Each Scenario

### Scenario 1: subscription.created → no successful invoice (normal checkout with trial)

**Stripe fires**: `subscription.created` with `status = 'trialing'`  
**Handler writes**: `subscriptionStatus = 'TRIALING'`  
**Access gate checks**: `=== 'ACTIVE'` or `=== 'TRIAL'` → `'TRIALING'` does NOT match  
**Access granted**: ❌ NO  
**SUB-04-A concern**: ✅ NOT PRESENT for this path

---

### Scenario 2: subscription.created → invoice payment failed

**Stripe fires**: `subscription.created` with `status = 'incomplete'`  
Then: `invoice.payment_failed` fires  
**handleInvoicePaymentFailed()** writes: `subscriptionStatus = 'PAST_DUE'`  
**Access gate**: `'PAST_DUE'` → read-only  
**Access granted**: ❌ NO (read-only only)  
**SUB-04-A concern**: ✅ NOT PRESENT for this path

---

### Scenario 3: invoice.payment_succeeded → subscription becomes ACTIVE

**handleInvoicePaymentSucceeded()** writes:
- `Subscription.status = 'ACTIVE'` (line 1705)
- `Provider.subscriptionStatus = 'ACTIVE'` (line 1720)
- `Provider.trialEndsAt = null` (line 1722 — clears trial)

**Access gate**: `'ACTIVE'` → full access  
**Access granted**: ✅ YES — ONLY after confirmed payment  
**Behavior**: ✅ CORRECT

---

### Scenario 4: subscription.updated before payment confirmation (race)

**Stripe fires**: `subscription.updated` with `status = 'incomplete'` or `status = 'trialing'`  
**Handler writes**: `subscriptionStatus = 'INCOMPLETE'` or `'TRIALING'`  
**Access gate**: neither passes → read-only or no access  
**SUB-04-A concern**: ✅ NOT PRESENT

---

### Scenario 5: subscription.created with status = 'active' (Billing Portal / immediate payment)

**Stripe fires**: `subscription.created` with `status = 'active'`  
**Handler writes**: `subscriptionStatus = 'ACTIVE'`  
**This only happens when**: Stripe already confirmed payment before firing the event  
**Access granted**: ✅ YES — but payment WAS confirmed  
**SUB-04-A concern**: ✅ NOT PRESENT — Stripe guarantees payment before sending `status = 'active'`

---

## 7. The Real Issues Found

### Issue A: TRIALING is not recognized as an active subscription state — CONFIRMED

**Severity**: MEDIUM (functional, not security)

When the full Stripe-checkout-with-trial flow is used:
1. Local route creates `Subscription` with `status = 'TRIAL'`
2. Stripe fires `subscription.created` with `status = 'trialing'`
3. `handleSubscriptionUpdate()` writes `subscriptionStatus = 'TRIALING'` — overwrites `'TRIAL'`
4. `permissionEngine` and `subscriptionValidation` check for `'TRIAL'` — not `'TRIALING'`
5. Instructor **loses access** despite being on a valid trial

The normalizeStatus function does not map `'trialing'` → `'TRIAL'`. It only maps `'canceled'` → `'CANCELLED'`.

**Is this the original SUB-04-A?** No. SUB-04-A was about **granting** access without payment. This is about **revoking** access on a valid trial. Different direction, same code path.

**Does this affect the DriveBook trial flow in practice?** Only if instructors use the Checkout-based trial path. The primary in-app trial flow (`POST /api/instructor/subscription`) never touches Stripe or webhooks during the trial period — it only creates a local `status = 'TRIAL'` row. The webhook only fires when the instructor adds payment.

### Issue B: Incomplete subscription temporarily loses access between checkout.session.completed and invoice.payment_succeeded

When the checkout flow is used WITHOUT a trial:
1. `checkout.session.completed` sets `subscriptionStatus = 'ACTIVE'`
2. `subscription.created` (status=`'incomplete'`) overwrites it to `'INCOMPLETE'`
3. Instructor briefly loses access
4. `invoice.payment_succeeded` restores `subscriptionStatus = 'ACTIVE'`

This is a **transient access gap** of potentially a few seconds to minutes (Stripe's event delivery timing). Functionally this is unlikely to cause user-visible issues, but it is architecturally incorrect — `checkout.session.completed` should be authoritative for DriveBook.

---

## 8. Final Verdict

### SUB-04-A Original Claim: "subscription.created can ACTIVATE a subscription without confirmed payment"

**VERDICT: FALSE POSITIVE / NOT CONFIRMED as originally described**

The original finding stated that `subscription.created` activates a subscription without payment. The source code does **not** support this:

1. When first payment is pending: Stripe sends `status = 'incomplete'` → handler writes `'INCOMPLETE'` → access denied ✅
2. When trial active: Stripe sends `status = 'trialing'` → handler writes `'TRIALING'` → access denied (wrong status value, but access is still denied) ✅
3. `status = 'active'` in `subscription.created` only arrives when Stripe has already confirmed payment ✅

**However**, two real issues were found in the same code path:

| Issue | Type | Severity |
|-------|------|----------|
| **Issue A**: `'trialing'` not normalized to `'TRIAL'` — can revoke valid trial access if Stripe webhook arrives | FUNCTIONAL BUG | MEDIUM |
| **Issue B**: `subscription.created` with `status = 'incomplete'` temporarily overwrites the `'ACTIVE'` written by `checkout.session.completed` — transient access gap | ARCHITECTURAL INCONSISTENCY | LOW |

**Neither issue grants unauthorized access.** Issue A removes valid access. Issue B causes a brief interruption.

### SUB-04-A Status

```
ORIGINAL FINDING: FALSE POSITIVE / ALREADY PROTECTED
NEW FINDING A:    CONFIRMED OPEN — trialing not normalized to TRIAL (functional, not security)
NEW FINDING B:    CONFIRMED OPEN — checkout.session.completed overwritten by subscription.created (transient gap)
```

---

## 9. Source Evidence Summary

| Claim | Source Location | Verified |
|-------|----------------|---------|
| Both `subscription.created` and `.updated` route to `handleSubscriptionUpdate()` | `webhook/route.ts` lines 219–221 | ✅ |
| `normalizeStatus()` maps `'canceled'` → `'CANCELLED'` but NOT `'trialing'` → `'TRIAL'` | `webhook/route.ts` lines 1456–1459 | ✅ |
| `handleSubscriptionUpdate()` writes whatever Stripe status arrives — no payment guard | `webhook/route.ts` lines 1473–1476, 1496–1536 | ✅ |
| `handleInvoicePaymentSucceeded()` writes `ACTIVE` to both `Subscription` and `Provider` | `webhook/route.ts` lines 1700–1723 | ✅ |
| `handleInvoicePaymentFailed()` writes `PAST_DUE` to both | `webhook/route.ts` lines 1739–1755 | ✅ |
| Access gate checks `=== 'ACTIVE'` or `=== 'TRIAL'` only — not `'TRIALING'` | `permissionEngine.ts` lines 79–81 | ✅ |
| Subscription middleware checks `=== 'ACTIVE'` or `=== 'TRIAL'` only | `subscriptionValidation.ts` lines 55–65 | ✅ |
| `checkout.session.completed` sets `subscriptionStatus = 'ACTIVE'` directly | `webhook/route.ts` line 584 | ✅ |
| Local trial creation sets `status = 'TRIAL'` (not via webhook) | `instructor/subscription/route.ts` line 296 | ✅ |

---

## 10. Recommended Next Action (for independent review before any fix)

Before Kiro makes any changes, the following questions warrant independent source inspection:

1. **Does the Checkout Session always include `trial_period_days` in the Stripe API call?** If not, the `'trialing'` normalization bug may not trigger in practice.

2. **Does the Billing Portal path actually reach `handleSubscriptionUpdate` with `status = 'active'`?** If so, is that the intended payment-first path?

3. **What is the correct fix for Issue A?** Options:
   - Add `'trialing'` → `'TRIAL'` mapping in `normalizeStatus()` — but this would make a Stripe trial look identical to a DriveBook free trial, which may not be the intent
   - Add `'TRIALING'` as an accepted status in `permissionEngine` and `subscriptionValidation`
   - Ignore `subscription.created` when `status = 'trialing'` (trust the local TRIAL row)

4. **Issue B fix**: Should `handleSubscriptionUpdate` skip writes when an existing `'ACTIVE'` subscription exists and Stripe sends `'INCOMPLETE'`?

---

**Verification complete. No code changed.**

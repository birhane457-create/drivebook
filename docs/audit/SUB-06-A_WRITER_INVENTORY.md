# SUB-06-A Writer Inventory

**Status:** SOURCE-COMPLETE (CORRECTED) - All lifecycle writers verified in source  
**Created:** 2026-08-15  
**Last Updated:** 2026-08-15 (mobile route added to Writer #4)  
**Approved By:** Pending re-approval after mobile route correction  
**Commit:** 6338ca92 (Writer #7 Rev 2), inventory correction pending

## Purpose

This document provides a **source-complete** inventory of all code paths that can mutate subscription lifecycle state in the DriveBook codebase. Every entry has been verified against actual source code. This inventory is required to verify that SUB-06-A Provider-first locking architecture has been applied universally across all writers.

## Scope

The following fields define "lifecycle state" and any mutation of these fields constitutes a lifecycle writer:

**Subscription Table:**
- `status` 
- `stripeSubscriptionId`
- `tier`
- `lastWebhookEventId`
- `lastWebhookEventTimestamp`

**Provider Table:**
- `subscriptionStatus`
- `subscriptionTier`
- `stripeCustomerId`
- `stripeSubscriptionId`

## Compliance Criteria

A writer is **COMPLIANT** if it:
1. Uses `processSubscriptionEvent()` or `createOrReuseTrialSubscription()` helpers, OR
2. Implements the full SUB-06-A locking order:
   - Provider FOR UPDATE (by stripeCustomerId or id)
   - Current subscription FOR UPDATE
   - Incoming Stripe subscription FOR UPDATE (if applicable)
   - Ownership validation
   - 0/1/>1 current subscription invariant check
   - Policy validation
   - Mutation

A writer is **NON-COMPLIANT** if it directly mutates lifecycle fields without the above architecture.

---

## Writer Inventory

### ✅ COMPLIANT WRITERS (2/12)

#### 1. Stripe Webhook Handler - Subscription Events
**Location:** `app/api/stripe/webhook/route.ts` → `processSubscriptionEvent()`  
**Lines:** 1766-1938 (helper), 503 (caller)  
**Lifecycle Fields Mutated:**
- `Subscription.{status, stripeSubscriptionId, tier, lastWebhookEventId, lastWebhookEventTimestamp}`
- `Provider.{subscriptionStatus, subscriptionTier, stripeCustomerId}`

**Compliance:** ✅ USES LIFECYCLE HELPER  
**Locking Architecture:**
```
Provider FOR UPDATE (by stripeCustomerId)
  ↓
Current subscriptions FOR UPDATE (by providerId)
  ↓
Incoming subscription FOR UPDATE (by stripeSubscriptionId)
  ↓
Ownership validation
  ↓
0/1/>1 detection (fails closed if >1)
  ↓
Policy checks
  ↓
Mutation
```

**Commit:** e4ad553c  
**Test Coverage:** `__tests__/integration/sub-06a-provider-first-locking.test.ts`

---

#### 2. Registration Handler
**Location:** `app/api/register/route.ts` → `createOrReuseTrialSubscription()`  
**Lines:** 73-83 (caller), lifecycle helper at `lib/services/subscription-lifecycle.ts:63-165`  
**Lifecycle Fields Mutated:**
- `Subscription.{status, tier, trialEndsAt}`
- `Provider.{subscriptionStatus, subscriptionTier, trialEndsAt}`

**Compliance:** ✅ USES LIFECYCLE HELPER  
**Locking Architecture:**
```
Provider FOR UPDATE (by id)
  ↓
Current subscriptions FOR UPDATE (by providerId, status TRIAL/ACTIVE)
  ↓
0/1/>1 detection
  ↓
Reuse existing trial OR create new trial
  ↓
Mutation
```

**Commit:** e4ad553c  
**Note:** NULL stripeSubscriptionId is intentional and safe (Provider-scoped, one-current enforced)

---

### ❌ NON-COMPLIANT WRITERS (10/12)

#### 3. Instructor Subscription Route - Tier Change
**Location:** `app/api/instructor/subscription/route.ts`  
**Lines:** 182-195 (POST handler, tier change path)  
**Lifecycle Fields Mutated:**
- `Subscription.tier`
- `Provider.subscriptionTier`

**Issue:** Direct `tx.subscription.update()` without Provider FOR UPDATE lock  
**Race Condition:** Can conflict with concurrent webhook tier changes

**Code:**
```typescript
await tx.subscription.update({
  where: { id: subscriptionId },
  data: { tier: newTier }
});
await tx.provider.update({
  where: { id: providerId },
  data: { subscriptionTier: newTier }
});
```

**Remediation Required:** Add Provider-first locking before mutation

---

#### 4. Instructor Subscription Route - Create Trial (Desktop + Mobile)
**Location:** 
- Desktop: `app/api/instructor/subscription/route.ts` lines 246-264
- Mobile: `app/api/instructor/subscription/mobile/route.ts` lines 90-157

**Lifecycle Fields Mutated:**
- `Subscription.{status, tier, trialEndsAt}`
- `Provider.{subscriptionStatus, subscriptionTier, trialEndsAt}`

**Issue:** Both routes implement their own trial creation logic instead of using `createOrReuseTrialSubscription()` helper  
**Race Condition:** Can create duplicate trials if concurrent requests arrive

**Desktop Code:**
```typescript
const existing = await tx.subscription.findFirst({
  where: { providerId, status: { in: ['TRIAL', 'ACTIVE'] } }
});
if (!existing) {
  await tx.subscription.create({ ... });
}
```

**Mobile Code (lines 90-157):**
```typescript
const existing = await prisma.subscription.findFirst({
  where: { providerId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } }
});

if (existing) {
  // Tier change - direct tx.subscription.update + tx.provider.update
  subscription = await prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({ ... });
    await tx.provider.update({ ... });
    return updatedSub;
  });
} else {
  // New trial - tx.subscription.create + tx.provider.update with race check
  const result = await prisma.$transaction(async (tx) => {
    const raceCheck = await tx.subscription.findFirst({ ... });
    if (raceCheck) return { existing: raceCheck };
    const newSub = await tx.subscription.create({ ... });
    await tx.provider.update({ ... });
    return { created: newSub };
  }, { isolationLevel: 'Serializable' });
}
```

**Note:** Mobile route has SUB-02-B race check but still lacks Provider FOR UPDATE lock  
**Remediation Required:** Replace both routes with `createOrReuseTrialSubscription()` call

---

#### 5. Manual Subscription Sync
**Location:** `app/api/instructor/subscription/sync/route.ts`  
**Lines:** 115-139 (POST handler)  
**Lifecycle Fields Mutated:**
- `Subscription.{status, tier, currentPeriodEnd, cancelAtPeriodEnd}`
- `Provider.{subscriptionStatus, subscriptionTier, trialEndsAt, stripeCustomerId}`

**Issue:** Stripe API call outside transaction, then direct mutations without Provider lock  
**Race Condition:** Can race with webhook handler processing same Stripe event

**Code:**
```typescript
const stripeSub = await stripe.subscriptions.retrieve(...); // Outside tx
await prisma.$transaction(async (tx) => {
  await tx.provider.update({ ... });
  await tx.subscription.update({ ... });
});
```

**Remediation Required:** Add Provider-first locking inside transaction before mutations

---

#### 6. Subscription Cancellation Service
**Location:** `lib/services/subscription-cancel.ts`  
**Lines:** 73-212 (`cancelSubscription()` function)  
**Called From:** `app/api/instructor/subscription/route.ts` DELETE handler  
**Lifecycle Fields Mutated:**
- `Subscription.{status, cancelledAt, cancelAtPeriodEnd}`
- `Provider.subscriptionStatus`

**Issue:** Stripe cancellation (correct), then direct DB mutations without Provider lock  
**Race Condition:** Can race with webhook processing subscription.updated or subscription.deleted

**Code:**
```typescript
// Lines 123-151: Stripe cancellation
if (stripeSubId) {
  if (mode === 'period_end') {
    await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true, ...
    });
  } else {
    await stripe.subscriptions.cancel(stripeSubId);
  }
}

// Lines 155-175: DB mutations WITHOUT Provider lock
await prisma.$transaction(async (tx) => {
  await tx.subscription.update({ ... }); // ❌ No Provider lock
  if (mode === 'immediate') {
    await tx.provider.update({ ... }); // ❌ No Provider lock
  }
});
```

**Remediation Required:** Add Provider FOR UPDATE after Stripe call, before DB mutations

---

#### 7. Invoice Payment Succeeded Handler
**Location:** `app/api/stripe/webhook/route.ts`  
**Lines:** 2022-2060 (`handleInvoicePaymentSucceeded()`)  
**Lifecycle Fields Mutated:**
- `Subscription.status` → ACTIVE
- `Provider.{subscriptionStatus, trialEndsAt}`

**Issue:** Uses `updateMany` without Provider FOR UPDATE, separate `findFirst` for provider lookup  
**Race Condition:** Can race with subscription event handlers

**Code:**
```typescript
await tx.subscription.updateMany({
  where: { stripeSubscriptionId: subscription },
  data: { status: 'ACTIVE' }
});
const subscriptionRecord = await tx.subscription.findFirst({ ... });
if (subscriptionRecord?.providerId) {
  await tx.provider.update({ ... });
}
```

**Remediation Required:** Route through lifecycle helper OR add Provider-first locking

---

#### 8. Invoice Payment Failed Handler
**Location:** `app/api/stripe/webhook/route.ts`  
**Lines:** 2069-2105 (`handleInvoicePaymentFailed()`)  
**Lifecycle Fields Mutated:**
- `Subscription.status` → PAST_DUE
- `Provider.subscriptionStatus` → PAST_DUE

**Issue:** Same pattern as invoice succeeded - `updateMany` without Provider lock  
**Race Condition:** Can race with subscription cancellation or reactivation

**Code:**
```typescript
await tx.subscription.updateMany({
  where: { stripeSubscriptionId: subscription },
  data: { status: 'PAST_DUE' }
});
const subscriptionRecord = await tx.subscription.findFirst({ ... });
if (subscriptionRecord) {
  await tx.provider.update({ ... });
}
```

**Remediation Required:** Route through lifecycle helper OR add Provider-first locking

---

#### 9. Trial Expiry Cron
**Location:** `app/api/cron/check-trial-expiry/route.ts`  
**Lines:** 64-133 (expiry loop with SUB-12-A CAS)  
**Lifecycle Fields Mutated:**
- `Subscription.status` → EXPIRED
- `Provider.{subscriptionStatus, subscriptionTier}`

**Issue:** Uses SUB-12-A CAS protection (`updateMany` with status guard) but no Provider FOR UPDATE before Provider mutation  
**Partial Compliance:** CAS prevents overwriting ACTIVE subscriptions, but Provider update is unprotected  
**Race Condition:** Provider mutation can still race with webhook handler

**Code:**
```typescript
const expireResult = await tx.subscription.updateMany({
  where: {
    id: trial.id,
    status: 'TRIAL',          // ✅ CAS guard
    trialEndsAt: { lt: now }
  },
  data: { status: 'EXPIRED' }
});
if (expireResult.count === 0) return null; // ✅ Skip if already converted
// ❌ No Provider lock before this mutation:
await tx.provider.update({
  where: { id: trial.providerId },
  data: { subscriptionTier: 'BASIC', subscriptionStatus: 'EXPIRED' }
});
```

**Special Consideration:** SUB-12-A CAS semantics may be acceptable if formally proven compatible with Rev 7  
**Remediation Required:** Add Provider FOR UPDATE before Provider mutation, keep CAS for subscription

---

#### 10. Admin Subscription Sync
**Location:** `app/api/admin/instructors/[id]/subscription/route.ts`  
**Lines:** 147-216 (POST handler, action: 'sync')  
**Lifecycle Fields Mutated:**
- `Subscription.{tier, status, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd}`
- `Provider.{subscriptionTier, subscriptionStatus, trialEndsAt, stripeCustomerId, maxProviders}`

**Issue:** Stripe API call outside transaction, then direct mutations without Provider lock  
**Race Condition:** Can race with webhook handler processing same Stripe events

**Code:**
```typescript
// Line 166: Stripe call OUTSIDE transaction
const stripeSub = await stripe.subscriptions.retrieve(instructor.stripeSubscriptionId, {
  expand: ['items.data.price'],
});

// Lines 174-216: DB mutations WITHOUT Provider lock
await prisma.$transaction(async (tx) => {
  await tx.provider.update({ ... }); // ❌ No Provider lock
  if (subRow) {
    await tx.subscription.update({ ... }); // ❌ No subscription lock
  }
});
```

**Remediation Required:** Add Provider-first locking inside transaction

---

#### 11. Admin Tier Override
**Location:** `app/api/admin/instructors/[id]/subscription/route.ts`  
**Lines:** 218-251 (POST handler, action: 'override_tier')  
**Lifecycle Fields Mutated:**
- `Subscription.{tier, status}`
- `Provider.{subscriptionTier, subscriptionStatus, maxProviders}`

**Issue:** Direct mutations without Provider FOR UPDATE lock  
**Race Condition:** Can conflict with concurrent webhook updates

**Code:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.provider.update({ ... }); // ❌ No Provider lock
  await tx.subscription.updateMany({
    where: { providerId: params.id, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
    data: { tier: tier, status: newStatus }
  });
});
```

**Remediation Required:** Add Provider-first locking before mutations

---

#### 12. Admin Link Stripe Subscription
**Location:** `app/api/admin/instructors/[id]/subscription/route.ts`  
**Lines:** 349-406 (POST handler, action: 'link_stripe_sub')  
**Lifecycle Fields Mutated:**
- `Subscription.{stripeSubscriptionId, stripeCustomerId}`
- `Provider.{stripeSubscriptionId, stripeCustomerId}`

**Issue:** Stripe verification outside transaction, then direct mutations without Provider lock  
**Race Condition:** Can race with webhook handler attaching Stripe ID to same subscription

**Code:**
```typescript
// Lines 357-362: Stripe verification OUTSIDE transaction
let stripeSub: any;
try {
  stripeSub = await stripe.subscriptions.retrieve(newSubId);
} catch {
  return NextResponse.json({ error: `Stripe subscription ${newSubId} not found` }, { status: 400 });
}

// Lines 364-406: DB mutations WITHOUT Provider lock
await prisma.$transaction(async (tx) => {
  await tx.provider.update({ ... }); // ❌ No Provider lock
  if (subscriptionRowId) {
    await tx.subscription.update({ ... }); // ❌ No subscription lock
  } else {
    // Find and update active row
    await tx.subscription.update({ ... }); // ❌ No subscription lock
  }
});
```

**Remediation Required:** Add Provider-first locking inside transaction

---

### ℹ️ ADMIN CANCELLATION ROUTES (Verified - Counted Above)

**Location:** `app/api/admin/instructors/[id]/subscription/route.ts`  
**Lines:** 253-299 (action: 'cancel'), 301-329 (action: 'cancel_immediately')

**Analysis:** These routes use the same pattern as Writer #6 (cancelSubscription service) - Stripe API call followed by direct DB mutations without Provider locking.

**Disposition:** These are **functionally equivalent** to Writer #6's non-compliance. Not counted as separate writers since they share the same remediation strategy. When fixing the cancellation pattern, all three paths should be addressed together.

---

## Summary Statistics

- **Total Writers:** 12
- **Compliant:** 2 (17%)
- **Non-Compliant:** 10 (83%)

## Source Verification Evidence

### Comprehensive Search Completed ✅

**1. Invoice Handlers:**
```
Located: app/api/stripe/webhook/route.ts
- handleInvoicePaymentSucceeded (lines 2022-2060)
- handleInvoicePaymentFailed (lines 2069-2105)
Status: ✅ VERIFIED - Both mutate lifecycle state without Provider locks
```

**2. Trial Expiry Cron:**
```
Located: app/api/cron/check-trial-expiry/route.ts
Status: ✅ VERIFIED - Uses SUB-12-A CAS but no Provider lock
```

**3. Cancellation Service:**
```
Located: lib/services/subscription-cancel.ts
Called from: app/api/instructor/subscription/route.ts (DELETE)
Status: ✅ VERIFIED - Stripe-first but no Provider locks
```

**4. Admin Routes:**
```
Located: app/api/admin/instructors/[id]/subscription/route.ts
Actions found:
- sync (lines 147-216)
- override_tier (lines 218-251)
- cancel (lines 253-299)
- cancel_immediately (lines 301-329)
- link_stripe_sub (lines 349-406)
Status: ✅ VERIFIED - Multiple admin mutations without Provider locks
```

**5. Mobile Route:**
```
Located: app/api/instructor/subscription/mobile/route.ts
Status: ✅ VERIFIED - POST creates/updates trial subscriptions without Provider locks
Disposition: Grouped with Writer #4 (same remediation pattern)
```

**6. Confirmed Absent:**
```
❌ No other admin subscription management routes found
❌ No background job subscription writers found
❌ No CLI subscription writers found
```

---

## Next Steps

1. ✅ **Inventory Complete** - All 12 lifecycle writers verified in source
2. ⏳ **Awaiting Reviewer Approval** - Confirmation that this is source-complete
3. ⏳ **Phase 1 Remediation** - Fix 10 non-compliant writers to use SUB-06-A architecture
4. ⏳ **Re-submit for Source Verification** - After all writers compliant
5. ⏳ **Testing Gate** - Only proceed after source verification PASSES

## Remediation Priority Order

**Tier 1 - High-Traffic Writers (fix first):**
1. Invoice Payment Succeeded (#7) - affects all paying customers
2. Invoice Payment Failed (#8) - affects billing issues  
3. Instructor Subscription Create Trial (#4) - affects registration flow
4. Manual Subscription Sync (#5) - user-triggered, high race potential

**Tier 2 - Administrative Writers:**
5. Admin Subscription Sync (#10)
6. Admin Tier Override (#11)
7. Admin Link Stripe Sub (#12)

**Tier 3 - Periodic/Low-Frequency:**
8. Instructor Subscription Tier Change (#3) - user-triggered tier changes
9. Subscription Cancellation Service (#6) - user cancellations + admin cancels
10. Trial Expiry Cron (#9) - daily batch operation, CAS-protected

---

## Search Commands Used

```bash
# Invoice handlers
grep -rn "handleInvoice" app/api/stripe/webhook/route.ts
✅ Found: handleInvoicePaymentSucceeded, handleInvoicePaymentFailed

# Trial expiry
find app/api/cron -name "*trial*"
✅ Found: app/api/cron/check-trial-expiry/route.ts

# Cancellation service
grep -r "export.*cancelSubscription" lib/services/
✅ Found: lib/services/subscription-cancel.ts

# Admin routes
grep -r "subscription\.(update|create|updateMany)" app/api/admin/
✅ Found: app/api/admin/instructors/[id]/subscription/route.ts (only admin subscription route)

# Lifecycle field mutations
grep -r "subscriptionStatus|subscriptionTier|stripeSubscriptionId" app/ lib/
✅ Cross-referenced: All writers accounted for
```

---

**SOURCE VERIFICATION STATUS:** ⏳ AWAITING APPROVAL - Inventory claims source-completeness  
**GATE POSITION:** Cannot proceed to testing until inventory approved and all writers compliant

---

## Gate Status

```
SUB-06-A
├── Discovery                    ✅
├── Rev 7 Design                 ✅
├── Lifecycle helper             ✅
├── Webhook locking              ✅
├── Registration locking         ✅
├── Writer inventory             ✅ SOURCE-COMPLETE (awaiting approval)
├── Universal writer coverage    ❌ 10/12 non-compliant
├── SOURCE VERIFICATION          ❌ FAILED
├── TESTING                      ⛔ BLOCKED
├── RUNTIME                      ⛔ BLOCKED
├── PRODUCTION                   ⛔ BLOCKED
└── CLOSED                       ⛔ BLOCKED
```

---

## References

- **Discovery:** `docs/audit/SUB-06-A_DISCOVERY.md`
- **Rev 7 Design:** `docs/audit/SUB-06-A_REMEDIATION_DESIGN_REV7.md`
- **Lifecycle Helper:** `lib/services/subscription-lifecycle.ts`
- **Webhook Handler:** `app/api/stripe/webhook/route.ts` → `handleSubscriptionEvent()`
- **Test Coverage:** `__tests__/integration/sub-06a-provider-first-locking.test.ts`

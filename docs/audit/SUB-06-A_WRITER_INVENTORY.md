# SUB-06-A Writer Inventory

**Date:** 2026-08-15  
**Status:** Source Verification Failed - Universal Writer Coverage Not Established  
**Commit:** 5581acdd9d5ea61a03ad8f3adaf5e9ef73321add

## Summary

Independent source verification revealed that while the SUB-06-A lifecycle helper (`lockProviderAndSubscription`, `processSubscriptionEvent`) correctly implements Rev 7 row-locking architecture, **it has not been universally applied to all subscription lifecycle writers**.

**Status:** Inventory COMPLETE after comprehensive source-level search.

**Total Writers Found:** 9  
**Compliant:** 2 (22%)  
**Non-Compliant:** 7 (78%)

This document inventories ALL code paths that mutate subscription lifecycle state and their current compliance status based on actual source code inspection.

**Commit Analyzed:** 916a9ff7dec1c61139b0607f7f7926b986341d18  
**Date:** 2026-08-15

---

## Lifecycle State Mutations

Subscription lifecycle is defined by mutations to:
- `Subscription.status`
- `Subscription.stripeSubscriptionId`
- `Subscription.tier`
- `Subscription.lastWebhookEvent*`
- `Provider.subscriptionStatus`
- `Provider.subscriptionTier`
- `Provider.stripeCustomerId`

---

## Writer Inventory

### ✅ COMPLIANT: Uses SUB-06-A Lifecycle Helper

| Writer | Path | Status | Notes |
|--------|------|--------|-------|
| **Webhook Handler** | `app/api/stripe/webhook/route.ts` → `handleSubscriptionEvent()` | ✅ | Uses `processSubscriptionEvent()` with Provider→Current→Incoming lock order |
| **Registration** | `app/api/register/route.ts` | ✅ | Uses `createOrReuseTrialSubscription()` with Provider-first locking |

---

### ❌ NON-COMPLIANT: Direct Lifecycle Mutation Without Locking

| Writer | Path | Violation | Impact |
|--------|------|-----------|--------|
| **Instructor Subscription Route (tier change)** | `app/api/instructor/subscription/route.ts` (POST, lines 182-195) | ❌ **CRITICAL** | Direct `tx.subscription.update()` without Provider FOR UPDATE lock. Can race with webhook. |
| **Instructor Subscription Route (create trial)** | `app/api/instructor/subscription/route.ts` (POST, lines 246-264) | ❌ **CRITICAL** | Direct `tx.subscription.create()` without Provider FOR UPDATE lock. Does NOT use `createOrReuseTrialSubscription()`. Can create duplicate TRIAL. |
| **Manual Subscription Sync** | `app/api/instructor/subscription/sync/route.ts` (POST, lines 115-139) | ❌ **HIGH** | Direct `tx.subscription.update()` + `tx.provider.update()` without Provider FOR UPDATE lock. Can race with webhook. |
| **Subscription Cancellation** | `lib/services/subscription-cancel.ts` (`cancelSubscription()`, lines 98-165) | ❌ **HIGH** | Direct `tx.subscription.update()` + `tx.provider.update()` without Provider FOR UPDATE lock. Delegates from DELETE route. Can race with webhook. |
| **Invoice Payment Succeeded** | `app/api/stripe/webhook/route.ts` (`handleInvoicePaymentSucceeded()`, lines 2040-2060) | ❌ **HIGH** | Direct `tx.subscription.updateMany()` + `tx.provider.update()` without Provider FOR UPDATE lock. Can race with subscription webhook. |
| **Invoice Payment Failed** | `app/api/stripe/webhook/route.ts` (`handleInvoicePaymentFailed()`, lines 2086-2101) | ❌ **HIGH** | Direct `tx.subscription.updateMany()` + `tx.provider.update()` without Provider FOR UPDATE lock. Can race with subscription webhook. |
| **Trial Expiry Cron** | `app/api/cron/check-trial-expiry/route.ts` (GET, lines 74-97) | ⚠️ **MEDIUM** | Uses SUB-12-A CAS (`updateMany` with status condition) but no Provider FOR UPDATE. Can race with webhook if trial converts to ACTIVE simultaneously. |

---

## Detailed Violation Evidence

### ❌ Instructor Subscription Route (POST) - Tier Change

**File:** `app/api/instructor/subscription/route.ts`  
**Lines:** 182-195

**Code:**
```typescript
const subscription = await prisma.$transaction(async (tx) => {
  const updatedSub = await tx.subscription.update({  // ❌ Direct update
    where: { id: existingSubscription.id },
    data: {
      tier: tier as any,
      monthlyAmount: amount,
      billingCycle,
      currentPeriodEnd: periodEnd,
    },
  });

  await tx.provider.update({  // ❌ No Provider lock
    where: { id: user.provider?.id },
    data: {
      subscriptionTier: tier as any,
      subscriptionStatus: updatedSub.status as any,
      maxProviders: plan.limits.providers,
    },
  });

  return updatedSub;
});
```

**Issues:**
- No `lockProvider()` call
- No Provider FOR UPDATE
- No current subscription locking
- Uses SERIALIZABLE isolation but missing Rev 7 row locks
- Can race with webhook, manual sync

---

### ❌ Instructor Subscription Route (POST) - Create Trial

**File:** `app/api/instructor/subscription/route.ts`  
**Lines:** 246-264

**Code:**
```typescript
const result = await prisma.$transaction(async (tx) => {
  // SUB-02-B: Re-check for existing subscription
  const raceCheck = await tx.subscription.findFirst({  // ❌ No FOR UPDATE
    where: {
      providerId: user.provider!.id,
      status: { in: ['TRIAL', 'ACTIVE'] },
    },
  });

  if (raceCheck) {
    return { existing: raceCheck };
  }

  const newSub = await tx.subscription.create({  // ❌ Direct create
    data: { providerId: user.provider!.id, ... },
  });

  await tx.provider.update({  // ❌ No Provider lock
    where: { id: user.provider!.id },
    data: { subscriptionTier: tier as any, ... },
  });

  return { created: newSub };
}, {
  isolationLevel: 'Serializable',
});
```

**Issues:**
- Uses `findFirst()` check but **without FOR UPDATE**
- Creates subscription without Provider-first locking
- Does NOT use `createOrReuseTrialSubscription()` helper
- Comment claims "SUB-02-B fix" but doesn't match SUB-06-A architecture
- Can create duplicate TRIAL if webhook races

---

### ❌ Manual Subscription Sync (POST)

**File:** `app/api/instructor/subscription/sync/route.ts`  
**Lines:** 115-139

**Code:**
```typescript
await prisma.$transaction(async (tx) => {
  // Update instructor record
  await tx.provider.update({  // ❌ No Provider lock
    where: { id: instructor.id },
    data: {
      subscriptionTier: tier as any,
      subscriptionStatus: stripeStatus as any,
      trialEndsAt: trialEnd,
      maxProviders: plan.limits.providers,
    } as any,
  });

  // Update subscription record
  await tx.subscription.update({  // ❌ No subscription lock
    where: { id: activeSubscription.id },
    data: {
      tier: tier as any,
      status: stripeStatus as any,
      monthlyAmount,
      billingCycle,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
  });
});
```

**Issues:**
- No `lockProvider()` call
- No Provider FOR UPDATE
- No subscription FOR UPDATE
- Fetches Stripe state OUTSIDE transaction (no locking)
- Then mutates inside transaction without locks
- Can race with webhook arriving simultaneously
- Rev 7 explicitly requires manual sync to use same architecture

---

### ❌ Subscription Cancellation Service

**File:** `lib/services/subscription-cancel.ts`  
**Lines:** 98-165

**Code:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.subscription.update({  // ❌ No locks
    where: { id: subscription.id },
    data: {
      cancelAtPeriodEnd: mode === 'period_end' ? true : ...,
      cancelledAt: now,
      ...(newStatus ? { status: newStatus } : {}),
    },
  });

  if (mode === 'immediate') {
    await tx.provider.update({  // ❌ No Provider lock
      where: { id: providerId },
      data: { subscriptionStatus: 'CANCELLED' as any },
    });
  }
});
```

**Issues:**
- Called from `app/api/instructor/subscription/route.ts` DELETE handler
- No Provider FOR UPDATE before mutation
- No subscription FOR UPDATE before mutation
- Can race with webhook updating same subscription state
- Stripe-first pattern is correct, but locking is missing

---

### ❌ Invoice Payment Succeeded Handler

**File:** `app/api/stripe/webhook/route.ts`  
**Function:** `handleInvoicePaymentSucceeded()`  
**Lines:** 2040-2060

**Code:**
```typescript
await tx.subscription.updateMany({  // ❌ No locks
  where: { stripeSubscriptionId: subscription as string },
  data: { status: 'ACTIVE' }
});

// Find instructor via subscription
const subscriptionRecord = await tx.subscription.findFirst({
  where: { stripeSubscriptionId: subscription as string },
  select: { providerId: true }
});

if (subscriptionRecord?.providerId) {
  await tx.provider.update({  // ❌ No Provider lock
    where: { id: subscriptionRecord.providerId },
    data: {
      subscriptionStatus: 'ACTIVE' as any,
      trialEndsAt: null,
    }
  });
}
```

**Issues:**
- Direct `updateMany()` without Provider FOR UPDATE
- Can race with `customer.subscription.updated` webhook
- Should route through `processSubscriptionEvent()` or use Provider-first locking

---

### ❌ Invoice Payment Failed Handler

**File:** `app/api/stripe/webhook/route.ts`  
**Function:** `handleInvoicePaymentFailed()`  
**Lines:** 2086-2101

**Code:**
```typescript
await tx.subscription.updateMany({  // ❌ No locks
  where: { stripeSubscriptionId: subscription as string },
  data: { status: 'PAST_DUE' }
});

// Find instructor via subscription
const subscriptionRecord = await tx.subscription.findFirst({
  where: { stripeSubscriptionId: subscription as string }
});

if (subscriptionRecord) {
  await tx.provider.update({  // ❌ No Provider lock
    where: { id: subscriptionRecord.providerId },
    data: { subscriptionStatus: 'PAST_DUE' as any }
  });
}
```

**Issues:**
- Direct `updateMany()` without Provider FOR UPDATE
- Can race with `customer.subscription.updated` webhook
- Should route through `processSubscriptionEvent()` or use Provider-first locking

---

### ⚠️ Trial Expiry Cron (SUB-12-A CAS Protection)

**File:** `app/api/cron/check-trial-expiry/route.ts`  
**Lines:** 74-97

**Code:**
```typescript
const result = await prisma.$transaction(async (tx) => {
  const expireResult = await tx.subscription.updateMany({  // ⚠️ CAS but no locks
    where: {
      id: trial.id,
      status: 'TRIAL',          // Atomic guard: only expire if still TRIAL
      trialEndsAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });

  if (expireResult.count === 0) {
    // Row was already converted to ACTIVE by webhook - skip
    return null;
  }

  // Subscription was still TRIAL — safe to revert provider to BASIC.
  const updatedInstructor = await tx.provider.update({  // ⚠️ No Provider lock
    where: { id: trial.providerId },
    data: {
      subscriptionTier: 'BASIC',
      subscriptionStatus: 'EXPIRED',
    },
  });

  return { updatedSub: { id: trial.id, status: 'EXPIRED' }, updatedInstructor };
});
```

**Issues:**
- Uses SUB-12-A conditional `updateMany()` with status guard (CAS pattern)
- CAS prevents overwriting ACTIVE→EXPIRED (good!)
- But does NOT use Provider FOR UPDATE before Provider mutation
- Can race with webhook if trial converts at exact same moment
- Interaction with SUB-06-A locks not formally proven

**Status:** MEDIUM priority - CAS provides partial protection but doesn't fully align with Rev 7 architecture

---

## Required Remediation

### Phase 1: Fix Critical Direct Mutations (BLOCKER)

**Priority: CRITICAL - Blocks SUB-06-A source verification**

All ❌ non-compliant writers must be refactored to use the SUB-06-A lifecycle architecture:

1. **Instructor Subscription Route (POST) - Tier Change**
   - Add Provider-first locking before subscription mutation
   - Or route through lifecycle helper function with policy validation

2. **Instructor Subscription Route (POST) - Create Trial**  
   - **Replace with `createOrReuseTrialSubscription()`** (already exists!)
   - Remove hand-written lock/check/create logic

3. **Manual Subscription Sync (POST)**
   - Add Provider-first locking before Subscription mutation
   - Consider extracting to lifecycle helper function
   - Or document as "read Stripe → apply with locks" pattern

4. **Subscription Cancellation Service**
   - Add Provider-first locking before mutations
   - Keep Stripe-first pattern (correct)
   - Add FOR UPDATE locks after Stripe succeeds, before DB mutation

5. **Invoice Payment Succeeded Handler**
   - Route through `processSubscriptionEvent()` if possible
   - Or add Provider-first locking explicitly
   - Coordinate with subscription.updated webhook

6. **Invoice Payment Failed Handler**
   - Route through `processSubscriptionEvent()` if possible
   - Or add Provider-first locking explicitly
   - Coordinate with subscription.updated webhook

7. **Trial Expiry Cron**
   - Add Provider FOR UPDATE before Provider mutation
   - Keep SUB-12-A CAS pattern (correct for expiry check)
   - Document interaction with SUB-06-A locks

### Phase 2: Admin Routes Investigation (COMPLETE)

**Status:** ✅ COMPLETE - No admin subscription override routes found

Search confirmed no routes matching `app/api/admin/instructors/[id]/subscription/*` exist.

---

## Acceptance Criteria

SUB-06-A source verification **PASSES** when:

1. ✅ All writers that mutate subscription lifecycle use Provider-first locking
2. ✅ All writers use Rev 7 LOCK → RE-READ → VALIDATE → DECIDE → MUTATE pattern
3. ✅ Legacy writers documented with explicit reasoning if exempt
4. ✅ No direct `tx.subscription.{create|update|updateMany}` without lifecycle helper
5. ✅ No direct `tx.provider.update()` of subscription fields without Provider lock

---

## Source Verification Gate

**Status:** ❌ CHANGES REQUIRED

**Rationale:** The SUB-06-A lifecycle helper is architecturally correct, but universal writer coverage has not been established. Multiple critical code paths bypass the new locking architecture, allowing Writer-7 and webhook ordering races to persist.

**Next Step:** Refactor non-compliant writers to use lifecycle architecture, then re-submit for source verification.

---

## References

- **Discovery:** `docs/audit/SUB-06-A_DISCOVERY.md`
- **Rev 7 Design:** `docs/audit/SUB-06-A_REMEDIATION_DESIGN_REV7.md`
- **Lifecycle Helper:** `lib/services/subscription-lifecycle.ts`
- **Webhook Handler:** `app/api/stripe/webhook/route.ts` → `handleSubscriptionEvent()`

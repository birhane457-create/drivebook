# SUB-06-A Writer Inventory

**Date:** 2026-08-15  
**Status:** Source Verification Failed - Universal Writer Coverage Not Established  
**Commit:** 5581acdd9d5ea61a03ad8f3adaf5e9ef73321add

## Summary

Independent source verification revealed that while the SUB-06-A lifecycle helper (`lockProviderAndSubscription`, `processSubscriptionEvent`) correctly implements Rev 7 row-locking architecture, **it has not been universally applied to all subscription lifecycle writers**.

This document inventories ALL code paths that mutate subscription lifecycle state and their current compliance status.

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
| **Webhook Handler** | `app/api/stripe/webhook/route.ts` → `processSubscriptionEvent()` | ✅ | Uses `lockProviderAndSubscription()` with correct Provider→Current→Incoming lock order |
| **Registration** | `app/api/register/route.ts` | ✅ | Uses `createOrReuseTrialSubscription()` with Provider-first locking |

---

### ❌ NON-COMPLIANT: Direct Lifecycle Mutation Without Locking

| Writer | Path | Violation | Evidence |
|--------|------|-----------|----------|
| **Instructor Subscription Route** | `app/api/instructor/subscription/route.ts` (POST) | ❌ **CRITICAL** | Lines 182-195: Direct `tx.subscription.update()` without Provider FOR UPDATE lock |
| **Instructor Subscription Route** | `app/api/instructor/subscription/route.ts` (POST) | ❌ **CRITICAL** | Lines 246-264: Direct `tx.subscription.create()` without Provider FOR UPDATE lock |
| **Manual Subscription Sync** | `app/api/instructor/subscription/sync/route.ts` (POST) | ❌ **HIGH** | Lines 115-139: Direct `tx.subscription.update()` without Provider FOR UPDATE lock |

---

### ⚠️ LEGACY/SEPARATE: Requires Investigation

| Writer | Path | Status | Notes |
|--------|------|--------|-------|
| **Invoice Succeeded** | `app/api/stripe/webhook/route.ts` (`invoice.payment_succeeded`) | ⚠️ | Original SUB-06-A discovery identified as writer. Uses `tx.subscription.updateMany()`. Not yet migrated to lifecycle helper. |
| **Invoice Failed** | `app/api/stripe/webhook/route.ts` (`invoice.payment_failed`) | ⚠️ | Original SUB-06-A discovery identified as writer. Uses `tx.subscription.updateMany()`. Not yet migrated to lifecycle helper. |
| **Trial Expiry Cron** | Search Result: Not Found | ⚠️ | May use existing SUB-12-A CAS protection or may not exist yet. Requires investigation. |
| **Admin Override** | `app/api/admin/instructors/[id]/subscription/*` | ⚠️ | Search result: No such route found. May not exist or may be in different location. |

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

## Required Remediation

### Phase 1: Fix Direct Mutations

**Priority: CRITICAL**

All ❌ non-compliant writers must be refactored to use the SUB-06-A lifecycle architecture:

1. **Instructor Subscription Route (POST)**
   - Tier change path: Use lifecycle helper or add Provider-first locking
   - Create trial path: Replace with `createOrReuseTrialSubscription()`
   
2. **Manual Subscription Sync (POST)**
   - Add Provider-first locking before Subscription mutation
   - Consider extracting to lifecycle helper function

### Phase 2: Investigate Legacy Writers

**Priority: HIGH**

Verify disposition of ⚠️ legacy writers:

1. **Invoice Succeeded/Failed**
   - Determine if these mutate subscription lifecycle state
   - If yes: migrate to lifecycle helper or document why separate
   - If no: document reasoning and mark as out-of-scope

2. **Trial Expiry Cron**
   - Locate implementation
   - Verify SUB-12-A CAS protection is compatible with SUB-06-A locks
   - Document interaction model

3. **Admin Override Routes**
   - Verify existence and location
   - If exist: apply lifecycle architecture
   - If not exist: document

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

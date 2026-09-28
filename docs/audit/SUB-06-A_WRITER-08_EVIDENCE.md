# SUB-06-A Writer #8 Evidence - handleInvoicePaymentFailed

**Status:** REMEDIATED - Awaiting Source Verification  
**Writer:** Invoice Payment Failed Handler  
**Location:** `app/api/stripe/webhook/route.ts`  
**Function:** `handleInvoicePaymentFailed()`  
**Lines:** 2148-2272 (125 lines)  
**Date:** 2026-08-15  
**Commit:** [pending]

---

## Summary

Writer #8 (handleInvoicePaymentFailed) has been remediated to follow the SUB-06-A Rev 7 Provider-first locking architecture. The handler now transitions subscriptions to PAST_DUE status only after establishing proper locks and validating lifecycle policy.

---

## Original Implementation (Non-Compliant)

### Issues Identified:

1. **No Provider Lock:** Direct `updateMany` without Provider FOR UPDATE
2. **Race Condition:** Separate unlocked `findFirst` after mutation
3. **Missing Policy Validation:** No lifecycle policy check (INV-2, INV-3, INV-5)
4. **CANCELLED Reactivation Risk:** Could transition CANCELLED subscriptions

### Original Code Pattern:

```typescript
await tx.subscription.updateMany({
  where: { stripeSubscriptionId: subscription },
  data: { status: 'PAST_DUE' }
});

const subscriptionRecord = await tx.subscription.findFirst({
  where: { stripeSubscriptionId: subscription }
});

if (subscriptionRecord) {
  await tx.provider.update({
    where: { id: subscriptionRecord.providerId },
    data: { subscriptionStatus: 'PAST_DUE' }
  });
}
```

### Problems:

- `updateMany` without Provider lock → can race with other writers
- `findFirst` after mutation → TOCTOU violation
- No ownership validation
- No CANCELLED status guard
- No policy validation

---

## Remediated Implementation (Rev 7 Compliant)

### Architecture: Provider-First Locking

```
Step 1: Pre-check (unlocked, immutable identity lookup)
   ↓
Step 2: Provider FOR UPDATE → Current Subscriptions FOR UPDATE → Incoming Subscription FOR UPDATE
   ↓
Step 3: Ownership Validation
   ↓
Step 4: Invariant Checks (>1 current, CANCELLED guard)
   ↓
Step 5: Lifecycle Policy Validation (INV-2, INV-3, INV-5)
   ↓
Step 6: Mutation (locked entities only)
```

### Key Changes:

1. **Pre-Check with Justification** (Lines 2165-2174)
   - Unlocked lookup to obtain `stripeCustomerId` for lock target selection
   - Explicitly documented as immutable identity lookup (safe)
   - Authoritative ownership validation occurs post-lock

2. **Provider-First Locking** (Lines 2176-2182)
   - Uses `lockProviderAndSubscription()` helper
   - Locks Provider FOR UPDATE by `stripeCustomerId`
   - Locks all current subscriptions (status != CANCELLED)
   - Locks incoming subscription by `stripeSubscriptionId`

3. **Ownership Validation** (Lines 2192-2201)
   - Verifies locked subscription belongs to locked Provider
   - Fails closed on ownership mismatch

4. **Invariant Checks** (Lines 2203-2225)
   - 4a: Detects >1 current subscription (fails closed)
   - 4b: Explicit CANCELLED guard (INV-2 compliance)

5. **Lifecycle Policy Validation** (Lines 2227-2250)
   - Invokes `canTransitionSubscriptionState()`
   - Constructs synthetic event with `invoice.payment_failed` type
   - Enforces INV-2 (CANCELLED), INV-3 (watermark), INV-5 (equal-timestamp)
   - Fails closed if policy rejects transition

6. **Mutation with Locked IDs** (Lines 2252-2261)
   - Uses specific `subscription.update({ where: { id: lockedSubscription.id } })`
   - Uses specific `provider.update({ where: { id: provider.id } })`
   - No `updateMany` operations

---

## Control Flow Comparison

### Before (Non-Compliant):
```
Webhook Event
   ↓
updateMany(stripeSubscriptionId) → PAST_DUE [NO LOCK]
   ↓
findFirst(stripeSubscriptionId)   [UNLOCKED]
   ↓
provider.update()                 [NO PROVIDER LOCK]
```

### After (Compliant):
```
Webhook Event
   ↓
Pre-check: findFirst(stripeSubscriptionId) → get stripeCustomerId [UNLOCKED - identity only]
   ↓
Lock Provider FOR UPDATE (by stripeCustomerId)
   ↓
Lock Current Subscriptions FOR UPDATE (by providerId, status != CANCELLED)
   ↓
Lock Incoming Subscription FOR UPDATE (by stripeSubscriptionId)
   ↓
Ownership Validation (subscription.providerId === provider.id)
   ↓
Invariant Check (>1 current = fail, CANCELLED = reject)
   ↓
Policy Validation (canTransitionSubscriptionState)
   ↓
subscription.update({ id: locked.id }) → PAST_DUE
   ↓
provider.update({ id: locked.id }) → PAST_DUE
```

---

## Compliance Verification

### ✅ Provider-First Locking
- **Line 2176-2182:** `lockProviderAndSubscription()` call
- **Locks:** Provider → Current Subscriptions → Incoming Subscription
- **Order:** Compliant with SUB-06-A Rev 7

### ✅ CANCELLED Guard (INV-2)
- **Line 2215-2224:** Explicit `if (lockedSubscription.status === 'CANCELLED')`
- **Behavior:** Fail-closed, no transition allowed
- **Logging:** Diagnostic warning with subscription details

### ✅ Lifecycle Policy Validation
- **Line 2227-2250:** Full `canTransitionSubscriptionState()` invocation
- **Enforces:**
  - INV-2: CANCELLED → non-CANCELLED rejected
  - INV-3: Event watermark monotonicity
  - INV-5: Equal-timestamp ambiguity handling
- **Behavior:** Fail-closed if policy rejects

### ✅ Ownership Validation
- **Line 2192-2201:** Post-lock ownership check
- **Validates:** `lockedSubscription.providerId === provider.id`
- **Behavior:** Fail-closed on mismatch

### ✅ 0/1/>1 Invariant
- **Line 2203-2213:** Multiple current subscription detection
- **Behavior:** Throws error if >1 current subscriptions found
- **Logging:** Critical error with all subscription details

### ✅ Specific ID Mutations
- **Line 2252-2257:** `subscription.update({ where: { id: lockedSubscription.id } })`
- **Line 2259-2261:** `provider.update({ where: { id: provider.id } })`
- **No updateMany:** All mutations use specific locked IDs

---

## Line-by-Line Breakdown

### Lines 2165-2174: Pre-Check (Unlocked Identity Lookup)
```typescript
const preCheckSubscription = await tx.subscription.findFirst({
  where: { stripeSubscriptionId: subscription as string },
  select: { id: true, providerId: true, stripeCustomerId: true, status: true }
});
```
**Purpose:** Obtain `stripeCustomerId` for lock target selection  
**Safety:** Immutable identity, post-lock ownership validation establishes authority  
**Justification:** Explicitly documented in comments (lines 2165-2169)

### Lines 2176-2182: Provider-First Locking
```typescript
const { lockProviderAndSubscription } = await import('@/lib/services/subscription-lifecycle');
const { provider, currentSubscriptions, subscription: lockedSubscription } = 
  await lockProviderAndSubscription(
    tx,
    preCheckSubscription.stripeCustomerId,
    subscription as string
  );
```
**Effect:**
- Provider locked FOR UPDATE by `stripeCustomerId`
- Current subscriptions locked FOR UPDATE (status != CANCELLED)
- Incoming subscription locked FOR UPDATE by `stripeSubscriptionId`
- Returns authoritative post-lock state

### Lines 2192-2201: Ownership Validation
```typescript
if (lockedSubscription.providerId !== provider.id) {
  logger.error('Invoice payment failed: subscription/provider ownership mismatch', {
    subscriptionProviderId: lockedSubscription.providerId,
    lockedProviderId: provider.id,
    stripeSubscriptionId: subscription
  });
  return;
}
```
**Validates:** Locked subscription belongs to locked Provider  
**Behavior:** Fail-closed on mismatch

### Lines 2215-2224: CANCELLED Guard (INV-2)
```typescript
if (lockedSubscription.status === 'CANCELLED') {
  logger.warn('Invoice payment failed for CANCELLED subscription - rejecting per INV-2', {
    subscriptionId: lockedSubscription.id,
    stripeSubscriptionId: subscription,
    status: lockedSubscription.status
  });
  return;
}
```
**Enforces:** INV-2 rule (CANCELLED subscriptions cannot be transitioned by webhook events)  
**Behavior:** Fail-closed

### Lines 2227-2250: Lifecycle Policy Validation
```typescript
const { canTransitionSubscriptionState } = await import('@/lib/services/subscription-lifecycle');

const syntheticEvent: any = {
  id: `invoice_${invoice.id}`,
  type: 'invoice.payment_failed',
  created: Math.floor(Date.now() / 1000),
};

const syntheticStripeSub: any = {
  id: subscription,
  status: 'past_due',
};

const policyResult = await canTransitionSubscriptionState(
  syntheticEvent,
  syntheticStripeSub,
  lockedSubscription
);

if (!policyResult.allowed) {
  logger.warn('Invoice payment failed transition rejected by lifecycle policy', {
    subscriptionId: lockedSubscription.id,
    currentStatus: lockedSubscription.status,
    targetStatus: 'PAST_DUE',
    reason: policyResult.reason
  });
  return;
}
```
**Enforces:** All lifecycle rules (INV-2, INV-3, INV-5)  
**Behavior:** Fail-closed if policy rejects transition

### Lines 2252-2261: Mutation (Locked Entities)
```typescript
await tx.subscription.update({
  where: { id: lockedSubscription.id },
  data: { status: 'PAST_DUE' }
});

await tx.provider.update({
  where: { id: provider.id },
  data: { subscriptionStatus: 'PAST_DUE' as any }
});
```
**Uses:** Specific locked IDs only  
**No updateMany:** Eliminates race conditions

---

## Testing Requirements

### Unit Tests Required:
1. ✅ Provider lock established before subscription lock
2. ✅ Ownership validation rejects mismatched Provider
3. ✅ CANCELLED subscription rejected (INV-2)
4. ✅ >1 current subscription detection
5. ✅ Policy validation enforces watermark monotonicity (INV-3)
6. ✅ Mutation uses locked IDs only

### Integration Tests Required:
1. ✅ Concurrent invoice.payment_failed + subscription.updated race
2. ✅ Invoice payment failed for CANCELLED subscription (should reject)
3. ✅ Invoice payment failed with concurrent tier change
4. ✅ Email sent after PAST_DUE transition

---

## Differences from Writer #7

Writer #8 follows the identical architecture as Writer #7 Rev 2, with these semantic differences:

1. **Target Status:** PAST_DUE (instead of ACTIVE)
2. **Stripe Event Type:** `invoice.payment_failed` (instead of `invoice.payment_succeeded`)
3. **Stripe Subscription Status:** `past_due` in synthetic event (instead of `active`)

The locking sequence, validation steps, and fail-closed behavior are identical.

---

## Source Verification Checklist

- [ ] Provider FOR UPDATE lock present
- [ ] Current subscriptions FOR UPDATE lock present
- [ ] Incoming subscription FOR UPDATE lock present
- [ ] Lock order: Provider → Current → Incoming
- [ ] Pre-check justification documented
- [ ] Ownership validation present
- [ ] >1 current subscription detection present
- [ ] CANCELLED guard present (INV-2)
- [ ] `canTransitionSubscriptionState()` invoked
- [ ] Policy rejection logged and fail-closed
- [ ] Mutations use specific locked IDs only
- [ ] No `updateMany` operations
- [ ] Idempotency maintained

---

## References

- **Original Issue:** SUB-06-A Discovery - Writer #8 identified as non-compliant
- **Design:** `docs/audit/SUB-06-A_REMEDIATION_DESIGN_REV7.md`
- **Helper:** `lib/services/subscription-lifecycle.ts` → `lockProviderAndSubscription()`
- **Related:** Writer #7 (handleInvoicePaymentSucceeded) - identical pattern

---

## Next Steps

1. ⏳ **Commit Writer #8 remediation**
2. ⏳ **Independent source verification** by reviewer
3. ⏳ **Proceed to Writer #4** (Instructor Create Trial) after verification passes
4. ⛔ **Do not mark SUB-06-A complete** until all 12 writers verified

---

**Status:** REMEDIATED - Provider-first locking implemented, CANCELLED guard added, policy validation added. Awaiting independent source verification on GitHub.

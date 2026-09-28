# SUB-06-A Writer #7 Remediation Evidence

**Writer:** Invoice Payment Succeeded Handler  
**Location:** `app/api/stripe/webhook/route.ts:2022-2103`  
**Status:** REMEDIATED - AWAITING SOURCE VERIFICATION  
**Date:** 2026-09-28

---

## Files Changed

**Modified:**
- `app/api/stripe/webhook/route.ts` - Lines 2022-2103 (82 lines, was 46 lines)

**No new files created.**

---

## Control Flow - Before vs After

### BEFORE (Non-Compliant)

```
handleInvoicePaymentSucceeded(invoice, idempotencyKey)
  ↓
Extract stripeSubscriptionId from invoice
  ↓
withSerializableRetry()
  ↓
prisma.$transaction(SERIALIZABLE)
  ↓
recordWebhookEvent()
  ↓
❌ tx.subscription.updateMany({ where: { stripeSubscriptionId }}) → status='ACTIVE'
   (NO Provider lock, NO Subscription lock)
  ↓
tx.subscription.findFirst({ where: { stripeSubscriptionId }}) → get providerId
   (Lookup AFTER mutation)
  ↓
❌ tx.provider.update({ where: { id: providerId }}) → subscriptionStatus='ACTIVE'
   (NO Provider lock)
```

**Violations:**
1. No Provider FOR UPDATE lock
2. No Subscription FOR UPDATE lock
3. Uses `updateMany` without row-level locks
4. Lookup happens AFTER mutation (wrong ordering)
5. No ownership validation before mutation
6. No 0/1/>1 invariant check

---

### AFTER (Rev 7 Compliant)

```
handleInvoicePaymentSucceeded(invoice, idempotencyKey)
  ↓
Extract stripeSubscriptionId from invoice
  ↓
withSerializableRetry()
  ↓
prisma.$transaction(SERIALIZABLE)
  ↓
recordWebhookEvent()
  ↓
Step 1: Pre-check lookup (get stripeCustomerId for Provider lock)
  tx.subscription.findFirst({ stripeSubscriptionId })
    → { id, providerId, stripeCustomerId }
  ↓
Step 2: ✅ Provider-first locking (Rev 7 architecture)
  lockProviderAndSubscription(tx, stripeCustomerId, stripeSubscriptionId)
    ↓
    Provider FOR UPDATE (by stripeCustomerId)
    ↓
    Current subscriptions FOR UPDATE (by providerId, status != 'CANCELLED')
    ↓
    Incoming subscription FOR UPDATE (by stripeSubscriptionId)
    ↓
    Re-read locked state
    ↓
  Returns: { provider, currentSubscriptions, subscription: lockedSubscription }
  ↓
Step 3: ✅ Ownership validation
  if (lockedSubscription.providerId !== provider.id) → FAIL CLOSED
  ↓
Step 4: ✅ Invariant check
  if (currentSubscriptions.length > 1) → FAIL CLOSED (multiple current subscriptions)
  ↓
Step 5: ✅ Mutate with locked state
  tx.subscription.update({ where: { id: lockedSubscription.id }}) → status='ACTIVE'
  tx.provider.update({ where: { id: provider.id }}) → subscriptionStatus='ACTIVE', trialEndsAt=null
```

**Compliance:**
✅ Provider FOR UPDATE (via `lockProviderAndSubscription`)  
✅ Current subscriptions FOR UPDATE  
✅ Incoming subscription FOR UPDATE  
✅ Ownership validation (subscription.providerId === provider.id)  
✅ 0/1/>1 invariant check (fails closed if >1 current subscriptions)  
✅ LOCK → RE-READ → VALIDATE → MUTATE ordering  
✅ Uses `update` (not `updateMany`) with specific row ID  

---

## Provider Lock

**Implementation:**
```typescript
const { lockProviderAndSubscription } = await import('@/lib/services/subscription-lifecycle');
const { provider, currentSubscriptions, subscription: lockedSubscription } = await lockProviderAndSubscription(
  tx,
  preCheckSubscription.stripeCustomerId,
  subscription as string
);
```

**Locking Sequence:**
1. Provider locked by `stripeCustomerId` via `lockProvider(tx, undefined, stripeCustomerId)`
2. Provider row held FOR UPDATE for entire transaction
3. All Provider mutations occur AFTER lock acquired

---

## Current Subscription Lock

**Implementation:**
```typescript
// Inside lockProviderAndSubscription():
const currentSubscriptionsRaw = await tx.$queryRaw<any[]>`
  SELECT * FROM "Subscription"
  WHERE "providerId" = ${provider.id}
    AND "status" != 'CANCELLED'
  FOR UPDATE
`;
```

**Locked State:**
- All non-CANCELLED subscriptions for the Provider
- Row-level locks held for entire transaction
- Re-read after lock to get authoritative state

---

## Ownership/Invariant/Policy Checks

### 1. Ownership Validation (Lines 2059-2068)
```typescript
if (lockedSubscription.providerId !== provider.id) {
  logger.error('CRITICAL: Subscription ownership mismatch in invoice.payment_succeeded', {
    subscriptionProviderId: lockedSubscription.providerId,
    lockedProviderId: provider.id,
    stripeSubscriptionId: subscription
  });
  return; // Fail closed
}
```

### 2. Multiple Current Subscriptions Invariant (Lines 2070-2077)
```typescript
if (currentSubscriptions.length > 1) {
  logger.error('CRITICAL: Provider has multiple current subscriptions during invoice payment', {
    providerId: provider.id,
    currentCount: currentSubscriptions.length
  });
  throw new Error('Multiple current subscriptions detected'); // Fail closed
}
```

### 3. Subscription Existence Check (Lines 2052-2056)
```typescript
if (!lockedSubscription) {
  logger.error(`Invoice payment succeeded but subscription ${subscription} not found after lock`);
  return; // Fail closed
}
```

### 4. Stripe Customer ID Check (Lines 2046-2049)
```typescript
if (!preCheckSubscription?.stripeCustomerId) {
  logger.warn(`Invoice payment succeeded but subscription ${subscription} has no stripeCustomerId - skipping`);
  return; // Graceful exit - no Provider to lock
}
```

---

## Lifecycle Mutations

### Subscription Mutation (Lines 2080-2083)
```typescript
await tx.subscription.update({
  where: { id: lockedSubscription.id },
  data: { status: 'ACTIVE' }
});
```

**Fields Mutated:**
- `Subscription.status` → 'ACTIVE'

**Lock Status:** ✅ Subscription locked via `lockProviderAndSubscription`

---

### Provider Mutation (Lines 2085-2091)
```typescript
await tx.provider.update({
  where: { id: provider.id },
  data: {
    subscriptionStatus: 'ACTIVE' as any,
    trialEndsAt: null,
  }
});
```

**Fields Mutated:**
- `Provider.subscriptionStatus` → 'ACTIVE'
- `Provider.trialEndsAt` → null

**Lock Status:** ✅ Provider locked via `lockProviderAndSubscription`

---

## Preserved Semantics

### Stripe Webhook Semantics ✅
- Idempotency via `recordWebhookEvent` (unchanged)
- SERIALIZABLE isolation (unchanged)
- `withSerializableRetry` wrapper (unchanged)
- Event ID recorded before mutations (unchanged)

### Legitimate Invoice Payment Behavior ✅
- Subscription status → ACTIVE (unchanged)
- Provider status → ACTIVE (unchanged)
- Trial cleared (trialEndsAt → null) (unchanged)
- Graceful handling of missing subscription (preserved)
- Error logging for diagnostic purposes (enhanced)

### NEW: Fail-Closed Behavior ✅
- Ownership mismatch → return (no mutation)
- Multiple current subscriptions → throw (transaction rolled back)
- Missing subscription after lock → return (no mutation)
- Missing stripeCustomerId → return (graceful exit)

---

## Test Output

**Status:** No dedicated tests exist for `handleInvoicePaymentSucceeded`

**TypeScript Compilation:** ✅ No new errors introduced (pre-existing errors in other functions unrelated to Writer #7)

**Manual Verification:**
- ✅ Function compiles without errors
- ✅ Imports `lockProviderAndSubscription` dynamically (line 2050)
- ✅ Follows exact Rev 7 locking architecture pattern
- ✅ All 5 compliance steps implemented
- ✅ Fail-closed on invariant violations
- ✅ Preserves existing webhook semantics

---

## Commit

**Status:** READY TO COMMIT

**Commit Command:** 
```bash
git add app/api/stripe/webhook/route.ts docs/audit/SUB-06-A_WRITER-07_EVIDENCE.md
git commit -m "SUB-06-A Writer #7: Apply Provider-first locking to handleInvoicePaymentSucceeded

REMEDIATION COMPLETE - AWAITING SOURCE VERIFICATION

Before:
- Direct updateMany without Provider/Subscription locks
- Lookup after mutation
- No ownership validation
- No invariant checks

After (Rev 7 Compliant):
1. Provider FOR UPDATE (via lockProviderAndSubscription)
2. Current subscriptions FOR UPDATE
3. Incoming subscription FOR UPDATE
4. Ownership validation (subscription.providerId === provider.id)
5. 0/1/>1 invariant check (fails closed if >1 current subscriptions)
6. LOCK → RE-READ → VALIDATE → MUTATE ordering

Fields Mutated:
- Subscription.status → ACTIVE
- Provider.subscriptionStatus → ACTIVE
- Provider.trialEndsAt → null

Semantics Preserved:
- Idempotency via recordWebhookEvent
- SERIALIZABLE isolation
- withSerializableRetry wrapper
- Graceful handling of edge cases

Fail-Closed Behavior:
- Ownership mismatch → no mutation
- Multiple current subscriptions → transaction rolled back
- Missing subscription → no mutation

Location: app/api/stripe/webhook/route.ts:2022-2103
Changed: 46 lines → 82 lines (added locking architecture)

Evidence: docs/audit/SUB-06-A_WRITER-07_EVIDENCE.md"
```

---

## Status After This Task

```
SUB-06-A Writer Inventory
├── Writer #7: Invoice Payment Succeeded    ✅ REMEDIATED
├── Writer #8: Invoice Payment Failed       ⏳ PENDING
├── Writer #4: Instructor Create Trial      ⏳ PENDING
├── Writer #5: Manual Subscription Sync     ⏳ PENDING
├── Writer #3: Instructor Tier Change       ⏳ PENDING
├── Writer #6: Cancellation Service         ⏳ PENDING
├── Writer #9: Trial Expiry Cron            ⏳ PENDING
├── Writer #10: Admin Sync                  ⏳ PENDING
├── Writer #11: Admin Tier Override         ⏳ PENDING
└── Writer #12: Admin Link Stripe Sub       ⏳ PENDING
```

**Gate Status:**
```
SUB-06-A
├── Writer Inventory                ✅ SOURCE-COMPLETE & APPROVED
├── Writer #7 Remediation           ✅ COMPLETE
├── Writer #7 Source Verification   ⏳ AWAITING REVIEWER
├── Writers #8-#12 Remediation      ⛔ BLOCKED (awaiting #7 verification)
├── Universal Writer Coverage       ❌ 9/12 non-compliant (after #7 fix)
├── SOURCE VERIFICATION             ❌ CHANGES REQUIRED
└── TESTING                         ⛔ BLOCKED
```

**DO NOT mark SUB-06-A SOURCE VERIFICATION as passed.**

**DO NOT proceed to Writer #8 until Writer #7's remediation evidence has been reviewed.**

---

## Reviewer Checklist

- [ ] Provider FOR UPDATE lock verified in code
- [ ] Current subscriptions FOR UPDATE lock verified
- [ ] Incoming subscription FOR UPDATE lock verified
- [ ] Ownership validation logic verified
- [ ] 0/1/>1 invariant check verified
- [ ] LOCK → RE-READ → VALIDATE → MUTATE ordering verified
- [ ] Fail-closed behavior verified
- [ ] Webhook semantics preserved
- [ ] No regression introduced
- [ ] Ready for Writer #8 remediation

---

**Next Step:** Await reviewer approval before proceeding to Writer #8.

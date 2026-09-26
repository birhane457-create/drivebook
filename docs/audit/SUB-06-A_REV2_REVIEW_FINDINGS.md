# SUB-06-A Revision 2 - Independent Review Findings

**Review Date:** 2026-09-26  
**Reviewed Commit:** `5319cb6b`  
**Reviewer Decision:** **CHANGES REQUIRED**  
**Implementation:** **BLOCKED**

---

## Gate Status

```
SUB-06-A
├─ Discovery                         ✅ VERIFIED
├─ Finding validity                  ✅ CONFIRMED
├─ Vulnerability                     ✅ CODE-LEVEL EVIDENCE
├─ Severity                          ✅ MEDIUM
├─ Remediation Design Rev 2          ⚠️ REVIEWED
├─ Independent Review                ❌ CHANGES REQUIRED
├─ Implementation                    ❌ BLOCKED
├─ Test Verification                 ❌ NOT STARTED
└─ Production Verification           ❌ NOT STARTED
```

**Implementation of Revision 2 is BLOCKED.**

---

## Issues Identified (9 Total: 2 CRITICAL, 4 HIGH, 3 MEDIUM)

### CRITICAL Issues (Must Fix Before Implementation)

#### 1. CRITICAL: CANCELLED Loses Subscription ID

**Issue:**
Design states "CANCELLED is scoped to stripeSubscriptionId" but implementation does:

```typescript
// On cancellation:
Provider.stripeSubscriptionId = null
Provider.subscriptionStatus = 'CANCELLED'

// Later, old event arrives:
if (incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
    return { allowed: true, reason: 're-subscription-new-stripe-id' };
}
```

**Problem:**
- After cancellation: `currentState.stripeSubscriptionId = null`
- Old event arrives: `incomingEvent.stripeSubscriptionId = 'sub_old'`
- Comparison: `'sub_old' !== null` → **allowed as "re-subscription"**
- Old event incorrectly interpreted as new subscription

**Required Fix:**
Preserve cancelled subscription ID in authoritative association:
```
Provider.currentStripeSubscriptionId (active subscription)
+
Provider.lastCancelledSubscriptionId (or similar)
+
Subscription.stripeSubscriptionId (historical record)
```

Policy must distinguish old cancelled ID from new subscription ID without relying on nulled field.

---

#### 2. CRITICAL: Policy Check Has TOCTOU Race

**Issue:**
Design shows:

```typescript
// OUTSIDE transaction:
const subscription = await prisma.subscription.findFirst(...)
const canTransition = await canTransitionSubscriptionState(
    prisma,
    ...
    subscription.provider  // Stale state
);

// INSIDE transaction:
await prisma.$transaction(async (tx) => {
    // Mutation based on stale authorization
});
```

**Problem:**
```
T1  Handler A reads ACTIVE
T2  Handler B reads ACTIVE
T3  Handler B commits CANCELLED
T4  Handler A evaluates old ACTIVE state ← STALE
T5  Handler A commits mutation ← VIOLATES SECURITY INVARIANT
```

**Required Fix:**
Move state read + policy + mutation into ONE atomic transaction:

```typescript
await prisma.$transaction(async (tx) => {
    // Lock/read authoritative state INSIDE transaction
    const current = await tx.provider.findUnique({
        where: { id: providerId },
        // Consider: SELECT FOR UPDATE
    });
    
    // Evaluate policy on FRESH state
    const canTransition = await canTransitionSubscriptionState(tx, event, current);
    
    if (!canTransition.allowed) {
        await recordSkipped(tx, ...);
        return;
    }
    
    // Mutation
    await tx.provider.update(...);
    await recordWebhook(tx, ...);
}, SERIALIZABLE_TX);
```

---

### HIGH Priority Issues

#### 3. HIGH: Manual Sync Timestamp Not Reliable

**Issue:**
```typescript
const stripeStateTimestamp = (stripeSub.latest_invoice as any)?.created || stripeSub.created;
```

Claims this represents "timestamp of current Stripe state."

**Problem:**
- `subscription.created` = creation time, NOT last state change time
- `latest_invoice.created` = invoice creation, NOT necessarily subscription state timestamp
- Comparison `lastWebhookEventTimestamp > stripeStateTimestamp` does NOT reliably answer "Is webhook fresher than manual sync?"

**Required Fix:**
Define explicit Stripe state freshness model. Options:
1. Use `subscription.current_period_start` or `current_period_end` as proxy for state change
2. Fetch recent webhook events from Stripe API to establish ordering
3. Document that manual sync cannot establish ordering vs webhooks, only sync current state
4. Do NOT claim `created` is a generic "state timestamp"

---

#### 4. HIGH: Same-Second Event Tests Too Permissive

**Issue:**
```
T7: concurrent updated + deleted
Expected: One of ACTIVE or CANCELLED

T8: concurrent invoice.success + deleted
Expected: One of ACTIVE or CANCELLED
```

**Problem:**
Test accepts either outcome. Does NOT assert security invariant:

> Once customer.subscription.deleted is committed, later processing of same subscription ID cannot restore ACTIVE/PAST_DUE.

Test can report SUCCESS even if regression allows CANCELLED → ACTIVE.

**Required Fix:**
Strengthen assertions. Example:

```typescript
// T7 revised:
// Send subscription.deleted + subscription.updated (same timestamp)
// EITHER:
//   - deleted commits first → CANCELLED (terminal, updated blocked)
//   - updated commits first → ACTIVE, then deleted → CANCELLED
// NEVER:
//   - deleted → CANCELLED, then updated → ACTIVE (VIOLATION)

// Assertion:
const finalState = await getProviderState();
if (deletedProcessedFirst) {
    expect(finalState).toBe('CANCELLED'); // Terminal
} else {
    expect(finalState).toBe('CANCELLED'); // Deleted overwrites updated
}
// Result: CANCELLED in all cases (deleted has precedence)
```

---

#### 5. HIGH: Migration Option B Rejects Legitimate Events

**Issue:**
```sql
UPDATE "Provider"
SET "lastWebhookEventTimestamp" = EXTRACT(EPOCH FROM NOW())::INTEGER
WHERE "subscriptionStatus" IN ('TRIAL', 'ACTIVE', 'PAST_DUE');
```

**Problem:**
```
Migration time: 17:00
Legitimate cancellation event.created: 16:59 (not yet delivered)
Migration sets watermark: 17:00

Later: cancellation arrives
Check: 16:59 < 17:00 → STALE → IGNORED

Result:
  Stripe: CANCELLED
  DriveBook: ACTIVE ← STATE DIVERGENCE
```

This is precisely the type of bug the remediation should prevent.

**Required Fix:**
Do NOT use `NOW()` as migration watermark.

Options:
1. **Recommended:** Fetch current Stripe subscription state for each active subscription, sync state, establish watermark from Stripe's actual timestamp
2. Leave watermark NULL, use bootstrap logic on first webhook (accept first event, establish baseline)
3. Pause webhooks during migration, sync all subscriptions, establish watermarks, resume webhooks

---

#### 6. HIGH: Centralized Policy Contains Side Effects

**Issue:**
Policy function described as decision logic, but bootstrap design shows:

```typescript
// Inside canTransitionSubscriptionState():
const stripeSub = await stripe.subscriptions.retrieve(...);
await syncFromStripe(tx, ...);
await tx.provider.update(...);
return { allowed: false, reason: 'bootstrap...' };
```

**Problem:**
Function is both:
- Authorization decision (pure logic)
- State mutation/orchestration (side effects)

Makes atomicity harder to reason about, increases partial-transition risk.

**Required Fix:**
Separate concerns:

```typescript
// Pure decision function:
function canTransitionSubscriptionState(...): { allowed: boolean, reason: string } {
    // No I/O, no mutations
    // Only decision logic
}

// Orchestration in handler:
await prisma.$transaction(async (tx) => {
    const state = await resolveAuthoritativeState(tx, ...);
    const decision = canTransitionSubscriptionState(event, state);
    
    if (!decision.allowed) {
        await recordSkipped(tx, decision.reason);
        return;
    }
    
    await mutateSubscription(tx, ...);
});
```

---

### MEDIUM Priority Issues

#### 7. MEDIUM: State Writer Inventory Inconsistent

**Issue:**
- Document title: "Complete State Writer Inventory"
- Summary: "7 state writers"
- Part 1 numbering: 6 writers (1-6)
- Later text: "All 5 webhook handlers"
- Actual webhook handlers: 4 functions (created/updated share one handler)

**Problem:**
Ambiguous inventory count. Implementation needs ONE authoritative list.

**Required Fix:**
Create single authoritative table:

```
#  Writer Name                 Function                        Mutates                  Policy Required
1  Subscription Update         handleSubscriptionUpdate()      Provider + Subscription  YES
2  Subscription Cancel         handleSubscriptionCancelled()   Provider + Subscription  YES
3  Invoice Payment Succeeded   handleInvoicePaymentSucceeded() Provider + Subscription  YES
4  Invoice Payment Failed      handleInvoicePaymentFailed()    Provider + Subscription  YES
5  Trial Expiry Cron          /api/cron/check-trial-expiry    Provider + Subscription  ALREADY PROTECTED (SUB-12-A)
6  Manual Sync                /api/instructor/subscription/sync Provider + Subscription YES
7  Registration/Checkout      /api/register + checkout routes  Provider (initial)       NO (creates initial state)
```

Total: 7 writers, 6 require policy check.

---

#### 8. MEDIUM: CANCELLED → EXPIRED Weakens Terminal Invariant

**Issue:**
```typescript
if (incomingEvent.targetStatus === 'EXPIRED') {
    return { allowed: true, reason: 'cancelled-aging-to-expired' };
}
```

**Problem:**
- Stated invariant: "CANCELLED is terminal for that Stripe subscription"
- Exception: CANCELLED → EXPIRED allowed
- If EXPIRED is only reporting/retention, should it be a lifecycle state?

**Required Fix:**
Either:
1. Document that EXPIRED is post-terminal reporting state (not a lifecycle violation)
2. Separate retention state from lifecycle state
3. Remove exception and keep CANCELLED as true terminal state

Clarify: Does this undermine security invariant or not?

---

#### 9. MEDIUM: Rollback Plan Too Destructive

**Issue:**
```sql
ALTER TABLE "Provider" DROP COLUMN "lastWebhookEventTimestamp";
ALTER TABLE "Subscription" DROP COLUMN "lastWebhookEventId";
```

**Problem:**
If application still references these columns, DROP will cause errors.

Not safe for first-line production rollback.

**Required Fix:**
Safer rollback sequence:

```
1. Disable feature flag (application ignores columns)
2. Deploy backward-compatible app version
3. Verify system stable
4. Retain columns (no DROP yet)
5. Monitor for 7+ days
6. Separate schema migration to DROP columns (later)
```

Database rollback should be independent from application rollback.

---

## What Revision 2 Got Right (Keep These)

✅ Centralized state transition policy  
✅ Complete audit of all state writers  
✅ Recognition of invoice.payment_succeeded as resurrection path  
✅ Recognition of invoice.payment_failed as invalid transition  
✅ CANCELLED scoped to specific Stripe subscription (intent correct, implementation broken)  
✅ Distinction between cancel_at_period_end and CANCELLED  
✅ Signed HTTP webhook testing requirement  
✅ Explicit stale-event scenarios  
✅ Explicit re-subscription scenarios  
✅ Recognition that webhook delivery order cannot be assumed  
✅ Removed unsupported "50% probability" claim  

---

## Required Changes for Revision 3

### Priority 1 (CRITICAL - Blocking)

1. **Preserve cancelled subscription ID**
   - Add `Provider.lastCancelledSubscriptionId` OR
   - Maintain subscription ID history in Subscription table
   - Policy must correctly distinguish old vs new subscription

2. **Fix TOCTOU race**
   - Move state read INTO transaction
   - Policy evaluation on fresh state
   - Atomic: lock → read → decide → mutate → commit

### Priority 2 (HIGH - Security Impact)

3. **Fix manual sync timestamp semantics**
   - Define explicit Stripe freshness model
   - Do NOT claim `created` is state timestamp
   - Document ordering limitations

4. **Strengthen T7/T8 test assertions**
   - Assert actual security invariant
   - CANCELLED must be final outcome for same-second deleted events
   - Tests must fail if CANCELLED → ACTIVE occurs

5. **Replace NOW() migration strategy**
   - Sync from Stripe during migration
   - Establish watermarks from actual Stripe state
   - Do NOT invent future watermarks

6. **Remove side effects from policy function**
   - Pure decision logic only
   - Orchestration in handler
   - Separate state resolution from authorization

### Priority 3 (MEDIUM - Correctness)

7. **Reconcile state writer count** (create authoritative table)
8. **Clarify CANCELLED → EXPIRED** (terminal or not?)
9. **Improve rollback safety** (app first, schema later)

---

## Next Steps

1. Create Revision 3 design document
2. Address all 9 issues (6 Priority 1+2, 3 Priority 3)
3. Submit for second independent review
4. **DO NOT implement until Revision 3 approved**

---

## Audit Trail

- **Rev 1:** Initial design (timestamp guard only)
- **Rev 2:** Centralized policy, identified issues → **REJECTED (9 issues)**
- **Rev 3:** *(pending)* Fix CRITICAL + HIGH issues
- **Implementation:** BLOCKED until Rev 3 approved

---

**End of Review Findings**

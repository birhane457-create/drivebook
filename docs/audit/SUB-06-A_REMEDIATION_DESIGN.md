# SUB-06-A Remediation Design (REVISION 2)

**Finding:** Out-of-order webhook delivery can produce invalid subscription state  
**Severity:** MEDIUM  
**Status:** DESIGN PHASE - REVISION 2  
**Discovery Commit:** `13e7a038`  
**Initial Design Date:** 2026-09-XX  
**Revision Date:** 2026-09-XX

---

## Revision History

### Revision 2 (Current)
**Changes Based on Independent Review:**

1. ✅ **Centralized State Transition Policy**
   - Replaced ad-hoc timestamp guards with ONE authoritative `canTransitionSubscriptionState()` function
   - All 7 state writers must call this function before ANY mutation
   - Enforces layered guards: subscription ID scoping + terminal states + timestamp freshness + manual sync authority

2. ✅ **Terminal State Rules Strengthened**
   - CANCELLED is terminal for specific `stripeSubscriptionId` (not globally)
   - All event types explicitly checked against CANCELLED (not just subscription.updated)
   - Re-subscription via new Stripe subscription ID explicitly handled

3. ✅ **Manual Sync Authority Corrected**
   - Changed from "webhook is source of truth" to "Stripe current state is authoritative"
   - Manual sync retrieves direct Stripe state, which may be fresher than webhooks
   - Policy function compares Stripe state timestamp vs last webhook timestamp
   - Webhooks can override manual sync only if fresher

4. ✅ **Migration Bootstrap Policy Added**
   - Defined behavior for existing subscriptions with `lastWebhookEventTimestamp = NULL`
   - Option A: Bootstrap from first webhook (simpler, recommended)
   - Option B: Backfill with current timestamp during migration (safer)
   - Prevents pre-migration stale events from being accepted post-migration

5. ✅ **Scheduled Cancellation Explicitly Handled**
   - Distinguished `cancelAtPeriodEnd = true` (still ACTIVE, cancellation scheduled) from `status = CANCELLED` (terminated)
   - State machine diagram updated to show this distinction
   - Policy function does NOT treat cancel_at_period_end as terminal state

6. ✅ **Same-Second Events Clarified**
   - Timestamp is NOT a total ordering (multiple events can share same `event.created`)
   - Layered guards handle this: subscription ID scoping + terminal states + idempotency
   - Transaction serialization determines order for truly concurrent events
   - No additional guard needed beyond existing layers

7. ✅ **Test Coverage Expanded to 16 Tests**
   - Added T3-T6: Invoice events vs CANCELLED, manual sync vs CANCELLED
   - Added T13-T15: cancel_at_period_end, stale tier updates
   - Added T16: Migration bootstrap with NULL watermark
   - All tests MUST exercise actual signed webhook endpoint (not just handler functions)

8. ✅ **Invoice Events as Second Vulnerability Path**
   - Explicitly identified `invoice.payment_succeeded` and `invoice.payment_failed` as capable of resurrecting CANCELLED
   - Both handlers now check CANCELLED terminal state before mutation

### Revision 1 (Initial Design)
- Complete state writer inventory (7 paths)
- Identified invoice.payment_succeeded vulnerability
- Proposed timestamp ordering + CANCELLED terminal state
- 16 test scenarios defined

---

## Executive Summary

Discovery confirmed that `customer.subscription.updated` events can arrive after `customer.subscription.deleted`, allowing a stale update to overwrite a CANCELLED state. The current idempotency mechanism (`event_type + event_id + event_created`) prevents duplicate event processing but does NOT establish chronological ordering.

This design maps all subscription state writers and establishes authoritative state machine invariants before implementing fixes.

---

## Part 1: Complete State Writer Inventory

### Webhook Event Handlers (Primary State Writers)

#### 1. `handleSubscriptionUpdate()` (Lines 1570-1760)
**Trigger:** `customer.subscription.created`, `customer.subscription.updated`

**Mutates:**
- `Provider.subscriptionStatus` → normalizeStatus(subscription.status)
- `Provider.subscriptionTier` → derived tier
- `Provider.trialEndsAt` → trial_end timestamp
- `Subscription.status` → normalizeStatus(subscription.status)
- `Subscription.tier` → derived tier
- `Subscription` record (create/update via updateMany CAS or create)

**Current Guards:**
- Idempotency key prevents duplicate event processing
- SUB-22 fix: `updateMany()` CAS for trial-row claiming
- SERIALIZABLE transaction isolation

**Missing Guards:**
- ❌ NO timestamp/version ordering
- ❌ NO terminal state protection
- ❌ NO Stripe subscription ID scoping for CANCELLED

**Vulnerability:**
A stale `subscription.updated` event can unconditionally overwrite CANCELLED → ACTIVE.

---

#### 2. `handleSubscriptionCancelled()` (Lines 1822-1870)
**Trigger:** `customer.subscription.deleted`

**Mutates:**
- `Provider.subscriptionStatus` → 'CANCELLED'
- `Subscription.status` → 'CANCELLED' (via updateMany on stripeSubscriptionId)

**Current Guards:**
- Idempotency key
- SERIALIZABLE transaction
- `updateMany()` targets specific stripeSubscriptionId

**Missing Guards:**
- ❌ NOT protected from subsequent overwrites by other handlers
- ❌ NO lastEventTimestamp persistence
- ❌ CANCELLED is NOT treated as terminal

**Vulnerability:**
After this handler succeeds, a delayed `subscription.updated` or `invoice.payment_succeeded` can resurrect the subscription.

---

#### 3. `handleInvoicePaymentSucceeded()` (Lines 1926-1972)
**Trigger:** `invoice.payment_succeeded`

**Mutates:**
- `Subscription.status` → 'ACTIVE' (via updateMany on stripeSubscriptionId)
- `Provider.subscriptionStatus` → 'ACTIVE'
- `Provider.trialEndsAt` → NULL (clears trial state)

**Current Guards:**
- Idempotency key
- SERIALIZABLE transaction
- Scoped to specific stripeSubscriptionId

**Missing Guards:**
- ❌ NO check if subscription is CANCELLED
- ❌ NO timestamp ordering
- ❌ Can overwrite CANCELLED state

**Vulnerability:**
An invoice payment for an already-cancelled subscription can reactivate it. This is a **second independent vulnerability** beyond stale subscription.updated events.

**Critical Case:**
1. User cancels subscription (CANCELLED)
2. Delayed invoice.payment_succeeded arrives for the final billing period
3. Subscription incorrectly reactivated

---

#### 4. `handleInvoicePaymentFailed()` (Lines 1973-2033)
**Trigger:** `invoice.payment_failed`

**Mutates:**
- `Subscription.status` → 'PAST_DUE' (via updateMany)
- `Provider.subscriptionStatus` → 'PAST_DUE'

**Current Guards:**
- Idempotency key
- SERIALIZABLE transaction

**Missing Guards:**
- ❌ Can overwrite CANCELLED
- ❌ NO timestamp ordering

**Lower Risk:**
Overwriting CANCELLED with PAST_DUE is less severe than ACTIVE, but still violates state machine integrity.

---

### Cron Jobs (Secondary State Writers)

#### 5. Trial Expiry Cron (`/api/cron/check-trial-expiry`)
**Schedule:** Daily

**Mutates:**
- `Subscription.status` → 'EXPIRED' (via updateMany with CAS: WHERE status='TRIAL')
- `Provider.subscriptionStatus` → 'EXPIRED'
- `Provider.subscriptionTier` → 'BASIC'

**Current Guards:**
- ✅ **SUB-12-A FIX APPLIED:** Uses `updateMany({ where: { status: 'TRIAL' } })` CAS
- ✅ Only expires if row is still TRIAL (atomic guard)
- ✅ `count === 0` → skip provider update (race with webhook conversion)

**Status:** **CORRECTLY PROTECTED** against webhook races (verified in SUB-12-A concurrent tests)

**No Changes Required** for SUB-06-A remediation.

---

### Manual Sync Routes (User-Initiated State Writers)

#### 6. Subscription Sync Route (`/api/instructor/subscription/sync`)
**Trigger:** POST request after Billing Portal return

**Mutates:**
- `Provider.subscriptionTier` → tier from Stripe
- `Provider.subscriptionStatus` → normalizeStatus(stripeSub.status)
- `Provider.trialEndsAt` → trialEnd
- `Subscription.tier` → tier
- `Subscription.status` → normalizeStatus(status)
- `Subscription` billing fields (monthlyAmount, billingCycle, etc.)

**Current Guards:**
- Authentication required
- SERIALIZABLE transaction
- Fetches live state from Stripe API

**Missing Guards:**
- ❌ NO timestamp ordering
- ❌ Can overwrite CANCELLED if Stripe still shows active
- ❌ NOT idempotent with webhook processing

**Vulnerability:**
Manual sync can race with webhook delivery. If user returns from Billing Portal immediately after cancellation, sync might fetch stale Stripe state and overwrite CANCELLED.

---

## Part 2: Authoritative State Machine Design

### Current Status Enum
```typescript
'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'

// Plus subscription-level flag:
cancelAtPeriodEnd: boolean  // Scheduled cancellation, still active
```

**CRITICAL DISTINCTION:**
- `cancelAtPeriodEnd = true` → subscription is still ACTIVE/PAST_DUE, cancellation scheduled
- `status = 'CANCELLED'` → subscription terminated via `customer.subscription.deleted`

---

### Centralized State Transition Policy

**All 7 state writers must consult ONE authoritative policy function before mutating state.**

```typescript
/**
 * Authoritative subscription state transition policy.
 * Returns { allowed: boolean, reason: string }.
 * 
 * Called by ALL state writers before any mutation.
 */
async function canTransitionSubscriptionState(
  tx: PrismaTransaction,
  incomingEvent: {
    type: 'webhook' | 'manual-sync' | 'cron',
    stripeSubscriptionId: string | null,
    targetStatus: SubscriptionStatus,
    eventTimestamp: number | null,  // Unix timestamp for webhooks, Date.now() for others
    eventId: string,
  },
  currentState: {
    subscriptionStatus: SubscriptionStatus,
    stripeSubscriptionId: string | null,
    lastWebhookEventTimestamp: number | null,
    cancelAtPeriodEnd: boolean,
  }
): Promise<{ allowed: boolean; reason: string }> {
  
  // RULE 1: Terminal state protection (scoped to Stripe subscription ID)
  if (currentState.subscriptionStatus === 'CANCELLED') {
    // CANCELLED is terminal for the SAME Stripe subscription
    if (incomingEvent.stripeSubscriptionId === currentState.stripeSubscriptionId) {
      // Exception: CANCELLED → EXPIRED (aging for reporting)
      if (incomingEvent.targetStatus === 'EXPIRED') {
        return { allowed: true, reason: 'cancelled-aging-to-expired' };
      }
      
      // Block all other transitions
      return { allowed: false, reason: 'cancelled-is-terminal-for-this-subscription' };
    }
    
    // Different subscription ID → new subscription after cancellation
    if (incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
      return { allowed: true, reason: 're-subscription-new-stripe-id' };
    }
    
    // No subscription ID in event (e.g., cron expiry) → block
    return { allowed: false, reason: 'no-subscription-id-cannot-overwrite-cancelled' };
  }
  
  // RULE 2: Subscription ID scoping (prevent stale events for old subscriptions)
  if (currentState.stripeSubscriptionId !== null &&
      incomingEvent.stripeSubscriptionId !== null &&
      incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
    return { allowed: false, reason: 'event-for-old-subscription-id' };
  }
  
  // RULE 3: Event freshness (timestamp ordering for webhooks)
  if (incomingEvent.type === 'webhook' && 
      incomingEvent.eventTimestamp !== null &&
      currentState.lastWebhookEventTimestamp !== null) {
    
    if (incomingEvent.eventTimestamp < currentState.lastWebhookEventTimestamp) {
      return { allowed: false, reason: 'stale-event-older-timestamp' };
    }
    
    // Same timestamp → rely on idempotency key deduplication
    // This handles same-second events (not stale, just concurrent)
  }
  
  // RULE 4: Manual sync authority
  if (incomingEvent.type === 'manual-sync') {
    // Manual sync retrieves CURRENT Stripe state, which is authoritative
    // But if a webhook arrived MORE RECENTLY than the Stripe subscription's
    // last_updated timestamp, the webhook wins
    
    // Note: This requires the caller to pass Stripe's subscription.created or
    // subscription.updated timestamp as eventTimestamp for manual sync
    
    if (currentState.lastWebhookEventTimestamp !== null &&
        incomingEvent.eventTimestamp !== null &&
        currentState.lastWebhookEventTimestamp > incomingEvent.eventTimestamp) {
      return { allowed: false, reason: 'webhook-fresher-than-manual-sync' };
    }
    
    // Manual sync is fresher or no webhook exists → allow
    return { allowed: true, reason: 'manual-sync-fresher-than-webhooks' };
  }
  
  // RULE 5: Trial expiry cron (already has CAS guard in SUB-12-A)
  if (incomingEvent.type === 'cron' && incomingEvent.targetStatus === 'EXPIRED') {
    // Cron uses updateMany({ where: { status: 'TRIAL' } }) CAS
    // No additional guard needed here (handled in cron code)
    return { allowed: true, reason: 'cron-expiry-with-cas-guard' };
  }
  
  // RULE 6: Normal state transitions (no special guards triggered)
  // Allowed transitions:
  //   TRIAL      → ACTIVE (payment succeeds)
  //   TRIAL      → EXPIRED (trial ends)
  //   ACTIVE     → PAST_DUE (payment fails)
  //   ACTIVE     → CANCELLED (user cancels)
  //   PAST_DUE   → ACTIVE (payment succeeds)
  //   PAST_DUE   → CANCELLED (user cancels or dunning fails)
  //   EXPIRED    → ACTIVE (user subscribes)
  
  return { allowed: true, reason: 'normal-state-transition' };
}
```

---

### State Transition Matrix

| From State | To State | Trigger | Allowed? | Notes |
|------------|----------|---------|----------|-------|
| TRIAL | ACTIVE | webhook: subscription.updated (payment) | ✅ | Normal conversion |
| TRIAL | ACTIVE | webhook: invoice.payment_succeeded | ✅ | First payment |
| TRIAL | EXPIRED | cron: trial expiry | ✅ | CAS guard in cron |
| TRIAL | CANCELLED | webhook: subscription.deleted | ✅ | User cancels trial |
| ACTIVE | PAST_DUE | webhook: invoice.payment_failed | ✅ | Payment failure |
| ACTIVE | CANCELLED | webhook: subscription.deleted | ✅ | User cancels |
| ACTIVE | ACTIVE | webhook: subscription.updated (renewal) | ✅ | Normal renewal |
| PAST_DUE | ACTIVE | webhook: invoice.payment_succeeded | ✅ | Payment recovered |
| PAST_DUE | CANCELLED | webhook: subscription.deleted | ✅ | Dunning failed |
| CANCELLED | ACTIVE | webhook: subscription.updated (same sub ID) | ❌ | **BLOCKED** - terminal state |
| CANCELLED | ACTIVE | webhook: invoice.payment_succeeded (same sub ID) | ❌ | **BLOCKED** - terminal state |
| CANCELLED | ACTIVE | webhook: subscription.created (NEW sub ID) | ✅ | Re-subscription |
| CANCELLED | EXPIRED | cron: aging | ✅ | Reporting/cleanup |
| EXPIRED | ACTIVE | webhook: subscription.created (new subscription) | ✅ | User re-subscribes |
| ANY | ANY | webhook with older timestamp | ❌ | **BLOCKED** - stale event |
| ANY | ANY | webhook for old subscription ID | ❌ | **BLOCKED** - old subscription |

---

### Scheduled Cancellation Handling

**`cancelAtPeriodEnd` is NOT a status, it's a flag.**

```typescript
// Stripe webhook: subscription.updated with cancel_at_period_end=true
{
  status: 'ACTIVE',          // Still active
  cancelAtPeriodEnd: true,   // Cancellation scheduled
  currentPeriodEnd: 1234567890
}

// Later: customer.subscription.deleted fires at period end
{
  status: 'CANCELLED',       // Now terminated
  cancelAtPeriodEnd: false
}
```

**Policy:**
- `cancelAtPeriodEnd = true` → subscription remains ACTIVE/PAST_DUE, no terminal state
- `subscription.deleted` → sets CANCELLED (terminal for that subscription ID)

---

### Migration Bootstrap Policy

**Problem:** Existing subscriptions have `lastWebhookEventTimestamp = NULL`.

**Solution: Watermark Bootstrap**

```typescript
// When first webhook arrives for a subscription with NULL watermark:

if (currentState.lastWebhookEventTimestamp === NULL) {
  // Bootstrap: accept the event but establish baseline
  
  // Option A: Trust the first event unconditionally
  // Risk: If first post-migration event is stale, it establishes wrong baseline
  
  // Option B: Fetch current Stripe state as bootstrap (RECOMMENDED)
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const stripeUpdatedAt = stripeSub.created; // or latest_invoice.created
  
  if (incomingEvent.eventTimestamp < stripeUpdatedAt) {
    // Incoming event is older than Stripe's current state
    logger.warn(`Bootstrap: first event ${incomingEvent.eventId} is stale, fetching Stripe state`);
    
    // Sync from Stripe directly (manual sync logic)
    await syncFromStripe(tx, providerId, stripeSubscriptionId);
    
    // Record watermark from Stripe
    await tx.provider.update({
      where: { id: providerId },
      data: {
        lastWebhookEventTimestamp: stripeUpdatedAt,
        lastWebhookEventId: `bootstrap-${Date.now()}`
      }
    });
    
    return { allowed: false, reason: 'bootstrap-stale-event-synced-from-stripe' };
  }
  
  // Incoming event is fresh → accept and establish watermark
  return { allowed: true, reason: 'bootstrap-first-event' };
}
```

**Alternative (Simpler):**
During migration, backfill `lastWebhookEventTimestamp` with current time:

```sql
-- Migration: Set watermark to NOW for existing subscriptions
UPDATE "Provider" 
SET "lastWebhookEventTimestamp" = EXTRACT(EPOCH FROM NOW())::INTEGER
WHERE "subscriptionStatus" IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

-- Leave CANCELLED/EXPIRED with NULL (no future events expected)
```

This prevents pre-migration stale events from being accepted post-migration.

---

### Manual Sync Authority Rule (REVISED)

**Previous statement was backwards. Corrected:**

```
Stripe current subscription object = authoritative current state
Webhook event = state notification with event-time context
Manual sync = direct query of Stripe's authoritative state

Authority hierarchy:
1. Stripe API current state (retrieved via manual sync)
2. Recent webhook event (if fresher than manual sync)
3. Stale webhook event (ignored)
```

**Implementation:**

```typescript
// In manual sync route:
const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

// Stripe's subscription object has a 'created' timestamp and 'updated' metadata
// Use the most recent timestamp available (usually latest_invoice.created or current_period_start)
const stripeStateTimestamp = stripeSub.created; // or latest_invoice.created

const instructor = await prisma.provider.findUnique({
  where: { id: providerId },
  select: { lastWebhookEventTimestamp: true, subscriptionStatus: true }
});

// Check if a webhook has already processed a NEWER state
if (instructor.lastWebhookEventTimestamp &&
    instructor.lastWebhookEventTimestamp > stripeStateTimestamp) {
  // Webhook is fresher than Stripe's current state timestamp
  // (Should be rare, but can happen if webhook delivered before Stripe API fully consistent)
  return { synced: false, reason: 'webhook-fresher-than-stripe-state' };
}

// Manual sync is authoritative → proceed
// But STILL respect terminal CANCELLED state
const canTransition = await canTransitionSubscriptionState(tx, {
  type: 'manual-sync',
  stripeSubscriptionId: stripeSub.id,
  targetStatus: normalizeStatus(stripeSub.status),
  eventTimestamp: stripeStateTimestamp,
  eventId: `manual-sync-${Date.now()}`
}, instructor);

if (!canTransition.allowed) {
  return { synced: false, reason: canTransition.reason };
}

// Proceed with sync...
```

---

### Same-Second Events

**Problem:** Multiple events can share the same `event.created` timestamp.

**Solution:** Timestamp is NOT a total ordering. Layered guards:

```
Layer 1: Subscription ID scoping (events for old subscriptions ignored)
Layer 2: Terminal state rules (CANCELLED cannot be overwritten for same ID)
Layer 3: Timestamp freshness (reject events with older timestamps)
Layer 4: Idempotency key (reject duplicate event IDs)
```

**For same-second events:**
- Timestamp check passes (same timestamp = not stale)
- Idempotency key prevents duplicates
- Terminal state rules prevent CANCELLED overwrites
- Last event processed wins (transaction serialization determines order)

**No additional guard needed** - existing idempotency + terminal state rules suffice.

---

## Part 3: State Machine Diagram

```
         TRIAL ──────┐
           │         │
           │ trial   │ payment
           │ ends    │ succeeds
           ▼         ▼
        EXPIRED    ACTIVE ◄───┐
                     │         │ renewal
                     │ payment │ succeeds
                     │ fails   │
                     ▼         │
                  PAST_DUE ────┘
                     │
                     │ cancel
                     ▼
                 CANCELLED ◄─── (terminal for this stripeSubscriptionId)
                               
Re-subscription → NEW stripeSubscriptionId → NEW row starts at TRIAL/ACTIVE
```

---

## Part 4: Affected Database Schema

### Migration Required

```sql
-- Add timestamp tracking to Provider
ALTER TABLE "Provider" ADD COLUMN "lastWebhookEventTimestamp" INTEGER;
ALTER TABLE "Provider" ADD COLUMN "lastWebhookEventId" TEXT;

-- Add timestamp tracking to Subscription
ALTER TABLE "Subscription" ADD COLUMN "lastWebhookEventTimestamp" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "lastWebhookEventId" TEXT;

-- Backfill: set to NULL for existing rows (no historical data)
UPDATE "Provider" SET "lastWebhookEventTimestamp" = NULL WHERE "lastWebhookEventTimestamp" IS NULL;
UPDATE "Subscription" SET "lastWebhookEventTimestamp" = NULL WHERE "lastWebhookEventTimestamp" IS NULL;
```

---

## Part 5: Required Code Changes

### 5.0 Centralized State Transition Policy (NEW - REQUIRED)

**Location:** `app/api/stripe/webhook/route.ts` or new `lib/subscription-state-machine.ts`

**ALL handlers must call this function before ANY state mutation.**

```typescript
/**
 * SUB-06-A Fix: Centralized subscription state transition policy.
 * 
 * Enforces:
 * - Terminal CANCELLED state (scoped to Stripe subscription ID)
 * - Subscription ID scoping (events for old subscriptions rejected)
 * - Event freshness (timestamp ordering for webhooks)
 * - Manual sync authority (direct Stripe state vs webhook freshness)
 * 
 * Returns { allowed: boolean, reason: string }.
 */
async function canTransitionSubscriptionState(
  tx: PrismaTransaction,
  incomingEvent: {
    type: 'webhook' | 'manual-sync' | 'cron',
    stripeSubscriptionId: string | null,
    targetStatus: SubscriptionStatus,
    eventTimestamp: number | null,
    eventId: string,
  },
  currentState: {
    subscriptionStatus: SubscriptionStatus,
    stripeSubscriptionId: string | null,
    lastWebhookEventTimestamp: number | null,
    cancelAtPeriodEnd: boolean,
  }
): Promise<{ allowed: boolean; reason: string }> {
  
  // RULE 1: Terminal state protection (scoped to Stripe subscription ID)
  if (currentState.subscriptionStatus === 'CANCELLED') {
    if (incomingEvent.stripeSubscriptionId === currentState.stripeSubscriptionId) {
      // CANCELLED → EXPIRED aging allowed
      if (incomingEvent.targetStatus === 'EXPIRED') {
        return { allowed: true, reason: 'cancelled-aging-to-expired' };
      }
      return { allowed: false, reason: 'cancelled-is-terminal-for-this-subscription' };
    }
    
    // Different subscription ID → re-subscription
    if (incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
      return { allowed: true, reason: 're-subscription-new-stripe-id' };
    }
    
    return { allowed: false, reason: 'no-subscription-id-cannot-overwrite-cancelled' };
  }
  
  // RULE 2: Subscription ID scoping
  if (currentState.stripeSubscriptionId !== null &&
      incomingEvent.stripeSubscriptionId !== null &&
      incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
    return { allowed: false, reason: 'event-for-old-subscription-id' };
  }
  
  // RULE 3: Event freshness (timestamp ordering)
  if (incomingEvent.type === 'webhook' && 
      incomingEvent.eventTimestamp !== null &&
      currentState.lastWebhookEventTimestamp !== null) {
    
    if (incomingEvent.eventTimestamp < currentState.lastWebhookEventTimestamp) {
      return { allowed: false, reason: 'stale-event-older-timestamp' };
    }
    
    // Same timestamp → idempotency handles duplicates
  }
  
  // RULE 4: Manual sync authority
  if (incomingEvent.type === 'manual-sync') {
    if (currentState.lastWebhookEventTimestamp !== null &&
        incomingEvent.eventTimestamp !== null &&
        currentState.lastWebhookEventTimestamp > incomingEvent.eventTimestamp) {
      return { allowed: false, reason: 'webhook-fresher-than-manual-sync' };
    }
    return { allowed: true, reason: 'manual-sync-authoritative' };
  }
  
  // RULE 5: Cron expiry (CAS guard in cron code)
  if (incomingEvent.type === 'cron' && incomingEvent.targetStatus === 'EXPIRED') {
    return { allowed: true, reason: 'cron-expiry-with-cas-guard' };
  }
  
  // RULE 6: Bootstrap watermark (NULL → first event)
  if (currentState.lastWebhookEventTimestamp === null && incomingEvent.type === 'webhook') {
    // First webhook post-migration or for new subscription
    return { allowed: true, reason: 'bootstrap-first-webhook' };
  }
  
  // Normal transition allowed
  return { allowed: true, reason: 'normal-state-transition' };
}
```

---

### 5.1 Update `handleSubscriptionUpdate()`

**BEFORE state mutation, call policy function:**

```typescript
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  idempotencyKey: string,
  eventCreated: number  // NEW: event.created timestamp from Stripe
): Promise<void> {
  // ... existing metadata validation ...

  const instructor = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      lastWebhookEventTimestamp: true,
      cancelAtPeriodEnd: true
    }
  });

  if (!instructor) {
    logger.error(`Instructor not found: ${providerId}`);
    return;
  }

  // *** CENTRALIZED POLICY CHECK ***
  const canTransition = await canTransitionSubscriptionState(
    prisma, // or tx if inside transaction
    {
      type: 'webhook',
      stripeSubscriptionId: subscription.id,
      targetStatus: normalizeStatus(subscription.status),
      eventTimestamp: eventCreated,
      eventId: idempotencyKey
    },
    instructor
  );

  if (!canTransition.allowed) {
    logger.warn(`subscription.updated blocked: ${canTransition.reason}`, {
      subscriptionId: subscription.id,
      providerId,
      eventTimestamp: eventCreated
    });
    
    // Record webhook as processed (idempotency) but skip state mutation
    await recordWebhookEvent(prisma, idempotencyKey, 'subscription.updated', subscription.id, {
      skipped: true,
      reason: canTransition.reason,
      providerId
    });
    
    return; // Exit without mutating state
  }

  // Policy allowed → proceed with state mutation
  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
      await recordWebhookEvent(tx, idempotencyKey, 'subscription.updated', subscription.id, {
        providerId,
        tier,
        status
      });
  
      await tx.provider.update({
        where: { id: providerId },
        data: {
          subscriptionTier: tier as any,
          subscriptionStatus: normalizeStatus(status) as any,
          stripeSubscriptionId: subscription.id,
          lastWebhookEventTimestamp: eventCreated,  // Update watermark
          lastWebhookEventId: idempotencyKey,
          trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
          stripeCustomerId: subscription.customer as string,
        } as any
      });
  
      // ... existing subscription update/create logic ...
      
      // Also update Subscription.lastWebhookEventTimestamp
      await tx.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          lastWebhookEventTimestamp: eventCreated,
          lastWebhookEventId: idempotencyKey
        }
      });
    }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-subscription-updated' });
}
```

---

### 5.2 Update `handleSubscriptionCancelled()`

**Same pattern: policy check first, then mutate:**

```typescript
async function handleSubscriptionCancelled(
  subscription: Stripe.Subscription,
  idempotencyKey: string,
  eventCreated: number
): Promise<void> {
  const { metadata } = subscription;
  const { providerId } = metadata;

  if (!providerId) {
    await recordWebhookEvent(prisma, idempotencyKey, 'subscription.cancelled', subscription.id, {
      error: 'Missing providerId'
    });
    return;
  }

  const instructor = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      lastWebhookEventTimestamp: true,
      cancelAtPeriodEnd: true
    }
  });

  if (!instructor) {
    logger.error(`Instructor not found: ${providerId}`);
    return;
  }

  // *** CENTRALIZED POLICY CHECK ***
  const canTransition = await canTransitionSubscriptionState(
    prisma,
    {
      type: 'webhook',
      stripeSubscriptionId: subscription.id,
      targetStatus: 'CANCELLED',
      eventTimestamp: eventCreated,
      eventId: idempotencyKey
    },
    instructor
  );

  if (!canTransition.allowed) {
    logger.warn(`subscription.deleted blocked: ${canTransition.reason}`);
    await recordWebhookEvent(prisma, idempotencyKey, 'subscription.cancelled', subscription.id, {
      skipped: true,
      reason: canTransition.reason
    });
    return;
  }

  // Policy allowed → proceed
  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
      await recordWebhookEvent(tx, idempotencyKey, 'subscription.cancelled', subscription.id, {
        providerId
      });
  
      await tx.provider.update({
        where: { id: providerId },
        data: {
          subscriptionStatus: 'CANCELLED' as any,
          stripeSubscriptionId: null,  // Clear current subscription (enables re-subscription)
          lastWebhookEventTimestamp: eventCreated,
          lastWebhookEventId: idempotencyKey
        }
      });
  
      await tx.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: 'CANCELLED',
          lastWebhookEventTimestamp: eventCreated,
          lastWebhookEventId: idempotencyKey
        }
      });
  
      // ... audit log ...
    }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-subscription-cancelled' });

  logger.info(`✅ Subscription cancelled: ${subscription.id}`);
}
```

---

### 5.3 Update `handleInvoicePaymentSucceeded()`

**Check CANCELLED terminal state + subscription ID match:**

```typescript
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  idempotencyKey: string,
  eventCreated: number
): Promise<void> {
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    await recordWebhookEvent(prisma, idempotencyKey, 'invoice.payment_succeeded', invoice.id, {});
    return;
  }

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId as string },
    include: {
      provider: {
        select: {
          id: true,
          subscriptionStatus: true,
          stripeSubscriptionId: true,
          lastWebhookEventTimestamp: true,
          cancelAtPeriodEnd: true
        }
      }
    }
  });

  if (!subscription?.provider) {
    logger.warn(`No subscription found for invoice ${invoice.id}`);
    return;
  }

  // *** CENTRALIZED POLICY CHECK ***
  const canTransition = await canTransitionSubscriptionState(
    prisma,
    {
      type: 'webhook',
      stripeSubscriptionId: subscriptionId as string,
      targetStatus: 'ACTIVE',
      eventTimestamp: eventCreated,
      eventId: idempotencyKey
    },
    subscription.provider
  );

  if (!canTransition.allowed) {
    logger.warn(`invoice.payment_succeeded blocked: ${canTransition.reason}`, {
      invoiceId: invoice.id,
      subscriptionId
    });
    
    await recordWebhookEvent(prisma, idempotencyKey, 'invoice.payment_succeeded', invoice.id, {
      skipped: true,
      reason: canTransition.reason,
      subscriptionId
    });
    
    return;
  }

  // Policy allowed → set ACTIVE
  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
      await recordWebhookEvent(tx, idempotencyKey, 'invoice.payment_succeeded', invoice.id, {
        subscriptionId
      });
  
      await tx.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId as string },
        data: {
          status: 'ACTIVE',
          lastWebhookEventTimestamp: eventCreated,
          lastWebhookEventId: idempotencyKey
        }
      });
  
      await tx.provider.update({
        where: { id: subscription.providerId },
        data: {
          subscriptionStatus: 'ACTIVE' as any,
          trialEndsAt: null,
          lastWebhookEventTimestamp: eventCreated,
          lastWebhookEventId: idempotencyKey
        }
      });
    }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-invoice-payment-succeeded' });

  logger.info(`✅ Invoice payment succeeded: ${invoice.id}`);
}
```

---

### 5.4 Update `handleInvoicePaymentFailed()`

**Same pattern as invoice.payment_succeeded:**

```typescript
// Similar to handleInvoicePaymentSucceeded, but targetStatus: 'PAST_DUE'
// Policy check prevents overwriting CANCELLED with PAST_DUE
```

---

### 5.5 Update Manual Sync Route

**Fetch Stripe timestamp, call policy, respect terminal states:**

```typescript
export async function POST(req: NextRequest) {
  // ... existing auth + provider lookup ...

  const stripeSub = await stripe.subscriptions.retrieve(
    activeSubscription.stripeSubscriptionId,
    { expand: ['items.data.price', 'latest_invoice'] }
  );

  // Derive timestamp from Stripe object
  // Use latest_invoice.created if available (most recent activity)
  // Otherwise use subscription.created
  const stripeStateTimestamp = (stripeSub.latest_invoice as any)?.created || stripeSub.created;

  // *** CENTRALIZED POLICY CHECK ***
  const canTransition = await canTransitionSubscriptionState(
    prisma,
    {
      type: 'manual-sync',
      stripeSubscriptionId: stripeSub.id,
      targetStatus: normalizeStatus(stripeSub.status),
      eventTimestamp: stripeStateTimestamp,
      eventId: `manual-sync-${Date.now()}`
    },
    {
      subscriptionStatus: instructor.subscriptionStatus,
      stripeSubscriptionId: instructor.stripeSubscriptionId,
      lastWebhookEventTimestamp: instructor.lastWebhookEventTimestamp,
      cancelAtPeriodEnd: instructor.cancelAtPeriodEnd || false
    }
  );

  if (!canTransition.allowed) {
    return NextResponse.json({
      synced: false,
      reason: canTransition.reason
    });
  }

  // Policy allowed → proceed with sync
  await prisma.$transaction(async (tx) => {
    await tx.provider.update({
      where: { id: instructor.id },
      data: {
        subscriptionTier: tier as any,
        subscriptionStatus: stripeStatus as any,
        trialEndsAt: trialEnd,
        maxProviders: plan.limits.providers,
        lastWebhookEventTimestamp: stripeStateTimestamp,  // Update watermark
        lastWebhookEventId: `manual-sync-${Date.now()}`
      } as any,
    });

    // ... update subscription record ...
  });

  return NextResponse.json({ synced: true, tier, status: stripeStatus });
}
```

---

### 5.6 Update Webhook POST Handler

**Pass `event.created` timestamp to handlers:**

```typescript
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  // Verify signature...
  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  
  const idempotencyKey = `${event.type}_${event.id}_${event.created}`;
  const eventCreated = event.created;  // Extract timestamp

  // Existing idempotency check...

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, idempotencyKey, eventCreated);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object as Stripe.Subscription, idempotencyKey, eventCreated);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, idempotencyKey, eventCreated);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, idempotencyKey, eventCreated);
      break;

    // ...
  }
}
```

---

## Part 6: Regression Test Coverage

### Required Test Scenarios (16 Tests)

**ALL tests must exercise the actual signed webhook endpoint, not just invoke handler functions.**

#### Test Group 1: Basic Out-of-Order Delivery
**T1: updated(active) → deleted (correct order)**
- Send subscription.updated (ACTIVE, timestamp T1)
- Send subscription.deleted (timestamp T2 > T1)
- Expected: Final state = CANCELLED ✅

**T2: deleted → stale updated(active) (PRIMARY VULNERABILITY)**
- Send subscription.deleted (timestamp T2)
- Send subscription.updated (ACTIVE, timestamp T1 < T2) [STALE]
- Expected: Final state = CANCELLED (stale update blocked) ✅

**T3: deleted → invoice.payment_succeeded (SECOND VULNERABILITY)**
- Send subscription.deleted (timestamp T2)
- Send invoice.payment_succeeded (timestamp T1 < T2) [STALE]
- Expected: Final state = CANCELLED (invoice ignored) ✅

**T4: deleted → invoice.payment_failed**
- Send subscription.deleted (timestamp T2)
- Send invoice.payment_failed (timestamp T1 < T2) [STALE]
- Expected: Final state = CANCELLED (invoice ignored, NOT PAST_DUE) ✅

**T5: deleted → stale subscription.created**
- Send subscription.deleted (timestamp T2)
- Send subscription.created (timestamp T1 < T2) [STALE]
- Expected: Final state = CANCELLED (creation ignored) ✅

**T6: deleted → manual sync returning active**
- Send subscription.deleted (timestamp T2)
- Trigger manual sync (retrieves Stripe state with timestamp T1 < T2)
- Expected: Final state = CANCELLED (manual sync blocked by terminal state) ✅

#### Test Group 2: Concurrent Events
**T7: concurrent updated + deleted**
- Send subscription.updated (ACTIVE, timestamp T1)
- Send subscription.deleted (timestamp T1) [SAME SECOND]
- Expected: One of ACTIVE or CANCELLED (transaction serialization determines order, both valid) ✅

**T8: concurrent invoice.success + deleted**
- Send invoice.payment_succeeded (timestamp T1)
- Send subscription.deleted (timestamp T1) [SAME SECOND]
- Expected: One of ACTIVE or CANCELLED (last transaction wins) ✅

#### Test Group 3: Multiple Out-of-Order Updates
**T9: multiple out-of-order updates**
- Send subscription.updated (tier=PRO, timestamp T3)
- Send subscription.updated (tier=BASIC, timestamp T1) [STALE]
- Send subscription.updated (tier=STUDIO, timestamp T2) [STALE]
- Expected: Final tier = PRO (most recent timestamp wins) ✅

#### Test Group 4: Idempotency
**T10: duplicate updated**
- Send subscription.updated (same event ID twice)
- Expected: Processed once, idempotent (no error, single state update) ✅

**T11: duplicate deleted**
- Send subscription.deleted (same event ID twice)
- Expected: Processed once, idempotent (CANCELLED state stable) ✅

#### Test Group 5: Re-subscription (CRITICAL)
**T12: new Stripe subscription after cancellation**
- Send subscription.deleted (subscription ID = sub_A, timestamp T1)
- Verify: Provider.subscriptionStatus = CANCELLED, Provider.stripeSubscriptionId = NULL
- Send subscription.created (subscription ID = sub_B, timestamp T2 > T1) [NEW SUB]
- Expected: Provider.subscriptionStatus = ACTIVE, Provider.stripeSubscriptionId = sub_B
- Verify: Old Subscription row (sub_A) remains CANCELLED ✅

**T13: stale event for old subscription after re-subscription**
- Re-subscribe (subscription ID sub_A → sub_B)
- Send subscription.updated for sub_A (ACTIVE, timestamp T_stale)
- Expected: Event ignored (old subscription ID), Provider remains on sub_B ✅

#### Test Group 6: Scheduled Cancellation
**T14: cancel_at_period_end update**
- Send subscription.updated (status=ACTIVE, cancel_at_period_end=true, timestamp T1)
- Expected: Provider.subscriptionStatus = ACTIVE (still active, cancellation scheduled)
- Send subscription.updated (status=ACTIVE, cancel_at_period_end=false, timestamp T2) [User reactivated]
- Expected: cancel_at_period_end = false (cancellation un-scheduled) ✅

**T15: stale old tier update after cancel_at_period_end**
- Send subscription.updated (tier=PRO, cancel_at_period_end=true, timestamp T2)
- Send subscription.updated (tier=BASIC, timestamp T1) [STALE]
- Expected: tier = PRO, cancel_at_period_end = true (stale update ignored) ✅

#### Test Group 7: Migration Bootstrap
**T16: existing pre-migration subscription with NULL watermark**
- Create subscription with lastWebhookEventTimestamp = NULL (simulates pre-migration row)
- Send subscription.updated (timestamp T1)
- Expected: Watermark bootstrapped, event accepted
- Send subscription.updated (timestamp T0 < T1) [STALE]
- Expected: Stale event blocked (watermark now established) ✅

---

### HTTP Integration Test Script

**Script:** `__tests__/integration/sub-06a-state-machine.test.ts`

**Requirements:**
1. Use actual signed webhook endpoint (`/api/stripe/webhook`)
2. Generate valid Stripe webhook signatures
3. Use test Stripe subscription IDs
4. Clean up test data after each scenario
5. Verify database state after each event
6. Verify AuditLog entries for skipped events

**Example Structure:**
```typescript
describe('SUB-06-A State Machine Ordering', () => {
  describe('T1: updated → deleted (correct order)', () => {
    it('processes events in order and reaches CANCELLED', async () => {
      // Setup: create test provider + subscription
      // Send signed webhook: subscription.updated (ACTIVE)
      // Verify: Provider.subscriptionStatus = ACTIVE
      // Send signed webhook: subscription.deleted
      // Verify: Provider.subscriptionStatus = CANCELLED
      // Cleanup
    });
  });
  
  describe('T2: deleted → stale updated (PRIMARY VULNERABILITY)', () => {
    it('blocks stale update after cancellation', async () => {
      // Setup
      // Send subscription.deleted (T2)
      // Verify: CANCELLED
      // Send subscription.updated (T1 < T2) [STALE]
      // Verify: STILL CANCELLED (event logged as skipped)
      // Cleanup
    });
  });
  
  // ... T3-T16 ...
});
```

---

## Part 7: Production Verification Plan

### Step 1: Deploy with Feature Flag
```typescript
const ENABLE_SUB_06A_FIX = process.env.ENABLE_SUB_06A_ORDERING_FIX === 'true';

if (ENABLE_SUB_06A_FIX) {
  // Run new timestamp guards
} else {
  // Fall back to existing behavior (for safe rollback)
}
```

### Step 2: Monitoring & Alerting
**Metrics to Track:**
- `sub_06a_stale_events_blocked` (count of events ignored due to timestamp)
- `sub_06a_cancelled_protected` (count of CANCELLED overwrites prevented)
- `sub_06a_old_subscription_ignored` (count of events for old stripeSubscriptionId)

**Alerts:**
- Alert if `stale_events_blocked` > 10/hour (indicates webhook ordering issues)
- Alert if `lastWebhookEventTimestamp` goes backwards (timestamp consistency violation)

### Step 3: HTTP Integration Tests (Production-Safe)
**Test Script:** `scripts/run-sub-06a-production-verification.mjs`

1. Create test provider with trial subscription
2. Trigger `subscription.updated` via Stripe API
3. Trigger `subscription.deleted` via Stripe API
4. Verify: Provider.subscriptionStatus = CANCELLED
5. Simulate stale event (inject old event via test webhook endpoint with auth)
6. Verify: CANCELLED preserved
7. Clean up test data

**Success Criteria:**
- All 6 scenarios pass
- Zero production data corrupted
- Zero production revenue impact

---

## Part 8: Rollback Plan

### If Production Issues Detected:
1. Set `ENABLE_SUB_06A_ORDERING_FIX=false` (reverts to old behavior)
2. Deploy via emergency release
3. Monitor for 24h
4. Review logs for root cause

### Database Rollback:
```sql
-- If schema migration applied but fix has issues:
ALTER TABLE "Provider" DROP COLUMN "lastWebhookEventTimestamp";
ALTER TABLE "Provider" DROP COLUMN "lastWebhookEventId";
ALTER TABLE "Subscription" DROP COLUMN "lastWebhookEventTimestamp";
ALTER TABLE "Subscription" DROP COLUMN "lastWebhookEventId";
```

---

## Part 9: Risk Assessment

### Risks Mitigated by This Fix:
1. ✅ Stale subscription.updated overwriting CANCELLED
2. ✅ invoice.payment_succeeded resurrecting cancelled subscription
3. ✅ Manual sync racing with webhooks
4. ✅ Out-of-order webhook delivery producing invalid state

### Remaining Risks (Out of Scope):
1. **Stripe clock skew:** If Stripe's event.created timestamps are non-monotonic (should never happen, but not under our control)
2. **Webhook delivery failure:** If webhooks never arrive, subscription state becomes stale (existing risk, not introduced by this fix)
3. **Concurrent cancellation + renewal:** User cancels and immediately re-subscribes within same second (timestamp collision) - idempotency key still prevents duplicates

### Mitigation for Remaining Risks:
- Timestamp collision: Idempotency key (event_id) provides tie-breaker
- Webhook failure: Existing manual sync route + cron health checks already handle this
- Stripe timestamp bugs: Log and alert on timestamp regression, manual investigation required

---

## Part 10: Acceptance Criteria

### Definition of Done:
- [ ] Database migration applied (lastWebhookEventTimestamp columns)
- [ ] All 5 webhook handlers updated with timestamp guards
- [ ] Manual sync route respects webhook timestamps
- [ ] 16 regression tests written and passing
- [ ] HTTP production verification script passes (3/3 scenarios)
- [ ] Feature flag deployed
- [ ] Monitoring dashboards updated
- [ ] Runbook updated with rollback procedure
- [ ] SECURITY_FINDINGS_TRACKER.md updated: SUB-06-A → CLOSED

---

## Part 11: Independent Review Corrections

### Discovery Document Corrections Required:
1. ❌ Remove "50% chance" probability claim (unsupported)
2. ❌ Clarify "Stripe recommends timestamps" → "Webhook delivery order must not be assumed"
3. ✅ Keep code-level vulnerability evidence (accurate)
4. ✅ Add invoice.payment_succeeded as second vulnerability path
5. ✅ Add manual sync race condition
6. ✅ Clarify re-subscription case (CANCELLED must be scoped to stripeSubscriptionId)

---

## Next Steps

**DO NOT IMPLEMENT** until this design is approved by independent review.

**Review Checkpoints:**
1. State machine transitions correct?
2. Terminal state logic sound?
3. Re-subscription case handled correctly?
4. Test coverage sufficient?
5. Rollback plan adequate?
6. Any edge cases missed?

**After Approval:**
1. Create implementation branch
2. Apply database migration
3. Implement handler updates
4. Write regression tests
5. Run test suite
6. Deploy to staging
7. Run HTTP verification
8. Deploy to production with feature flag
9. Monitor for 48h
10. Enable feature flag globally
11. Close SUB-06-A finding

---

## Appendix: Event Timestamp Examples

### Example 1: Correct Order
```json
Event 1: subscription.updated (created: 1609459200)
  → Provider.subscriptionStatus = ACTIVE
  → Provider.lastWebhookEventTimestamp = 1609459200

Event 2: subscription.deleted (created: 1609459300)
  → Check: 1609459300 > 1609459200 ✅ (newer)
  → Provider.subscriptionStatus = CANCELLED
  → Provider.lastWebhookEventTimestamp = 1609459300

Final: CANCELLED ✅
```

### Example 2: Stale Event Blocked
```json
Event 1: subscription.deleted (created: 1609459300)
  → Provider.subscriptionStatus = CANCELLED
  → Provider.lastWebhookEventTimestamp = 1609459300

Event 2: subscription.updated (created: 1609459200) [STALE]
  → Check: 1609459200 < 1609459300 ❌ (older)
  → SKIP mutation, log warning
  → Provider.lastWebhookEventTimestamp unchanged (1609459300)

Final: CANCELLED ✅ (protected)
```

### Example 3: Re-subscription
```json
Old Subscription: stripeSubscriptionId = sub_old_123
Event 1: subscription.deleted (sub_old_123, created: 1609459300)
  → Provider.subscriptionStatus = CANCELLED
  → Provider.stripeSubscriptionId = NULL

User re-subscribes → new Stripe subscription created
New Subscription: stripeSubscriptionId = sub_new_456

Event 2: subscription.updated (sub_new_456, created: 1609459500)
  → Check: sub_new_456 != sub_old_123 ✅ (different subscription)
  → Provider.subscriptionStatus = ACTIVE
  → Provider.stripeSubscriptionId = sub_new_456

Stale Event 3: subscription.updated (sub_old_123, created: 1609459250) [DELAYED]
  → Check: sub_old_123 != sub_new_456 ❌ (old subscription)
  → SKIP mutation
  → Provider.subscriptionStatus unchanged (ACTIVE for sub_new_456) ✅

Final: ACTIVE (new subscription), old subscription row CANCELLED ✅
```

---

**End of Remediation Design Document**

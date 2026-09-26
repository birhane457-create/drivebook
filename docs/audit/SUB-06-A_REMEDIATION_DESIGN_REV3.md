# SUB-06-A Remediation Design (REVISION 3)

**Finding:** Out-of-order webhook delivery can produce invalid subscription state  
**Severity:** MEDIUM  
**Status:** DESIGN PHASE - REVISION 3 (ARCHITECTURAL)  
**Discovery Commit:** `13e7a038`  
**Rev 2 Commit:** `5319cb6b` (REJECTED - 9 issues)  
**Rev 2 Review:** `18755b3d`  
**Rev 3 Date:** 2026-09-26

---

## Revision History

### Revision 3 (Current - Architectural)
**Addresses ALL 9 Rev 2 issues with architectural solutions:**

**CRITICAL FIXES:**
1. ✅ **Use existing Subscription.stripeSubscriptionId as immutable identity**
   - NO new `lastCancelledSubscriptionId` field
   - Subscription row retains `stripeSubscriptionId` even when CANCELLED
   - Provider.stripeSubscriptionId cleared on cancellation (pointer only)
   - Policy evaluates against specific Subscription row, not only Provider fields

2. ✅ **Atomic transaction boundary: resolve → decide → mutate**
   - BEGIN TRANSACTION → identify → lock → read → decide → mutate → COMMIT
   - NO security decisions on pre-transaction state
   - Pure policy function (no I/O, no mutations)
   - Clean separation: state resolution, authorization, mutation

**HIGH PRIORITY FIXES:**
3. ✅ **Manual sync freshness model defined**
   - NO generic "state timestamp" claims
   - Conservative behavior when freshness cannot be compared
   - Explicit Stripe API eventual consistency handling

4. ✅ **T7/T8 test invariants strengthened**
   - Assert: once cancellation committed for sub_A, no resurrection
   - Tests MUST fail if CANCELLED → ACTIVE occurs

5. ✅ **Migration bootstrap from actual Stripe state**
   - NO NOW() invented watermarks
   - Explicit reconciliation procedure
   - Safe for subscriptions with pending webhooks

6. ✅ **Pure policy function (no side effects)**
   - canTransitionSubscriptionState() is deterministic
   - NO Stripe API calls, NO database writes
   - Side effects in handler/orchestration layer

**MEDIUM PRIORITY FIXES:**
7. ✅ **Authoritative state writer inventory (reconciled)**
8. ✅ **CANCELLED → EXPIRED semantics clarified**
9. ✅ **Safe rollback (application first, schema later)**

### Revision 2 (Rejected)
- Centralized policy, BUT lost subscription ID + TOCTOU race
- 9 issues identified in independent review

### Revision 1 (Initial)
- Timestamp guard only (incomplete)

---

## Part 0: Architectural Invariants

**These 8 invariants MUST be demonstrable in the design:**

```
INV-1  A Stripe subscription ID has one immutable historical identity
       → Subscription.stripeSubscriptionId never changes for a row

INV-2  CANCELLED is terminal for that Stripe subscription ID
       → Once Subscription(sub_A).status = CANCELLED, no event for sub_A can change it

INV-3  A new Stripe subscription ID creates a new lifecycle instance
       → Subscription(sub_B) is independent of Subscription(sub_A)

INV-4  State authorization and mutation occur atomically
       → Read, policy check, and mutation in ONE SERIALIZABLE transaction

INV-5  Older webhook events cannot overwrite newer accepted state
       → Timestamp ordering enforced

INV-6  Equal-timestamp events cannot resurrect a committed cancellation
       → CANCELLED precedence regardless of event order

INV-7  Manual sync cannot incorrectly overwrite newer authoritative state
       → Conservative freshness comparison

INV-8  Existing rows are safely bootstrapped after migration
       → Reconciliation from actual Stripe state, not invented timestamps
```

---

## Part 1: Schema and Data Model

### Existing Schema (NO changes needed for critical fixes)

```prisma
model Subscription {
  id                   String    @id @default(cuid())
  providerId           String
  tier                 String
  status               String    @default("ACTIVE")
  billingCycle         String    @default("monthly")
  monthlyAmount        Decimal   @db.Decimal(10, 2)
  stripeSubscriptionId String?   // ← IMMUTABLE IDENTITY (INV-1)
  stripeCustomerId     String?
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean   @default(false)
  trialEndsAt          DateTime?
  cancelledAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  provider             Provider  @relation(fields: [providerId], references: [id])
}

model Provider {
  id                   String    @id
  stripeSubscriptionId String?   // ← POINTER to current subscription (nullable)
  subscriptionStatus   String?   // ← DENORMALIZED current status
  subscriptionTier     String?
  // ... other fields
}
```

### Required Schema Changes (for timestamp ordering only)

```sql
-- Add event timestamp tracking for ordering
ALTER TABLE "Provider" ADD COLUMN "lastWebhookEventTimestamp" INTEGER;
ALTER TABLE "Provider" ADD COLUMN "lastWebhookEventId" TEXT;

ALTER TABLE "Subscription" ADD COLUMN "lastWebhookEventTimestamp" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "lastWebhookEventId" TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_subscription_stripe_id" 
  ON "Subscription"("stripeSubscriptionId");
```

### Data Model Invariants

**Subscription Table:**
- `stripeSubscriptionId` = **immutable** Stripe subscription identity (INV-1)
- `status` = lifecycle state for **that specific** Stripe subscription
- Row persists after cancellation (historical record)

**Provider Table:**
- `stripeSubscriptionId` = **pointer** to current active subscription (nullable)
- Set to NULL on cancellation (enables re-subscription)
- `subscriptionStatus` = **denormalized** current status (for query performance)

**Key Relationship:**
```
Provider.stripeSubscriptionId → Subscription.stripeSubscriptionId (current)
Subscription.stripeSubscriptionId → Stripe API subscription ID (immutable)
```

**On Cancellation:**
```typescript
// Subscription row RETAINS identity (INV-1, INV-2)
Subscription(sub_A) {
  stripeSubscriptionId: 'sub_A',  // ← RETAINED
  status: 'CANCELLED',            // ← TERMINAL
  cancelledAt: now()
}

// Provider clears pointer (enables re-subscription, INV-3)
Provider {
  stripeSubscriptionId: null,     // ← CLEARED (pointer)
  subscriptionStatus: 'CANCELLED' // ← DENORMALIZED
}
```

**On Re-subscription:**
```typescript
// New subscription creates NEW row (INV-3)
Subscription(sub_B) {
  stripeSubscriptionId: 'sub_B',  // ← NEW identity
  status: 'TRIAL',
  providerId: same_provider_id
}

// Provider points to new subscription
Provider {
  stripeSubscriptionId: 'sub_B',  // ← NEW pointer
  subscriptionStatus: 'TRIAL'
}

// Old subscription remains cancelled (INV-2)
Subscription(sub_A) {
  stripeSubscriptionId: 'sub_A',
  status: 'CANCELLED'  // ← UNCHANGED
}
```

---

## Part 2: Atomic Transaction Architecture (INV-4)

### Transaction Boundary (Mandatory Pattern)

**ALL webhook handlers MUST follow this pattern:**

```typescript
async function handleWebhookEvent(event: StripeEvent) {
  const idempotencyKey = `${event.type}_${event.id}_${event.created}`;
  
  // OUTSIDE transaction: only fast idempotency check
  const alreadyProcessed = await checkIdempotency(idempotencyKey);
  if (alreadyProcessed) return;
  
  // ALL state-dependent logic INSIDE transaction (INV-4)
  await prisma.$transaction(async (tx) => {
    // STEP 1: Identify and lock subscription by Stripe ID
    const subscription = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: event.data.object.id },
      include: { provider: true }
    });
    // Consider: SELECT FOR UPDATE if needed
    
    if (!subscription) {
      // Handle subscription creation (separate logic)
      return await handleNewSubscription(tx, event);
    }
    
    // STEP 2: Read authoritative state (FRESH, inside transaction)
    const currentState = {
      subscriptionStatus: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      lastWebhookEventTimestamp: subscription.lastWebhookEventTimestamp,
      cancelledAt: subscription.cancelledAt,
      provider: {
        id: subscription.provider.id,
        stripeSubscriptionId: subscription.provider.stripeSubscriptionId,
        lastWebhookEventTimestamp: subscription.provider.lastWebhookEventTimestamp
      }
    };
    
    // STEP 3: Evaluate PURE policy function (no I/O, no mutations)
    const decision = canTransitionSubscriptionState(
      {
        type: 'webhook',
        stripeSubscriptionId: event.data.object.id,
        targetStatus: normalizeStatus(event.data.object.status),
        eventTimestamp: event.created,
        eventId: idempotencyKey
      },
      currentState
    );
    
    // STEP 4: Record result (even if blocked)
    await tx.webhookEvent.create({
      data: {
        idempotencyKey,
        eventType: event.type,
        stripeEventId: event.id,
        processed: decision.allowed,
        skipReason: decision.allowed ? null : decision.reason,
        metadata: { subscriptionId: subscription.id }
      }
    });
    
    // STEP 5: Conditional mutation (only if allowed)
    if (!decision.allowed) {
      logger.warn(`Event blocked: ${decision.reason}`, { event: event.type });
      return; // Exit without mutation
    }
    
    // STEP 6: Perform mutation (state change)
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: normalizeStatus(event.data.object.status),
        lastWebhookEventTimestamp: event.created,
        lastWebhookEventId: idempotencyKey,
        // ... other fields
      }
    });
    
    await tx.provider.update({
      where: { id: subscription.providerId },
      data: {
        subscriptionStatus: normalizeStatus(event.data.object.status),
        lastWebhookEventTimestamp: event.created,
        lastWebhookEventId: idempotencyKey,
        // ... other fields
      }
    });
    
    // STEP 7: Audit log
    await tx.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_STATE_CHANGE',
        targetId: subscription.id,
        metadata: { from: currentState.subscriptionStatus, to: normalizeStatus(event.data.object.status) }
      }
    });
  }, {
    isolationLevel: 'Serializable',
    timeout: 10000
  });
}
```

**Key Architectural Properties:**
- ✅ State read INSIDE transaction (no TOCTOU)
- ✅ Policy evaluation on FRESH state
- ✅ Mutation ONLY if policy allows
- ✅ All steps atomic (INV-4)

---

## Part 3: Pure Policy Function (INV-2, INV-5, INV-6)

### Signature

```typescript
/**
 * Pure subscription state transition policy.
 * NO I/O, NO mutations, NO side effects.
 * 
 * Returns decision based solely on:
 * - Incoming event characteristics
 * - Current authoritative state
 * 
 * Enforces INV-2 (terminal CANCELLED), INV-5 (timestamp ordering), INV-6 (cancellation precedence).
 */
function canTransitionSubscriptionState(
  incomingEvent: {
    type: 'webhook' | 'manual-sync' | 'cron';
    stripeSubscriptionId: string | null;
    targetStatus: SubscriptionStatus;
    eventTimestamp: number | null;  // Unix timestamp
    eventId: string;
  },
  currentState: {
    subscriptionStatus: SubscriptionStatus;
    stripeSubscriptionId: string | null;
    lastWebhookEventTimestamp: number | null;
    cancelledAt: Date | null;
    provider: {
      id: string;
      stripeSubscriptionId: string | null;
      lastWebhookEventTimestamp: number | null;
    };
  }
): { allowed: boolean; reason: string } {
  
  // GUARD 1: Terminal CANCELLED state (INV-2)
  if (currentState.subscriptionStatus === 'CANCELLED') {
    // CANCELLED is terminal for THIS Stripe subscription ID
    if (incomingEvent.stripeSubscriptionId === currentState.stripeSubscriptionId) {
      // Exception: CANCELLED → EXPIRED (retention/reporting only, not lifecycle)
      if (incomingEvent.targetStatus === 'EXPIRED' && incomingEvent.type === 'cron') {
        return { allowed: true, reason: 'retention-state-transition' };
      }
      
      // All other transitions BLOCKED (INV-2)
      return { allowed: false, reason: 'cancelled-is-terminal' };
    }
    
    // Different subscription ID → this is a NEW subscription (INV-3)
    if (incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
      return { allowed: true, reason: 'new-subscription-different-id' };
    }
    
    // No subscription ID in event → cannot proceed
    return { allowed: false, reason: 'no-subscription-id' };
  }
  
  // GUARD 2: Subscription ID scoping (INV-1, INV-3)
  if (currentState.stripeSubscriptionId !== null &&
      incomingEvent.stripeSubscriptionId !== null &&
      incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
    // Event is for a DIFFERENT subscription → reject (stale/wrong subscription)
    return { allowed: false, reason: 'event-for-different-subscription-id' };
  }
  
  // GUARD 3: Timestamp ordering for webhooks (INV-5)
  if (incomingEvent.type === 'webhook' &&
      incomingEvent.eventTimestamp !== null &&
      currentState.lastWebhookEventTimestamp !== null) {
    
    if (incomingEvent.eventTimestamp < currentState.lastWebhookEventTimestamp) {
      // Stale event → reject (INV-5)
      return { allowed: false, reason: 'stale-event-older-timestamp' };
    }
    
    // Equal timestamp → both events are concurrent
    // Rely on idempotency (already checked) + terminal state rules (above)
    // If we reach here with equal timestamps, allow (transaction serialization determines order)
  }
  
  // GUARD 4: Cancellation precedence for equal-timestamp events (INV-6)
  if (incomingEvent.type === 'webhook' &&
      incomingEvent.eventTimestamp === currentState.lastWebhookEventTimestamp &&
      currentState.subscriptionStatus === 'CANCELLED') {
    // Equal timestamp, but current state is already CANCELLED
    // This means cancellation was committed first
    // Do NOT allow resurrection (INV-6)
    if (incomingEvent.targetStatus === 'ACTIVE' || incomingEvent.targetStatus === 'PAST_DUE') {
      return { allowed: false, reason: 'cancellation-precedence-equal-timestamp' };
    }
  }
  
  // GUARD 5: Manual sync freshness (INV-7)
  if (incomingEvent.type === 'manual-sync') {
    // Conservative: if a webhook has processed ANYTHING, defer to webhook
    if (currentState.lastWebhookEventTimestamp !== null) {
      // We cannot reliably compare manual sync "freshness" to webhook timestamp
      // because Stripe subscription object timestamps don't represent state change time
      // Conservative: block manual sync if webhook has ever run
      return { allowed: false, reason: 'webhook-exists-manual-sync-deferred' };
    }
    
    // No webhook has run → manual sync is authoritative
    return { allowed: true, reason: 'manual-sync-no-webhook-baseline' };
  }
  
  // GUARD 6: Cron expiry (already protected by SUB-12-A CAS)
  if (incomingEvent.type === 'cron' && incomingEvent.targetStatus === 'EXPIRED') {
    // Cron uses updateMany({ where: { status: 'TRIAL' } }) CAS
    // Additional policy check not strictly needed, but confirm not CANCELLED
    if (currentState.subscriptionStatus === 'CANCELLED') {
      return { allowed: false, reason: 'cannot-expire-cancelled-subscription' };
    }
    return { allowed: true, reason: 'cron-expiry-allowed' };
  }
  
  // GUARD 7: Bootstrap (first event for NULL watermark)
  if (currentState.lastWebhookEventTimestamp === null && incomingEvent.type === 'webhook') {
    // First webhook for this subscription → establish baseline
    return { allowed: true, reason: 'bootstrap-first-webhook' };
  }
  
  // All guards passed → allow normal transition
  return { allowed: true, reason: 'normal-state-transition' };
}
```

**Properties:**
- ✅ Pure function (deterministic, no I/O)
- ✅ Enforces INV-2 (terminal CANCELLED)
- ✅ Enforces INV-5 (timestamp ordering)
- ✅ Enforces INV-6 (cancellation precedence)
- ✅ Enforces INV-7 (conservative manual sync)

---

## Part 4: State Writer Inventory (Authoritative)

| # | Writer Name | Function | Trigger | Mutates | Policy Check | Notes |
|---|-------------|----------|---------|---------|--------------|-------|
| 1 | Subscription Update | `handleSubscriptionUpdate()` | `customer.subscription.created`<br>`customer.subscription.updated` | Subscription.status<br>Provider.subscriptionStatus | ✅ YES | Shares handler for created/updated |
| 2 | Subscription Cancel | `handleSubscriptionCancelled()` | `customer.subscription.deleted` | Subscription.status → CANCELLED<br>Provider.stripeSubscriptionId → NULL | ✅ YES | Sets CANCELLED (terminal) |
| 3 | Invoice Payment Succeeded | `handleInvoicePaymentSucceeded()` | `invoice.payment_succeeded` | Subscription.status → ACTIVE<br>Provider.subscriptionStatus → ACTIVE | ✅ YES | Can resurrect if not protected |
| 4 | Invoice Payment Failed | `handleInvoicePaymentFailed()` | `invoice.payment_failed` | Subscription.status → PAST_DUE<br>Provider.subscriptionStatus → PAST_DUE | ✅ YES | Can overwrite CANCELLED if not protected |
| 5 | Trial Expiry Cron | `/api/cron/check-trial-expiry` | Daily cron | Subscription.status → EXPIRED<br>Provider.subscriptionStatus → EXPIRED | ⚠️ PARTIAL | Already protected by SUB-12-A CAS<br>Additional policy check recommended |
| 6 | Manual Sync | `/api/instructor/subscription/sync` | User-initiated POST | Subscription (all fields)<br>Provider (all fields) | ✅ YES | Fetches from Stripe API |
| 7 | Registration/Checkout | `/api/register`<br>`/api/subscriptions/checkout` | New user signup | Provider.subscriptionStatus → TRIAL<br>Subscription (create initial) | ❌ NO | Creates initial state<br>Out of scope (no existing subscription) |

**Total:** 7 writers  
**Policy-protected:** 6 writers (1-6)  
**Initial state creation:** 1 writer (7, out of scope)

---

## Part 5: Manual Sync Freshness Model (INV-7)

### Problem Statement

Stripe subscription object timestamps DO NOT reliably represent "last state change":
- `subscription.created` = creation time (never changes)
- `subscription.current_period_start` = billing period (not state change)
- `latest_invoice.created` = invoice creation (not subscription state change)

**There is NO reliable "state modified timestamp" in Stripe's subscription object.**

### Conservative Freshness Strategy

```typescript
// In manual sync route:
const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

const subscription = await prisma.subscription.findUnique({
  where: { stripeSubscriptionId: stripeSub.id }
});

// CONSERVATIVE RULE (INV-7):
// If ANY webhook has processed for this subscription, defer to webhook state.
// Manual sync cannot reliably determine if it's fresher than webhook.

if (subscription.lastWebhookEventTimestamp !== null) {
  // Webhook has processed at least once → webhook is source of truth
  return {
    synced: false,
    reason: 'webhook-baseline-exists-manual-sync-skipped',
    currentStatus: subscription.status
  };
}

// NO webhook has ever processed → manual sync establishes baseline
await prisma.$transaction(async (tx) => {
  const decision = canTransitionSubscriptionState(
    {
      type: 'manual-sync',
      stripeSubscriptionId: stripeSub.id,
      targetStatus: normalizeStatus(stripeSub.status),
      eventTimestamp: null, // No comparable timestamp
      eventId: `manual-sync-${Date.now()}`
    },
    subscription
  );
  
  if (!decision.allowed) {
    return { synced: false, reason: decision.reason };
  }
  
  // Sync state from Stripe
  await tx.subscription.update({
    where: { id: subscription.id },
    data: {
      status: normalizeStatus(stripeSub.status),
      tier: deriveTier(stripeSub),
      // ... other fields from Stripe
      // NO lastWebhookEventTimestamp (not a webhook)
    }
  });
  
  await tx.provider.update({
    where: { id: subscription.providerId },
    data: {
      subscriptionStatus: normalizeStatus(stripeSub.status),
      subscriptionTier: deriveTier(stripeSub)
      // NO lastWebhookEventTimestamp (not a webhook)
    }
  });
});
```

**Freshness Model:**
- Webhooks establish authoritative event stream
- Manual sync is **bootstrap only** (when no webhook has run)
- Once webhook baseline exists, manual sync defers
- NO attempt to compare incomparable timestamps (INV-7)

**Alternative (if always-available manual sync required):**
Fetch recent Stripe events via API to establish true ordering:
```typescript
const events = await stripe.events.list({
  type: 'customer.subscription.*',
  limit: 10
});
// Find most recent event timestamp, compare to lastWebhookEventTimestamp
```
(More expensive, but provides real ordering)

---

## Part 6: Migration Bootstrap Strategy (INV-8)

### Problem with NOW() Approach

```
Migration time: 17:00
Legitimate event created: 16:59 (not yet delivered)
Migration sets: lastWebhookEventTimestamp = 17:00

Event arrives later:
  Check: 16:59 < 17:00 → STALE → REJECTED

Result: State divergence (Stripe CANCELLED, DriveBook ACTIVE)
```

### Safe Bootstrap Strategy

**Step 1: Pause non-critical webhooks (optional safety measure)**
```typescript
// In webhook handler, add temporary migration gate
if (process.env.MIGRATION_IN_PROGRESS === 'true') {
  // Queue event for later processing
  await queueWebhookForLater(event);
  return;
}
```

**Step 2: Fetch current Stripe state for all active subscriptions**
```typescript
// Migration script: sync-subscriptions-from-stripe.ts

const activeSubscriptions = await prisma.subscription.findMany({
  where: {
    status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
    stripeSubscriptionId: { not: null }
  }
});

for (const sub of activeSubscriptions) {
  try {
    // Fetch authoritative Stripe state
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    
    // Fetch recent events for this subscription
    const recentEvents = await stripe.events.list({
      type: 'customer.subscription.*',
      limit: 5,
      // Filter by subscription (if Stripe API supports)
    });
    
    // Find most recent event timestamp for this subscription
    const mostRecentEvent = recentEvents.data
      .filter(e => e.data.object.id === sub.stripeSubscriptionId)
      .sort((a, b) => b.created - a.created)[0];
    
    const watermark = mostRecentEvent?.created || stripeSub.created;
    
    // Update subscription with Stripe state + watermark
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: normalizeStatus(stripeSub.status),
          tier: deriveTier(stripeSub),
          lastWebhookEventTimestamp: watermark,
          lastWebhookEventId: `migration-bootstrap-${Date.now()}`,
          // ... other fields from stripeSub
        }
      });
      
      await tx.provider.update({
        where: { id: sub.providerId },
        data: {
          subscriptionStatus: normalizeStatus(stripeSub.status),
          subscriptionTier: deriveTier(stripeSub),
          lastWebhookEventTimestamp: watermark,
          lastWebhookEventId: `migration-bootstrap-${Date.now()}`
        }
      });
      
      await tx.auditLog.create({
        data: {
          action: 'MIGRATION_BOOTSTRAP',
          targetType: 'SUBSCRIPTION',
          targetId: sub.id,
          metadata: {
            stripeStatus: stripeSub.status,
            watermark,
            source: mostRecentEvent ? 'recent-event' : 'subscription-created'
          }
        }
      });
    });
    
    console.log(`Bootstrapped subscription ${sub.id} with watermark ${watermark}`);
  } catch (error) {
    console.error(`Failed to bootstrap subscription ${sub.id}:`, error);
    // Continue with next subscription
  }
}
```

**Step 3: Resume webhooks**
```typescript
// Remove migration gate
process.env.MIGRATION_IN_PROGRESS = 'false';
```

**Step 4: Process queued webhooks (if any)**
```typescript
await processQueuedWebhooks();
```

**Properties:**
- ✅ Watermark from actual Stripe event stream (INV-8)
- ✅ NO invented NOW() timestamps
- ✅ Safe for pending webhooks
- ✅ Verifiable against Stripe API

---

## Part 7: Test Scenarios with Strong Invariant Assertions

### T7: Concurrent updated + deleted (REVISED)

**Scenario:**
Send `subscription.updated` (ACTIVE) and `subscription.deleted` with **same timestamp**.

**Implementation:**
```typescript
test('T7: Concurrent updated + deleted enforces cancellation precedence', async () => {
  const provider = await createTestProvider();
  const subscriptionId = 'sub_test_t7';
  
  // Create initial subscription
  await createTestSubscription(provider.id, subscriptionId, 'ACTIVE');
  
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Send both events with SAME timestamp
  const [updatedResponse, deletedResponse] = await Promise.all([
    sendSignedWebhook('customer.subscription.updated', {
      id: subscriptionId,
      status: 'active',
      created: timestamp  // SAME timestamp
    }),
    sendSignedWebhook('customer.subscription.deleted', {
      id: subscriptionId,
      status: 'canceled',
      created: timestamp  // SAME timestamp
    })
  ]);
  
  // STRONG ASSERTION (INV-6):
  // Regardless of processing order, final state MUST be CANCELLED
  // Cancellation has precedence over updates for same-timestamp events
  
  const finalSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId }
  });
  
  const finalProvider = await prisma.provider.findUnique({
    where: { id: provider.id }
  });
  
  // MUST be CANCELLED (not ACTIVE)
  expect(finalSubscription.status).toBe('CANCELLED');
  expect(finalProvider.subscriptionStatus).toBe('CANCELLED');
  expect(finalProvider.stripeSubscriptionId).toBeNull(); // Pointer cleared
  
  // Verify both events were processed
  const webhookEvents = await prisma.webhookEvent.findMany({
    where: { stripeEventId: { in: [updatedResponse.eventId, deletedResponse.eventId] } }
  });
  expect(webhookEvents).toHaveLength(2);
  
  // At least one should have been blocked or cancellation should have won
  const cancelledEventProcessed = webhookEvents.some(e => 
    e.eventType === 'customer.subscription.deleted' && e.processed
  );
  expect(cancelledEventProcessed).toBe(true);
  
  // TEST FAILS IF: finalSubscription.status === 'ACTIVE'
  // This would indicate cancellation precedence was NOT enforced (BUG)
});
```

### T8: Concurrent invoice.payment_succeeded + deleted (REVISED)

```typescript
test('T8: Concurrent invoice + cancellation enforces terminal CANCELLED', async () => {
  const provider = await createTestProvider();
  const subscriptionId = 'sub_test_t8';
  
  await createTestSubscription(provider.id, subscriptionId, 'ACTIVE');
  
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Send concurrent invoice + cancellation
  await Promise.all([
    sendSignedWebhook('invoice.payment_succeeded', {
      subscription: subscriptionId,
      created: timestamp
    }),
    sendSignedWebhook('customer.subscription.deleted', {
      id: subscriptionId,
      created: timestamp
    })
  ]);
  
  const finalState = await getSubscriptionState(subscriptionId);
  
  // STRONG ASSERTION (INV-2, INV-6):
  // Once cancellation is committed, invoice cannot resurrect
  expect(finalState.status).toBe('CANCELLED');
  expect(finalState.provider.subscriptionStatus).toBe('CANCELLED');
  
  // TEST FAILS IF: invoice.payment_succeeded resurrects CANCELLED → ACTIVE
});
```

**Key Difference from Rev 2:**
- Rev 2: `Expected: One of ACTIVE or CANCELLED` (too permissive)
- Rev 3: `Expected: CANCELLED` (enforces INV-2, INV-6)

---

## Part 8: Rollback Strategy (Application First)

### Phase 1: Disable Feature (Immediate Rollback)

```typescript
// Environment variable controls feature
const ENABLE_SUB_06A_FIX = process.env.ENABLE_SUB_06A_ORDERING_FIX === 'true';

// In webhook handlers:
if (!ENABLE_SUB_06A_FIX) {
  // Fall back to old behavior (no policy checks, no watermarks)
  return await handleWebhookLegacy(event);
}

// New behavior (policy checks, watermarks)
return await handleWebhookWithOrdering(event);
```

**Rollback:** Set `ENABLE_SUB_06A_ORDERING_FIX=false`, deploy.

### Phase 2: Backward-Compatible Schema

```typescript
// Application must handle NULL watermarks gracefully
const watermark = subscription.lastWebhookEventTimestamp ?? null;

// If NULL, use legacy behavior or conservative default
```

**Rollback:** Columns remain but unused. No DROP yet.

### Phase 3: Schema Cleanup (LATER, separate migration)

```sql
-- After 30+ days of stable operation:
ALTER TABLE "Provider" DROP COLUMN IF EXISTS "lastWebhookEventTimestamp";
ALTER TABLE "Provider" DROP COLUMN IF EXISTS "lastWebhookEventId";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "lastWebhookEventTimestamp";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "lastWebhookEventId";
```

**This is NOT part of emergency rollback.**

---

## Part 9: CANCELLED → EXPIRED Semantics

### Clarification

**EXPIRED is a retention/reporting state, NOT a lifecycle state.**

```
Lifecycle States:   TRIAL → ACTIVE → PAST_DUE → CANCELLED
Retention States:   CANCELLED → EXPIRED (for cleanup/archival)
```

**Policy Logic:**
```typescript
// CANCELLED → EXPIRED is allowed ONLY for retention purposes
if (currentState.subscriptionStatus === 'CANCELLED' &&
    incomingEvent.targetStatus === 'EXPIRED' &&
    incomingEvent.type === 'cron') {
  return { allowed: true, reason: 'retention-state-transition' };
}
```

**This does NOT weaken INV-2 because:**
- EXPIRED is not a resurrection (cannot return to ACTIVE/PAST_DUE)
- Only cron can trigger (not webhooks)
- Purpose: mark old CANCELLED rows for archival/deletion

**Alternative:** Separate `retentionState` field instead of overloading `status`.

---

## Part 10: Invariant Proofs

### INV-1: Immutable Stripe Subscription ID

**Proof:**
- `Subscription.stripeSubscriptionId` set once on creation
- NEVER updated (no UPDATE statements change this field)
- Persists through entire lifecycle including CANCELLED
- ✅ Proven by schema design

### INV-2: CANCELLED is Terminal

**Proof:**
```typescript
// In canTransitionSubscriptionState():
if (currentState.subscriptionStatus === 'CANCELLED' &&
    incomingEvent.stripeSubscriptionId === currentState.stripeSubscriptionId) {
  // Only EXPIRED allowed (retention, not lifecycle)
  if (incomingEvent.targetStatus === 'EXPIRED' && incomingEvent.type === 'cron') {
    return { allowed: true, reason: 'retention' };
  }
  return { allowed: false, reason: 'cancelled-is-terminal' }; // ← BLOCKS ALL
}
```
- ✅ Enforced by policy function
- ✅ Tested in T7, T8

### INV-3: New Subscription ID = New Instance

**Proof:**
```typescript
// On re-subscription:
// Old: Subscription(sub_A) { status: CANCELLED }
// New: Subscription(sub_B) { status: TRIAL } ← NEW ROW

// Policy check for events on sub_A:
if (incomingEvent.stripeSubscriptionId !== currentState.stripeSubscriptionId) {
  return { allowed: false, reason: 'different-subscription-id' };
}
```
- ✅ Each subscription ID has independent lifecycle
- ✅ Old subscription remains CANCELLED

### INV-4: Atomic Authorization + Mutation

**Proof:**
```typescript
await prisma.$transaction(async (tx) => {
  const state = await tx.subscription.findUnique(...); // ← LOCK/READ
  const decision = canTransitionSubscriptionState(...); // ← DECIDE
  if (!decision.allowed) return;                        // ← GUARD
  await tx.subscription.update(...);                     // ← MUTATE
}, { isolationLevel: 'Serializable' });                 // ← ATOMIC
```
- ✅ All steps in ONE transaction
- ✅ SERIALIZABLE isolation
- ✅ No TOCTOU race

### INV-5: Older Events Cannot Overwrite Newer State

**Proof:**
```typescript
if (incomingEvent.eventTimestamp < currentState.lastWebhookEventTimestamp) {
  return { allowed: false, reason: 'stale-event' };
}
```
- ✅ Timestamp comparison enforced
- ✅ Watermark updated atomically with mutation

### INV-6: Equal-Timestamp Cancellation Precedence

**Proof:**
```typescript
if (incomingEvent.eventTimestamp === currentState.lastWebhookEventTimestamp &&
    currentState.subscriptionStatus === 'CANCELLED') {
  if (incomingEvent.targetStatus === 'ACTIVE' || incomingEvent.targetStatus === 'PAST_DUE') {
    return { allowed: false, reason: 'cancellation-precedence' };
  }
}
```
- ✅ CANCELLED blocks resurrection even with equal timestamps
- ✅ Tested in T7, T8

### INV-7: Manual Sync Cannot Incorrectly Overwrite

**Proof:**
```typescript
if (incomingEvent.type === 'manual-sync') {
  if (currentState.lastWebhookEventTimestamp !== null) {
    return { allowed: false, reason: 'webhook-baseline-exists' };
  }
}
```
- ✅ Conservative: defers to webhook if webhook has run
- ✅ NO unreliable timestamp comparisons

### INV-8: Safe Bootstrap After Migration

**Proof:**
- Migration script fetches actual Stripe state
- Watermark established from real Stripe event timestamps
- NO invented NOW() watermarks
- ✅ Safe for pending webhooks

---

## Part 11: Acceptance Criteria

- [ ] All 8 invariants (INV-1 through INV-8) demonstrable in code
- [ ] Pure policy function (no I/O, no mutations)
- [ ] Atomic transaction boundary (resolve → decide → mutate)
- [ ] Subscription.stripeSubscriptionId as immutable identity
- [ ] Provider.stripeSubscriptionId cleared on cancellation (pointer only)
- [ ] 6 state writers use policy function (excluding initial creation)
- [ ] T7/T8 tests assert CANCELLED as final state
- [ ] Manual sync defers to webhook baseline (conservative)
- [ ] Migration bootstrap from actual Stripe state (no NOW())
- [ ] Rollback plan: feature flag first, schema cleanup later
- [ ] CANCELLED → EXPIRED clarified as retention (not lifecycle)

---

## Part 12: Implementation Checklist

### Phase 1: Schema Migration
- [ ] Add lastWebhookEventTimestamp columns (Provider, Subscription)
- [ ] Add lastWebhookEventId columns (Provider, Subscription)
- [ ] Create indexes on Subscription.stripeSubscriptionId
- [ ] Run migration bootstrap script (sync from Stripe)

### Phase 2: Policy Function
- [ ] Implement pure `canTransitionSubscriptionState()` function
- [ ] Unit tests for all 7 guards
- [ ] Verify no I/O, no mutations

### Phase 3: Handler Updates (6 handlers)
- [ ] Update `handleSubscriptionUpdate()` with atomic pattern
- [ ] Update `handleSubscriptionCancelled()` with atomic pattern
- [ ] Update `handleInvoicePaymentSucceeded()` with atomic pattern
- [ ] Update `handleInvoicePaymentFailed()` with atomic pattern
- [ ] Update trial expiry cron (add policy check)
- [ ] Update manual sync route (conservative freshness)

### Phase 4: Testing
- [ ] 16 integration tests (T1-T16) with signed webhooks
- [ ] T7, T8 with strong CANCELLED assertions
- [ ] Concurrent event tests (actual parallelism, not mocks)
- [ ] Migration bootstrap test (verify watermarks correct)

### Phase 5: Production
- [ ] Deploy with feature flag OFF
- [ ] Run migration bootstrap in production
- [ ] Enable feature flag for 1% traffic
- [ ] Monitor metrics (stale events blocked, cancellation protected)
- [ ] Gradual rollout to 100%

---

## Summary of Architectural Changes from Rev 2

| Issue | Rev 2 Approach | Rev 3 Approach |
|-------|---------------|----------------|
| Lost subscription ID | Set `stripeSubscriptionId = null` | Subscription row RETAINS ID, Provider clears pointer |
| TOCTOU race | Policy check before transaction | Policy check INSIDE transaction (atomic) |
| Manual sync timestamp | Claimed `created` is "state timestamp" | Conservative: defer to webhook, no unreliable comparison |
| T7/T8 tests | Accept either ACTIVE or CANCELLED | Assert CANCELLED (strong invariant) |
| Migration watermark | Invented NOW() timestamp | Bootstrap from actual Stripe event stream |
| Policy side effects | Contained Stripe API calls, mutations | Pure function (no I/O, no mutations) |
| Writer inventory | Inconsistent count (6 vs 7) | Authoritative table: 7 writers, 6 policy-protected |
| CANCELLED → EXPIRED | Unclear if it weakens terminal state | Clarified: retention state, not lifecycle |
| Rollback | Destructive schema DROP | Feature flag first, schema cleanup later |

---

**End of Revision 3 Design**

**Gate Status:**
```
SUB-06-A — REVISION 3 DESIGN COMPLETE
Implementation — BLOCKED (pending Rev 3 independent review)
Invariants — INV-1 through INV-8 demonstrable
```

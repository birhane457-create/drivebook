# SUB-06-A Revision 3 - Independent Review Findings

**Review Date:** 2026-09-26  
**Reviewed Commit:** `4422111f`  
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
├─ Rev 2                             ❌ REJECTED (9 issues)
├─ Rev 3 architecture                ⚠️ SUBSTANTIALLY IMPROVED
├─ Independent review                ❌ CHANGES REQUIRED (10 issues)
├─ Implementation                    ❌ BLOCKED
├─ Tests                             ❌ NOT STARTED
└─ Production verification           ❌ NOT STARTED
```

**Implementation of Revision 3 is BLOCKED.**

---

## What Revision 3 Got Right

✅ **Subscription.stripeSubscriptionId** remains attached to historical row  
✅ **Provider.stripeSubscriptionId** treated as current pointer  
✅ **CANCELLED scoped** to individual subscription  
✅ **Pure policy function** (decision logic only)  
✅ **Manual sync** no longer invents "last modified" timestamp  
✅ **T7/T8** now require CANCELLED final state  
✅ **NOW()** removed as migration watermark  
✅ **CANCELLED → EXPIRED** clarified as retention, not resurrection  
✅ **State writer inventory** reconciled (7 writers, 6 policy-protected)  

**Architectural improvements are substantial and correct conceptually.**

---

## Issues Identified (10 Total: 3 CRITICAL, 5 HIGH, 2 MEDIUM)

### CRITICAL Issues (Must Fix Before Implementation)

#### 1. CRITICAL: findUnique() Does Not Establish Row Lock

**Issue:**
Design claims "identify → lock → read → decide → mutate" but shows:

```typescript
const subscription = await tx.subscription.findUnique({
  where: { stripeSubscriptionId: event.data.object.id },
  include: { provider: true }
});
```

With comment: `"Consider: SELECT FOR UPDATE if needed"`

**Problem:**
- `findUnique()` is a READ, not a LOCK
- "Consider" cannot remain optional for concurrency vulnerability fix
- SERIALIZABLE isolation alone is insufficient without explicit lock or CAS
- Need to specify EXACT concurrency mechanism

**Concurrent Race:**
```
Transaction A: findUnique() → reads ACTIVE
Transaction B: findUnique() → reads ACTIVE
Transaction A: policy check → allow
Transaction B: policy check → allow
Transaction A: UPDATE → CANCELLED
Transaction B: UPDATE → ACTIVE (overwrites CANCELLED)
```

**Required Fix:**
Mandatory concurrency mechanism. Options:

**Option A: Pessimistic Locking**
```typescript
const subscription = await tx.$queryRaw`
  SELECT * FROM "Subscription"
  WHERE "stripeSubscriptionId" = ${stripeSubscriptionId}
  FOR UPDATE
`;
```

**Option B: Optimistic CAS with Retry**
```typescript
await tx.subscription.updateMany({
  where: {
    stripeSubscriptionId: event.data.object.id,
    lastWebhookEventTimestamp: currentTimestamp  // CAS condition
  },
  data: { status: newStatus, lastWebhookEventTimestamp: newTimestamp }
});

if (updateResult.count === 0) {
  // Lost race, retry transaction
  throw new SerializationFailure();
}
```

**Option C: SERIALIZABLE with Explicit Retry**
```typescript
await withSerializableRetry(async () => {
  await prisma.$transaction(async (tx) => {
    // ... logic
  }, { isolationLevel: 'Serializable' });
}, {
  maxRetries: 3,
  onSerializationFailure: (err) => logger.warn('Serialization conflict, retrying')
});
```

Must specify WHICH mechanism and HOW retry/failure is handled.

---

#### 2. CRITICAL: Idempotency Check Outside Transaction

**Issue:**
```typescript
// OUTSIDE transaction:
const alreadyProcessed = await checkIdempotency(idempotencyKey);
if (alreadyProcessed) return;

// INSIDE transaction:
await prisma.$transaction(async (tx) => {
  await tx.webhookEvent.create({ ... });
});
```

**Concurrent Race:**
```
Request A: checkIdempotency() → not found
Request B: checkIdempotency() → not found
Request A: BEGIN; create webhookEvent; ...
Request B: BEGIN; create webhookEvent; ← P2002 unique violation
```

**Problem:**
- Pre-check provides NO concurrency protection
- Duplicate concurrent requests both pass check
- One transaction will fail on unique constraint
- Existing code has SUB-22 P2002 handling, but design doesn't integrate it

**Required Fix:**
Idempotency record creation INSIDE transaction as authoritative guard:

```typescript
await prisma.$transaction(async (tx) => {
  // Attempt to create idempotency record (unique constraint)
  try {
    await tx.webhookEvent.create({
      data: {
        idempotencyKey,  // ← unique constraint
        eventType: event.type,
        stripeEventId: event.id,
        processed: false  // Mark in-progress
      }
    });
  } catch (err) {
    if (err.code === 'P2002') {
      // Lost race, another transaction is processing
      logger.info('Duplicate event, idempotency protected');
      return; // Exit gracefully
    }
    throw err;
  }
  
  // Proceed with state mutation
  const decision = canTransitionSubscriptionState(...);
  // ...
  
  // Mark completed
  await tx.webhookEvent.update({
    where: { idempotencyKey },
    data: { processed: true, skipReason: decision.allowed ? null : decision.reason }
  });
}, { isolationLevel: 'Serializable' });
```

**Schema Requirement:**
```sql
CREATE UNIQUE INDEX "idx_webhook_event_idempotency" 
  ON "WebhookEvent"("idempotencyKey");
```

---

#### 3. CRITICAL: T7/T8 Do Not Prove Transaction Order Invariant

**Issue:**
Tests send concurrent requests and assert final state = CANCELLED.

```typescript
await Promise.all([
  sendSignedWebhook('subscription.updated', ...),
  sendSignedWebhook('subscription.deleted', ...)
]);

expect(finalState).toBe('CANCELLED');
```

**Problem:**
- Test proves THIS execution ended CANCELLED
- Does NOT prove "cancellation precedence regardless of order"
- Random concurrency insufficient for deterministic coverage

**Need to Test BOTH Orders:**
```
Case A: updated commits first → deleted commits → CANCELLED ✅
Case B: deleted commits first → updated blocked → CANCELLED ✅
```

**Second case is CRITICAL** - it exercises terminal state guard.

**Required Fix:**
Deterministic transaction order testing:

```typescript
test('T7-A: Updated commits first, then deleted overwrites', async () => {
  // Force serialization: updated completes before deleted starts
  await sendSignedWebhook('subscription.updated', { status: 'active', timestamp: T1 });
  await waitForWebhookProcessed();
  
  await sendSignedWebhook('subscription.deleted', { timestamp: T2 });
  await waitForWebhookProcessed();
  
  const final = await getSubscriptionState();
  expect(final.status).toBe('CANCELLED'); // ✅ Deleted overwrites
});

test('T7-B: Deleted commits first, updated blocked by terminal state', async () => {
  // Force serialization: deleted completes before updated starts
  await sendSignedWebhook('subscription.deleted', { timestamp: T2 });
  await waitForWebhookProcessed();
  
  await sendSignedWebhook('subscription.updated', { status: 'active', timestamp: T1 });
  await waitForWebhookProcessed();
  
  const final = await getSubscriptionState();
  expect(final.status).toBe('CANCELLED'); // ✅ Terminal state protected
  
  // Verify stale event was blocked
  const webhookEvents = await prisma.webhookEvent.findMany({
    where: { eventType: 'subscription.updated' }
  });
  expect(webhookEvents[0].processed).toBe(true);
  expect(webhookEvents[0].skipReason).toBe('stale-event-older-timestamp');
});

test('T7-C: True concurrent (same millisecond)', async () => {
  // Race condition: both start simultaneously
  const results = await Promise.all([
    sendSignedWebhook('subscription.updated', { timestamp: T }),
    sendSignedWebhook('subscription.deleted', { timestamp: T })
  ]);
  
  const final = await getSubscriptionState();
  expect(final.status).toBe('CANCELLED'); // ✅ Cancellation precedence
  
  // At least one should have been blocked or serialized
  const events = await getWebhookEvents();
  const deletedProcessed = events.some(e => e.eventType === 'subscription.deleted' && e.processed);
  expect(deletedProcessed).toBe(true);
});
```

---

### HIGH Priority Issues

#### 4. HIGH: Migration Bootstrap Event History Incomplete

**Issue:**
```typescript
const recentEvents = await stripe.events.list({
  type: 'customer.subscription.*',  // ← Wildcard needs verification
  limit: 5  // ← Insufficient
});
```

**Problems:**

**A. Wildcard Filter:**
- Assumes `customer.subscription.*` is supported by Stripe API
- Must verify Stripe actually supports this filter

**B. Limit 5 Insufficient:**
- Subscription may have > 5 recent events
- Relevant event might not be in top 5
- Watermark could be wrong event → incorrect baseline

**Scenario:**
```
Subscription has 10 recent events
Migration fetches limit: 5
Most recent subscription.updated is event #7
Watermark = event #3 (wrong)
Later webhook with timestamp between #3 and #7 → incorrectly classified as stale
```

**Required Fix:**
Fetch COMPLETE event history for subscription:

```typescript
// Fetch ALL events for this subscription (paginated)
const allEvents = [];
let hasMore = true;
let startingAfter = undefined;

while (hasMore) {
  const batch = await stripe.events.list({
    limit: 100,
    starting_after: startingAfter,
    // Filter by specific subscription if API supports
  });
  
  // Filter events for THIS subscription
  const relevantEvents = batch.data.filter(e => 
    e.type.startsWith('customer.subscription.') &&
    e.data.object.id === subscriptionId
  );
  
  allEvents.push(...relevantEvents);
  
  hasMore = batch.has_more;
  if (hasMore) {
    startingAfter = batch.data[batch.data.length - 1].id;
  }
}

// Find most recent event for THIS subscription
const mostRecentEvent = allEvents
  .sort((a, b) => b.created - a.created)[0];

const watermark = mostRecentEvent?.created || stripeSub.created;
```

**Alternative (if event history unavailable):**
Use conservative watermark + reconciliation:
```typescript
// Set watermark to Stripe subscription creation time
const watermark = stripeSub.created;

// Mark for reconciliation check on next webhook
await tx.subscription.update({
  data: {
    lastWebhookEventTimestamp: watermark,
    reconciliationRequired: true  // Flag for validation
  }
});
```

---

#### 5. HIGH: Migration/Webhook Concurrency Not Solved

**Issue:**
Design proposes "pause webhooks" with:
```typescript
if (process.env.MIGRATION_IN_PROGRESS === 'true') {
  await queueWebhookForLater(event);
  return;
}
```

**Problems:**
- NO actual queue mechanism exists
- "Optional safety measure" insufficient for production
- Migration can overwrite concurrent webhook updates

**Race:**
```
T1: Migration reads Stripe state (ACTIVE)
T2: Webhook arrives (CANCELLED)
T3: Webhook commits (CANCELLED)
T4: Migration writes snapshot (ACTIVE) ← Overwrites CANCELLED
```

**Required Fix:**
Migration MUST use same authoritative transaction/policy:

```typescript
// In migration script:
for (const sub of existingSubscriptions) {
  await prisma.$transaction(async (tx) => {
    // Use SAME locking mechanism as webhooks
    const current = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: sub.stripeSubscriptionId }
      // Add FOR UPDATE if using pessimistic locking
    });
    
    // Fetch Stripe state
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    
    // Use SAME policy function
    const decision = canTransitionSubscriptionState(
      {
        type: 'migration-bootstrap',
        stripeSubscriptionId: stripeSub.id,
        targetStatus: normalizeStatus(stripeSub.status),
        eventTimestamp: bootstrapTimestamp,
        eventId: `migration-${Date.now()}`
      },
      current
    );
    
    if (!decision.allowed) {
      logger.warn(`Migration blocked by policy: ${decision.reason}`);
      return;
    }
    
    // Mutation with CAS or under lock
    await tx.subscription.update({
      where: { id: sub.id },
      data: { /* ... */ }
    });
  }, { isolationLevel: 'Serializable' });
}
```

**OR: Formal Maintenance Window**
```
1. Stop webhook processing (drain queue)
2. Run migration
3. Resume webhooks
4. Process queued events
```

Document WHICH approach and implement actual queue if needed.

---

#### 6. HIGH: Manual Sync Blocks After Any Webhook

**Issue:**
```typescript
if (subscription.lastWebhookEventTimestamp !== null) {
  return { synced: false, reason: 'webhook-baseline-exists' };
}
```

**Problem:**
- Current product: manual sync fetches Stripe after Billing Portal
- New design: manual sync blocked if ANY webhook ever processed
- **Material product behavior change**
- Billing Portal changes may never sync if webhook delayed

**Scenario:**
```
User subscribes → webhook processes → lastWebhookEventTimestamp = T1
User upgrades via Billing Portal → Stripe state = PRO
User returns to app → manual sync triggered
Manual sync: lastWebhookEventTimestamp exists → BLOCKED
Webhook delayed 30 seconds
User sees: OLD tier for 30 seconds
```

**Current Behavior:**
Manual sync immediately fetches and applies Stripe state (safety net).

**Required Fix:**
Define convergence mechanism. Options:

**Option A: Event-Based Reconciliation**
```typescript
// Manual sync fetches recent Stripe events
const recentEvents = await stripe.events.list({
  limit: 10,
  types: ['customer.subscription.updated']
});

const mostRecentEventTimestamp = recentEvents.data[0]?.created;

if (mostRecentEventTimestamp > subscription.lastWebhookEventTimestamp) {
  // Stripe has newer state than our webhook baseline
  // Safe to sync from Stripe
  await syncFromStripe(tx, stripeSub, mostRecentEventTimestamp);
}
```

**Option B: Read-Only Verification + Trigger**
```typescript
// Manual sync becomes verification only
const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

if (normalizeStatus(stripeSub.status) !== subscription.status) {
  // Divergence detected → trigger webhook reconciliation
  logger.warn('Manual sync detected divergence, triggering reconciliation');
  await triggerWebhookReconciliation(subscriptionId);
}

return { synced: false, reason: 'webhook-authoritative-reconciliation-triggered' };
```

**Option C: Time-Based Freshness Window**
```typescript
const FRESHNESS_WINDOW = 60; // seconds

if (Date.now() - subscription.lastWebhookEventTimestamp * 1000 > FRESHNESS_WINDOW * 1000) {
  // Webhook baseline is stale (> 60s old), allow manual sync
  await syncFromStripe(tx, stripeSub);
}
```

Must define and document WHICH mechanism ensures eventual convergence.

---

#### 7. HIGH: Subscription Identity Uniqueness Not Enforced

**Issue:**
Schema shown:
```prisma
stripeSubscriptionId String?
```

Design proposes:
```sql
CREATE INDEX IF NOT EXISTS "idx_subscription_stripe_id" 
  ON "Subscription"("stripeSubscriptionId");
```

**Problem:**
- Index ≠ Unique Constraint
- Design relies on `findUnique({ where: { stripeSubscriptionId } })`
- But schema allows duplicate `stripeSubscriptionId` values
- If duplicates exist, `findUnique()` behavior undefined

**Invariant Violation:**
```
Subscription #1: stripeSubscriptionId = 'sub_A', status = CANCELLED
Subscription #2: stripeSubscriptionId = 'sub_A', status = ACTIVE

findUnique({ where: { stripeSubscriptionId: 'sub_A' } })
  → Returns which row? Undefined behavior.
```

**Required Fix:**
Enforce uniqueness at database level:

```sql
-- Option A: Simple unique constraint (if nullable uniqueness acceptable)
CREATE UNIQUE INDEX "idx_subscription_stripe_id_unique" 
  ON "Subscription"("stripeSubscriptionId")
  WHERE "stripeSubscriptionId" IS NOT NULL;

-- Option B: NOT NULL + unique (stronger)
ALTER TABLE "Subscription" 
  ALTER COLUMN "stripeSubscriptionId" SET NOT NULL;

CREATE UNIQUE INDEX "idx_subscription_stripe_id_unique" 
  ON "Subscription"("stripeSubscriptionId");
```

**Prisma Schema:**
```prisma
model Subscription {
  stripeSubscriptionId String?  @unique
  // OR
  stripeSubscriptionId String   @unique
}
```

---

#### 8. HIGH: Provider Denormalization Consistency

**Issue:**
Design updates:
```typescript
Subscription.status = 'ACTIVE'
Provider.subscriptionStatus = 'ACTIVE'
Provider.stripeSubscriptionId = 'sub_B'
```

On re-subscription:
```
Old: Subscription(sub_A) { status: 'CANCELLED' }
New: Subscription(sub_B) { status: 'TRIAL' }
```

**Problem:**
- Provider points to ONE "current" subscription
- But multiple non-CANCELLED Subscription rows could exist
- No explicit invariant: Provider → ONE current Subscription

**Concurrent Creation Race:**
```
Transaction A: Creates Subscription(sub_B) → TRIAL
Transaction B: Creates Subscription(sub_C) → TRIAL
Both: Update Provider.stripeSubscriptionId

Result: Which subscription is current? Last writer wins (incorrect).
```

**Required Fix:**
Enforce invariant explicitly:

```typescript
// Before creating/updating to new subscription:
await tx.subscription.updateMany({
  where: {
    providerId,
    status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
    stripeSubscriptionId: { not: newSubscriptionId }
  },
  data: { status: 'SUPERSEDED' }  // Mark old subscriptions as superseded
});

// Then create/update new subscription
await tx.subscription.create({
  data: {
    providerId,
    stripeSubscriptionId: newSubscriptionId,
    status: 'TRIAL'
  }
});

// Update Provider pointer
await tx.provider.update({
  where: { id: providerId },
  data: {
    stripeSubscriptionId: newSubscriptionId,
    subscriptionStatus: 'TRIAL'
  }
});
```

**Invariant Check (assertion):**
```typescript
// After transaction:
const activeSubscriptions = await prisma.subscription.count({
  where: {
    providerId,
    status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] }
  }
});

if (activeSubscriptions > 1) {
  logger.error(`Provider ${providerId} has ${activeSubscriptions} active subscriptions!`);
  // Alert/rollback
}
```

---

### MEDIUM Priority Issues

#### 9. MEDIUM: Integration with Existing SUB-22 Logic

**Issue:**
Current `handleSubscriptionUpdate()` contains:
- Metadata/tier resolution
- Instructor existence lookup
- SUB-22 `updateMany()` trial-row claiming
- P2002/23505 race handling
- Post-transaction email

Rev 3 simplified pseudocode doesn't show integration.

**Problem:**
- Existing SUB-22 protections must be preserved
- New policy checks must integrate, not replace
- Risk: implementation breaks existing concurrency protections

**Required:**
Explicit integration plan:

```typescript
async function handleSubscriptionUpdate(subscription, idempotencyKey, eventCreated) {
  // EXISTING: Metadata validation (preserve)
  const { providerId, tier } = validateMetadata(subscription);
  
  // EXISTING: Instructor existence check (preserve)
  const instructorExists = await checkInstructorExists(providerId);
  if (!instructorExists) return;
  
  // NEW: Atomic transaction with policy
  await prisma.$transaction(async (tx) => {
    // NEW: Idempotency (moved inside transaction)
    await createIdempotencyRecord(tx, idempotencyKey);
    
    // EXISTING: Trial row claiming logic (preserve)
    const existingSubscription = await tx.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });
    
    if (!existingSubscription) {
      // EXISTING: SUB-22 CAS trial claiming (preserve)
      const updateResult = await tx.subscription.updateMany({
        where: {
          providerId,
          stripeSubscriptionId: null,
          status: { in: ['TRIAL', 'ACTIVE'] }
        },
        data: { stripeSubscriptionId: subscription.id, /* ... */ }
      });
      
      if (updateResult.count === 0) {
        // Create new subscription
      }
    }
    
    // NEW: Policy check on FRESH state
    const currentState = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id }
    });
    
    const decision = canTransitionSubscriptionState(event, currentState);
    if (!decision.allowed) {
      await recordSkipped(tx, decision.reason);
      return;
    }
    
    // EXISTING + NEW: Mutation
    await tx.subscription.update({ /* ... */ });
    await tx.provider.update({ /* ... */ });
    
    // EXISTING: Audit log (preserve)
    await tx.auditLog.create({ /* ... */ });
  }, { isolationLevel: 'Serializable' });
  
  // EXISTING: Post-transaction email (preserve)
  await sendEmailNotification(...);
}
```

Document EXACT integration points.

---

#### 10. MEDIUM: CANCELLED → EXPIRED as Separate Retention State

**Issue:**
Design uses same `status` field:
```typescript
status: 'CANCELLED'  → status: 'EXPIRED'
```

**Problem:**
- EXPIRED is retention/archival, NOT lifecycle
- Overloading `status` field mixes concerns
- Risk: treating EXPIRED as lifecycle transition

**Cleaner Design:**
```prisma
model Subscription {
  status: String  // Lifecycle: TRIAL, ACTIVE, PAST_DUE, CANCELLED
  retentionState: String?  // Archival: EXPIRED, ARCHIVED, DELETED
}
```

**Policy:**
```typescript
// Lifecycle transitions (strict)
TRIAL → ACTIVE → PAST_DUE → CANCELLED (terminal)

// Retention transitions (separate concern)
CANCELLED → retentionState = 'EXPIRED'
EXPIRED → retentionState = 'ARCHIVED'
```

**Not blocking**, but recommended for cleaner invariants.

---

## Summary of Required Changes for Revision 4

### BLOCKING (Must Fix)

1. **Mandatory row lock/CAS mechanism** (specify SELECT FOR UPDATE or optimistic CAS)
2. **Atomic idempotency** (unique constraint inside transaction)
3. **Deterministic T7/T8** (test BOTH transaction orders explicitly)
4. **Complete migration event history** (fetch ALL relevant events, not limit 5)
5. **Migration/webhook concurrency control** (use same transaction/policy or maintenance window)
6. **Unique subscription identity** (database-enforced constraint)

### STRONGLY REQUIRED

7. **Manual sync convergence** (define mechanism for Billing Portal changes)
8. **Provider/current-subscription consistency** (enforce ONE current subscription invariant)
9. **SUB-22 integration** (explicit preservation of existing protections)

### RECOMMENDED

10. **Separate retention state** (don't overload `status` for EXPIRED)

---

## Conclusion

**Revision 3 architecture is sound conceptually.**

The blocking work is now about **database-enforced concurrency invariants**, not policy concepts.

Next revision (Rev 4) must specify:
- WHICH locking mechanism (SELECT FOR UPDATE vs CAS vs SERIALIZABLE retry)
- HOW idempotency is enforced atomically
- HOW transaction order is tested deterministically
- HOW migration establishes reliable watermarks
- HOW migration/webhook conflicts are prevented
- HOW manual sync ensures eventual convergence
- HOW existing SUB-22 protections are preserved

**Do not begin implementation until these mechanisms are specified and reviewed.**

---

## Audit Trail

- **Rev 1:** Timestamp guard only → REJECTED
- **Rev 2:** Centralized policy → REJECTED (9 issues: TOCTOU, lost ID)
- **Rev 3:** Architectural fixes → **CHANGES REQUIRED (10 issues: concurrency mechanics)**
- **Rev 4:** *(pending)* Database-enforced invariants
- **Implementation:** BLOCKED

---

**End of Rev 3 Review Findings**

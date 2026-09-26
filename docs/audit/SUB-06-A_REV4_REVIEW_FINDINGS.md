# SUB-06-A Revision 4 - Independent Review Findings

**Review Date:** 2026-09-26  
**Reviewed Commit:** `5be563b4`  
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
├─ Rev 3                             ❌ CHANGES REQUIRED (10 issues)
├─ Rev 4                             ⚠️ SUBSTANTIALLY IMPROVED
├─ Independent review                ❌ CHANGES REQUIRED (10 issues)
├─ Implementation                    ❌ BLOCKED
└─ Production verification           ❌ NOT STARTED
```

**Implementation of Revision 4 is BLOCKED.**

---

## What Revision 4 Got Right

✅ **Mandatory SELECT FOR UPDATE specified**  
✅ **Serialization retry with exact error codes**  
✅ **Atomic idempotency concept**  
✅ **Policy inside transaction**  
✅ **Pure policy function**  
✅ **Stripe ID uniqueness (database level)**  
✅ **SUB-22 integration shown**  
✅ **Separate retention state**  
✅ **Deterministic test orders (A/B/C)**  
✅ **Complete event history (no limit: 5)**  

**Revision 4 fixes most Rev 3 architectural weaknesses.**

---

## Issues Identified (10 Total: 4 CRITICAL, 4 HIGH, 2 MEDIUM)

### CRITICAL Issues (Must Fix)

#### 1. CRITICAL: Creation Path Lock Order Undefined

**Issue:**
Existing subscription:
```typescript
SELECT * FROM "Subscription"
WHERE "stripeSubscriptionId" = ${id}
FOR UPDATE
```

Non-existent subscription (creation):
```typescript
SELECT * FROM "Provider"
WHERE "id" = ${providerId}
FOR UPDATE
```

**Problem:**
- Lock acquisition order differs by path
- Potential deadlock: Path A acquires Subscription→Provider, Path B acquires Provider→Subscription
- No proof that concurrent creation paths lock same Provider deterministically

**Concurrent Creation Race:**
```
Event A (sub_new): Lock Provider P → Create Subscription S
Event B (sub_new): Lock Provider P → Create Subscription S (duplicate)
```

**Required Fix:**
Define ONE universal lock order for ALL writers:

**Option A: Always Provider first**
```typescript
// EVERY writer starts here:
const provider = await lockProviderForUpdate(tx, providerId);

// Then conditionally lock subscription if exists
const subscription = await lockSubscriptionForUpdate(tx, stripeSubscriptionId);

// Guaranteed order: Provider → Subscription (no deadlock)
```

**Option B: Lock matrix**
```
Creation:     Provider
Update:       Subscription → Provider (nested)
Cancellation: Subscription → Provider (nested)
```

Must prove no circular dependencies.

---

#### 2. CRITICAL: Idempotency State Transitions Imprecise

**Issue:**
```typescript
try {
  await tx.webhookEvent.create({ idempotencyKey, processed: false });
  return { claimed: true };
} catch (P2002) {
  const existing = await tx.webhookEvent.findUnique({ idempotencyKey });
  
  if (existing?.processed) {
    return { claimed: false, reason: 'already-processed' };
  }
  
  return { claimed: false, reason: 'concurrent-in-progress' };
}
```

**Problems:**

**A. Visibility within transaction:**
- P2002 occurs because another transaction already committed the INSERT
- But `findUnique()` within this transaction sees committed data
- `processed = false` should NOT normally persist (transaction rolls back with INSERT)

**B. Legacy incomplete records:**
- If a transaction crashes, `processed = false` persists
- Design treats this as "concurrent in-progress" (incorrect)

**C. State model unclear:**
```
ABSENT → INSERT (claimed) → processed=true (committed)

vs

ABSENT → INSERT (claimed) → CRASH → processed=false (orphaned)
```

**Required Fix:**
Explicit state lifecycle:

```typescript
// State model:
// ABSENT: no row
// CLAIMED: row exists, processed=false (transaction in-progress)
// COMPLETED: row exists, processed=true (committed)
// ORPHANED: row exists, processed=false, createdAt old (crashed transaction)

async function claimIdempotency(...) {
  try {
    await tx.webhookEvent.create({
      idempotencyKey,
      processed: false,
      claimedAt: new Date()
    });
    return { claimed: true };
  } catch (P2002) {
    // Another transaction already claimed
    const existing = await prisma.webhookEvent.findUnique({ 
      where: { idempotencyKey } 
    });
    
    if (!existing) {
      // Should not happen (P2002 implies row exists)
      throw new Error('Idempotency constraint violated but row not found');
    }
    
    if (existing.processed) {
      // Completed successfully
      return { claimed: false, reason: 'already-completed' };
    }
    
    // Check if orphaned (transaction crashed)
    const ageMs = Date.now() - existing.claimedAt.getTime();
    const ORPHAN_THRESHOLD_MS = 60000; // 60 seconds
    
    if (ageMs > ORPHAN_THRESHOLD_MS) {
      // Orphaned record → take over
      logger.warn(`Orphaned idempotency record detected: ${idempotencyKey}, age ${ageMs}ms`);
      
      // Update to claim it
      await tx.webhookEvent.update({
        where: { idempotencyKey },
        data: { claimedAt: new Date(), processed: false }
      });
      
      return { claimed: true, reason: 'orphan-recovery' };
    }
    
    // Recent concurrent request still in-progress
    return { claimed: false, reason: 'concurrent-in-progress' };
  }
}
```

---

#### 3. CRITICAL: 60-Second Manual Sync Rule ≠ Freshness Proof

**Issue:**
```typescript
const webhookAge = now - subscription.lastWebhookEventTimestamp;

if (webhookAge < 60) {
  // Webhook fresh → defer
}

if (webhookAge >= 60) {
  // Webhook stale → allow manual sync
}
```

**Problem: Age ≠ Freshness**

**Scenario 1 (Safe):**
```
12:00:00  Stripe changes → webhook A
12:00:01  Webhook A delivery fails
12:01:01  Manual sync fetches Stripe (matches change)
12:01:02  Manual sync writes (webhookAge = 61s, stale)
          ✅ Safe (no webhook to conflict)
```

**Scenario 2 (Unsafe):**
```
12:00:00  Webhook A processes (T=1000)
12:00:10  Stripe changes again
12:00:11  Webhook B delayed
12:01:00  Manual sync reads Stripe (T=now, but based on event at T=1010)
12:01:01  Manual sync writes (webhookAge = 61s)
12:01:02  Webhook B arrives (T=1010)
          ❌ Conflict: Manual sync vs Webhook B (which is fresher?)
```

**Core Issue:**
- Webhook age measures time since last webhook
- Does NOT measure whether manual sync state is fresher than pending webhooks

**Required Fix:**
Explicit synchronization baseline with Stripe event API:

```typescript
// In manual sync:
const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

// Fetch RECENT Stripe events for this subscription
const recentEvents = await fetchRecentSubscriptionEvents(stripe, subscriptionId, {
  since: subscription.lastWebhookEventTimestamp || 0,
  limit: 10
});

// Find most recent event timestamp
const mostRecentEventTimestamp = recentEvents[0]?.created || stripeSub.created;

// EXPLICIT COMPARISON:
if (subscription.lastWebhookEventTimestamp &&
    subscription.lastWebhookEventTimestamp >= mostRecentEventTimestamp) {
  // Our DB has processed events AS RECENT AS or NEWER THAN Stripe's most recent
  return { synced: false, reason: 'webhook-baseline-current' };
}

// Manual sync is fresher than last processed webhook
// AND no pending webhooks detected in Stripe event stream
// Safe to sync

await tx.subscription.update({
  data: {
    // Sync state from Stripe
    // But DO NOT update lastWebhookEventTimestamp
    // (Only webhooks update that field)
  }
});
```

**Fallback (if event API unavailable):**
- Use 60s as operational safety threshold
- BUT explicitly document that this is NOT a freshness proof
- Mark subscription for reconciliation check

---

#### 4. CRITICAL: CANCELLED Precedence Not Explicit Invariant

**Issue:**
Policy says:
```typescript
if (incomingEvent.eventTimestamp === currentState.lastWebhookEventTimestamp &&
    currentState.subscriptionStatus === 'CANCELLED') {
  // Block resurrection
}
```

**Problem:**
- This checks if CANCELLED is already committed
- Does NOT establish cancellation as an explicit terminal event

**Missing Invariant:**
```
For the same Stripe subscription ID:

Once customer.subscription.deleted is accepted,
NO subsequent transaction may transition lifecycle state away from CANCELLED.
```

**Current wording:**
> "Proceed (idempotency + terminal state rules handle conflicts)"

**Problem:** Idempotency does NOT establish ordering between DIFFERENT events.

**Required Fix:**
Make CANCELLED terminal precedence explicit:

```typescript
// GUARD 1: Terminal CANCELLED state (ALWAYS check first, independent of timestamp)
if (currentState.subscriptionStatus === 'CANCELLED' &&
    incomingEvent.stripeSubscriptionId === currentState.stripeSubscriptionId) {
  
  // CANCELLED is TERMINAL for this subscription ID
  // NO resurrection allowed (INV-2)
  
  // Exception: Retention state changes (separate field)
  if (incomingEvent.type === 'cron' && 
      incomingEvent.targetStatus === 'EXPIRED') {
    // Setting retentionState, not lifecycle status
    return { allowed: true, reason: 'retention-state-only' };
  }
  
  // Block ALL lifecycle transitions from CANCELLED
  return { allowed: false, reason: 'cancelled-is-terminal-no-resurrection' };
}

// GUARD 2: Subscription ID scoping (THEN check subscription identity)
// ...

// GUARD 3: Timestamp ordering (THEN check freshness)
// ...
```

**Test Update:**
T7-C and T8-C must assert:
```typescript
// Regardless of transaction order or timestamps:
// Once subscription.deleted commits, it CANNOT be overwritten
expect(finalState).toBe('CANCELLED');
```

---

### HIGH Priority Issues

#### 5. HIGH: Timestamp + Event ID ≠ Total Ordering

**Issue:**
Schema:
```sql
lastWebhookEventTimestamp INTEGER
lastWebhookEventId TEXT  -- "for debugging"
```

**Problem:**
- Two different Stripe events CAN have same `event.created`
- `eventId` is NOT an ordering sequence (it's an identifier)
- Therefore: `(timestamp, eventId)` does NOT provide total ordering

**Example:**
```
Event A: id=evt_A, created=2000
Event B: id=evt_B, created=2000

Which is "newer"? Cannot determine from these fields.
```

**Current Handling:**
- Terminal CANCELLED rule handles cancellation case
- Idempotency prevents duplicate events
- But does NOT order different events with same timestamp

**Required Fix:**
Explicit documentation:

```markdown
## Ordering Limitations

**Timestamp is a freshness signal, NOT a total ordering:**
- `lastWebhookEventTimestamp` establishes "staleness cutoff"
- Events with older timestamps are rejected
- Events with EQUAL timestamps are considered concurrent

**Event ID is an identifier, NOT a sequence:**
- `lastWebhookEventId` used for debugging/audit only
- Does NOT provide ordering between different events

**Safe transitions with equal timestamps:**
- CANCELLED terminal rule prevents resurrection (INV-2)
- Idempotency prevents duplicate event processing
- Transaction serialization determines commit order for concurrent events

**Unsafe transitions with equal timestamps:**
- Multiple updates to same subscription (order undefined)
- Mitigation: Stripe typically spaces events by milliseconds
- Monitoring: Alert if equal-timestamp conflicts exceed threshold
```

---

#### 6. HIGH: Migration Watermark Algorithm Incomplete

**Issue:**
```typescript
while (hasMore) {
  const batch = await stripe.events.list({ limit: 100, starting_after });
  // ... filter for subscription
}
```

**Problems:**

**A. Event type filtering unclear:**
- Which event types are relevant?
- `customer.subscription.*` only?
- What about `invoice.*` events that change state?

**B. Subscription filtering mechanism:**
- How are events filtered to specific subscription?
- `event.data.object.id === subscriptionId`?
- What if event structure varies?

**C. Watermark selection:**
- "Most recent event" → but which field? `event.created`?
- What if events are out of order in API response?

**D. Edge cases:**
- No events found → use `subscription.created`?
- Stripe state disagrees with newest event → which wins?
- API retention limits → events older than 30 days unavailable

**Required Fix:**
Explicit algorithm:

```typescript
/**
 * Establish migration watermark for subscription.
 * 
 * Returns: { watermark: number, source: string, needsReconciliation: boolean }
 */
async function establishMigrationWatermark(
  stripe: Stripe,
  subscription: Subscription
): Promise<{ watermark: number; source: string; needsReconciliation: boolean }> {
  
  const stripeSubscriptionId = subscription.stripeSubscriptionId!;
  
  // Step 1: Fetch current Stripe subscription
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  
  // Step 2: Fetch ALL subscription-related events (paginated)
  const allEvents: Stripe.Event[] = [];
  const RELEVANT_EVENT_TYPES = [
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.trial_will_end',
    // Note: invoice events NOT included (different object type)
  ];
  
  let hasMore = true;
  let startingAfter: string | undefined;
  
  while (hasMore) {
    const batch = await stripe.events.list({
      limit: 100,
      starting_after: startingAfter,
      // Note: Stripe API does NOT support type wildcard filtering
    });
    
    // Filter for THIS subscription
    const relevantEvents = batch.data.filter(event => {
      // Check event type
      if (!RELEVANT_EVENT_TYPES.includes(event.type)) return false;
      
      // Check subscription ID
      const eventSubId = (event.data?.object as any)?.id;
      return eventSubId === stripeSubscriptionId;
    });
    
    allEvents.push(...relevantEvents);
    
    hasMore = batch.has_more;
    if (hasMore && batch.data.length > 0) {
      startingAfter = batch.data[batch.data.length - 1].id;
    } else {
      break;
    }
    
    // Safety limit
    if (allEvents.length > 1000) {
      logger.warn(`Too many events for subscription ${stripeSubscriptionId}, stopping`);
      break;
    }
  }
  
  // Step 3: Determine watermark
  if (allEvents.length === 0) {
    // No events found → use subscription creation time
    return {
      watermark: stripeSub.created,
      source: 'subscription-created',
      needsReconciliation: false
    };
  }
  
  // Sort by timestamp (most recent first)
  allEvents.sort((a, b) => b.created - a.created);
  
  const mostRecentEvent = allEvents[0];
  
  // Step 4: Verify consistency
  const stripeStateStatus = normalizeStatus(stripeSub.status);
  const mostRecentEventStatus = normalizeStatus((mostRecentEvent.data.object as any).status);
  
  if (stripeStateStatus !== mostRecentEventStatus) {
    // Divergence detected
    logger.warn(`Stripe current state (${stripeStateStatus}) differs from most recent event (${mostRecentEventStatus})`);
    
    // Use current state timestamp but mark for reconciliation
    return {
      watermark: stripeSub.current_period_start,
      source: 'stripe-current-state-divergence',
      needsReconciliation: true
    };
  }
  
  // Consistent → use event timestamp
  return {
    watermark: mostRecentEvent.created,
    source: 'most-recent-event',
    needsReconciliation: false
  };
}
```

---

#### 7. HIGH: Maintenance Mode HTTP 503 Needs Retry Verification

**Issue:**
```typescript
if (await isMaintenanceMode()) {
  return res.status(503);  // Service Unavailable
}
```

**Problem:**
- Does Stripe retry 503 responses?
- What is retry interval?
- Are events permanently lost if not retried?

**Migration Sequence Gap:**
```
1. Enable maintenance mode
2. Run migration
3. Disable maintenance mode
4. ??? (What happens to rejected webhooks?)
```

**Required Fix:**
Explicit webhook retry/backlog handling:

```typescript
// Migration script:

// Step 1: Enable maintenance mode
await enableMaintenanceMode();

// Step 2: Wait for in-flight webhooks to complete
await waitForInFlightWebhooks(30000); // 30s

// Step 3: Verify no webhooks being processed
const inProgress = await countInProgressWebhooks();
if (inProgress > 0) {
  throw new Error(`Still ${inProgress} webhooks in progress, aborting migration`);
}

// Step 4: Run migration
await runMigration();

// Step 5: Verify migration success
await verifyMigrationInvariants();

// Step 6: Disable maintenance mode
await disableMaintenanceMode();

// Step 7: CRITICAL - Verify Stripe webhook backlog
// Stripe retries 503 responses automatically
// But verify backlog is draining
await monitorWebhookBacklog({
  maxWaitMinutes: 10,
  expectedBacklogSize: 0,
  onBacklog: (count) => {
    logger.info(`Webhook backlog: ${count} events pending retry`);
  }
});

// Step 8: Verify state consistency
await verifyAllSubscriptionsConsistent();
```

**Stripe Retry Behavior (document explicitly):**
- Stripe retries failed webhooks with exponential backoff
- 503 responses treated as temporary failure
- Verify retry behavior in Stripe dashboard after migration
- Monitor webhook event delivery status

---

#### 8. HIGH: Provider Pointer Invariant Not Database-Enforced

**Issue:**
Design claims:
```
Provider pointer consistency invariant (INV-3, Rev 3 Issue #8)
├─ Enforced by: enforceProviderPointerInvariant()
└─ Status: ✅ DB/application enforcement
```

**Reality:**
- `enforceProviderPointerInvariant()` is APPLICATION code
- NOT a database constraint/trigger
- Database does NOT enforce:
  ```sql
  Provider.stripeSubscriptionId
    →
  Subscription.stripeSubscriptionId (belonging to same Provider)
  ```

**Acceptance Criteria Claims:**
> "Provider pointer invariant ✅ DB/application enforcement"

**Problem:** This overstates the enforcement level.

**Required Correction:**
```markdown
## Provider Pointer Consistency

**Invariant:**
```
Provider.stripeSubscriptionId IS NULL
  OR
Provider.stripeSubscriptionId → Subscription.stripeSubscriptionId
  AND Subscription.providerId = Provider.id
  AND Subscription is current lifecycle instance
```

**Enforcement Level:**
- ⚠️ **Application-enforced** (transactional, not database constraint)
- Function: `enforceProviderPointerInvariant()` called in every writer
- Verification: Test suite + periodic health check query

**NOT database-enforced** (no foreign key with additional constraint).

**Verification Query (should return 0 rows):**
```sql
SELECT p.id, p."stripeSubscriptionId"
FROM "Provider" p
LEFT JOIN "Subscription" s ON s."stripeSubscriptionId" = p."stripeSubscriptionId"
WHERE p."stripeSubscriptionId" IS NOT NULL
  AND (s.id IS NULL OR s."providerId" != p.id);
```

**Risk:** If application code has bugs, invariant can be violated.
**Mitigation:** Test coverage + health checks + audit logs.
```

---

### MEDIUM Priority Issues

#### 9. MEDIUM: Redundant Stripe ID Indexes

**Issue:**
Revision 4 creates:
```sql
CREATE UNIQUE INDEX "idx_subscription_stripe_id_unique" 
  ON "Subscription"("stripeSubscriptionId")
  WHERE "stripeSubscriptionId" IS NOT NULL;

CREATE INDEX "idx_subscription_stripe_id" 
  ON "Subscription"("stripeSubscriptionId");
```

Plus Prisma schema:
```prisma
stripeSubscriptionId String? @unique
@@index([stripeSubscriptionId])
```

**Problem:**
- Unique index already covers lookups
- Non-unique index is redundant
- Wastes storage + write performance

**Required Fix:**
```sql
-- Keep ONLY the unique index
CREATE UNIQUE INDEX "idx_subscription_stripe_id_unique" 
  ON "Subscription"("stripeSubscriptionId")
  WHERE "stripeSubscriptionId" IS NOT NULL;

-- Remove redundant non-unique index
-- DROP INDEX IF EXISTS "idx_subscription_stripe_id";
```

Prisma schema:
```prisma
stripeSubscriptionId String? @unique
// Remove: @@index([stripeSubscriptionId])
```

---

#### 10. MEDIUM: Feature Flag Rollback Needs Schema Compatibility Test

**Issue:**
Rollback strategy:
```typescript
ENABLE_SUB_06A_ORDERING_FIX = false → legacy handler
```

But schema already changed:
```sql
ALTER TABLE "Subscription" ADD COLUMN "lastWebhookEventTimestamp" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "retentionState" TEXT;
CREATE UNIQUE INDEX ...;
```

**Problem:**
- Legacy code may not handle new columns gracefully
- Unique constraint may reject legitimate legacy behavior
- NOT tested: `new schema + legacy code`

**Required Fix:**
Pre-deployment compatibility test:

```typescript
describe('Rollback Compatibility: New Schema + Legacy Code', () => {
  beforeAll(async () => {
    // Apply new schema
    await runMigration('SUB-06-A-schema.sql');
    
    // Switch to legacy handler
    process.env.ENABLE_SUB_06A_ORDERING_FIX = 'false';
  });
  
  test('Legacy handler can process webhooks with new schema', async () => {
    // Send webhook using legacy code path
    await handleWebhookLegacy({
      type: 'customer.subscription.updated',
      data: { /* ... */ }
    });
    
    // Verify no errors
    // Verify subscription updated correctly
    // Verify new columns remain NULL (legacy doesn't use them)
  });
  
  test('Unique constraint does not break legacy behavior', async () => {
    // Create subscription via legacy path
    const sub1 = await createSubscriptionLegacy(providerId, 'sub_A');
    
    // Attempt duplicate (should fail same way as before migration)
    await expect(
      createSubscriptionLegacy(providerId, 'sub_A')
    ).rejects.toThrow();
  });
  
  test('NULL retentionState does not break legacy queries', async () => {
    const subscriptions = await fetchSubscriptionsLegacy(providerId);
    expect(subscriptions).toHaveLength(1);
    // Verify retentionState=NULL handled gracefully
  });
});
```

---

## Summary: Rev 4 Progress

| Area | Rev 3 Status | Rev 4 Status | Remaining |
|------|--------------|--------------|-----------|
| Historical identity | ✅ Correct | ✅ Correct | None |
| Mandatory locking | ⚠️ "Consider" | ✅ Specified | Lock order undefined |
| Serialization retry | ⚠️ Mentioned | ✅ Specified | None |
| Atomic idempotency | ❌ Outside TX | ✅ Inside TX | State lifecycle imprecise |
| T7/T8 tests | ⚠️ Promise.all | ✅ A/B/C orders | None |
| Stripe events | ❌ limit: 5 | ✅ Paginated | Algorithm incomplete |
| Migration/webhook | ❌ "Optional" | ✅ Maintenance window | Retry verification missing |
| Manual sync | ❌ Blocked always | ⚠️ 60s rule | Not freshness proof |
| Stripe ID unique | ✅ Correct | ✅ Correct | Redundant indexes |
| Provider pointer | ⚠️ Conceptual | ⚠️ Application-level | Enforcement level overstated |
| SUB-22 integration | ⚠️ Not shown | ✅ Shown | None |
| Retention state | ❌ Overload status | ✅ Separate field | None |
| CANCELLED terminal | ⚠️ Equal-timestamp only | ⚠️ Same | Not explicit invariant |

---

## Required Changes for Revision 5

**Targeted corrections only (no broad redesign):**

### CRITICAL (Must Fix)

1. **Define universal lock order**
   - Specify: Provider-first vs Subscription-first vs lock matrix
   - Prove no deadlock for all 7 writers

2. **Precise idempotency state model**
   - Explicit states: ABSENT, CLAIMED, COMPLETED, ORPHANED
   - Handle orphaned records (crashed transactions)

3. **Replace 60s rule with explicit sync baseline**
   - Fetch recent Stripe events
   - Compare timestamps explicitly
   - Fallback: mark for reconciliation (not time-based guess)

4. **Make CANCELLED terminal precedence explicit**
   - Independent of timestamp
   - Check CANCELLED FIRST (before any other guard)
   - Explicit invariant in policy specification

### HIGH (Strongly Required)

5. **Document timestamp + eventId limitations**
   - NOT a total ordering
   - Timestamp = freshness signal
   - EventId = identifier (not sequence)

6. **Complete migration watermark algorithm**
   - Event type list
   - Subscription filtering mechanism
   - Edge cases (no events, divergence, retention limits)

7. **Verify Stripe webhook retry/backlog**
   - Document Stripe 503 retry behavior
   - Add backlog monitoring post-migration

8. **Correct Provider pointer enforcement claim**
   - Change "DB/application" to "Application-enforced"
   - Document risk + mitigation

### MEDIUM (Should Fix)

9. **Remove redundant indexes**
10. **Test new schema + legacy code rollback**

---

## Conclusion

**Revision 4 is substantially improved and specifies mechanisms correctly.**

**Remaining work:** Ensure mechanisms GUARANTEE the claimed invariants.

**Key gaps:**
- Lock order (deadlock potential)
- Idempotency orphan handling
- Manual sync freshness (age ≠ freshness)
- CANCELLED precedence (not explicit enough)

**Next revision (Rev 5):** Targeted corrections, not redesign.

**Implementation remains BLOCKED until mechanisms provably guarantee invariants.**

---

## Audit Trail

- **Rev 1:** Timestamp guard only → REJECTED
- **Rev 2:** Centralized policy → REJECTED (9 issues: TOCTOU, lost ID)
- **Rev 3:** Architectural fixes → CHANGES REQUIRED (10 issues: concurrency mechanics)
- **Rev 4:** Mechanisms specified → **CHANGES REQUIRED (10 issues: invariant gaps)**
- **Rev 5:** *(pending)* Targeted corrections
- **Implementation:** BLOCKED

---

**End of Rev 4 Review Findings**

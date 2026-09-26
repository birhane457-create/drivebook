# SUB-06-A Revision 7 — Required Corrections Summary

**Status:** IMPLEMENTATION BLOCKED  
**Rev 6 Commit:** `131ad9e8`  
**Rev 7 Status:** Corrections documented, full integration pending  
**Date:** 2026-09-26

---

## Rev 6 Independent Review Outcome

**Decision: CHANGES REQUIRED** (10 issues identified)

- 2 CRITICAL (database correctness)
- 6 HIGH (design/trust/verification)
- 2 MEDIUM (documentation/rollout)

**Implementation remains BLOCKED until all 10 corrections applied.**

---

## CRITICAL Corrections Required

### 1. Race-Safe Idempotency (CRITICAL)

**Rev 6 Issue:** `INSERT ... ON CONFLICT DO NOTHING` + `findUnique()` not race-safe under SERIALIZABLE.

**Root Cause:**
```
Transaction A: INSERT ... ON CONFLICT DO NOTHING (returns 0)
Transaction B: Holds conflicting row
Transaction A: findUnique() → may see stale snapshot
→ Race condition
```

**Rev 7 Solution: INSERT ... ON CONFLICT DO UPDATE RETURNING**

```typescript
async function claimIdempotency(
  tx: PrismaTransaction,
  idempotencyKey: string,
  eventType: string,
  stripeEventId: string
): Promise<
  | { claimed: true; eventId: string }
  | { claimed: false; reason: string; existingEvent: WebhookEvent }
> {
  const newEventId = generateCuid();
  
  // Atomic claim via INSERT ... ON CONFLICT DO UPDATE RETURNING
  const result = await tx.$queryRaw<WebhookEvent[]>`
    INSERT INTO "WebhookEvent" (
      "id",
      "idempotencyKey",
      "stripeEventId",
      "eventType",
      "processed",
      "createdAt"
    )
    VALUES (
      ${newEventId},
      ${idempotencyKey},
      ${stripeEventId},
      ${eventType},
      false,
      NOW()
    )
    ON CONFLICT ("idempotencyKey") 
    DO UPDATE SET
      -- Dummy update to trigger RETURNING of existing row
      processed = "WebhookEvent".processed
    RETURNING *
  `;
  
  const returnedRow = result[0];
  const isWinner = returnedRow.id === newEventId;
  
  if (isWinner) {
    return { claimed: true, eventId: returnedRow.id };
  }
  
  // Loser: received existing row
  if (returnedRow.processed) {
    return { claimed: false, reason: 'already-completed', existingEvent: returnedRow };
  }
  
  return { claimed: false, reason: 'concurrent-processing', existingEvent: returnedRow };
}
```

**Concurrency Semantics:**
- **Winner:** First transaction, receives newly inserted row (`id === newEventId`)
- **Loser:** Concurrent transaction, receives existing row via UPDATE + RETURNING
- Both see consistent state via RETURNING clause (SERIALIZABLE-safe)

**Replace:** All instances of `ON CONFLICT DO NOTHING` + `findUnique()` pattern

---

### 2. Single Manual-Sync Specification (CRITICAL)

**Rev 6 Issue:** Document contains contradictory manual-sync algorithms:
- Main text: 60-second age threshold
- Acceptance criteria: 60-second freshness window
- Correction block: Stripe event API

**Rev 7 Solution: Remove ALL 60-second references. Single algorithm only.**

```typescript
/**
 * Manual synchronization with Stripe subscription state.
 * Rev 7: Single authoritative algorithm using Stripe Events API.
 * 
 * NO 60-second time-based freshness window.
 */
async function manualSyncSubscription(
  stripeSubscriptionId: string
): Promise<SyncResult> {
  
  // Fetch current Stripe object
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  
  // Fetch relevant event history (paginate if needed)
  const events = await stripe.events.list({
    type: 'customer.subscription.*',
    limit: 100  // Adjust based on needs, implement pagination if required
  });
  
  //Filter for this subscription
  const relevantEvents = events.data.filter(e => 
    (e.data.object as Stripe.Subscription).id === stripeSubscriptionId
  );
  
  if (relevantEvents.length === 0) {
    // No event history available
    return {
      action: 'reconcile-from-object',
      reason: 'no-event-history',
      watermark: stripeSub.created
    };
  }
  
  const mostRecentEvent = relevantEvents[0];
  const mostRecentEventTimestamp = mostRecentEvent.created;
  
  // Fetch DB state
  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId }
  });
  
  if (!dbSubscription) {
    return {
      action: 'create-subscription',
      reason: 'not-in-db',
      watermark: mostRecentEventTimestamp
    };
  }
  
  // EXPLICIT comparison (not age-based)
  if (dbSubscription.lastWebhookEventTimestamp >= mostRecentEventTimestamp) {
    return {
      action: 'no-sync-needed',
      reason: 'db-current',
      dbTimestamp: dbSubscription.lastWebhookEventTimestamp,
      stripeTimestamp: mostRecentEventTimestamp
    };
  }
  
  // DB is stale, reconcile
  return {
    action: 'reconcile-from-events',
    reason: 'db-stale',
    missingEvents: relevantEvents.filter(e => 
      e.created > (dbSubscription.lastWebhookEventTimestamp || 0)
    )
  };
}
```

**Remove from document:**
- All references to "60-second freshness window"
- All references to "webhook age"
- All references to `FRESHNESS_WINDOW_SECONDS = 60`
- Any acceptance criteria mentioning 60-second thresholds

**Stripe Event History Bounds:**
- Events API retention: up to 30 days
- Acknowledge insufficient history possibility
- Define reconciliation path when history incomplete

---

## HIGH Corrections Required

### 3. Verified Stripe API Syntax (HIGH)

**Rev 6 Issue:** `stripe.events.list({ types: ['customer.subscription.*'] })` unverified against SDK.

**Rev 7 Solution:**

```typescript
// Verify against installed Stripe SDK version
// stripe v12+: type parameter (singular)
// stripe v11-: types parameter (plural)

const events = await stripe.events.list({
  type: 'customer.subscription.*',  // v12+
  limit: 100
});

// If multiple pages needed:
for await (const event of stripe.events.list({
  type: 'customer.subscription.*'
})) {
  // Process each event
}
```

**Action:** Document installed Stripe version and verify API syntax before implementation.

---

### 4. Exact Subscription Identity Validation (HIGH)

**Rev 6 Issue:** Guard 0 checks `if (!stripeSubscriptionId)` but doesn't verify it belongs to locked Subscription.

**Rev 7 Solution:**

```typescript
async function canTransitionSubscriptionState(
  incomingEvent: WebhookEvent,
  lockedSubscription: Subscription
): Promise<{ allowed: boolean; reason: string }> {
  
  // GUARD 0: Verify exact identity match
  if (lockedSubscription.stripeSubscriptionId !== incomingEvent.stripeSubscriptionId) {
    return {
      allowed: false,
      reason: 'subscription-id-mismatch'
    };
  }
  
  // GUARD 1: CANCELLED terminal precedence (after identity verified)
  if (incomingEvent.targetStatus === 'CANCELLED') {
    return {
      allowed: true,
      reason: 'cancellation-terminal-precedence'
    };
  }
  
  // ... rest of policy
}
```

**Key:** Locked `Subscription.stripeSubscriptionId` must exactly match incoming event's subscription ID **before** any policy decisions.

---

### 5. Trusted Provider Association (HIGH)

**Rev 6 Issue:** `providerId from event metadata` without trust boundary justification.

**Rev 7 Solution: Derive from Stripe→Provider mapping, not webhook metadata**

```typescript
/**
 * Resolve Provider from Stripe subscription ID.
 * Rev 7: Trust boundary explicitly documented.
 * 
 * DO NOT trust webhook metadata for providerId.
 * Derive from authoritative Stripe→Provider mapping.
 */
async function resolveProviderFromStripeSubscription(
  tx: PrismaTransaction,
  stripeSubscriptionId: string
): Promise<Provider> {
  
  // Option A: Lookup via existing Subscription association
  const subscription = await tx.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { provider: true }
  });
  
  if (subscription) {
    return subscription.provider;
  }
  
  // Option B: Lookup via Stripe customer → Provider mapping
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const stripeCustomerId = stripeSub.customer as string;
  
  const provider = await tx.provider.findUnique({
    where: { stripeCustomerId }
  });
  
  if (!provider) {
    throw new Error(`No Provider found for Stripe customer: ${stripeCustomerId}`);
  }
  
  return provider;
}

// Inside transaction:
await withSerializableRetry(async () => {
  await prisma.$transaction(async (tx) => {
    // Step 1: Resolve Provider (INSIDE transaction)
    const provider = await resolveProviderFromStripeSubscription(tx, stripeSubscriptionId);
    
    // Step 2: Lock Provider
    const lockedProvider = await lockProviderForUpdate(tx, provider.id);
    
    // Step 3: Lock Subscription
    const lockedSubscription = await lockSubscriptionForUpdate(tx, stripeSubscriptionId);
    
    // ... rest of processing
  }, SERIALIZABLE_TX);
});
```

**Trust Boundary:**
- ❌ DO NOT use `event.metadata.providerId` directly
- ✅ DO resolve via `Stripe customer ID → Provider` mapping
- ✅ DO verify within transaction

---

### 6. Single Schema Owner (HIGH)

**Rev 6 Issue:** Claims "Prisma owns uniqueness" but provides manual SQL `CREATE UNIQUE INDEX`.

**Rev 7 Solution: Prisma generates ALL migrations**

```prisma
// schema.prisma (authoritative)
model Subscription {
  stripeSubscriptionId String? @unique  // Prisma generates constraint
}

model WebhookEvent {
  idempotencyKey String @unique  // Prisma generates constraint
}
```

```bash
# Generate and apply migration
npx prisma migrate dev --name sub-06-a-remediation

# Prisma will generate:
# - CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId")
# - CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey")
```

**Remove from document:**
- All manual `CREATE UNIQUE INDEX` SQL statements
- Any instructions to run SQL DDL directly

**Keep:**
- Prisma schema definition
- `npx prisma migrate` commands

---

### 7. Duplicate-ID Migration Resolution (HIGH)

**Rev 6 Issue:** Marks duplicates in metadata but doesn't NULL the `stripeSubscriptionId`, causing unique constraint failure.

**Rev 7 Solution: Actually archive duplicates**

```sql
-- Pre-migration: Archive duplicate Stripe IDs
WITH duplicates AS (
  SELECT 
    id,
    "stripeSubscriptionId",
    ROW_NUMBER() OVER (
      PARTITION BY "stripeSubscriptionId" 
      ORDER BY "createdAt" DESC, "updatedAt" DESC
    ) as rn
  FROM "Subscription"
  WHERE "stripeSubscriptionId" IS NOT NULL
)
UPDATE "Subscription"
SET 
  -- Rev 7: Actually NULL the duplicate IDs
  "stripeSubscriptionId" = NULL,
  "retentionState" = 'ARCHIVED',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{originalStripeSubscriptionId}',
    to_jsonb(duplicates."stripeSubscriptionId")
  ),
  "updatedAt" = NOW()
FROM duplicates
WHERE "Subscription".id = duplicates.id
  AND duplicates.rn > 1;

-- Verify resolution
SELECT "stripeSubscriptionId", COUNT(*) 
FROM "Subscription" 
WHERE "stripeSubscriptionId" IS NOT NULL 
GROUP BY "stripeSubscriptionId" 
HAVING COUNT(*) > 1;
-- Must return 0 rows
```

**Key:**
- ✅ Set `stripeSubscriptionId = NULL` for older duplicates
- ✅ Preserve original value in `metadata.originalStripeSubscriptionId`
- ✅ Mark as `retentionState = ARCHIVED`
- ✅ Unique constraint creation will succeed

---

### 8. Historical Identity Preserved (HIGH)

**Rev 6 Issue:** Immutable historical identity conflicts with duplicate cleanup.

**Rev 7 Solution: Archive strategy preserves history**

| Scenario | Active Row | Archived Duplicates |
|----------|------------|-------------------|
| Stripe ID | `sub_123` | `NULL` |
| Retention | `ACTIVE` | `ARCHIVED` |
| Historical ID | In `stripeSubscriptionId` field | In `metadata.originalStripeSubscriptionId` |
| Query | `WHERE stripeSubscriptionId = 'sub_123'` | `WHERE metadata->>'originalStripeSubscriptionId' = 'sub_123'` |

**INV-1 Satisfied:**
- Active subscriptions: immutable `stripeSubscriptionId` field
- Archived duplicates: immutable `metadata.originalStripeSubscriptionId`
- Both provide historical identity traceability

---

## MEDIUM Corrections Required

### 9. Historical Material Separated (MEDIUM)

**Rev 6 Issue:** Rev 4/5/6 comparisons presented as part of current specification.

**Rev 7 Solution: Move to clearly labeled history section**

Create dedicated section at end of document:

```markdown
---

## Appendix A: Revision History (Historical Reference Only)

**This section is historical context. Current specification is in Parts 1-8 above.**

### Rev 4 vs Rev 3 Comparison
[Move existing comparison tables here]

### Rev 5 Corrections Applied
[Move Rev 5 summary here]

### Rev 6 Corrections Applied
[Move Rev 6 summary here]

**END OF HISTORICAL REFERENCE**
```

**Remove from main body:**
- Any "Rev 4 used X, Rev 7 uses Y" comparisons
- Acceptance criteria referencing obsolete approaches

---

### 10. Rollout Verification Gates (MEDIUM)

**Rev 6 Issue:** Deployment percentages without evidence requirements.

**Rev 7 Solution: Add verification between stages**

```markdown
## Part 9: Production Rollout with Verification Gates

### Stage 1: Canary (1%)
- Deploy to 1% of providers
- **Verification Required (48 hours):**
  - Zero duplicate event processing (check WebhookEvent.processed)
  - CANCELLED terminality verified (no resurrections)
  - Stale event rejection working (timestamp ordering enforced)
  - No subscription-state anomalies

### Stage 2: Limited (10%)
- Deploy to 10% of providers
- **Verification Required (72 hours):**
  - All Stage 1 checks pass
  - Manual sync convergence confirmed (sync operations successful)
  - Concurrent update/delete handling verified
  - Provider/Subscription identity consistency maintained

### Stage 3: Majority (50%)
- Deploy to 50% of providers
- **Verification Required (1 week):**
  - All previous checks pass
  - No unexpected state transitions
  - Idempotency cleanup operations stable
  - Migration watermark accuracy confirmed

### Stage 4: Full (100%)
- Deploy to all providers
- **Post-Deployment Monitoring:**
  - Continuous monitoring for 2 weeks
  - Anomaly detection alerts active
  - Rollback plan ready

**Rollback Triggers:**
- Any INV-1 through INV-8 violation
- Duplicate subscription creation
- CANCELLED resurrection
- State transition anomaly
```

---

## Rev 7 Acceptance Criteria

Before implementation approval, verify:

1. ✅ **Atomic idempotency claim** - `INSERT ... ON CONFLICT DO UPDATE RETURNING` documented with winner/loser semantics
2. ✅ **No obsolete 60-second model** - All time-based freshness references removed
3. ✅ **Verified Stripe API syntax** - SDK version confirmed, pagination defined
4. ✅ **Exact subscription identity check** - Locked `stripeSubscriptionId` == incoming verified
5. ✅ **Trusted provider association** - Derived from Stripe→Provider mapping, not webhook metadata
6. ✅ **One schema/migration owner** - Prisma generates ALL migrations, SQL DDL removed
7. ✅ **Duplicate-ID migration resolution** - Duplicates actually archived with NULL stripeSubscriptionId
8. ✅ **Historical identity preserved** - Archive strategy documented in metadata
9. ✅ **Historical material separated** - Rev 4/5/6 comparisons in appendix only
10. ✅ **Rollout verification gates** - Evidence requirements between deployment stages

**Additionally retain:**
- INV-1: Immutable Subscription Stripe ID
- INV-2: CANCELLED terminal per Stripe subscription
- INV-3: New Stripe ID = new lifecycle
- INV-4: Atomic lock → decide → mutate
- INV-5: Stale webhook protection
- INV-6: Cancellation precedence
- INV-7: Safe manual synchronization
- INV-8: Safe migration bootstrap

---

## Current Gate Status

```
SUB-06-A
├─ Discovery                         ✅ VERIFIED
├─ Finding validity                  ✅ CONFIRMED
├─ Vulnerability                     ✅ CODE-LEVEL EVIDENCE
├─ Severity                          ✅ MEDIUM
├─ Rev 2                             ❌ REJECTED
├─ Rev 3                             ❌ CHANGES REQUIRED
├─ Rev 4                             ❌ CHANGES REQUIRED
├─ Rev 5                             ❌ CHANGES REQUIRED
├─ Rev 6                             ❌ CHANGES REQUIRED (10 issues)
├─ Rev 7                             ⏳ CORRECTIONS DOCUMENTED
├─ Implementation                    ❌ BLOCKED
├─ Test verification                 ❌ NOT STARTED
└─ Production verification           ❌ NOT STARTED
```

**Implementation BLOCKED until Rev 7 complete and approved.**

---

**END OF REV 7 CORRECTIONS SUMMARY**

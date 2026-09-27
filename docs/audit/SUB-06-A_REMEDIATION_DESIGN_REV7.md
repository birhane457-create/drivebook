# SUB-06-A Remediation Design (REVISION 7 - FINAL)

**Finding:** Out-of-order webhook delivery can produce invalid subscription state  
**Severity:** MEDIUM  
**Status:** IMPLEMENTATION READY - REVISION 7 (FINAL)  
**Discovery Commit:** `13e7a038`  
**Rev 7 Corrections Summary:** `df90a1b4`  
**Rev 7 Date:** 2026-09-26

**Stripe SDK Version:** `^20.3.1` (from package.json; exact resolved version not verified from lockfile)

---

## Executive Summary

This design remediates SUB-06-A: out-of-order webhook delivery producing invalid subscription state transitions.

**Root Cause:** Subscription state mutations applied without verifying event ordering, enabling race conditions where:
- Stale events override current state
- Concurrent transactions produce inconsistent mutations
- Duplicate events process multiple times
- Provider/Subscription identity boundaries violated

**Solution Architecture:**

```
Webhook → Idempotency Claim → Provider Resolution → Universal Lock Order →
Identity Validation → Stale Event Guard → Policy Decision → 
Conditional Mutation → Audit → Commit

With whole-transaction retry on 40001/P2034 serialization failures
```

---

## Revision History

### Revision 7 (Current - FINAL)

**Rev 6 Review:** Corrections summary accepted with 7 integration conditions.

**Integration Corrections Applied:**

1. ✅ **CRITICAL: Serialization failure handling** - 40001/P2034 handled by whole-transaction retry
2. ✅ **HIGH: Manual-sync transaction architecture** - Follows LOCK→READ→DECIDE→MUTATE pattern
3. ✅ **HIGH: Provider.stripeCustomerId uniqueness** - Schema constraint requirement documented
4. ✅ **HIGH: INV-1 active vs archived distinction** - Clear identity preservation semantics
5. ✅ **HIGH: Business-safe canonical selection** - Provider relationship preserved in migration
6. ✅ **MEDIUM: Stripe SDK dependency declaration** - `^20.3.1` from package.json; exact resolved version not independently verified
7. ✅ **MEDIUM: Deterministic event pagination** - Exhaustion and insufficient-history handling

**This is the single authoritative implementation specification.**

---

## Core Invariants (INV-1 through INV-8)

### INV-1: Immutable Subscription Identity

**Active Subscriptions:**
- Every active Subscription has unique, immutable `stripeSubscriptionId`
- Field never NULL for active subscription records
- Field never changes once set

**Archived Duplicates:**
- Duplicate records from migration have `stripeSubscriptionId = NULL`
- Original identity preserved in `metadata.originalStripeSubscriptionId`
- Marked with `retentionState = ARCHIVED`

**Formal Statement:**
```
∀ s ∈ ActiveSubscriptions: s.stripeSubscriptionId ≠ NULL ∧ UNIQUE(s.stripeSubscriptionId)
∀ s ∈ ArchivedDuplicates: s.stripeSubscriptionId = NULL ∧ s.metadata.originalStripeSubscriptionId preserves historical identity
```

### INV-2: CANCELLED Terminal for Webhook Events (With Authoritative Reconciliation Exception)

```
Webhook Event Processing:
∀ webhook events e1, e2 where e1.stripeSubscriptionId = e2.stripeSubscriptionId:
  (DB.status = CANCELLED ∧ e2.targetStatus ≠ CANCELLED ∧ e2.created > DB.lastWebhookEventTimestamp)
    ⇒ reject(e2, reason: 'terminal-cancelled-by-webhook')

Authoritative Manual Reconciliation:
Manual sync retrieves Stripe.subscription.retrieve() = authoritative current state
  IF Stripe.status ≠ CANCELLED ∧ DB.status = CANCELLED:
    Manual sync MAY update DB.status to match Stripe authoritative state
    Manual sync MUST update DB.lastWebhookEventTimestamp to Stripe event baseline
    → Establishes new authoritative watermark
    → Subsequent webhooks evaluated against new watermark per INV-5
```

**Semantics:**

1. **Webhook-Established CANCELLED is terminal for delayed webhooks:**
   - Once DB status = CANCELLED (established by webhook), subsequent webhook events targeting non-CANCELLED are rejected
   - Rationale: Prevents stale/delayed webhooks from resurrecting cancelled subscriptions

2. **Authoritative Manual Reconciliation can override CANCELLED:**
   - Manual sync explicitly retrieves Stripe's current authoritative state via API
   - If Stripe shows non-CANCELLED, manual sync updates DB to match
   - This is NOT a webhook event - it's authoritative reconciliation
   - Establishes new event watermark from Stripe event history

3. **Subsequent Webhooks After Manual Reactivation:**
   - Evaluated against new watermark (INV-5 stale-event policy)
   - Standard equal-timestamp and ordering rules apply
   - Manual reactivation does NOT exempt subsequent webhooks from INV-5

**Example State Machine:**

```
t1000: webhook subscription.deleted → DB = CANCELLED, watermark = 1000
       (INV-2 now active: subsequent non-CANCELLED webhooks rejected)

t1050: Manual sync: Stripe.retrieve() = ACTIVE, event baseline = 1100
       → DB = ACTIVE, watermark = 1100
       → Audit: subscription-reactivation-from-cancelled
       (Authoritative reconciliation, NOT a webhook event)

t1080: webhook subscription.updated (created = 1080, target = ACTIVE)
       → 1080 < 1100 (watermark)
       → REJECT per INV-5 (stale event)
       (INV-2 does not apply - DB is ACTIVE, not CANCELLED)

t1150: webhook subscription.updated (created = 1150, target = ACTIVE)
       → 1150 > 1100 (watermark), DB = ACTIVE
       → ACCEPT per standard INV-5 policy
       (Standard webhook processing, DB not in CANCELLED state)

t1200: webhook subscription.deleted (created = 1200, target = CANCELLED)
       → 1200 > 1150, DB = ACTIVE
       → ACCEPT, DB = CANCELLED, watermark = 1200
       (INV-2 reactivated: subsequent non-CANCELLED webhooks now rejected again)
```

**Key Distinction:**

- **INV-2 applies to:** Webhook event processing when DB.status = CANCELLED
- **INV-2 does NOT apply to:** Authoritative manual reconciliation via Stripe API retrieval
- **After manual reactivation:** INV-2 is NOT active (DB.status ≠ CANCELLED), standard INV-5 applies

### INV-3: New Stripe ID = New Lifecycle

```
e.stripeSubscriptionId ≠ currentSubscription.stripeSubscriptionId ⇒ 
  create new Subscription row (do not mutate existing)
```

### INV-4: Atomic Lock → Decide → Mutate

```
BEGIN SERIALIZABLE
  lock Provider FOR UPDATE
  lock Subscription FOR UPDATE
  verify identity
  check policy
  conditional mutation
COMMIT

On 40001/P2034: retry entire transaction
```

### INV-5: Stale Webhook Protection

```
incomingEvent.timestamp < subscription.lastWebhookEventTimestamp ⇒ reject(incoming, reason: 'stale')

incomingEvent.timestamp = subscription.lastWebhookEventTimestamp ⇒ apply equal-timestamp policy
```

**Equal-Timestamp Policy (Second-Precision Limitation):**

Stripe `event.created` has second precision and cannot distinguish events within the same second.

When `incomingEvent.timestamp = lastWebhookEventTimestamp`:

1. **If incoming event is CANCELLED:**
   - **AND current DB state is NOT CANCELLED** → Accept (state transition to CANCELLED, cancellation precedence per INV-6)
   - **AND current DB state IS CANCELLED** → Accept as idempotent (no state change, audit log records duplicate cancellation event)
   
2. **Otherwise (non-cancellation event with equal timestamp):** → Reject with `reason: 'equal-timestamp-ambiguous'`

**Rationale:**
- Cancellation events have business priority (subscription termination)
- Equal-timestamp cancellation on already-CANCELLED subscription is idempotent (safe to accept)
- Non-cancellation equal-timestamp events cannot be chronologically ordered
- Accepting ambiguous ordering would violate the stale-event protection intent
- The system favors consistency over accepting potentially-stale non-terminal mutations

**Note:** This policy treats equal-second non-cancellation events conservatively. Production monitoring should track `equal-timestamp-ambiguous` rejections to assess real-world impact.

### INV-6: Cancellation Precedence (After Identity Validation)

```
lockedSubscription.stripeSubscriptionId = incomingEvent.stripeSubscriptionId ∧
incomingEvent.targetStatus = CANCELLED ⇒ allow(incoming)
```

### INV-7: Safe Manual Synchronization

```
Stripe baseline → BEGIN → lock → fresh DB read → decide → mutate → COMMIT
```

### INV-8: Safe Migration Bootstrap

Migration establishes unique `stripeSubscriptionId` constraint with deterministic business-safe duplicate resolution.

---

## Invariant Reconciliation: INV-2 vs INV-7

**Issue:** INV-2 states CANCELLED is terminal, but INV-7 (manual sync) can retrieve Stripe current object showing ACTIVE after DB shows CANCELLED.

**Reconciliation Policy with Complete Lifecycle Rule:**

Manual synchronization establishes **Stripe authority** for subscription lifecycle state:

1. **If Stripe current object status ≠ CANCELLED** AND **DB status = CANCELLED**:
   - This indicates Stripe subscription was reactivated (rare but legitimate: customer resubscribed, cancellation reversed, admin action)
   - Manual sync SHALL update DB to match Stripe authority
   - Audit log SHALL record: `subscription-reactivation-from-cancelled`
   - This is NOT a violation of INV-2 because it represents Stripe's authoritative current state, not a stale webhook

2. **If Stripe current object status = CANCELLED** AND **DB status ≠ CANCELLED**:
   - Standard reconciliation: update DB to CANCELLED
   - Audit log: `manual-sync-cancelled`

3. **Webhook processing after manual sync - Complete Watermark Rule:**

**CRITICAL: Event Watermark Semantics**

To resolve INV-2 vs INV-7 after manual reactivation, the system uses `lastWebhookEventTimestamp` as an **event watermark** (NOT a lifecycle generation identifier):

- When manual sync reactivates from CANCELLED, it updates `lastWebhookEventTimestamp` to the mostRecentEventTimestamp from Stripe event history
- This establishes a new authoritative baseline watermark for stale-event comparison
- The watermark is a timestamp (second precision), not a generation/epoch counter

**Webhook Policy After Manual Reactivation:**

```
Incoming webhook event E:

IF lockedSubscription.status = CANCELLED:
    IF E.created > lockedSubscription.lastWebhookEventTimestamp:
        # Event timestamp is strictly later than cancellation watermark
        IF E.targetStatus = CANCELLED:
            ACCEPT (idempotent, reinforces terminal state)
        ELSE:
            REJECT (INV-2: terminal CANCELLED cannot be overridden by delayed webhooks)
            
    IF E.created = lockedSubscription.lastWebhookEventTimestamp:
        # Equal timestamp - apply equal-timestamp policy
        IF E.targetStatus = CANCELLED:
            ACCEPT (cancellation precedence)
        ELSE:
            REJECT (equal-timestamp-ambiguous per INV-5)
            
    IF E.created < lockedSubscription.lastWebhookEventTimestamp:
        REJECT (INV-5: stale event)

IF lockedSubscription.status ≠ CANCELLED:
    # Standard stale-event and equal-timestamp policies apply (INV-5)
    ...
```

**Equal-Timestamp Behavior After Reactivation:**

When manual sync establishes watermark T and a webhook arrives with event.created = T:
- The system CANNOT determine chronological ordering from timestamp alone
- Apply equal-timestamp policy from INV-5 (CANCELLED accepted, others rejected as ambiguous)
- This is conservative but consistent with second-precision limitation

**Example Scenario:**

```
t1000: subscription.deleted → DB = CANCELLED, watermark = 1000
t1050: Manual sync retrieves Stripe object = ACTIVE, event history shows mostRecent = 1100
        → DB = ACTIVE, watermark = 1100
        → Audit: subscription-reactivation-from-cancelled
t1080: Delayed webhook subscription.updated (event.created = 1080) arrives
        → 1080 < 1100 (watermark)
        → REJECT per INV-5 (stale)
t1100: Webhook subscription.updated (event.created = 1100) arrives
        → 1100 = 1100 (watermark), non-CANCELLED
        → REJECT per equal-timestamp policy (ambiguous)
t1150: New webhook subscription.updated (event.created = 1150) arrives
        → 1150 > 1100 (watermark), DB = ACTIVE
        → ACCEPT per standard policy
```

**What the System Does NOT Track:**

- Lifecycle generation / epoch identifiers
- Chronological ordering within the same second
- Event sequence numbers derived from event IDs

**Rationale:**
- Manual sync explicitly retrieves Stripe's current authoritative state and event baseline
- The watermark provides stale-event protection via `>`, `<`, `=` comparison
- INV-2 applies to webhook event ordering: CANCELLED remains terminal for delayed webhooks
- Manual sync establishes a new authoritative watermark from Stripe's event history
- Equal-timestamp events remain ambiguous and handled conservatively
- Production monitoring tracks `subscription-reactivation-from-cancelled` to detect unexpected patterns

---

## Part 1: Database Schema (Prisma-Managed)

**Rev 7: Prisma owns ALL schema changes. No manual SQL DDL.**

### 1.1 Prisma Schema

```prisma
model Provider {
  id                        String    @id @default(cuid())
  userId                    String?   @unique
  
  // Rev 7 CRITICAL: Must add @unique constraint for authoritative Provider resolution
  stripeCustomerId          String?   @unique
  stripeAccountId           String?
  
  // Webhook event ordering baseline
  lastWebhookEventTimestamp Int?
  lastWebhookEventId        String?
  
  // ... other fields
  
  subscriptions             Subscription[]
  
  @@index([stripeCustomerId])
}

model Subscription {
  id                       String   @id @default(cuid())
  providerId               String
  
  // INV-1: Immutable historical identity (active subscriptions)
  // NULL for archived duplicate records from migration
  stripeSubscriptionId     String?  @unique
  
  status                   SubscriptionStatus
  retentionState           RetentionState  @default(ACTIVE)
  
  // Webhook event ordering baseline (INV-5)
  lastWebhookEventId       String?
  lastWebhookEventTimestamp Int?    // Unix timestamp
  
  currentPeriodStart       DateTime?
  currentPeriodEnd         DateTime?
  cancelAt                 DateTime?
  canceledAt               DateTime?
  
  metadata                 Json?    // Archived duplicates: originalStripeSubscriptionId stored here
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  
  provider                 Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  
  @@index([providerId])
  @@index([status])
  @@index([lastWebhookEventTimestamp])
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum RetentionState {
  ACTIVE      // Normal operational state
  ARCHIVED    // Soft-deleted/superseded, historical identity in metadata
  PURGED      // Hard-deleted, cannot be restored
}

model WebhookEvent {
  id              String   @id @default(cuid())
  
  // Atomic idempotency (INV-4)
  idempotencyKey  String   @unique
  
  stripeEventId   String
  eventType       String
  processed       Boolean  @default(false)
  skipReason      String?
  metadata        Json?
  createdAt       DateTime @default(now())
  
  @@index([stripeEventId])
  @@index([eventType, createdAt])
}
```

### 1.2 Migration Strategy

**Step 1: Add Provider.stripeCustomerId Uniqueness (REQUIRED)**

Currently `Provider.stripeCustomerId` is NOT unique in the schema. This must be corrected before implementation.

```bash
# Update schema.prisma to add @unique
# Then generate migration:
npx prisma migrate dev --name add-provider-stripe-customer-unique

# Prisma will generate:
# CREATE UNIQUE INDEX "Provider_stripeCustomerId_key" ON "Provider"("stripeCustomerId");
```

**Pre-Migration Check:**
```sql
-- Verify no duplicate stripeCustomerId values exist
SELECT "stripeCustomerId", COUNT(*) as count
FROM "Provider"
WHERE "stripeCustomerId" IS NOT NULL
GROUP BY "stripeCustomerId"
HAVING COUNT(*) > 1;
-- Must return 0 rows
```

**Step 2: Pre-Clean Duplicate Subscription.stripeSubscriptionId (if any)**

See Part 5 for complete duplicate resolution procedure.

**Step 3: Apply Prisma Migration**

```bash
# Generate migration for all schema changes
npx prisma migrate dev --name sub-06-a-remediation

# Prisma generates:
# - Provider.stripeCustomerId unique constraint
# - Subscription.stripeSubscriptionId unique constraint  
# - WebhookEvent.idempotencyKey unique constraint
# - Required indexes
# - Enum types
```

### 1.3 Schema Verification

After migration, verify constraints:

```sql
-- Verify Provider.stripeCustomerId uniqueness
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Provider' 
  AND indexname = 'Provider_stripeCustomerId_key';
-- Must return 1 row (unique index exists)

-- Verify Subscription.stripeSubscriptionId uniqueness
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Subscription' 
  AND indexname = 'Subscription_stripeSubscriptionId_key';
-- Must return 1 row (unique index exists)

-- Verify WebhookEvent.idempotencyKey uniqueness
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'WebhookEvent' 
  AND indexname = 'WebhookEvent_idempotencyKey_key';
-- Must return 1 row (unique index exists)
```

---

## Part 2: Atomic Idempotency with Serialization Failure Handling

### 2.1 Race-Safe Idempotency Claim (Rev 7 CRITICAL)

**Pattern:** `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`

**Concurrency Guarantee:** Winner and loser determined atomically. Both transactions receive consistent row via RETURNING clause.

**Serialization Failures:** SERIALIZABLE isolation can still produce 40001/P2034. These are handled by whole-transaction retry (see Section 2.3).

```typescript
/**
 * Atomically claim idempotency using INSERT ... ON CONFLICT DO UPDATE RETURNING.
 * 
 * Rev 7: Race-safe under SERIALIZABLE isolation. Serialization failures (40001/P2034)
 * are handled by whole-transaction retry mechanism.
 * 
 * Concurrency Semantics:
 * - Winner: First transaction to claim, receives newly inserted row (id === newEventId)
 * - Loser: Concurrent transaction, receives existing row via UPDATE + RETURNING
 * - Both transactions see consistent state via RETURNING clause
 * 
 * @returns 
 * - { claimed: true, eventId } if winner (proceed with processing)
 * - { claimed: false, reason, existingEvent } if loser (exit, duplicate detected)
 */
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
  
  // Use raw SQL for INSERT ... ON CONFLICT DO UPDATE RETURNING
  // Prisma's upsert doesn't provide the exact atomic semantics needed
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
      -- Dummy update to force RETURNING of existing row
      -- (processed field unchanged, just triggers RETURNING mechanism)
      processed = "WebhookEvent".processed
    RETURNING *
  `;
  
  if (!result || result.length === 0) {
    throw new Error(`Idempotency claim returned no row: ${idempotencyKey}`);
  }
  
  const returnedRow = result[0];
  
  // Determine winner vs loser by comparing IDs
  // Winner: returnedRow.id === newEventId (our INSERT succeeded)
  // Loser: returnedRow.id !== newEventId (conflict detected, got existing row)
  const isWinner = returnedRow.id === newEventId;
  
  if (isWinner) {
    // This transaction won the idempotency race
    // returnedRow is our newly inserted row (processed=false)
    logger.info(`Idempotency claimed: ${idempotencyKey}`, {
      eventId: returnedRow.id,
      stripeEventId
    });
    
    return { 
      claimed: true, 
      eventId: returnedRow.id 
    };
  }
  
  // This transaction lost the race
  // returnedRow is the existing row from competing transaction
  
  if (returnedRow.processed) {
    // Already successfully completed by another transaction
    logger.info(`Idempotency duplicate (completed): ${idempotencyKey}`, {
      existingEventId: returnedRow.id,
      processedAt: returnedRow.metadata?.completedAt
    });
    
    return { 
      claimed: false, 
      reason: 'already-completed',
      existingEvent: returnedRow
    };
  }
  
  // Still processing (processed=false)
  // Another transaction currently owns this event
  logger.warn(`Idempotency duplicate (concurrent): ${idempotencyKey}`, {
    existingEventId: returnedRow.id,
    createdAt: returnedRow.createdAt
  });
  
  return { 
    claimed: false, 
    reason: 'concurrent-processing',
    existingEvent: returnedRow
  };
}

/**
 * Mark idempotency as completed.
 * Called at END of transaction after successful mutation.
 */
async function markIdempotencyProcessed(
  tx: PrismaTransaction,
  eventId: string,
  result: { allowed: boolean; reason: string }
): Promise<void> {
  await tx.webhookEvent.update({
    where: { id: eventId },
    data: {
      processed: true,
      skipReason: result.allowed ? null : result.reason,
      metadata: { 
        completedAt: Date.now(),
        policyDecision: result
      }
    }
  });
}
```

### 2.2 Concurrency Behavior

**Timeline Example:**

```
Time  Transaction A                    Transaction B
----  -------------------------------- --------------------------------
T0    BEGIN SERIALIZABLE              
T1    claimIdempotency()               
      → INSERT ... VALUES (id='A')     
      → No conflict                    
      → RETURNING row(id='A')          
      → Winner (claimed=true)          
T2                                     BEGIN SERIALIZABLE
T3                                     claimIdempotency()
                                       → INSERT ... VALUES (id='B')
                                       → Conflict detected
                                       → DO UPDATE processed=processed
                                       → RETURNING row(id='A') [existing]
                                       → Loser (claimed=false)
T4    Process subscription mutation    
T5    markIdempotencyProcessed()       Exit (no mutation)
      → UPDATE processed=true          
T6    COMMIT                           COMMIT (or rollback)
```

### 2.3 Serialization Failure Handling (Rev 7 CRITICAL)

**Important:** `INSERT ... ON CONFLICT DO UPDATE RETURNING` provides atomic winner/loser resolution, but SERIALIZABLE isolation can still produce serialization failures.

**PostgreSQL Error Codes:**
- `40001` - serialization_failure
- `40P01` - deadlock_detected

**Prisma Error Codes:**
- `P2034` - Transaction failed due to write conflict or deadlock

**Handling Strategy:**

Serialization failures trigger **whole-transaction retry**. The idempotency claim, along with all subsequent operations, must be retried as a complete unit.

```typescript
/**
 * Wrapper for SERIALIZABLE transactions with automatic retry on serialization failures.
 * 
 * Rev 7: Handles 40001/P2034 by retrying the ENTIRE transaction.
 */
async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 100;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      // Check for serialization failure
      const isSerializationFailure = 
        error.code === '40001' ||  // PostgreSQL serialization_failure
        error.code === '40P01' ||  // PostgreSQL deadlock_detected
        error.code === 'P2034';    // Prisma write conflict/deadlock
      
      if (!isSerializationFailure || attempt === maxRetries) {
        // Not a serialization failure, or max retries exhausted
        throw error;
      }
      
      // Log and retry with exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      logger.warn(`Serialization failure (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms`, {
        error: error.message,
        code: error.code
      });
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error('Max retries exhausted (should not reach here)');
}
```

**Usage in Webhook Handler:**

```typescript
export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<Response> {
  
  const idempotencyKey = `stripe:${event.id}`;
  
  try {
    // Entire webhook processing wrapped in serializable retry
    await withSerializableRetry(async () => {
      await prisma.$transaction(async (tx) => {
        
        // Step 1: Claim idempotency (atomic winner/loser)
        const claimResult = await claimIdempotency(
          tx,
          idempotencyKey,
          event.type,
          event.id
        );
        
        if (!claimResult.claimed) {
          // Duplicate detected, exit gracefully
          return;
        }
        
        // Step 2: Process subscription state transition
        // (Provider resolution, locking, policy, mutation)
        const mutationResult = await processSubscriptionEvent(tx, event);
        
        // Step 3: Mark idempotency complete
        await markIdempotencyProcessed(
          tx,
          claimResult.eventId,
          mutationResult
        );
        
      }, {
        isolationLevel: 'Serializable',
        timeout: 30000
      });
    });
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200
    });
    
  } catch (error: any) {
    logger.error('Webhook processing failed', {
      eventId: event.id,
      error: error.message
    });
    
    // Return 500 to trigger Stripe retry
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500
    });
  }
}
```

### 2.4 Key Properties

✅ **Atomic winner/loser resolution** - `ON CONFLICT DO UPDATE RETURNING` determines claim ownership atomically

✅ **No stale reads** - Both winner and loser receive consistent row state via RETURNING

✅ **Serialization-safe** - 40001/P2034 failures handled by whole-transaction retry

✅ **Duplicate-safe** - Loser exits before any subscription mutation occurs

✅ **Simple state model** - ABSENT → CLAIMED (winner only) → COMPLETED

✅ **No orphan recovery needed** - Transaction atomicity eliminates persistent unclaimed records

---

## Part 3: Provider Resolution with Verified Uniqueness

### 3.1 Trust Boundary (Rev 7 HIGH)

**DO NOT trust webhook metadata for providerId.**

Webhook events cannot be trusted to provide authoritative Provider association. The Provider must be resolved from Stripe's authoritative customer→provider mapping.

### 3.2 Provider Resolution Strategy

**Prerequisite:** `Provider.stripeCustomerId` must have UNIQUE constraint (see Part 1).

```typescript
/**
 * Resolve Provider from Stripe subscription ID.
 * 
 * Rev 7: Trust boundary explicitly documented.
 * Uses verified stripeCustomerId uniqueness for authoritative resolution.
 * 
 * Resolution Order:
 * 1. Existing Subscription association (if subscription already in DB)
 * 2. Stripe customer → Provider mapping via UNIQUE stripeCustomerId
 * 
 * @throws Error if Provider cannot be deterministically resolved
 */
/**
 * Step 1: Resolve Stripe Customer ID (OUTSIDE transaction, before locking).
 * 
 * This function performs Stripe API I/O to determine the customer identity
 * associated with a subscription. It MUST be called before entering the 
 * database transaction to avoid holding locks during network I/O.
 * 
 * @returns stripeCustomerId for Provider resolution
 * @throws Error if Stripe subscription cannot be retrieved
 */
async function resolveStripeCustomerId(
  stripeSubscriptionId: string
): Promise<string> {
  
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const stripeCustomerId = typeof stripeSub.customer === 'string' 
    ? stripeSub.customer 
    : stripeSub.customer.id;
  
  logger.info('Stripe customer ID resolved (pre-transaction)', {
    stripeSubscriptionId,
    stripeCustomerId
  });
  
  return stripeCustomerId;
}

/**
 * Step 2: Lock Provider and Subscription in universal order (INSIDE transaction).
 * 
 * Rev 7 Correction: LOCK → RE-READ → DECIDE → MUTATE
 * 
 * This function:
 * 1. Locks Provider by stripeCustomerId (universal lock order step 1)
 * 2. Re-reads locked Provider row
 * 3. Locks Subscription by stripeSubscriptionId (universal lock order step 2)
 * 4. Re-reads locked Subscription row (if exists)
 * 5. Returns post-lock authoritative state
 * 
 * ALL policy decisions MUST use the returned post-lock values.
 * 
 * @param stripeCustomerId - Resolved BEFORE transaction via resolveStripeCustomerId()
 * @param stripeSubscriptionId - Target subscription for locking
 * @returns Locked Provider and Subscription (null if subscription doesn't exist)
 * @throws Error if Provider not found or locking fails
 */
async function lockProviderAndSubscription(
  tx: PrismaTransaction,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<{ provider: Provider; subscription: Subscription | null }> {
  
  // ═══════════════════════════════════════════════════════════════
  // Step 1: Lock Provider (universal lock order: Provider FIRST)
  // ═══════════════════════════════════════════════════════════════
  
  await tx.$executeRaw`
    SELECT * FROM "Provider" 
    WHERE "stripeCustomerId" = ${stripeCustomerId}
    FOR UPDATE
  `;
  
  // Step 2: Re-read locked Provider row (authoritative post-lock state)
  const lockedProvider = await tx.provider.findUnique({
    where: { stripeCustomerId }
  });
  
  if (!lockedProvider) {
    throw new Error(
      `No Provider found for Stripe customer: ${stripeCustomerId}. ` +
      `Subscription: ${stripeSubscriptionId}`
    );
  }
  
  logger.info('Provider locked', {
    providerId: lockedProvider.id,
    stripeCustomerId
  });
  
  // ═══════════════════════════════════════════════════════════════
  // Step 3: Lock Subscription (universal lock order: Subscription SECOND)
  // ═══════════════════════════════════════════════════════════════
  
  // First, check if subscription exists
  const subscriptionExists = await tx.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: { id: true }
  });
  
  let lockedSubscription: Subscription | null = null;
  
  if (subscriptionExists) {
    // Lock existing subscription
    await tx.$executeRaw`
      SELECT * FROM "Subscription" 
      WHERE "stripeSubscriptionId" = ${stripeSubscriptionId}
      FOR UPDATE
    `;
    
    // Step 4: Re-read locked Subscription row (authoritative post-lock state)
    lockedSubscription = await tx.subscription.findUniqueOrThrow({
      where: { stripeSubscriptionId }
    });
    
    logger.info('Subscription locked', {
      subscriptionId: lockedSubscription.id,
      stripeSubscriptionId
    });
  } else {
    logger.info('No existing subscription to lock (will be created)', {
      stripeSubscriptionId
    });
  }
  
  // Return authoritative post-lock state
  return { 
    provider: lockedProvider, 
    subscription: lockedSubscription 
  };
}
```

### 3.3 Uniqueness Verification

**Schema Requirement:**

```prisma
model Provider {
  stripeCustomerId String? @unique  // ← REQUIRED
}
```

**Runtime Verification:**

Before deployment, verify the uniqueness constraint exists:

```sql
-- Verify Provider.stripeCustomerId unique constraint
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'Provider'::regclass
  AND conname LIKE '%stripeCustomerId%';

-- Expected result: unique constraint exists
-- Example: Provider_stripeCustomerId_key | u | UNIQUE (stripeCustomerId)
```

**Pre-Deployment Data Check:**

```sql
-- Verify no duplicate stripeCustomerId values
SELECT "stripeCustomerId", COUNT(*) as count
FROM "Provider"
WHERE "stripeCustomerId" IS NOT NULL
GROUP BY "stripeCustomerId"
HAVING COUNT(*) > 1;

-- Must return 0 rows
```

###3.4 Universal Lock Order (INV-4)

**Provider → Subscription lock order enforced for ALL subscription state writers.**

**Complete Writer Inventory (from accepted discovery document SUB-06-A_DISCOVERY.md):**

1. **handleSubscriptionUpdate()** - Webhooks: `customer.subscription.created`, `customer.subscription.updated`
2. **handleSubscriptionCancelled()** - Webhook: `customer.subscription.deleted`
3. **handleInvoicePaymentSucceeded()** - Webhook: `invoice.payment_succeeded`
4. **handleInvoicePaymentFailed()** - Webhook: `invoice.payment_failed`
5. **Trial Expiry Cron** - Endpoint: `/api/cron/check-trial-expiry`
6. **Manual Subscription Sync** - Endpoint: `/api/instructor/subscription/sync`
7. **Registration / Checkout** - Initial TRIAL state creation (not subject to ordering issues per discovery)

**Writers 1-6 mutate existing subscription state** and MUST enforce universal lock order.

**Writer 7 (initial creation)** is NOT subject to ordering/locking requirements as it creates new subscription rows.

### 3.5 Identity Validation (INV-6)

After locking, verify exact identity match:

```typescript
/**
 * Validate subscription identity before policy decisions.
 * Rev 7: Exact match required between locked Subscription and incoming event.
 */
function validateSubscriptionIdentity(
  lockedSubscription: Subscription | null,
  incomingStripeSubscriptionId: string
): { valid: boolean; reason?: string } {
  
  if (!lockedSubscription) {
    // New subscription (no existing row), identity implicitly valid
    return { valid: true };
  }
  
  // Verify exact match
  if (lockedSubscription.stripeSubscriptionId !== incomingStripeSubscriptionId) {
    return {
      valid: false,
      reason: 'subscription-id-mismatch'
    };
  }
  
  return { valid: true };
}
```

### 3.6 Complete Transaction Flow

**CRITICAL: Transaction Architecture**

All Stripe API I/O MUST occur BEFORE entering the database transaction:

```
1. Stripe API: Resolve stripeCustomerId (via resolveStripeCustomerId())
2. BEGIN SERIALIZABLE
3. Lock Provider (using stripeCustomerId from step 1)
4. Lock Subscription
5. Re-read locked rows
6. Policy decisions (using post-lock state)
7. Conditional mutation
8. Audit
9. COMMIT
```

The following `processSubscriptionEvent` function assumes `stripeCustomerId` is already resolved externally and passed into the transaction.

```typescript
/**
 * Process subscription webhook event.
 * Rev 7 Correction: stripeCustomerId MUST be resolved BEFORE calling this function.
 * 
 * Call pattern:
 *   const stripeCustomerId = await resolveStripeCustomerId(stripeSubscriptionId);
 *   await prisma.$transaction(async (tx) => {
 *     return processSubscriptionEvent(tx, event, stripeCustomerId);
 *   }, { isolationLevel: 'Serializable' });
 */
async function processSubscriptionEvent(
  tx: PrismaTransaction,
  event: Stripe.Event,
  stripeCustomerId: string  // ← Resolved BEFORE transaction
): Promise<{ allowed: boolean; reason: string }> {
  
  const subscription = event.data.object as Stripe.Subscription;
  const stripeSubscriptionId = subscription.id;
  
  // Step 1: Lock Provider and Subscription (universal order)
  //         Uses pre-resolved stripeCustomerId (no Stripe API I/O inside transaction)
  const { provider, subscription: lockedSubscription } = 
    await lockProviderAndSubscription(tx, stripeCustomerId, stripeSubscriptionId);
  
  // Step 2: Validate identity (using post-lock authoritative state)
  const identityCheck = validateSubscriptionIdentity(
    lockedSubscription,
    stripeSubscriptionId
  );
  
  if (!identityCheck.valid) {
    logger.error('Subscription identity mismatch', {
      lockedId: lockedSubscription?.stripeSubscriptionId,
      incomingId: stripeSubscriptionId,
      reason: identityCheck.reason
    });
    
    return {
      allowed: false,
      reason: identityCheck.reason!
    };
  }
  
  // Step 3: Policy decision (using post-lock state: lockedSubscription)
  const policyResult = await canTransitionSubscriptionState(
    event,
    lockedSubscription  // ← Post-lock authoritative state
  );
  
  if (!policyResult.allowed) {
    logger.info('Event rejected by policy', {
      stripeSubscriptionId,
      reason: policyResult.reason
    });
    
    return policyResult;
  }
  
  // Step 4: Conditional mutation
  if (lockedSubscription) {
    // Update existing subscription
    await tx.subscription.update({
      where: { id: lockedSubscription.id },
      data: {
        status: mapStripeStatus(subscription.status),
        lastWebhookEventId: event.id,
        lastWebhookEventTimestamp: event.created,
        // ... other fields
      }
    });
  } else {
    // Create new subscription
    await tx.subscription.create({
      data: {
        providerId: provider.id,
        stripeSubscriptionId: subscription.id,
        status: mapStripeStatus(subscription.status),
        lastWebhookEventId: event.id,
        lastWebhookEventTimestamp: event.created,
        // ... other fields
      }
    });
  }
  
  // Step 5: Audit
  await tx.auditLog.create({
    data: {
      action: 'subscription.webhook.processed',
      actorId: 'system',
      actorRole: 'SYSTEM',
      targetType: 'Subscription',
      targetId: lockedSubscription?.id ?? 'new',
      metadata: {
        stripeEventId: event.id,
        stripeSubscriptionId,
        providerId: provider.id
      }
    }
  });
  
  return { allowed: true, reason: 'processed' };
}
```

---

## Part 4: Manual Synchronization (INV-7)

### 4.1 Architecture (Rev 7 HIGH)

**Manual sync must follow atomic transaction architecture:**

```
Stripe baseline (outside transaction)
        ↓
BEGIN SERIALIZABLE
        ↓
Resolve Provider (inside transaction)
        ↓
Lock Provider FOR UPDATE
        ↓
Lock Subscription FOR UPDATE
        ↓
Re-read fresh DB state
        ↓
Policy decision (compare Stripe vs DB)
        ↓
Conditional mutation
        ↓
COMMIT

On 40001/P2034: retry entire transaction
```

**Key Principle:** Stripe API calls occur BEFORE transaction to avoid holding database locks during network I/O. Security decision is made against freshly locked DB state INSIDE transaction.

### 4.2 Implementation

```typescript
/**
 * Manual synchronization with Stripe subscription state.
 * 
 * Rev 7 Correction: ALL Stripe API I/O occurs BEFORE transaction.
 * 
 * Architecture:
 * 1. Stripe API: Retrieve subscription + resolve stripeCustomerId + fetch event baseline
 * 2. BEGIN SERIALIZABLE
 * 3. Lock Provider + Subscription (universal order)
 * 4. Re-read locked state
 * 5. Policy decision
 * 6. Conditional mutation
 * 7. COMMIT
 */
async function manualSyncSubscription(
  stripeSubscriptionId: string
): Promise<{ synced: boolean; reason: string; action?: string }> {
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: Fetch Stripe Baseline (OUTSIDE transaction, no DB locks held)
  // ═══════════════════════════════════════════════════════════════
  
  // Step 1a: Fetch current Stripe subscription object
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  
  // Step 1b: Resolve Stripe customer ID (for Provider resolution)
  const stripeCustomerId = typeof stripeSub.customer === 'string' 
    ? stripeSub.customer 
    : stripeSub.customer.id;
  
  // Step 1c: Fetch relevant event history
  const eventBaseline = await fetchRelevantEventHistory(stripeSubscriptionId);
  
  if (!eventBaseline.success) {
    return {
      synced: false,
      reason: eventBaseline.reason,
      action: 'insufficient-history'
    };
  }
  
  const mostRecentEventTimestamp = eventBaseline.mostRecentTimestamp;
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: Transaction with Fresh DB State (INSIDE transaction)
  // ═══════════════════════════════════════════════════════════════
  
  const result = await withSerializableRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      
      // Step 2: Lock Provider and Subscription (universal order, using pre-resolved stripeCustomerId)
      const { provider, subscription: lockedSubscription } = 
        await lockProviderAndSubscription(tx, stripeCustomerId, stripeSubscriptionId);
      
      // Step 3: Policy decision (compare Stripe baseline vs locked DB state)
      if (lockedSubscription) {
        // Existing subscription - check if DB is current
        const dbTimestamp = lockedSubscription.lastWebhookEventTimestamp || 0;
        
        if (dbTimestamp > mostRecentEventTimestamp) {
          // DB is ahead of Stripe event baseline - DB is authoritative
          return {
            synced: false,
            reason: 'db-ahead',
            dbTimestamp,
            stripeTimestamp: mostRecentEventTimestamp
          };
        }
        
        if (dbTimestamp === mostRecentEventTimestamp) {
          // Equal timestamps - cannot determine authority from event.created alone
          // Apply convergence policy: trust Stripe current object as authority
          logger.info('Manual sync: equal timestamp - applying Stripe authority', {
            timestamp: dbTimestamp,
            stripeSubscriptionId
          });
          // Continue to synchronization below
        }
        
        // dbTimestamp < mostRecentEventTimestamp OR equal-timestamp convergence
        // Proceed with synchronization
        
        // Step 4: Reconcile from Stripe
        await tx.subscription.update({
          where: { id: lockedSubscription.id },
          data: {
            status: mapStripeStatus(stripeSub.status),
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            cancelAt: stripeSub.cancel_at ? 
              new Date(stripeSub.cancel_at * 1000) : null,
            canceledAt: stripeSub.canceled_at ? 
              new Date(stripeSub.canceled_at * 1000) : null,
            lastWebhookEventTimestamp: mostRecentEventTimestamp,
            lastWebhookEventId: eventBaseline.mostRecentEventId,
            updatedAt: new Date()
          }
        });
        
        await tx.auditLog.create({
          data: {
            action: 'subscription.manual-sync.reconciled',
            actorId: 'system',
            actorRole: 'SYSTEM',
            targetType: 'Subscription',
            targetId: lockedSubscription.id,
            metadata: {
              stripeSubscriptionId,
              previousTimestamp: dbTimestamp,
              newTimestamp: mostRecentEventTimestamp
            }
          }
        });
        
        return {
          synced: true,
          reason: 'reconciled-from-stripe',
          action: 'updated'
        };
        
      } else {
        // New subscription - create
        await tx.subscription.create({
          data: {
            providerId: provider.id,
            stripeSubscriptionId: stripeSub.id,
            status: mapStripeStatus(stripeSub.status),
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            cancelAt: stripeSub.cancel_at ? 
              new Date(stripeSub.cancel_at * 1000) : null,
            canceledAt: stripeSub.canceled_at ? 
              new Date(stripeSub.canceled_at * 1000) : null,
            lastWebhookEventTimestamp: mostRecentEventTimestamp,
            lastWebhookEventId: eventBaseline.mostRecentEventId,
            // ... other fields from stripeSub
          }
        });
        
        await tx.auditLog.create({
          data: {
            action: 'subscription.manual-sync.created',
            actorId: 'system',
            actorRole: 'SYSTEM',
            targetType: 'Subscription',
            targetId: stripeSubscriptionId,
            metadata: {
              stripeSubscriptionId,
              providerId: provider.id,
              initialTimestamp: mostRecentEventTimestamp
            }
          }
        });
        
        return {
          synced: true,
          reason: 'created-from-stripe',
          action: 'created'
        };
      }
      
    }, {
      isolationLevel: 'Serializable',
      timeout: 30000
    });
  });
  
  return result;
}
```

### 4.3 Event History Baseline (Stripe SDK v20)

**Rev 7: Deterministic pagination with exhaustion handling.**

```typescript
/**
 * Fetch relevant event history for subscription.
 * 
 * Rev 7: Uses Stripe SDK (^20.3.1 declared) syntax.
 * Deterministic pagination until relevant boundary or history exhausted.
 * Acknowledges 30-day Stripe event retention limit.
 */
async function fetchRelevantEventHistory(
  stripeSubscriptionId: string
): Promise<
  | { success: true; mostRecentTimestamp: number; mostRecentEventId: string }
  | { success: false; reason: string }
> {
  
  const STRIPE_EVENT_RETENTION_DAYS = 30;
  const oldestReliableTimestamp = Math.floor(Date.now() / 1000) - (STRIPE_EVENT_RETENTION_DAYS * 86400);
  
  const relevantEvents: Stripe.Event[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;
  
  // Paginate through Stripe events
  while (hasMore && relevantEvents.length < 100) {  // Safety limit: 100 events
    
    // Stripe SDK v20: use 'type' parameter (singular)
    const response = await stripe.events.list({
      type: 'customer.subscription.*',
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter })
    });
    
    // Filter for this specific subscription
    const pageRelevant = response.data.filter(event => {
      const sub = event.data.object as any;
      return sub.id === stripeSubscriptionId;
    });
    
    relevantEvents.push(...pageRelevant);
    
    // Check if we've found recent enough events
    if (pageRelevant.length > 0) {
      const oldestInPage = Math.min(...pageRelevant.map(e => e.created));
      
      // If oldest event in this page is within reliable history, we're done
      if (oldestInPage >= oldestReliableTimestamp) {
        break;
      }
    }
    
    hasMore = response.has_more;
    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }
  
  if (relevantEvents.length === 0) {
    // No event history available - must reconcile from subscription object only
    logger.warn('No event history found for subscription', {
      stripeSubscriptionId
    });
    
    return {
      success: false,
      reason: 'no-event-history'
    };
  }
  
  // Sort by timestamp descending (most recent first)
  // NOTE: This sort uses event.created which has second precision.
  // If multiple events share the same timestamp, their relative order is undefined.
  // This baseline provides timestamp + event ID for watermark tracking, NOT total chronological ordering.
  relevantEvents.sort((a, b) => b.created - a.created);
  
  const mostRecent = relevantEvents[0];
  
  // Check if history is sufficient
  if (mostRecent.created < oldestReliableTimestamp) {
    // Most recent event is older than 30-day retention window
    // History is insufficient for reliable ordering
    logger.warn('Event history insufficient (beyond retention window)', {
      stripeSubscriptionId,
      mostRecentTimestamp: mostRecent.created,
      retentionBoundary: oldestReliableTimestamp
    });
    
    return {
      success: false,
      reason: 'insufficient-history-beyond-retention'
    };
  }
  
  // Return baseline watermark (timestamp + event ID)
  // This is used for stale-event comparison, not as definitive chronological authority
  return {
    success: true,
    mostRecentTimestamp: mostRecent.created,
    mostRecentEventId: mostRecent.id
  };
}
```

### 4.4 Key Properties

✅ **Stripe baseline outside transaction** - No DB locks held during network I/O

✅ **Provider resolution inside transaction** - Trust boundary maintained

✅ **Universal lock order** - Provider → Subscription (consistent with webhooks)

✅ **Fresh DB state** - Decision made against locked current state

✅ **Deterministic pagination** - Exhaustion and retention limits handled

✅ **Insufficient history acknowledged** - No invented watermarks for unknown history

✅ **Serialization failure safe** - Whole-transaction retry on 40001/P2034

✅ **Event history baseline is NOT total chronological ordering** - Second-precision limitation explicitly acknowledged

### 4.5 Event History Baseline Semantics (CRITICAL)

**What Event History Provides:**

- **Maximum `event.created` timestamp** observed in relevant event set
- **Event ID** associated with that maximum timestamp (for idempotency tracking)

**What Event History Does NOT Provide:**

- Total chronological ordering of events
- Deterministic "latest event" when multiple events share the same `event.created` value

**Second-Precision Limitation:**

When multiple relevant events have identical `event.created` timestamps:
- The sort order between those events is undefined
- The selected `mostRecent` event is ONE OF the events with maximum timestamp, not necessarily THE chronologically latest
- This is acceptable because the baseline is used for watermark comparison (`>`, `<`, `=`), not as chronological authority

**Test Requirement:**

Manual-sync test suite MUST include scenario with multiple relevant events having identical `event.created` values to verify the implementation correctly handles equal-second ambiguity.

**Example Test Case:**
```typescript
// Two subscription events with same timestamp
const event1 = { id: 'evt_A', created: 1000, type: 'customer.subscription.updated' };
const event2 = { id: 'evt_B', created: 1000, type: 'customer.subscription.cancelled' };

// Baseline selection may return either evt_A or evt_B as mostRecent
// Implementation must use mostRecent.created (1000) for watermark comparison
// Implementation must NOT assume evt_A or evt_B is chronologically authoritative
```

---

## Part 5: Pre-Migration Duplicate Resolution (INV-1, INV-8)

### 5.1 Business-Safe Canonical Selection (Rev 7 HIGH)

**Problem:** Selecting canonical subscription by `createdAt DESC` alone can break Provider relationships.

**Example:**
```
Row A: older, ACTIVE, providerId=123 (Provider.stripeSubscriptionId points here)
Row B: newer, CANCELLED, providerId=123

Naive selection: Keep B (newest) → Provider loses active subscription pointer
```

**Rev 7 Solution: Deterministic business-safe selection**

**Provider-Primary Selection:**

The algorithm gives PRIMARY priority to the Provider relationship: the Subscription row that is actively referenced by its Provider (`Provider.id = Subscription.providerId AND Provider.stripeSubscriptionId = Subscription.stripeSubscriptionId`) is preferred as canonical.

**Important:** Provider relationship is a preference, not a uniqueness guarantee. If multiple duplicate rows satisfy the Provider relationship (which should not occur in correct operation but must be handled deterministically), the algorithm continues to secondary tie-breakers (status priority, updatedAt, createdAt, ID) to ensure exactly one canonical row is selected.

**Secondary Tie-Breakers:**
- Active lifecycle status (ACTIVE > TRIAL > PAST_DUE > CANCELLED > EXPIRED)
- Most recent updatedAt
- Most recent createdAt  
- Stable Subscription.id (lexicographic)

### 5.2 Canonical Selection Algorithm

```sql
-- ════════════════════════════════════════════════════════════════
-- Pre-Migration: Resolve Duplicate Subscription.stripeSubscriptionId
-- ════════════════════════════════════════════════════════════════

-- Step 1: Identify duplicates
SELECT "stripeSubscriptionId", COUNT(*) as duplicate_count
FROM "Subscription"
WHERE "stripeSubscriptionId" IS NOT NULL
GROUP BY "stripeSubscriptionId"
HAVING COUNT(*) > 1;

-- If duplicates exist, proceed with business-safe canonical selection

-- Step 2: Select canonical row with business-safe priority
-- Priority order (highest to lowest):
-- 1. PRIMARY: Row is actively referenced by its Provider 
--    (Provider.stripeSubscriptionId = Subscription.stripeSubscriptionId 
--     AND Provider.id = Subscription.providerId)
--    → Preserves current business relationship, ensures Provider continuity
-- 2. Active lifecycle status (ACTIVE > TRIAL > PAST_DUE > CANCELLED > EXPIRED)
-- 3. Most recent updatedAt
-- 4. Most recent createdAt
-- 5. Stable Subscription.id tie-breaker (lexicographic)

WITH status_priority AS (
  -- Assign numeric priority to subscription statuses
  SELECT 
    id,
    "stripeSubscriptionId",
    providerId,
    status,
    "updatedAt",
    "createdAt",
    CASE status
      WHEN 'ACTIVE' THEN 1
      WHEN 'TRIAL' THEN 2
      WHEN 'PAST_DUE' THEN 3
      WHEN 'CANCELLED' THEN 4
      WHEN 'EXPIRED' THEN 5
      ELSE 99
    END as status_priority
  FROM "Subscription"
  WHERE "stripeSubscriptionId" IS NOT NULL
),
canonical_selection AS (
  SELECT
    s.id,
    s."stripeSubscriptionId",
    s.providerId,
    s.status,
    -- Canonical flag based on business-safe priority
    ROW_NUMBER() OVER (
      PARTITION BY s."stripeSubscriptionId"
      ORDER BY
        -- Priority 1: Row-level Provider ownership
        -- (Provider.id matches this Subscription.providerId AND
        --  Provider.stripeSubscriptionId matches this stripeSubscriptionId)
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM "Provider" p
            WHERE p.id = s.providerId
              AND p."stripeSubscriptionId" = s."stripeSubscriptionId"
          ) THEN 1 
          ELSE 0 
        END DESC,
        -- Priority 2: Active lifecycle status (lower number = higher priority)
        s.status_priority ASC,
        -- Priority 3: Most recent update
        s."updatedAt" DESC,
        -- Priority 4: Most recent creation
        s."createdAt" DESC,
        -- Priority 5: Stable ID tie-breaker
        s.id ASC
    ) as row_rank
  FROM status_priority s
)
SELECT
  id,
  "stripeSubscriptionId",
  providerId,
  status,
  CASE WHEN row_rank = 1 THEN 'CANONICAL' ELSE 'DUPLICATE' END as classification
FROM canonical_selection
WHERE "stripeSubscriptionId" IN (
  SELECT "stripeSubscriptionId"
  FROM "Subscription"
  WHERE "stripeSubscriptionId" IS NOT NULL
  GROUP BY "stripeSubscriptionId"
  HAVING COUNT(*) > 1
)
ORDER BY "stripeSubscriptionId", row_rank;

-- Review canonical selections before proceeding
-- Verify that active Provider relationships are preserved
```

### 5.3 Archive Duplicates with Historical Identity Preservation

```sql
-- Step 3: Archive duplicate rows (non-canonical)
-- Rev 7: Actually NULL the stripeSubscriptionId (not just mark in metadata)

WITH status_priority AS (
  SELECT 
    id,
    "stripeSubscriptionId",
    providerId,
    status,
    "updatedAt",
    "createdAt",
    CASE status
      WHEN 'ACTIVE' THEN 1
      WHEN 'TRIAL' THEN 2
      WHEN 'PAST_DUE' THEN 3
      WHEN 'CANCELLED' THEN 4
      WHEN 'EXPIRED' THEN 5
      ELSE 99
    END as status_priority
  FROM "Subscription"
  WHERE "stripeSubscriptionId" IS NOT NULL
),
canonical_selection AS (
  SELECT
    s.id,
    s."stripeSubscriptionId",
    ROW_NUMBER() OVER (
      PARTITION BY s."stripeSubscriptionId"
      ORDER BY
        -- Priority 1: Row-level Provider ownership
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM "Provider" p
            WHERE p.id = s.providerId
              AND p."stripeSubscriptionId" = s."stripeSubscriptionId"
          ) THEN 1 
          ELSE 0 
        END DESC,
        s.status_priority ASC,
        s."updatedAt" DESC,
        s."createdAt" DESC,
        s.id ASC
    ) as row_rank
  FROM status_priority s
),
duplicates_to_archive AS (
  SELECT id, "stripeSubscriptionId"
  FROM canonical_selection
  WHERE row_rank > 1  -- Non-canonical rows
)
UPDATE "Subscription"
SET 
  -- Rev 7: Actually NULL the duplicate stripeSubscriptionId
  -- This is what makes unique constraint creation succeed
  "stripeSubscriptionId" = NULL,
  
  -- Archive the row
  "retentionState" = 'ARCHIVED',
  
  -- Preserve historical identity in metadata (INV-1)
  -- Rev 7 CRITICAL FIX: Chain jsonb_set() calls to preserve all three fields
  metadata = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{originalStripeSubscriptionId}',
        to_jsonb(duplicates_to_archive."stripeSubscriptionId")
      ),
      '{archivedReason}',
      '"duplicate-stripe-id-migration"'::jsonb
    ),
    '{archivedAt}',
    to_jsonb(EXTRACT(EPOCH FROM NOW())::bigint)
  ),
  
  "updatedAt" = NOW()
FROM duplicates_to_archive
WHERE "Subscription".id = duplicates_to_archive.id;

-- Report on archived rows
SELECT 
  COUNT(*) as archived_count,
  array_agg(DISTINCT metadata->>'originalStripeSubscriptionId') as affected_stripe_ids
FROM "Subscription"
WHERE "retentionState" = 'ARCHIVED'
  AND metadata->>'archivedReason' = 'duplicate-stripe-id-migration';
```

**REQUIRED MIGRATION TEST: Metadata Preservation Verification**

This test MUST be executed immediately after the archival UPDATE to verify all three metadata fields are preserved simultaneously:

```sql
-- CRITICAL MIGRATION TEST: Verify all three metadata fields preserved together
-- This test proves the chained jsonb_set() does not overwrite previous assignments
DO $$
DECLARE
  test_count INTEGER;
  total_archived INTEGER;
BEGIN
  -- Count archived rows
  SELECT COUNT(*) INTO total_archived
  FROM "Subscription"
  WHERE "retentionState" = 'ARCHIVED'
    AND metadata->>'archivedReason' = 'duplicate-stripe-id-migration';
  
  -- Count rows missing ANY required metadata field
  SELECT COUNT(*) INTO test_count
  FROM "Subscription"
  WHERE "retentionState" = 'ARCHIVED'
    AND metadata->>'archivedReason' = 'duplicate-stripe-id-migration'
    AND (
      metadata->>'originalStripeSubscriptionId' IS NULL
      OR metadata->>'archivedReason' IS NULL
      OR metadata->>'archivedAt' IS NULL
    );
  
  IF test_count > 0 THEN
    RAISE EXCEPTION 'Migration metadata preservation test FAILED: %/% rows missing required metadata fields', 
      test_count, total_archived;
  END IF;
  
  RAISE NOTICE 'Migration metadata preservation test PASSED: All % archived rows have complete metadata (originalStripeSubscriptionId, archivedReason, archivedAt)', 
    total_archived;
END $$;
```

### 5.4 Verification

```sql
-- Step 4: Verify resolution complete

-- Check 1: No duplicate non-NULL stripeSubscriptionId values remain
SELECT "stripeSubscriptionId", COUNT(*) as count
FROM "Subscription"
WHERE "stripeSubscriptionId" IS NOT NULL
GROUP BY "stripeSubscriptionId"
HAVING COUNT(*) > 1;
-- MUST return 0 rows

-- Check 2: Provider pointers still valid
SELECT 
  p.id as provider_id,
  p."stripeSubscriptionId",
  s.id as subscription_id,
  s.status,
  s."retentionState"
FROM "Provider" p
LEFT JOIN "Subscription" s ON s."stripeSubscriptionId" = p."stripeSubscriptionId"
WHERE p."stripeSubscriptionId" IS NOT NULL
  AND (s.id IS NULL OR s."retentionState" != 'ACTIVE');
-- SHOULD return 0 rows (all Provider pointers point to ACTIVE subscriptions)

-- Check 3: Archived duplicates preserve historical identity
SELECT 
  id,
  "stripeSubscriptionId",  -- Should be NULL
  "retentionState",         -- Should be 'ARCHIVED'
  metadata->>'originalStripeSubscriptionId' as original_id,
  metadata->>'archivedReason' as reason
FROM "Subscription"
WHERE "retentionState" = 'ARCHIVED'
  AND metadata->>'archivedReason' = 'duplicate-stripe-id-migration'
LIMIT 10;
-- Verify originalStripeSubscriptionId is populated

-- Step 5: Safe to apply Prisma migration
-- npx prisma migrate deploy
```

### 5.5 INV-1 Semantics (Active vs Archived)

**Active Subscriptions (INV-1 - Active):**
```
stripeSubscriptionId: NOT NULL, UNIQUE, immutable
Historical identity: In stripeSubscriptionId field directly
Query: WHERE stripeSubscriptionId = 'sub_123'
```

**Archived Duplicates (INV-1 - Archived):**
```
stripeSubscriptionId: NULL (to satisfy unique constraint)
retentionState: 'ARCHIVED'
Historical identity: In metadata.originalStripeSubscriptionId (immutable)
Query: WHERE metadata->>'originalStripeSubscriptionId' = 'sub_123'
         AND retentionState = 'ARCHIVED'
```

**Both provide historical traceability. Active subscriptions use the database field; archived duplicates use metadata preservation.**

---

## Part 6: Stripe API Integration (Rev 7 MEDIUM)

### 6.1 Stripe SDK Version Declaration

**Repository:** `e:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook`

**Verified from package.json:**
```json
{
  "dependencies": {
    "stripe": "^20.3.1"
  }
}
```

**SDK Compatibility:** Stripe Node.js SDK declared as `^20.3.1` in package.json (allows v20.3.x and later v20 releases; exact resolved version not verified)

**API Breaking Changes (v12+):**
- Events list: `type` parameter (singular), not `types` (plural)
- Async iteration support for pagination
- TypeScript improvements

### 6.2 Event Listing Syntax (v20)

```typescript
// ✅ CORRECT (Stripe SDK v20)
const events = await stripe.events.list({
  type: 'customer.subscription.*',  // ← 'type' (singular)
  limit: 100
});

// ❌ INCORRECT (Stripe SDK v11 and earlier)
const events = await stripe.events.list({
  types: ['customer.subscription.*'],  // ← 'types' (plural, deprecated)
  limit: 100
});
```

### 6.3 Deterministic Event Pagination

**Requirements:**
1. Continue until relevant boundary established OR history exhausted
2. Acknowledge 30-day Stripe event retention limit
3. Handle insufficient history without inventing watermarks
4. Safety limit to prevent infinite loops

```typescript
/**
 * Paginate through Stripe events deterministically.
 * 
 * Rev 7: Exhaustion and insufficient-history handling.
 * Stops when:
 * - Relevant event boundary found within 30-day retention
 * - History exhausted (has_more=false)
 * - Safety limit reached (max 500 events inspected)
 */
async function paginateStripeEvents(
  subscriptionId: string,
  options: {
    maxEvents?: number;
    retentionDays?: number;
  } = {}
): Promise<{
  success: boolean;
  events: Stripe.Event[];
  reason?: string;
  historyComplete: boolean;
}> {
  
  const MAX_EVENTS = options.maxEvents ?? 500;
  const RETENTION_DAYS = options.retentionDays ?? 30;
  const retentionBoundaryTimestamp = Math.floor(Date.now() / 1000) - (RETENTION_DAYS * 86400);
  
  const relevantEvents: Stripe.Event[] = [];
  let totalInspected = 0;
  let hasMore = true;
  let startingAfter: string | undefined = undefined;
  let historyComplete = false;
  
  while (hasMore && totalInspected < MAX_EVENTS) {
    
    // Fetch page using Stripe SDK v20 syntax
    const response = await stripe.events.list({
      type: 'customer.subscription.*',  // v20: 'type' (singular)
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter })
    });
    
    totalInspected += response.data.length;
    
    // Filter for this specific subscription
    const pageRelevant = response.data.filter(event => {
      const sub = event.data.object as Stripe.Subscription;
      return sub.id === subscriptionId;
    });
    
    relevantEvents.push(...pageRelevant);
    
    // Determine if we've reached sufficient history depth
    if (response.data.length > 0) {
      const oldestEventInPage = Math.min(...response.data.map(e => e.created));
      
      // Check if we've gone back far enough
      if (oldestEventInPage <= retentionBoundaryTimestamp) {
        // Reached or exceeded retention boundary
        historyComplete = true;
        logger.info('Event pagination reached retention boundary', {
          subscriptionId,
          oldestTimestamp: oldestEventInPage,
          retentionBoundary: retentionBoundaryTimestamp,
          relevantEventsFound: relevantEvents.length
        });
        break;
      }
    }
    
    // Check pagination status
    hasMore = response.has_more;
    
    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    } else {
      // No more pages available
      historyComplete = !hasMore;
      break;
    }
  }
  
  // Safety limit check
  if (totalInspected >= MAX_EVENTS && hasMore) {
    logger.warn('Event pagination safety limit reached', {
      subscriptionId,
      totalInspected,
      maxEvents: MAX_EVENTS,
      relevantEventsFound: relevantEvents.length
    });
    
    return {
      success: false,
      events: relevantEvents,
      reason: 'safety-limit-reached',
      historyComplete: false
    };
  }
  
  // No relevant events found
  if (relevantEvents.length === 0) {
    return {
      success: false,
      events: [],
      reason: 'no-events-found',
      historyComplete
    };
  }
  
  // Sort by timestamp descending (most recent first)
  relevantEvents.sort((a, b) => b.created - a.created);
  
  return {
    success: true,
    events: relevantEvents,
    historyComplete
  };
}
```

### 6.4 Insufficient History Handling

**Scenario:** Most recent event is older than 30-day retention window.

```typescript
/**
 * Determine baseline from event history with insufficient-history detection.
 */
function determineEventBaseline(
  events: Stripe.Event[],
  stripeSub: Stripe.Subscription,
  historyComplete: boolean
): {
  success: boolean;
  mostRecentTimestamp?: number;
  mostRecentEventId?: string;
  reason?: string;
  needsReconciliation?: boolean;
} {
  
  if (events.length === 0) {
    // No event history available
    // Fall back to subscription object created timestamp
    return {
      success: true,
      mostRecentTimestamp: stripeSub.created,
      mostRecentEventId: `fallback:${stripeSub.id}`,
      reason: 'no-event-history-using-created',
      needsReconciliation: true
    };
  }
  
  const mostRecent = events[0];  // Already sorted descending
  const RETENTION_DAYS = 30;
  const retentionBoundary = Math.floor(Date.now() / 1000) - (RETENTION_DAYS * 86400);
  
  // Check if most recent event is within reliable history
  if (mostRecent.created < retentionBoundary) {
    // Event history is beyond 30-day retention
    // Cannot establish reliable ordering
    logger.warn('Event history insufficient (beyond retention)', {
      subscriptionId: stripeSub.id,
      mostRecentEventTimestamp: mostRecent.created,
      retentionBoundary,
      daysBeyond: Math.floor((retentionBoundary - mostRecent.created) / 86400)
    });
    
    return {
      success: false,
      reason: 'insufficient-history-beyond-retention',
      needsReconciliation: true
    };
  }
  
  // History is sufficient
  return {
    success: true,
    mostRecentTimestamp: mostRecent.created,
    mostRecentEventId: mostRecent.id,
    needsReconciliation: false
  };
}
```

### 6.5 Alternative: Async Iteration (Stripe SDK v20)

For cleaner pagination, use async iteration:

```typescript
/**
 * Alternative event pagination using async iteration (Stripe SDK v20).
 */
async function paginateStripeEventsAsync(
  subscriptionId: string
): Promise<Stripe.Event[]> {
  
  const relevantEvents: Stripe.Event[] = [];
  const RETENTION_DAYS = 30;
  const retentionBoundary = Math.floor(Date.now() / 1000) - (RETENTION_DAYS * 86400);
  const MAX_EVENTS = 500;
  
  let inspected = 0;
  
  for await (const event of stripe.events.list({
    type: 'customer.subscription.*',
    limit: 100
  })) {
    
    inspected++;
    
    // Safety limit
    if (inspected > MAX_EVENTS) {
      logger.warn('Event iteration safety limit reached', {
        subscriptionId,
        inspected
      });
      break;
    }
    
    // Filter for subscription
    const sub = event.data.object as Stripe.Subscription;
    if (sub.id === subscriptionId) {
      relevantEvents.push(event);
    }
    
    // Stop if we've reached retention boundary
    if (event.created <= retentionBoundary) {
      break;
    }
  }
  
  return relevantEvents.sort((a, b) => b.created - a.created);
}
```

### 6.6 Key Properties

✅ **SDK declaration verified** - `^20.3.1` from package.json (exact resolved version not independently verified)

✅ **Correct v20 syntax** - `type` parameter (singular)

✅ **Deterministic pagination** - Continues until boundary or exhaustion

✅ **30-day retention acknowledged** - Explicit boundary checks

✅ **Insufficient history handling** - No invented watermarks

✅ **Safety limits** - Max events inspected (prevents infinite loops)

✅ **Unknown history ≠ fresh history** - Explicit reconciliation flag

---

## Part 7: Production Rollout with Verification Gates (Rev 7 MEDIUM)

### 7.1 Phased Deployment Strategy

**Deployment is not verification. Each stage requires evidence-based gate approval.**

### 7.2 Stage 1: Canary (1% of Providers)

**Deployment:**
```bash
# Enable feature flag for 1% of providers
UPDATE "Provider"
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{featureFlags,sub06aRemediation}',
  'true'::jsonb
)
WHERE id IN (
  SELECT id FROM "Provider"
  WHERE "isActive" = true
  ORDER BY RANDOM()
  LIMIT (SELECT COUNT(*) * 0.01 FROM "Provider" WHERE "isActive" = true)
);
```

**Verification Period:** 48 hours minimum

**Evidence Requirements:**

1. **Zero duplicate event processing**
```sql
-- Check for idempotency violations
SELECT 
  "idempotencyKey",
  COUNT(*) as process_count,
  array_agg("stripeEventId") as event_ids
FROM "WebhookEvent"
WHERE "processed" = true
  AND "createdAt" > NOW() - INTERVAL '48 hours'
GROUP BY "idempotencyKey"
HAVING COUNT(*) > 1;
-- MUST return 0 rows
```

2. **CANCELLED terminality verified**
```sql
-- Check for post-CANCELLED resurrections
SELECT 
  s.id,
  s."stripeSubscriptionId",
  s.status,
  s."lastWebhookEventTimestamp",
  jsonb_array_elements(s.metadata->'statusHistory') as history
FROM "Subscription" s
WHERE s.metadata ? 'statusHistory'
  AND s.metadata->'statusHistory' @> '[{"status": "CANCELLED"}]'::jsonb
  AND s.status != 'CANCELLED'
  AND s."updatedAt" > NOW() - INTERVAL '48 hours';
-- SHOULD return 0 rows (no resurrections)
```

3. **Stale event rejection working**
```sql
-- Check for stale event acceptance
SELECT 
  "stripeEventId",
  "eventType",
  "skipReason",
  metadata
FROM "WebhookEvent"
WHERE "processed" = true
  AND "skipReason" IS NULL  -- Successfully processed
  AND "createdAt" > NOW() - INTERVAL '48 hours'
  AND metadata ? 'eventTimestamp'
  AND (metadata->>'eventTimestamp')::bigint < (
    SELECT "lastWebhookEventTimestamp"
    FROM "Subscription"
    WHERE "stripeSubscriptionId" = (metadata->>'stripeSubscriptionId')
  );
-- SHOULD return 0 rows (no stale events accepted)
```

4. **No subscription-state anomalies**
```sql
-- Check for invalid status values
SELECT id, status, "stripeSubscriptionId"
FROM "Subscription"
WHERE status NOT IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')
  AND "updatedAt" > NOW() - INTERVAL '48 hours';
-- MUST return 0 rows
```

**Gate Decision:** Proceed to Stage 2 only if ALL verification checks pass.

---

### 7.3 Stage 2: Limited (10% of Providers)

**Deployment:**
```bash
# Expand to 10% of providers
UPDATE "Provider"
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{featureFlags,sub06aRemediation}',
  'true'::jsonb
)
WHERE id IN (
  SELECT id FROM "Provider"
  WHERE "isActive" = true
    AND (metadata->'featureFlags'->>'sub06aRemediation' IS NULL 
         OR metadata->'featureFlags'->>'sub06aRemediation' != 'true')
  ORDER BY RANDOM()
  LIMIT (SELECT COUNT(*) * 0.09 FROM "Provider" WHERE "isActive" = true)
);
```

**Verification Period:** 72 hours minimum

**Additional Evidence Requirements:**

5. **Manual sync convergence confirmed**
```sql
-- Track manual sync operations
SELECT 
  DATE_TRUNC('hour', "createdAt") as hour,
  COUNT(*) as sync_count,
  COUNT(*) FILTER (WHERE metadata->>'action' = 'reconciled') as reconciled_count,
  COUNT(*) FILTER (WHERE metadata->>'action' = 'no-sync-needed') as current_count,
  COUNT(*) FILTER (WHERE metadata->>'reason' = 'insufficient-history') as insufficient_count
FROM "AuditLog"
WHERE action = 'subscription.manual-sync.reconciled'
  AND "createdAt" > NOW() - INTERVAL '72 hours'
GROUP BY hour
ORDER BY hour DESC;
-- Verify majority reach 'no-sync-needed' or 'reconciled' state
```

6. **Concurrent update/delete handling verified**
```sql
-- Check for serialization failure recovery
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as failure_count,
  COUNT(*) FILTER (WHERE metadata->>'resolved' = 'retry-success') as recovered_count
FROM "AuditLog"
WHERE action LIKE '%serialization-failure%'
  AND "createdAt" > NOW() - INTERVAL '72 hours'
GROUP BY hour;
-- Verify all failures result in successful retry
```

7. **Provider/Subscription identity consistency maintained**
```sql
-- Verify Provider → Subscription pointer integrity
SELECT 
  p.id as provider_id,
  p."stripeSubscriptionId" as provider_pointer,
  s.id as subscription_id,
  s."stripeSubscriptionId" as subscription_id_field,
  s.status,
  s."retentionState"
FROM "Provider" p
LEFT JOIN "Subscription" s ON s."stripeSubscriptionId" = p."stripeSubscriptionId"
WHERE p."stripeSubscriptionId" IS NOT NULL
  AND (s.id IS NULL 
       OR s."retentionState" != 'ACTIVE'
       OR s."stripeSubscriptionId" != p."stripeSubscriptionId");
-- MUST return 0 rows (all pointers valid)
```

**Gate Decision:** Proceed to Stage 3 only if ALL previous + new verification checks pass.

---

### 7.4 Stage 3: Majority (50% of Providers)

**Deployment:**
```bash
# Expand to 50% of providers
UPDATE "Provider"
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{featureFlags,sub06aRemediation}',
  'true'::jsonb
)
WHERE id IN (
  SELECT id FROM "Provider"
  WHERE "isActive" = true
    AND (metadata->'featureFlags'->>'sub06aRemediation' IS NULL 
         OR metadata->'featureFlags'->>'sub06aRemediation' != 'true')
  ORDER BY RANDOM()
  LIMIT (SELECT COUNT(*) * 0.40 FROM "Provider" WHERE "isActive" = true)
);
```

**Verification Period:** 1 week minimum

**Additional Evidence Requirements:**

8. **No unexpected state transitions**
```sql
-- Monitor all subscription status changes
SELECT 
  metadata->>'previousStatus' as from_status,
  metadata->>'newStatus' as to_status,
  COUNT(*) as transition_count
FROM "AuditLog"
WHERE action = 'subscription.status.changed'
  AND "createdAt" > NOW() - INTERVAL '1 week'
GROUP BY from_status, to_status
ORDER BY transition_count DESC;
-- Review for unexpected transition patterns
```

9. **Idempotency cleanup operations stable**
```sql
-- Check WebhookEvent table growth
SELECT 
  DATE_TRUNC('day', "createdAt") as day,
  COUNT(*) as new_events,
  COUNT(*) FILTER (WHERE "processed" = true) as processed_count,
  COUNT(*) FILTER (WHERE "processed" = false) as pending_count
FROM "WebhookEvent"
WHERE "createdAt" > NOW() - INTERVAL '1 week'
GROUP BY day
ORDER BY day DESC;
-- Verify steady processing (pending remains low)
```

10. **Migration watermark accuracy confirmed**
```sql
-- Verify migration watermarks remain stable
SELECT 
  COUNT(*) as subscriptions_with_watermark,
  AVG(EXTRACT(EPOCH FROM NOW()) - "lastWebhookEventTimestamp") as avg_age_seconds,
  MAX(EXTRACT(EPOCH FROM NOW()) - "lastWebhookEventTimestamp") as max_age_seconds
FROM "Subscription"
WHERE "lastWebhookEventTimestamp" IS NOT NULL
  AND "retentionState" = 'ACTIVE';
-- Verify watermarks are current (avg age < 24 hours for active providers)
```

**Gate Decision:** Proceed to Stage 4 only if ALL previous + new verification checks pass.

---

### 7.5 Stage 4: Full Deployment (100% of Providers)

**Deployment:**
```bash
# Enable for all remaining providers
UPDATE "Provider"
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{featureFlags,sub06aRemediation}',
  'true'::jsonb
)
WHERE "isActive" = true
  AND (metadata->'featureFlags'->>'sub06aRemediation' IS NULL 
       OR metadata->'featureFlags'->>'sub06aRemediation' != 'true');
```

**Post-Deployment Monitoring:** 2 weeks minimum

**Continuous Monitoring:**
- All previous verification checks run daily
- Anomaly detection alerts configured
- Rollback plan maintained and tested

---

### 7.6 Rollback Triggers

**Immediate rollback if ANY of:**

1. ❌ **INV-1 violation** - Duplicate `stripeSubscriptionId` created
2. ❌ **INV-2 violation** - CANCELLED subscription resurrected
3. ❌ **INV-3 violation** - New Stripe ID mutated existing row
4. ❌ **INV-4 violation** - Transaction committed without locks
5. ❌ **INV-5 violation** - Stale event accepted (timestamp ordering broken)
6. ❌ **INV-6 violation** - Cancellation processed without identity validation
7. ❌ **INV-7 violation** - Manual sync mutation outside transaction
8. ❌ **INV-8 violation** - Migration created duplicate active subscriptions

**Rollback Procedure:**
```bash
# Disable feature flag immediately
UPDATE "Provider"
SET metadata = jsonb_set(
  metadata,
  '{featureFlags,sub06aRemediation}',
  'false'::jsonb
)
WHERE metadata->'featureFlags'->>'sub06aRemediation' = 'true';

# Audit all affected subscriptions
SELECT * FROM "AuditLog"
WHERE action LIKE 'subscription%'
  AND "createdAt" > [DEPLOYMENT_TIMESTAMP]
ORDER BY "createdAt" DESC;
```

---

## Acceptance Criteria (Final Checklist)

**All 7 integration corrections applied:**

- [x] **1. CRITICAL:** Serialization failure handling (40001/P2034 whole-transaction retry)
- [x] **2. HIGH:** Manual-sync transaction architecture (LOCK→READ→DECIDE→MUTATE)
- [x] **3. HIGH:** Provider.stripeCustomerId uniqueness (schema requirement documented)
- [x] **4. HIGH:** INV-1 active vs archived distinction (clear identity preservation)
- [x] **5. HIGH:** Business-safe canonical selection (Provider relationships preserved)
- [x] **6. MEDIUM:** Stripe SDK dependency declaration (`^20.3.1` from package.json; exact resolved version not independently verified)
- [x] **7. MEDIUM:** Deterministic event pagination (exhaustion + insufficient-history)

**All 8 invariants maintained:**

- [x] **INV-1:** Immutable subscription identity (active + archived semantics)
- [x] **INV-2:** CANCELLED terminal per Stripe subscription
- [x] **INV-3:** New Stripe ID = new lifecycle
- [x] **INV-4:** Atomic lock → decide → mutate
- [x] **INV-5:** Stale webhook protection
- [x] **INV-6:** Cancellation precedence (after identity validation)
- [x] **INV-7:** Safe manual synchronization
- [x] **INV-8:** Safe migration bootstrap

**This document is the single authoritative implementation specification.**

---

## Implementation Status

**Status:** IMPLEMENTATION READY  
**Gate:** SUB-06-A → Rev 7 APPROVED (pending independent review)  
**Next:** Implementation → Test Verification → Production Rollout

**Blocking Issues:** None (all Rev 6 issues resolved)

---

**END OF SUB-06-A REMEDIATION DESIGN REVISION 7**

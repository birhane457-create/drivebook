# SUB-22 Step 4: Remediation Design

**Date:** 2026-09-11  
**Status:** DESIGN ONLY — NO IMPLEMENTATION  
**Purpose:** Document remediation approach based on Step 1-3 evidence

---

## Executive Summary

SUB-22 requires a **three-layer remediation**:

1. **Database invariant**: Partial unique index preventing duplicate TRIAL/ACTIVE subscriptions per provider
2. **Webhook write strategy**: Deterministic conditional updates eliminating ambiguous `findFirst()` pattern
3. **Concurrency handling**: Explicit conflict detection and retry logic for constraint violations

This is NOT just "add a UNIQUE constraint" — the application must handle concurrent events correctly and converge on consistent state regardless of event ordering.

---

## Design Principle

**Two concurrent webhook events for the same provider/subscription context must converge on the same local Subscription row, with the final state reflecting the most recent Stripe data.**

No event should silently overwrite another's Stripe subscription ID.  
No event should create duplicate TRIAL/ACTIVE rows.  
Event order must not determine success/failure.

---

## Layer 1: Database Invariant

### Required Constraint

**At most one TRIAL or ACTIVE subscription per provider.**

Historical EXPIRED/CANCELLED subscriptions remain permitted (multi-row per provider is intentional for audit history).

### Implementation: Partial Unique Index

```sql
-- Prevent duplicate active/trial subscriptions per provider
CREATE UNIQUE INDEX "Subscription_provider_active_unique"
ON "Subscription"("providerId")
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');
```

**Rationale:**
- PostgreSQL partial index (with WHERE clause) only enforces uniqueness on matching rows
- EXPIRED/CANCELLED/other statuses excluded from constraint
- Protects against race conditions at database level
- Allows historical subscription records to coexist

**NOT this:**
```sql
-- WRONG: Too restrictive
@@unique([providerId])
```
This would prevent historical subscription records.

**Alternative consideration:**
```sql
-- Prevent duplicate Stripe subscription IDs
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_unique"
ON "Subscription"("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;
```

This is **also valuable** but addresses a different invariant (Stripe ID uniqueness, not provider-level uniqueness). Both constraints may be appropriate.

### Constraint Behavior

When a webhook attempts to create/update a subscription that violates the constraint:

```
Prisma error: P2002 (Unique constraint failed)
PostgreSQL error: 23505 (unique_violation)
```

The application **must treat this as an expected concurrency outcome**, not an unhandled 500 error.

---

## Layer 2: Webhook Write Strategy

### Current Problem (Lines 1489-1509 of route.ts)

```typescript
// CURRENT: Ambiguous trial-row selection
const trialRow = await tx.subscription.findFirst({
  where: {
    providerId,
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  orderBy: { createdAt: 'desc' },
});

if (trialRow) {
  await tx.subscription.update({
    where: { id: trialRow.id },
    data: { stripeSubscriptionId: subscription.id }
  });
}
```

**Issues:**
1. Two concurrent transactions can both see the same `trialRow`
2. `findFirst()` is non-deterministic if multiple TRIAL rows exist (shouldn't happen, but race could create them)
3. No verification that the update succeeded in claiming the row
4. Silent last-write-wins behavior

### Proposed Strategy: Conditional Update with Verification

```typescript
// PROPOSED: Deterministic atomic claim
const claimResult = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  data: {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    status: normalizeStatus(subscription.status),
    // ... other subscription data
  }
});

if (claimResult.count === 1) {
  // This transaction successfully claimed the trial
  logger.info(`✅ Claimed trial for provider ${providerId}`);
  
} else if (claimResult.count === 0) {
  // Another transaction already claimed it OR no trial exists
  // Re-read to determine which case
  
  const existingSub = await tx.subscription.findFirst({
    where: {
      providerId,
      stripeSubscriptionId: subscription.id, // Look for THIS Stripe subscription
    }
  });
  
  if (existingSub) {
    // Another event already linked this Stripe subscription — idempotent success
    logger.info(`♻️  Subscription ${subscription.id} already linked by another event`);
    
  } else {
    // Trial was claimed by a DIFFERENT Stripe subscription — this is a conflict
    const competingSub = await tx.subscription.findFirst({
      where: { providerId, status: { in: ['TRIAL', 'ACTIVE'] } }
    });
    
    if (competingSub) {
      logger.warn(`⚠️  Trial already claimed by ${competingSub.stripeSubscriptionId}`);
      // Handle based on business logic: throw, override, or accept
    } else {
      // No trial existed; create new subscription (legitimate case)
      logger.info(`➕ Creating subscription for provider ${providerId}`);
      await tx.subscription.create({ /* ... */ });
    }
  }
  
} else {
  // count > 1: Multiple trials claimed simultaneously (shouldn't happen with constraint)
  logger.error(`❌ Multiple trials claimed: ${claimResult.count}`);
  throw new Error('Unexpected: multiple trial rows claimed');
}
```

**Key differences:**
- `updateMany` returns affected row count (atomic claim detection)
- Explicit re-read to distinguish cases when count === 0
- Looks for THIS Stripe subscription ID to detect idempotent replay
- Handles competing Stripe subscription IDs explicitly
- Logs all outcomes for debugging

---

## Layer 3: Concurrency Handling

### Constraint Violation Handling

When the partial unique index triggers:

```typescript
try {
  await tx.subscription.create({ /* ... */ });
  
} catch (error: any) {
  if (error.code === 'P2002' && error.meta?.target?.includes('provider_active_unique')) {
    // Expected concurrency conflict: another transaction already created active subscription
    logger.info(`🔒 Unique constraint: active subscription exists for provider ${providerId}`);
    
    // Re-read the existing subscription
    const existingSub = await tx.subscription.findFirst({
      where: { providerId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } }
    });
    
    if (existingSub) {
      // Verify consistency: does it match this Stripe subscription?
      if (existingSub.stripeSubscriptionId === subscription.id) {
        // Idempotent success: another event already created/linked this subscription
        return { success: true, idempotent: true };
        
      } else {
        // Conflict: different Stripe subscription already active
        logger.error(`❌ Provider ${providerId} has conflicting subscription: ${existingSub.stripeSubscriptionId} vs ${subscription.id}`);
        // Handle based on business logic
      }
    }
  }
  throw error; // Rethrow unexpected errors
}
```

### SERIALIZABLE Transaction Retry

The existing `withSerializableRetry` wrapper handles PostgreSQL serialization failures (error code 40001). This remains appropriate:

```typescript
await withSerializableRetry(async () => {
  await prisma.$transaction(async (tx) => {
    // ... webhook processing logic
  }, SERIALIZABLE_TX);
}, { operationName: 'webhook-subscription-updated' });
```

**Important distinction:**
- **Serialization failure (40001)**: Retry automatically
- **Unique constraint violation (23505/P2002)**: Handle explicitly (may or may not retry)

Both are expected outcomes under concurrency, not 500 errors.

---

## Event Order Independence

### Required Test Matrix

| Event A | Event B | Expected Outcome |
|---------|---------|------------------|
| checkout.completed | subscription.created | Same Subscription row, final state = ACTIVE |
| checkout.completed | subscription.updated | Same Subscription row, final state = ACTIVE |
| subscription.created | subscription.updated | Same Subscription row, final state matches latest event |
| subscription.updated | subscription.created | Same Subscription row, final state matches latest event |
| Same event × 2 | (idempotency) | Processed once via WebhookEvent idempotency |
| Different Stripe IDs | (conflict) | Error or provider override logic |

### Convergence Property

**For events with the same `stripeSubscriptionId`:**

Regardless of arrival order, all events must:
1. Converge on the same local `Subscription.id`
2. Have that row's `stripeSubscriptionId` set to the Stripe subscription ID
3. Have final status/tier/dates reflect the most recent Stripe state
4. Not create duplicate rows

### Timestamp-Based Conflict Resolution

If events conflict, use Stripe's event timestamps:

```typescript
const eventTimestamp = event.created; // Stripe event creation time
const existingEventTimestamp = existingSub.updatedAt.getTime() / 1000;

if (eventTimestamp > existingEventTimestamp) {
  // This event is newer; update the existing subscription
} else {
  // This event is older; accept existing state (idempotent)
}
```

---

## Backward Compatibility

### Pre-Migration Requirements

1. **Production duplicate check** (already done in Step 1):
   - ✅ Verified no duplicate TRIAL/ACTIVE subscriptions exist
   - ✅ 19 subscriptions, all unique per provider

2. **Historical data preservation**:
   - EXPIRED/CANCELLED subscriptions must remain untouched
   - Partial unique index does not affect historical rows

3. **Migration safety check**:
   ```sql
   -- Pre-migration validation query
   SELECT "providerId", COUNT(*) as active_count
   FROM "Subscription"
   WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
   GROUP BY "providerId"
   HAVING COUNT(*) > 1;
   ```
   Expected result: 0 rows (already verified in Step 1)

### Migration Path

```sql
-- Step 1: Validate no duplicates exist
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "providerId"
    FROM "Subscription"
    WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
    GROUP BY "providerId"
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Migration blocked: % provider(s) have duplicate active subscriptions', duplicate_count;
  END IF;
END $$;

-- Step 2: Create partial unique index
CREATE UNIQUE INDEX CONCURRENTLY "Subscription_provider_active_unique"
ON "Subscription"("providerId")
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

-- Step 3 (optional): Also enforce Stripe ID uniqueness
CREATE UNIQUE INDEX CONCURRENTLY "Subscription_stripeSubscriptionId_unique"
ON "Subscription"("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;
```

**CONCURRENTLY**: Allows production traffic during index creation (important for live systems)

### Rollback Plan

```sql
-- Rollback if needed
DROP INDEX IF EXISTS "Subscription_provider_active_unique";
DROP INDEX IF EXISTS "Subscription_stripeSubscriptionId_unique";
```

No data modification occurs, so rollback is safe.

---

## Comparison: Web/Mobile vs Webhook

### Current State Analysis

**Web/Mobile trial creation** (SUB-02-B finding):
- Already uses SERIALIZABLE transaction
- Already has re-check logic after Provider update
- Protected against concurrent POST requests

**Webhook trial claiming**:
- Uses SERIALIZABLE transaction ✅
- **Lacks re-check logic after findFirst** ❌
- Uses ambiguous `findFirst()` ❌
- No affected-row verification ❌

### Design Goal

Bring webhook path to same protection level as web/mobile path:
- ✅ SERIALIZABLE isolation
- ✅ Deterministic row selection
- ✅ Conditional update verification
- ✅ Explicit concurrency conflict handling
- ✅ Database constraint enforcement

---

## Implementation Checklist (NOT DONE YET)

### Phase 1: Database Constraint
- [ ] Create pre-migration validation script
- [ ] Test migration on development database
- [ ] Run duplicate check in production
- [ ] Execute migration with CONCURRENTLY
- [ ] Verify constraint is active

### Phase 2: Webhook Logic
- [ ] Replace `findFirst() → update()` with `updateMany()` + count check
- [ ] Add constraint violation handling (P2002 error)
- [ ] Add idempotent re-read logic
- [ ] Add explicit conflict resolution
- [ ] Update logging for all outcomes

### Phase 3: Testing
- [ ] Re-run SUB-22 Step 3 concurrent tests with constraint
- [ ] Verify constraint prevents duplicates
- [ ] Verify constraint violations handled gracefully
- [ ] Test all event orderings from matrix
- [ ] Test SERIALIZABLE + constraint interaction

### Phase 4: Validation
- [ ] Deploy to staging
- [ ] Run production-like webhook traffic
- [ ] Monitor for constraint violations (expected under concurrency)
- [ ] Verify no 500 errors from constraint violations
- [ ] Check all subscription states converge correctly

### Phase 5: Production
- [ ] Run final duplicate check
- [ ] Deploy migration during low-traffic window
- [ ] Deploy code changes
- [ ] Monitor webhook processing
- [ ] Verify no duplicate subscriptions created

---

## Success Criteria

**After remediation, the system must demonstrate:**

1. ✅ No duplicate TRIAL/ACTIVE subscriptions per provider (database enforced)
2. ✅ Concurrent webhook events converge on same Subscription row
3. ✅ Unique constraint violations handled as expected outcomes (not 500 errors)
4. ✅ SERIALIZABLE retries work correctly
5. ✅ Event order does not affect final consistency
6. ✅ Idempotent replay of same event works
7. ✅ Different events for same subscription converge
8. ✅ Historical EXPIRED/CANCELLED data preserved
9. ✅ Audit logs capture all concurrency outcomes
10. ✅ Provider state remains coherent after concurrent webhooks

---

## Risk Assessment

### Low Risk (Mitigated)
- ✅ Database constraint creation (using CONCURRENTLY, no locks)
- ✅ Historical data impact (partial index excludes expired)
- ✅ Production duplicates (already verified clean)

### Medium Risk (Requires Testing)
- ⚠️ Constraint violation handling (must test all code paths)
- ⚠️ SERIALIZABLE + constraint interaction (behavior needs validation)
- ⚠️ Event ordering edge cases (comprehensive test matrix needed)

### High Risk (Requires Careful Implementation)
- ⚠️ Webhook event convergence logic (complex conditional update pattern)
- ⚠️ Conflict resolution when different Stripe IDs compete (business rule decision)
- ⚠️ Retry behavior under heavy concurrent load (must not cause cascading failures)

---

## Open Questions for Business Logic

1. **Different Stripe subscription IDs competing for same provider:**
   - Current behavior: Last write wins (silent overwrite)
   - Options:
     * Reject newer subscription (keep first)
     * Override with newer subscription (Stripe is source of truth)
     * Create separate CANCELLED row for old subscription
     * Alert admin for manual resolution
   
   **Recommendation:** Override with newer (Stripe subscription.updated is authoritative), but log warning for monitoring.

2. **Trial already claimed by paid subscription when checkout webhook arrives:**
   - Should checkout.completed accept existing ACTIVE subscription?
   - Or should it verify the Stripe IDs match?
   
   **Recommendation:** Verify Stripe IDs match; if different, this is a data inconsistency requiring investigation.

3. **Webhook arrives after trial already expired (cron changed status):**
   - Should webhook reactivate expired subscription?
   - Or should it create new subscription row?
   
   **Recommendation:** Reactivate (update status to ACTIVE) if Stripe says active and trial end < 24 hours ago. Otherwise investigate mismatch.

---

## Summary

**SUB-22 remediation requires:**

1. **Partial unique index** on `(providerId)` WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
2. **Deterministic conditional update** pattern replacing `findFirst() → update()`
3. **Explicit concurrency handling** for constraint violations and serialization failures
4. **Comprehensive testing** using Step 3 test suite with database access
5. **Event-order-independent** convergence logic

**This is NOT just adding a constraint — it's a three-layer defense-in-depth approach ensuring webhook concurrency safety.**

**Step 4 Status: DESIGN COMPLETE, IMPLEMENTATION PENDING**

**Next:** Await approval to proceed with Step 5 (Implementation) or iterate on design based on feedback.

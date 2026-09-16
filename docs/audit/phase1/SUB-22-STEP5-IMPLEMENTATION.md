# SUB-22 Step 5: Implementation Plan

**Date:** 2026-09-11  
**Status:** IN PROGRESS  
**Approval:** Step 5 approved under constraints

---

## Implementation Scope

### Approved Changes
1. ✅ PostgreSQL partial unique index on Subscription
2. ✅ Atomic conditional update in webhook handler
3. ✅ Proper P2002/40001 error handling
4. ✅ Stripe subscription ID conflict detection (no silent override)
5. ✅ Comprehensive testing with real webhook path

### Out of Scope (Explicitly NOT Implemented)
- ❌ 24-hour trial reactivation logic
- ❌ "Newer subscription wins" automatic override
- ❌ Any lifecycle policy beyond concurrency fix

---

## Pre-Implementation Verification ✅

**PAST_DUE Status Treatment:**
- Verified: PAST_DUE is treated as a current subscription state
- Used in: subscriptionValidation.ts, sync routes, admin routes, tier-change guard
- Pattern: `status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] }` throughout codebase
- **Decision**: Include PAST_DUE in partial unique index

**Current Webhook Pattern:**
- Confirmed: `handleSubscriptionUpdate()` uses `findFirst() → update()` at lines 1489-1509
- Race window: Multiple events can see same unclaimed trial row
- Target: Replace with atomic conditional update

---

## Implementation Tasks

### Task 1: Database Migration
**File:** `prisma/migrations/YYYYMMDDHHMMSS_sub22_unique_current_subscription/migration.sql`

```sql
-- Pre-migration validation
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
    RAISE EXCEPTION 'Migration blocked: % provider(s) have duplicate current subscriptions', duplicate_count;
  END IF;
END $$;

-- Create partial unique index
CREATE UNIQUE INDEX CONCURRENTLY "Subscription_provider_current_unique"
ON "Subscription"("providerId")
WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

-- Optional: Also enforce Stripe ID uniqueness
CREATE UNIQUE INDEX CONCURRENTLY "Subscription_stripeSubscriptionId_unique"
ON "Subscription"("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;
```

**Verification:**
- [ ] Migration runs without errors
- [ ] Indexes created successfully
- [ ] Historical EXPIRED/CANCELLED rows unaffected
- [ ] Current production data passes validation

### Task 2: Webhook Handler Fix
**File:** `app/api/stripe/webhook/route.ts`

**Current problematic pattern (lines ~1489-1509):**
```typescript
const trialRow = await tx.subscription.findFirst({
  where: { providerId, stripeSubscriptionId: null, status: { in: ['TRIAL', 'ACTIVE'] } }
});
if (trialRow) {
  await tx.subscription.update({ where: { id: trialRow.id }, data: { ... } });
}
```

**Replace with atomic conditional update:**
```typescript
// Atomic claim attempt
const claimResult = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  data: {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    status: normalizeStatus(status),
    tier: tier as any,
    monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
    billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
    currentPeriodEnd: new Date(current_period_end * 1000),
  }
});

if (claimResult.count === 1) {
  // Successfully claimed trial
  logger.info(`✅ Claimed trial subscription for provider ${providerId}`);
  
} else if (claimResult.count === 0) {
  // Trial already claimed - verify by whom
  const existingSub = await tx.subscription.findFirst({
    where: {
      providerId,
      status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
    }
  });
  
  if (existingSub) {
    if (existingSub.stripeSubscriptionId === subscription.id) {
      // Idempotent: this event already processed
      logger.info(`♻️  Subscription ${subscription.id} already linked (idempotent)`);
      
      // Update non-key fields
      await tx.subscription.update({
        where: { id: existingSub.id },
        data: {
          status: normalizeStatus(status),
          tier: tier as any,
          monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
          billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
          currentPeriodEnd: new Date(current_period_end * 1000),
        }
      });
      
    } else {
      // CONFLICT: Different Stripe subscription already active
      logger.error(`❌ STRIPE SUBSCRIPTION CONFLICT for provider ${providerId}:
        Existing: ${existingSub.stripeSubscriptionId}
        Incoming: ${subscription.id}
        This requires manual investigation.`);
      
      // Do NOT silently override - flag for investigation
      throw new Error(`Stripe subscription conflict: provider ${providerId} already has ${existingSub.stripeSubscriptionId}, cannot claim ${subscription.id}`);
    }
  } else {
    // No current subscription exists - create new (legitimate case)
    logger.info(`➕ Creating new subscription for provider ${providerId}`);
    await tx.subscription.create({
      data: {
        providerId,
        tier: tier as any,
        status: normalizeStatus(status),
        monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
        billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
        currentPeriodStart: new Date(current_period_start * 1000),
        currentPeriodEnd: new Date(current_period_end * 1000),
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
      }
    });
  }
  
} else {
  // count > 1: Multiple trials claimed (shouldn't happen with proper constraint)
  logger.error(`❌ Unexpected: ${claimResult.count} trials claimed for provider ${providerId}`);
  throw new Error('Multiple trials claimed - data integrity issue');
}
```

**Key changes:**
- ✅ Atomic `updateMany` with affected-row check
- ✅ Explicit idempotent replay detection
- ✅ Stripe subscription ID conflict flagged as error (no silent override)
- ✅ Clear logging for all outcomes
- ✅ Deterministic behavior

### Task 3: Error Handling
**Location:** Within `withSerializableRetry` wrapper

Add explicit P2002 handling:
```typescript
try {
  await tx.subscription.create({ /* ... */ });
} catch (error: any) {
  if (error.code === 'P2002') {
    // Unique constraint violation - expected under concurrency
    const target = error.meta?.target;
    
    if (target?.includes('provider_current_unique')) {
      logger.info(`🔒 Concurrent subscription creation blocked by unique constraint for provider ${providerId}`);
      // Re-read and verify consistency (handled by existing logic)
      
    } else if (target?.includes('stripeSubscriptionId_unique')) {
      logger.error(`❌ Duplicate Stripe subscription ID detected: ${subscription.id}`);
      throw new Error(`Duplicate Stripe subscription ID: ${subscription.id}`);
    }
  }
  throw error; // Re-throw for retry logic
}
```

**Error code mapping:**
- P2002 / 23505: Unique constraint violation (expected concurrency outcome)
- P2034 / 40001: Serialization failure (handled by existing `withSerializableRetry`)

### Task 4: Testing
**File:** Update `app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts`

**Changes needed:**
1. Import actual `handleSubscriptionUpdate` function
2. Create proper Stripe webhook event payloads
3. Exercise real production path (not just simulation)
4. Test all scenarios:
   - ✅ created → updated (concurrent)
   - ✅ updated → created (reverse order)
   - ✅ Same event twice (idempotency)
   - ✅ Different Stripe subscription IDs (conflict detection)
   - ✅ Triple concurrent events
   - ✅ Constraint violation handling
   - ✅ Serialization retry

**Test assertions:**
- Final subscription count === 1 per provider
- Stripe subscription ID matches expected value
- No silent overwrites of different Stripe IDs
- Proper error messages for conflicts
- Idempotent replay succeeds
- Historical EXPIRED/CANCELLED rows preserved

---

## Implementation Checklist

### Phase 1: Migration
- [ ] Create migration file
- [ ] Test migration on development database
- [ ] Verify no duplicate current subscriptions in production (already done in Step 1)
- [ ] Execute migration with CONCURRENTLY
- [ ] Verify indexes active

### Phase 2: Webhook Code
- [ ] Implement atomic conditional update pattern
- [ ] Add Stripe ID conflict detection
- [ ] Add P2002 error handling
- [ ] Update logging for all outcomes
- [ ] Remove old `findFirst() → update()` pattern

### Phase 3: Testing
- [ ] Update test suite to use real webhook path
- [ ] Test all concurrent scenarios
- [ ] Verify constraint prevents duplicates
- [ ] Test idempotent replay
- [ ] Test conflict detection
- [ ] Run full Step 3 suite

### Phase 4: Verification
- [ ] Build passes (TypeScript compilation)
- [ ] Tests pass
- [ ] No duplicate subscriptions can be created
- [ ] Constraint violations handled gracefully
- [ ] Stripe ID conflicts logged and blocked
- [ ] Historical data preserved

---

## Success Criteria

After implementation:
1. ✅ Database enforces one current subscription per provider
2. ✅ Concurrent webhook events converge on same Subscription row
3. ✅ Stripe subscription ID conflicts detected and logged
4. ✅ No silent overwrites of different Stripe IDs
5. ✅ Idempotent webhook replay works correctly
6. ✅ Event order doesn't affect final consistency
7. ✅ Historical EXPIRED/CANCELLED records preserved
8. ✅ P2002 and 40001 handled distinctly
9. ✅ All tests pass
10. ✅ Build succeeds

---

## Rollback Plan

If issues arise:
```sql
-- Rollback: Drop indexes
DROP INDEX IF EXISTS "Subscription_provider_current_unique";
DROP INDEX IF EXISTS "Subscription_stripeSubscriptionId_unique";
```

Webhook code can be reverted via git.

---

## Status Tracking

- [x] Pre-implementation verification (PAST_DUE status confirmed)
- [ ] Task 1: Database migration
- [ ] Task 2: Webhook handler fix
- [ ] Task 3: Error handling
- [ ] Task 4: Testing updates
- [ ] Final verification
- [ ] Documentation
- [ ] Commit and push

**Current Status:** Ready to begin Task 1 (Migration)

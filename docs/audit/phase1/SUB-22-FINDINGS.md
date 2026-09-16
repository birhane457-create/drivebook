# SUB-22: Subscription Webhook Duplicate Prevention — Findings & Next Steps

**Date:** 2026-09-11  
**Status:** Steps 1-2 complete, Step 3 in progress

---

## Executive Summary

Current production has **no database-level protection** against duplicate `stripeSubscriptionId` values. The subscription webhook handler uses a `findFirst()` → `update()` pattern for claiming trial subscriptions, which is vulnerable to concurrent webhook race conditions.

**Good news:** Current production data is clean (no duplicates found).  
**Risk:** System has not yet been tested under concurrent webhook delivery.

---

## Step 1: Production Data Check ✅

**Script:** `scripts/sub-22-duplicate-check.mjs`

### Key Findings

- ✅ No duplicate data in production
- 19 subscriptions total (18 TRIAL, 1 ACTIVE)
- 0 subscriptions have `stripeSubscriptionId` populated
- 1.00 subscriptions per provider (no multi-subscription cases)

### Interpretation

Production is currently in a **pre-webhook state**. All subscriptions are locally created trials that have not yet been linked to Stripe subscriptions through webhooks. This means the race condition SUB-22 aims to prevent **has not yet occurred in production**.

---

## Step 2: Database Constraint Check ✅

**Script:** `scripts/sub-22-constraint-check.mjs`

### Critical Finding

❌ **NO UNIQUE CONSTRAINT exists on `Subscription.stripeSubscriptionId`**

Current Subscription table constraints:
- PRIMARY KEY on `id` only
- FOREIGN KEY on `providerId` → `Provider(id)`
- **No uniqueness enforcement on Stripe identifiers**

Also checked:
- ⚠️ No UNIQUE constraint on `Provider.stripeCustomerId`

### Comparison with P0-01B

The wallet-add endpoint (P0-01B) uses a database UNIQUE constraint:

```sql
-- Migration: 20260911000000_add_wallet_transaction_payment_intent_unique
CREATE UNIQUE INDEX "WalletTransaction_paymentIntentId_key"
ON "WalletTransaction"((metadata->>'stripePaymentIntentId'))
WHERE (metadata->>'stripePaymentIntentId') IS NOT NULL;
```

**Subscription has no equivalent protection.**

---

## Step 3: Code Analysis — Current Webhook Implementation

### Location
`app/api/stripe/webhook/route.ts` → `handleSubscriptionUpdate()`

### Race Condition Pattern

```typescript
// Lines 1489-1509 (simplified for clarity)
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
    data: {
      // ... set stripeSubscriptionId
    }
  });
}
```

### Vulnerability

**Concurrent scenario:**
```
Event A: subscription.created arrives → findFirst() sees trial row → begins update
Event B: subscription.updated arrives → findFirst() sees SAME trial row → begins update
Both: update() with different event data
Result: RACE — last write wins, state depends on timing
```

**Even with SERIALIZABLE transactions:**
- Both transactions can complete successfully
- No serialization failure occurs because they're updating different fields or timestamps
- The `findFirst()` is not conditional on exclusive row ownership

### What SERIALIZABLE Does Protect

SERIALIZABLE prevents phantom reads and non-repeatable reads within a transaction, but both transactions can successfully `UPDATE` the same row if:
1. They select it before either commits
2. They modify non-conflicting data
3. No explicit lock is held

### What SERIALIZABLE Does NOT Protect

It does not prevent two transactions from both finding the same row and both updating it if the updates don't create a serialization anomaly that Postgres detects.

---

## Comparison: P0-01B vs SUB-22 Patterns

| Aspect | P0-01B (Wallet-Add) | SUB-22 (Subscription Webhook) |
|--------|---------------------|-------------------------------|
| **Protection** | Database UNIQUE constraint | SERIALIZABLE transaction only |
| **Pattern** | N/A (new row creation) | findFirst() → update() claiming |
| **Race detection** | Database constraint violation | None (last write wins) |
| **Test coverage** | ✅ Comprehensive concurrent tests | ❌ No concurrent webhook tests |
| **Production risk** | Low (constraint proven) | **High (untested under concurrency)** |

---

## Next Steps

### Step 3: Create Concurrent Webhook Tests (IN PROGRESS)

Create test suite at:
`app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts`

**Test scenarios:**

1. **Concurrent subscription.created events** (same stripeSubscriptionId)
   - Expected: Only one claims trial row
   - Actual: TBD

2. **Concurrent subscription.created + subscription.updated**
   - Expected: Consistent final state
   - Actual: TBD

3. **Triple concurrent events** (stress test)
   - Expected: One claim, two idempotent updates
   - Actual: TBD

4. **Measure SERIALIZABLE behavior**
   - Does it prevent the race?
   - Does withSerializableRetry handle it?
   - What state results from concurrent execution?

### Step 4: Evaluate Protection Mechanisms

After Step 3 tests, compare:
- SERIALIZABLE isolation effectiveness
- Need for database constraints
- Need for conditional update pattern

### Step 5: Select Remediation

**Options:**

A. **Database UNIQUE constraint** (strong, simple)
```sql
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key"
ON "Subscription"("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;
```

B. **Conditional update pattern** (application-level, flexible)
```typescript
const result = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] }
  },
  data: { stripeSubscriptionId: subscription.id }
});

if (result.count === 0) {
  // Another event claimed it — verify consistency
}
```

C. **Hybrid** (both constraint + conditional logic)

**Decision:** Deferred until Step 3-4 complete.

---

## Summary

| Item | Status | Finding |
|------|--------|---------|
| Production data | ✅ Clean | No duplicates exist |
| Database schema | ❌ Gap | No uniqueness constraint |
| Webhook code | ⚠️ Vulnerable | findFirst→update race |
| Test coverage | ❌ Missing | No concurrent webhook tests |
| Production usage | ℹ️ Low | No Stripe-linked subs yet |

**Recommendation:** Complete Step 3 concurrent tests before making any code or schema changes. The frozen remediation scope requires evidence-based decisions, not assumptions.

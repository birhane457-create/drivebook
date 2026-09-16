# F-13 Implementation Guide

**Date**: 2026-08-15  
**Status**: IN PROGRESS - Code changes documented, awaiting final edits

---

## Summary

F-13 fixes the subscription trial row race condition using:
1. **Correlation**: `stripeCustomerId` (authoritative Stripe customer ID)
2. **Concurrency**: Atomic conditional update with `stripeSubscriptionId IS NULL`

---

## Changes Made

### ✅ DONE: Trial Creation (app/api/instructor/subscription/route.ts)

**Line ~230**: Copy `Provider.stripeCustomerId` to `Subscription.stripeCustomerId`

```typescript
// F-13 FIX: Copy Provider's stripeCustomerId to Subscription for authoritative correlation
const provider = await prisma.provider.findUnique({
  where: { id: user.provider?.id },
  select: { stripeCustomerId: true }
});

subscription = await prisma.subscription.create({
  data: {
    // ... other fields
    stripeCustomerId: provider?.stripeCustomerId || null,  // ✅ ADDED
  },
});
```

### ✅ DONE: checkout.session.completed Handler (app/api/stripe/webhook/route.ts)

**Line ~591**: Replace trial row matching with atomic conditional update

```typescript
// F-13 FIX: Atomic conditional update
const claimResult = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeCustomerId: customer as string,  // Authoritative correlation
    stripeSubscriptionId: null,            // Atomic claim condition
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  data: {
    tier: tier as any,
    status: 'ACTIVE',
    stripeCustomerId: customer as string,
    stripeSubscriptionId: stripeSubId,
  },
});

if (claimResult.count === 0) {
  // Check if already linked
  const existing = await tx.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubId }
  });
  
  if (existing) {
    // Update existing (idempotent)
    await tx.subscription.update({ where: { id: existing.id }, data: {...} });
  } else {
    // Fallback for legacy data
    await tx.subscription.updateMany({ where: { providerId }, data: {...} });
  }
} else {
  logger.info(\`✓ Successfully claimed trial row (count: \${claimResult.count})\`);
}
```

### ⏳ TODO: subscription.updated Handler (app/api/stripe/webhook/route.ts)

**Line ~1507**: Replace with same atomic conditional update pattern

**REPLACE**:
```typescript
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
    data: {...}
  });
} else {
  await tx.subscription.create({...});
}
```

**WITH**:
```typescript
const claimResult = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeCustomerId: subscription.customer as string,  // Authoritative correlation
    stripeSubscriptionId: null,                         // Atomic claim
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  data: {
    tier: tier as any,
    status: normalizeStatus(status) as any,
    monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
    billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
    currentPeriodEnd: new Date(current_period_end * 1000),
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
  }
});

if (claimResult.count === 0) {
  const existing = await tx.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });
  
  if (existing) {
    logger.info(\`Subscription \${subscription.id} already linked - updating\`);
    await tx.subscription.update({
      where: { id: existing.id },
      data: {
        tier: tier as any,
        status: normalizeStatus(status) as any,
        monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
        billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
        currentPeriodEnd: new Date(current_period_end * 1000),
        stripeCustomerId: subscription.customer as string,
      }
    });
  } else {
    logger.info(\`No trial found - creating new subscription\`);
    const current_period_start = (subscription as any).current_period_start;
    await tx.subscription.create({
      data: {
        providerId,
        tier: tier as any,
        status: normalizeStatus(status) as any,
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
  logger.info(\`✓ Successfully claimed trial row (count: \${claimResult.count})\`);
}
```

---

## Testing Required

### Test 1: Concurrent Webhooks, Same Subscription
```
Setup: Trial exists with stripeCustomerId='cus_A'
Event A: checkout.session.completed (sub_123, cus_A)
Event B: subscription.updated (sub_123, cus_A)
Concurrent execution

Expected:
- ONE event claims trial (updateMany.count = 1)
- OTHER event sees count = 0, finds existing by stripeSubscriptionId
- Both update same row (idempotent)
- Final: ONE subscription linked to sub_123
```

### Test 2: Two Different Subscriptions
```
Setup: Provider has TWO trials (cus_A, cus_B)
Event A: subscription.updated (sub_123, cus_A)
Event B: subscription.updated (sub_456, cus_B)
Concurrent execution

Expected:
- Event A claims trial with cus_A
- Event B claims trial with cus_B
- NO cross-contamination
- Two separate subscriptions
```

### Test 3: No Trial Exists
```
Setup: NO trial subscription
Event: subscription.updated (sub_123, cus_A)

Expected:
- updateMany.count = 0
- findFirst by stripeSubscriptionId = null
- Creates NEW subscription
```

### Test 4: Already Linked
```
Setup: Subscription already has stripeSubscriptionId='sub_123'
Event: subscription.updated (sub_123, cus_A)

Expected:
- updateMany.count = 0 (no rows with stripeSubscriptionId IS NULL)
- findFirst finds existing subscription
- Updates existing (idempotent)
```

### Test 5: Legacy Data (No stripeCustomerId)
```
Setup: Trial exists WITHOUT stripeCustomerId
Event: subscription.updated (sub_123, cus_A)

Expected:
- updateMany.count = 0 (no match on stripeCustomerId)
- Fallback: updateMany by providerId only
- Subscription updated
```

---

## Schema Change (Optional)

Add `@unique` constraint to `stripeSubscriptionId` for data integrity:

```prisma
model Subscription {
  stripeSubscriptionId String? @unique
  // ... other fields
}
```

**Migration**:
```sql
-- Check for existing duplicates
SELECT stripeSubscriptionId, COUNT(*) 
FROM Subscription 
WHERE stripeSubscriptionId IS NOT NULL 
GROUP BY stripeSubscriptionId 
HAVING COUNT(*) > 1;

-- If clean, add unique constraint
ALTER TABLE "Subscription" 
ADD CONSTRAINT "Subscription_stripeSubscriptionId_key" 
UNIQUE ("stripeSubscriptionId");
```

---

## Verification Checklist

- [ ] Trial creation copies stripeCustomerId from Provider
- [ ] checkout.session.completed uses atomic conditional update
- [ ] subscription.updated uses atomic conditional update
- [ ] Both handlers check claimResult.count
- [ ] Both handlers handle count = 0 (already linked)
- [ ] Test 1: Concurrent same subscription (pass)
- [ ] Test 2: Two different subscriptions (pass)
- [ ] Test 3: No trial exists (pass)
- [ ] Test 4: Already linked (pass)
- [ ] Test 5: Legacy data handling (pass)
- [ ] TypeScript validation (pass)
- [ ] @unique constraint added (optional)
- [ ] AREA6_AUDIT_FINDINGS.md updated

---

**Status**: Awaiting final edit to subscription.updated handler

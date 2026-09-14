# F-13 Analysis: Subscription Trial Row Race Condition

**Date**: 2026-08-15  
**Status**: ANALYSIS IN PROGRESS

---

## Problem Statement

When a provider starts a subscription trial and then adds payment:
1. **Trial subscription** created with `stripeSubscriptionId: null`
2. **Stripe Checkout** Session created
3. **Multiple Stripe events** arrive concurrently:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
4. **Race condition**: Multiple events try to link to the SAME trial row
5. **Result**: Last event wins, previous Stripe subscription gets orphaned

---

## Current Flow

### Step 1: Trial Creation (No Payment)
**Endpoint**: `POST /api/instructor/subscription`

```typescript
const subscription = await prisma.subscription.create({
  data: {
    providerId: user.provider?.id,
    tier: 'PRO',
    status: 'TRIAL',
    monthlyAmount: 0,
    billingCycle: 'monthly',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialEndsAt: trialEnd,
    // stripeSubscriptionId: null  (NOT SET YET)
    // stripeCustomerId: null  (NOT SET YET)
  },
});
```

**State**: Local subscription exists WITHOUT Stripe linkage

### Step 2: User Adds Payment
**Endpoint**: `POST /api/instructor/subscription` (again, with payment)  
**Or**: User clicks "Add Payment Method" in dashboard

Creates Stripe Checkout Session:
```typescript
const session = await stripe.checkout.sessions.create({
  customer: existingStripeCustomer?.id,  // May be null for first time
  mode: 'subscription',
  subscription_data: {
    trial_period_days: remainingTrialDays,
    metadata: { providerId, tier }
  },
  metadata: { providerId, tier, billingCycle }
});
```

### Step 3: Checkout Completes (User Pays)
Stripe fires MULTIPLE events:
1. ✅ `checkout.session.completed`
2. ✅ `customer.subscription.created`
3. ✅ `customer.subscription.updated`

All arrive within milliseconds, potentially concurrently.

### Step 4: Webhook Handlers (THE RACE)

#### Handler A: `checkout.session.completed` (Line 562)
```typescript
const trialRow = await tx.subscription.findFirst({
  where: {
    providerId,                        // ❌ TOO BROAD
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  orderBy: { createdAt: 'desc' },      // Gets most recent
});

if (trialRow) {
  await tx.subscription.update({
    where: { id: trialRow.id },
    data: {
      ...updates,
      stripeSubscriptionId: checkoutSession.subscription  // Links Stripe sub A
    }
  });
}
```

#### Handler B: `subscription.updated` (Line 1427)
```typescript
const existingSubscription = await tx.subscription.findFirst({
  where: { stripeSubscriptionId: subscription.id }  // ✅ Checks for already-linked first
});

if (!existingSubscription) {
  // Not found by Stripe ID, try to find trial row
  const trialRow = await tx.subscription.findFirst({
    where: {
      providerId,                      // ❌ SAME TOO-BROAD QUERY
      stripeSubscriptionId: null,
      status: { in: ['TRIAL', 'ACTIVE'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  if (trialRow) {
    await tx.subscription.update({
      where: { id: trialRow.id },
      data: {
        ...updates,
        stripeSubscriptionId: subscription.id  // Links Stripe sub B (OVERWRITES A!)
      }
    });
  }
}
```

---

## The Race Condition Scenario

### Scenario 1: Single Provider, Multiple Subscriptions
**Setup**:
- Provider creates BASIC trial (subscription row 1)
- Provider creates PRO trial (subscription row 2)
- Provider adds payment to PRO trial

**Events**:
1. `checkout.session.completed` arrives → finds row 2 (most recent), links to Stripe sub A
2. `subscription.updated` arrives → finds row 2 (already linked to A), updates it to Stripe sub B
3. **Result**: Stripe sub A is orphaned, row 2 points to sub B

### Scenario 2: Concurrent Events, Same Subscription
**Setup**:
- Provider has ONE trial subscription (row 1)
- User adds payment

**Events** (concurrent):
1. Event A: `checkout.session.completed` → Reads row 1 (not yet linked)
2. Event B: `subscription.updated` → Reads row 1 (not yet linked)
3. Event A: Updates row 1 → `stripeSubscriptionId: sub_123`
4. Event B: Updates row 1 → `stripeSubscriptionId: sub_123` (SAME ID, idempotent ✅)

**Result**: Works correctly if SAME Stripe subscription ID

---

## Root Cause Analysis

### Issue 1: Non-Unique Trial Row Selection
```typescript
where: {
  providerId,           // ❌ Can match multiple rows
  stripeSubscriptionId: null,
  status: { in: ['TRIAL', 'ACTIVE'] },
}
```

**Problem**: If provider has multiple trial subscriptions:
- Query is ambiguous (which trial?)
- `orderBy: createdAt desc` picks most recent
- Not deterministic which subscription should link

### Issue 2: No Atomic Claim Mechanism
```typescript
const trialRow = await tx.subscription.findFirst(...);  // READ
if (trialRow) {
  await tx.subscription.update({                        // WRITE
    where: { id: trialRow.id },
    data: { stripeSubscriptionId: ... }
  });
}
```

**Problem**: Classic read-then-write race:
- T1 reads row 1 (not linked)
- T2 reads row 1 (not linked)
- T1 links row 1 to subscription A
- T2 links row 1 to subscription B (overwrites!)

### Issue 3: No Unique Constraint on stripeSubscriptionId
**Schema**:
```prisma
model Subscription {
  stripeSubscriptionId String?  // ❌ No @unique constraint
}
```

**Problem**: Multiple local Subscription rows can claim the same `stripeSubscriptionId`

---

## Available Identifiers

From Stripe events, we have:
- ✅ **`stripeSubscriptionId`** - THE authoritative identifier
- ✅ **`stripeCustomerId`** - Links customer
- ⚠️ **`providerId`** - Links provider (but too broad, multiple subscriptions possible)
- ⚠️ **`tier`** - Subscription tier (not authoritative, can change)
- ⚠️ **`createdAt`** - Timestamp (not deterministic for selection)

From local database:
- ✅ **Subscription.id** - Local subscription ID
- ✅ **Subscription.stripeSubscriptionId** - Links to Stripe (initially null)
- ⚠️ **Subscription.stripeCustomerId** - Links customer (initially null)
- ⚠️ **Subscription.providerId** - Too broad

---

## Solution Options

### Option 1: Add @unique Constraint to stripeSubscriptionId ✅ RECOMMENDED
**Approach**: Enforce one-to-one mapping at database level

```prisma
model Subscription {
  stripeSubscriptionId String? @unique
}
```

**Pros**:
- Database enforces uniqueness
- P2002 error on duplicate claim
- Atomic at database level

**Cons**:
- Requires migration
- Need to handle P2002 errors

**Implementation**:
```typescript
try {
  await tx.subscription.update({
    where: { id: trialRow.id },
    data: { stripeSubscriptionId: subscription.id }
  });
} catch (err) {
  if (err.code === 'P2002') {
    // Another event already claimed this Stripe subscription
    // Find the row that claimed it
    const claimed = await tx.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });
    // Update that row instead
  }
}
```

### Option 2: Use updateMany with Count Check ⚠️ PARTIAL
**Approach**: Atomic update with result count

```typescript
const result = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  data: {
    ...updates,
    stripeSubscriptionId: subscription.id
  }
});

if (result.count === 0) {
  // No trial row to claim, create new
  await tx.subscription.create({ data: {...} });
}
```

**Pros**:
- No schema change
- Atomic update

**Cons**:
- Updates FIRST matching row (non-deterministic which one)
- If multiple trial rows exist, picks arbitrarily
- Doesn't solve the "which trial" problem

### Option 3: Pre-Set stripeCustomerId on Trial Creation ❌ NOT FEASIBLE
**Approach**: Set `stripeCustomerId` when trial is created

**Problem**: Don't know Stripe customer ID until checkout session created

### Option 4: Single Trial Row Per Provider ❌ TOO RESTRICTIVE
**Approach**: Enforce only one trial subscription per provider

**Problem**: Providers should be able to switch tiers during trial

---

## Recommended Solution

**TWO-PART FIX**:

1. **Add `@unique` constraint to `stripeSubscriptionId`**
   - Enforces one-to-one mapping
   - Database-level atomic claim

2. **Update webhook handlers to handle P2002**
   - If claim fails (P2002), find existing row
   - Update that row instead

**Behavioral Guarantees**:
- ✅ Each Stripe subscription links to exactly ONE local Subscription
- ✅ Concurrent events for SAME Stripe subscription → idempotent
- ✅ Concurrent events for DIFFERENT Stripe subscriptions → each gets own row
- ✅ No orphaned Stripe subscriptions

---

## Next Steps

1. Add migration for `@unique` constraint
2. Update `checkout.session.completed` handler
3. Update `subscription.updated` handler
4. Create regression tests
5. Verify with TypeScript
6. Update AREA6_AUDIT_FINDINGS.md

---

## DEEP DATA-FLOW ANALYSIS

### Complete Lifecycle Trace

#### 1. Trial Subscription Creation (No Payment)
**Route**: `POST /api/instructor/subscription`  
**Code**: Lines 230-260

```typescript
subscription = await prisma.subscription.create({
  data: {
    providerId: user.provider?.id,
    tier,
    status: 'TRIAL',
    monthlyAmount: amount,
    billingCycle,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialEndsAt: trialEnd,
    // ❌ stripeSubscriptionId: NOT SET (null)
    // ❌ stripeCustomerId: NOT SET (null)
  },
});
```

**State After**:
- Subscription row: `{ providerId, tier, status: 'TRIAL', stripeSubscriptionId: null, stripeCustomerId: null }`
- Provider row: `{ id: providerId, stripeCustomerId: null (or existing) }`

#### 2. User Adds Payment Method
**Route**: `POST /api/instructor/subscription` (same endpoint, different flow)  
**Code**: Lines 120-170

```typescript
// Get or create Stripe customer
let customerId = user.provider?.stripeCustomerId;
if (!customerId) {
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { providerId: user.provider?.id },
  });
  customerId = customer.id;
  
  // ✅ Provider.stripeCustomerId IS SET HERE!
  await prisma.provider.update({
    where: { id: user.provider?.id },
    data: { stripeCustomerId: customerId },
  });
}

// Create checkout session
const checkoutSession = await stripe.checkout.sessions.create({
  customer: customerId,  // ✅ Stripe customer ID attached
  metadata: {
    providerId: user.provider?.id,
    tier,
    billingCycle,
  },
  subscription_data: {
    metadata: {
      providerId: user.provider?.id,
      tier,
      billingCycle,
    },
  },
});
```

**State After**:
- Provider row: `{ id: providerId, stripeCustomerId: 'cus_xxx' }` ✅
- Subscription row: `{ providerId, stripeCustomerId: null }` ❌ NOT UPDATED!
- Stripe Checkout Session: `{ customer: 'cus_xxx', metadata: { providerId } }`
- Stripe Subscription (created by Stripe): `{ id: 'sub_xxx', customer: 'cus_xxx', metadata: { providerId, tier } }`

**CRITICAL FINDING**: `Provider.stripeCustomerId` is set BEFORE webhook fires, but `Subscription.stripeCustomerId` is NOT!

#### 3. checkout.session.completed Event
**Handler**: Lines 562-644  
**Available Data**:
- `checkoutSession.customer` = `'cus_xxx'` ✅
- `checkoutSession.subscription` = `'sub_xxx'` ✅
- `checkoutSession.metadata.providerId` ✅

**Current Matching Logic** (Line 591):
```typescript
const trialRow = await tx.subscription.findFirst({
  where: {
    providerId,                      // ✅ Have this
    stripeSubscriptionId: null,      // ✅ Correct
    status: { in: ['TRIAL', 'ACTIVE'] },  // ✅ Correct
  },
  orderBy: { createdAt: 'desc' },    // ❌ NON-DETERMINISTIC!
});
```

**Problem**: If provider has MULTIPLE trial rows, picks most recent. No correlation to Stripe customer!

#### 4. subscription.updated Event
**Handler**: Lines 1427-1540  
**Available Data**:
- `subscription.customer` = `'cus_xxx'` ✅
- `subscription.id` = `'sub_xxx'` ✅
- `subscription.metadata.providerId` ✅

**Current Matching Logic** (Line 1485):
```typescript
const existingSubscription = await tx.subscription.findFirst({
  where: { stripeSubscriptionId: subscription.id }  // ✅ Tries stripeSubscriptionId first
});

if (!existingSubscription) {
  const trialRow = await tx.subscription.findFirst({
    where: {
      providerId,                    // ✅ Have this
      stripeSubscriptionId: null,    // ✅ Correct
      status: { in: ['TRIAL', 'ACTIVE'] },
    },
    orderBy: { createdAt: 'desc' },  // ❌ SAME NON-DETERMINISTIC LOGIC!
  });
}
```

---

## AUTHORITATIVE CORRELATION IDENTIFIER

### What We Have

| Field | Trial Subscription | Provider | Stripe Subscription | Webhook Event |
|-------|-------------------|----------|---------------------|---------------|
| `stripeSubscriptionId` | ❌ null | N/A | ✅ `sub_xxx` | ✅ Available |
| `stripeCustomerId` | ❌ null | ✅ `cus_xxx` | ✅ `cus_xxx` | ✅ Available |
| `providerId` | ✅ Set | ✅ `provider_id` | ✅ metadata | ✅ Available |
| `tier` | ✅ Set | ✅ Set | ✅ metadata | ✅ Available |

### The Authoritative Chain

**ONLY ONE valid correlation path exists**:

```
Stripe Subscription → subscription.customer ('cus_xxx')
                   ↓
                Provider.stripeCustomerId ('cus_xxx')
                   ↓
                Provider.id (providerId)
                   ↓
                Subscription.providerId
```

**BUT**: `Subscription.stripeCustomerId` is NOT set during trial creation!

---

## WHY @unique ALONE IS INSUFFICIENT

### The Race Scenario

```typescript
// Database state:
// Trial #123: { providerId: 'prov_1', stripeSubscriptionId: null, stripeCustomerId: null }

// Event A arrives: subscription_A (customer: cus_xxx, id: sub_A)
// Event B arrives: subscription_B (customer: cus_yyy, id: sub_B)

// Both events execute concurrently:
T1 (Event A): SELECT * FROM Subscription WHERE providerId='prov_1' AND stripeSubscriptionId IS NULL
T2 (Event B): SELECT * FROM Subscription WHERE providerId='prov_1' AND stripeSubscriptionId IS NULL

// Both get Trial #123

T1: UPDATE Subscription SET stripeSubscriptionId='sub_A' WHERE id=123
T2: UPDATE Subscription SET stripeSubscriptionId='sub_B' WHERE id=123

// @unique constraint on stripeSubscriptionId:
//   - T1 succeeds: stripeSubscriptionId='sub_A'
//   - T2 tries to set stripeSubscriptionId='sub_B'
//   - T2 SUCCEEDS because it's updating the SAME ROW (not inserting duplicate)
//   - Final state: stripeSubscriptionId='sub_B' (sub_A is orphaned!)
```

**@unique constraint ONLY prevents**:
- Two DIFFERENT rows having the SAME stripeSubscriptionId

**@unique constraint DOES NOT prevent**:
- Two DIFFERENT stripeSubscriptionIds being written to the SAME row sequentially

---

## SOLUTION: TWO-PART FIX

### Part 1: CORRELATION - Use stripeCustomerId

**Problem**: Trial Subscription doesn't have `stripeCustomerId` set.

**Solution Options**:

#### Option A: Set stripeCustomerId on Trial Creation ✅ RECOMMENDED
When creating trial subscription, copy `stripeCustomerId` from Provider if it exists:

```typescript
// In POST /api/instructor/subscription
const provider = await prisma.provider.findUnique({
  where: { id: user.provider?.id },
  select: { stripeCustomerId: true }
});

subscription = await prisma.subscription.create({
  data: {
    providerId: user.provider?.id,
    tier,
    status: 'TRIAL',
    // ... other fields
    stripeCustomerId: provider?.stripeCustomerId || null,  // ✅ COPY FROM PROVIDER!
  },
});
```

Then webhook can match using:
```typescript
const trialRow = await tx.subscription.findFirst({
  where: {
    providerId,
    stripeCustomerId: subscription.customer,  // ✅ AUTHORITATIVE!
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
});
```

**Pros**:
- Uses authoritative Stripe customer ID
- Deterministic (only ONE trial per provider+customer)
- No schema change required

**Cons**:
- Requires updating trial creation logic
- Only works for NEW trials (existing trials need backfill)

#### Option B: JOIN through Provider in Webhook ❌ MORE COMPLEX
```typescript
const provider = await tx.provider.findUnique({
  where: { id: providerId, stripeCustomerId: subscription.customer },
  include: {
    subscriptions: {
      where: {
        stripeSubscriptionId: null,
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    },
  },
});

const trialRow = provider?.subscriptions[0];
```

**Pros**:
- No trial creation change needed

**Cons**:
- More complex query
- Still needs `orderBy` (non-deterministic if multiple trials)

### Part 2: CONCURRENCY - Atomic Claim

Even with correct correlation, we need atomic claiming.

**Solution**: Update stripeSubscriptionId with WHERE clause check:

```typescript
const updateResult = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeCustomerId: subscription.customer,  // ✅ From Part 1
    stripeSubscriptionId: null,               // ✅ Only unclaimed
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  data: {
    tier: tier as any,
    status: normalizeStatus(status) as any,
    // ... other fields
    stripeSubscriptionId: subscription.id,    // ✅ ATOMIC CLAIM
    stripeCustomerId: subscription.customer,  // ✅ Ensure it's set
  },
});

if (updateResult.count === 0) {
  // No trial to claim, check if already linked
  const existing = await tx.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });
  
  if (existing) {
    // Already linked by another event, update it
    await tx.subscription.update({
      where: { id: existing.id },
      data: { /* updates */ }
    });
  } else {
    // No trial exists, create new subscription
    await tx.subscription.create({ data: { /* ... */ } });
  }
}
```

**Why This Works**:
1. `updateMany` with WHERE clause is atomic
2. Only updates if `stripeSubscriptionId IS NULL`
3. If another event already claimed it, `count === 0`
4. Then we find by `stripeSubscriptionId` and update that row

---

## FINAL SOLUTION

### A. Authoritative Correlation Identifier
**`stripeCustomerId`** (Stripe customer ID from `subscription.customer`)

### B. Current Race Sequence
1. Two events query for trial row using only `providerId`
2. Both find the same trial row (non-deterministic)
3. Both update `stripeSubscriptionId` sequentially
4. Last one wins, first one orphaned

### C. Proposed Correlation Mechanism
1. Set `stripeCustomerId` on trial Subscription during creation (copy from Provider)
2. Webhook matches using `{ providerId, stripeCustomerId, stripeSubscriptionId: null }`
3. Guarantees correct trial row (one provider can have multiple customers)

### D. Proposed Concurrency Mechanism
1. Use `updateMany` with WHERE clause including `stripeSubscriptionId IS NULL`
2. Atomic claim - only one event can set `stripeSubscriptionId` from null to value
3. Check `updateResult.count` to detect if another event already claimed
4. Fallback to finding by `stripeSubscriptionId` if already claimed

### E. Why @unique Alone Is Insufficient
- @unique prevents two ROWS from having same value
- Does NOT prevent two VALUES being written to same ROW sequentially
- Race condition: both events SELECT same row, both UPDATE with different values
- Need atomic WHERE clause check: `stripeSubscriptionId IS NULL`

### F. Exact Schema Changes
**NONE REQUIRED** - All fields already exist:
- `Subscription.stripeCustomerId` already exists as `String?`
- `Provider.stripeCustomerId` already exists and is set before webhook

**OPTIONAL** (recommended for data integrity):
```prisma
model Subscription {
  stripeSubscriptionId String? @unique  // Enforce one-to-one
  // ... other fields
}
```

### G. Exact Webhook Changes

#### Change 1: checkout.session.completed (Line ~591)
```typescript
// Before:
const trialRow = await tx.subscription.findFirst({
  where: {
    providerId,
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  orderBy: { createdAt: 'desc' },
});

// After:
const updateResult = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeCustomerId: checkoutSession.customer as string,  // ✅ ADDED
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
  data: {
    tier: tier as any,
    status: 'ACTIVE',
    stripeCustomerId: checkoutSession.customer as string,
    stripeSubscriptionId: stripeSubId,
  },
});

if (updateResult.count === 0) {
  // Check if already linked
  const existing = await tx.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubId }
  });
  if (existing) {
    // Update existing
  } else {
    // Create new (shouldn't happen for trial flow)
  }
}
```

#### Change 2: subscription.updated (Line ~1485)
Same pattern as above, use `subscription.customer` for matching.

#### Change 3: Trial creation (Line ~230 in /api/instructor/subscription/route.ts)
```typescript
// Get provider's stripeCustomerId
const provider = await prisma.provider.findUnique({
  where: { id: user.provider?.id },
  select: { stripeCustomerId: true }
});

subscription = await prisma.subscription.create({
  data: {
    providerId: user.provider?.id,
    tier,
    status: 'TRIAL',
    // ... other fields
    stripeCustomerId: provider?.stripeCustomerId || null,  // ✅ ADDED
  },
});
```

### H. Behavioral Tests Required

1. **Single subscription, concurrent webhooks (same Stripe subscription)**
   - Event A and B arrive concurrently for `sub_123`
   - Both try to claim trial row
   - Result: ONE claim succeeds, other updates same row (idempotent)

2. **Two different subscriptions, concurrent webhooks**
   - Event A for `sub_123` (customer: `cus_A`)
   - Event B for `sub_456` (customer: `cus_B`)
   - Provider has two trials (one per customer)
   - Result: Each links to correct trial row

3. **Trial with stripeCustomerId set**
   - Trial created with `stripeCustomerId: 'cus_xxx'`
   - Webhook arrives with matching customer
   - Result: Correct trial claimed

4. **Trial without stripeCustomerId (legacy data)**
   - Trial created before fix (stripeCustomerId: null)
   - Webhook arrives
   - Result: Graceful handling (fallback or create new)

5. **No trial exists**
   - Webhook arrives, no matching trial
   - Result: Create new subscription row

6. **Already linked subscription**
   - Webhook arrives, subscription already has stripeSubscriptionId
   - Result: Update existing subscription (idempotent)

7. **Provider with multiple customers**
   - Provider has 2 Stripe customers
   - Each customer has a trial subscription
   - Webhooks for both arrive
   - Result: Each links to correct trial (no cross-contamination)

---

**Status**: Ready for implementation with complete solution

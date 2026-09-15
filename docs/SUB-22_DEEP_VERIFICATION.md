# SUB-22 Deep Verification: Production Data + Concurrency + stripeSubscriptionId Invariant

**Date**: 2026-09-11  
**Type**: VERIFICATION ONLY — no code changes  
**Builds on**: `docs/SUB-22_VERIFICATION.md`  
**Scope**: Four checks requested before any migration design:
1. Production data query — live duplicates, stripeSubscriptionId duplicates
2. Re-subscription semantics — audit vs compensating code
3. Webhook SERIALIZABLE concurrency — is the fallback create() actually a proven race?
4. Constraint design — correct invariant from actual evidence

---

## Check 1: Production Data Query

### Method

Live read-only query against production Supabase (2026-09-11):

```sql
-- Status distribution
SELECT status, COUNT(*)::int AS count FROM "Subscription" GROUP BY status ORDER BY count DESC;

-- Providers with multiple rows (any status)
SELECT "providerId", COUNT(*)::int AS total_rows FROM "Subscription"
GROUP BY "providerId" HAVING COUNT(*) > 1 ORDER BY total_rows DESC LIMIT 50;

-- Providers with multiple live rows (non-terminal statuses)
SELECT "providerId", COUNT(*)::int AS live_row_count, array_agg(status ORDER BY "createdAt" DESC) AS statuses
FROM "Subscription" WHERE status NOT IN ('CANCELLED', 'EXPIRED', 'INCOMPLETE_EXPIRED')
GROUP BY "providerId" HAVING COUNT(*) > 1 ORDER BY live_row_count DESC LIMIT 50;

-- Duplicate non-null stripeSubscriptionId
SELECT "stripeSubscriptionId", COUNT(*)::int AS count FROM "Subscription"
WHERE "stripeSubscriptionId" IS NOT NULL GROUP BY "stripeSubscriptionId" HAVING COUNT(*) > 1;

-- Unlinked rows (no stripeSubscriptionId) by status
SELECT status, COUNT(*)::int AS count FROM "Subscription"
WHERE "stripeSubscriptionId" IS NULL GROUP BY status ORDER BY count DESC;
```

### Results (actual production output)

```json
{
  "totalRows": [{ "total": 19 }],
  "statusDistribution": [
    { "status": "TRIAL", "count": 18 },
    { "status": "ACTIVE", "count": 1 }
  ],
  "providersWithMultipleRows": [],
  "liveDuplicatesByStatus": [],
  "providersWithMultipleLiveRows": [],
  "duplicateStripeSubscriptionIds": [],
  "unlinkedRowsByStatus": [
    { "status": "TRIAL", "count": 18 },
    { "status": "ACTIVE", "count": 1 }
  ]
}
```

### Interpretation

**Total rows**: 19  
**Status distribution**: 18 TRIAL, 1 ACTIVE — no CANCELLED, EXPIRED, TRIALING, INCOMPLETE, PAST_DUE  
**Duplicates (any status)**: ZERO  
**Duplicates (live statuses)**: ZERO  
**Duplicate stripeSubscriptionId**: ZERO  
**Unlinked rows** (no stripeSubscriptionId): ALL 19 rows  

#### What this means

1. **No current duplicates exist in production.** The finding is a structural/architectural risk, not an existing data problem. A partial unique index will not fail at migration time.

2. **All 19 rows have `stripeSubscriptionId = NULL`.** This means every current provider is on a local TRIAL that has never been converted to a paid Stripe subscription. No provider has ever gone through the checkout-to-paid flow on this instance. This is a development/test environment characteristic or an early-stage production instance.

3. **The re-subscribe path (CANCELLED → new row) has never been exercised in production.** No terminal rows exist, so the question of whether a re-subscribe creates a duplicate is theoretical — it has never happened.

4. **The `TRIALING`/`INCOMPLETE` status gap is also theoretical.** These statuses would only appear via Stripe webhook delivery, and no webhook has ever set any row because all rows are unlinked.

5. **`stripeSubscriptionId` uniqueness**: No duplicates exist. A `WHERE stripeSubscriptionId IS NOT NULL` partial unique index could be added immediately without conflict.

---

## Check 2: Re-subscription Semantics — Audit vs Compensating Code

### The re-subscribe flow traced end-to-end

**Scenario**: Provider had a TRIAL, it expired → EXPIRED status (via cron). Provider now re-subscribes via `/api/subscriptions/checkout`.

**Step 1: `/api/subscriptions/checkout/route.ts` (lines 65–69)**

```typescript
const existingSubscription = await prisma.subscription.findFirst({
  where: { providerId: user.provider?.id },
  orderBy: { createdAt: 'asc' },   // ← oldest first = checks if ANY row exists ever
});
const hasHadTrial = !!existingSubscription;
const trialDays = hasHadTrial ? 0 : plan.trialDays;
```

**Effect**: Finds the old EXPIRED row. Sets `trialDays = 0`. Creates Stripe Checkout with no trial. Correct business logic — no second free trial.

**Step 2: Stripe Checkout completes**

`checkout.session.completed` fires → `handleCheckoutCompleted()`:
- Finds no matching row by `stripeSubscriptionId: null` for the trial row (the EXPIRED row has `stripeSubscriptionId = null`) — **actually would find it** via `updateMany` at line 600 (matches `stripeCustomerId` + `stripeSubscriptionId: null` + `status: { in: ['TRIAL','ACTIVE'] }`)
- But the EXPIRED row has `status = 'EXPIRED'` — **not in the filter** `['TRIAL', 'ACTIVE']`
- Falls through to the `else` branch with `updateMany({ where: { providerId } })` — updates ALL rows for that provider

**Specific lines 600–607**:
```typescript
const claimResult = await tx.subscription.updateMany({
  where: {
    providerId,
    stripeCustomerId: customer as string,
    stripeSubscriptionId: null,
    status: { in: ['TRIAL', 'ACTIVE'] },  // ← EXPIRED excluded
  },
  data: { tier, status: 'ACTIVE', stripeSubscriptionId: stripeSubId },
});
```

If `claimResult.count === 0`:
- Checks for row by `stripeSubscriptionId: stripeSubId` (not found — new subscription)
- Falls to `else` / `updateMany({ where: { providerId } })` — updates ALL rows including EXPIRED

**Lines 630–638**:
```typescript
logger.warn(`No trial row found for providerId=${providerId}...`);
await tx.subscription.updateMany({
  where: { providerId },          // ← ALL rows for this provider
  data: {
    tier: tier as any,
    status: 'ACTIVE',
    stripeCustomerId: customer as string,
    stripeSubscriptionId: stripeSubId,
  },
});
```

**Effect**: The EXPIRED row is **updated in place** to ACTIVE with the new `stripeSubscriptionId`. No new row is created by `handleCheckoutCompleted`.

**Step 3: `customer.subscription.created` fires**

`handleSubscriptionUpdate()` runs. Finds no row with `stripeSubscriptionId = sub_new` (the updateMany in step 2 hasn't linked it yet — these webhook events can race). Falls to trial row search: finds the EXPIRED row (now ACTIVE after step 2). Updates it further. No new row created.

**Key finding**: The re-subscribe path does NOT inherently create a second row. The concern in SUB-22 initial verification was correct in identifying the **theoretical** path but the actual code paths update existing rows. The fallback `create()` only fires when:
- No row exists by `stripeSubscriptionId` (not found), AND
- No row exists with `stripeSubscriptionId: null, status: { in: ['TRIAL','ACTIVE'] }` (not found)

After a re-subscribe, the old EXPIRED row has been updated to ACTIVE (by `handleCheckoutCompleted`), so the second condition won't hit the fallback create.

**Conclusion on re-subscribe semantics**: The existing multiple-row architecture is **compensating code**, not an audit requirement. There is no separate subscription history table — history is implicit in the same table via status values. The system was designed assuming one row would be updated through its lifecycle, but the `create()` fallback exists as a safety net for providers who joined before the current flow existed. The `findFirst(orderBy: createdAt desc)` patterns throughout are compensation for the possibility of multiple rows, not a deliberate design choice to have them.

---

## Check 3: Webhook SERIALIZABLE Concurrency — Is the Race Actually Exploitable?

### The code path

```typescript
await withSerializableRetry(async () => {
  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(tx, idempotencyKey, ...);  // ← P2002 if duplicate
    
    const existingSubscription = await tx.subscription.findFirst(
      { where: { stripeSubscriptionId: subscription.id } }
    );
    
    if (existingSubscription) {
      // update path
    } else {
      const trialRow = await tx.subscription.findFirst({
        where: { providerId, stripeSubscriptionId: null, status: { in: ['TRIAL','ACTIVE'] } }
      });
      
      if (trialRow) {
        // update path
      } else {
        await tx.subscription.create({ ... });  // ← fallback create
      }
    }
  }, SERIALIZABLE_TX);
}, { operationName: '...' });
```

### `withSerializableRetry` behaviour (from `lib/utils/transaction-retry.ts`)

- Catches `P2034` (PostgreSQL serialization failure)
- Retries up to `maxRetries` times (default 2) with exponential backoff
- Does NOT retry business errors or unknown errors
- Retry re-executes the **entire** transaction callback from the top

### PostgreSQL SERIALIZABLE isolation behaviour for this pattern

**Scenario**: Two concurrent deliveries of **different** events (`subscription.created` and `subscription.updated`) for the same Stripe subscription, both calling `handleSubscriptionUpdate()`.

Both events have **different** `idempotencyKey` values (because they encode `event.type + event.id + event.created`). Therefore `recordWebhookEvent()` does not P2002 block the second one.

**Transaction A** (sub.created): `findFirst` → null (no row yet) → `findFirst(trialRow)` → finds TRIAL row → `update(trialRow, { stripeSubscriptionId: sub_X })`

**Transaction B** (sub.updated): starts concurrently. Under SERIALIZABLE:

PostgreSQL SERIALIZABLE uses "Serializable Snapshot Isolation" (SSI). It tracks read/write conflicts. If Transaction B reads the TRIAL row **before** Transaction A writes it, PostgreSQL will detect a read-write conflict and abort one transaction with serialization failure.

**However**, there is a subtle point: the fallback `create()` path only fires when BOTH `findFirst` calls return null. For that to happen with two concurrent transactions:
- Both would need to observe no matching row by `stripeSubscriptionId`
- Both would need to observe no trial row

Under SSI, if Transaction A creates a row and Transaction B reads before A commits, PostgreSQL **may** allow both reads to return null (both see the pre-commit snapshot) and then abort B when A commits. B would retry, find A's row, and take the update path.

**Verdict**: The SERIALIZABLE isolation + `withSerializableRetry` combination **does** provide protection against two concurrent fallback `create()` calls producing two committed rows, because PostgreSQL SSI will abort the losing transaction (P2034) and the retry will find the first transaction's row.

**However**, there is one gap: if both events are for different Stripe subscriptions of the same provider (unlikely but theoretically possible if an admin creates two subscriptions in Stripe), both could successfully create a row. SERIALIZABLE protects the read-write conflict, not the business invariant "only one live sub per provider."

**Conclusion on concurrency**: The fallback create race is **not independently proven exploitable** under normal single-subscription-per-provider operation. The SERIALIZABLE + retry wrapper provides adequate protection for the common case. The risk is limited to the edge case of two different Stripe subscriptions for the same provider arriving simultaneously — which requires an unusual Stripe-side configuration.

---

## Check 4: Constraint Design — Correct Invariant from Actual Evidence

### Summary of findings

| Dimension | Finding |
|---|---|
| Current duplicates in production | ZERO |
| `TRIALING`/`INCOMPLETE` in production | ZERO (all rows are TRIAL or ACTIVE, local-only) |
| `stripeSubscriptionId` duplicates | ZERO |
| All rows have `stripeSubscriptionId = null` | TRUE (19/19) |
| Terminal rows (CANCELLED/EXPIRED) | ZERO |
| Re-subscribe creates new row | NOT confirmed — existing rows updated in place |
| Webhook race is proven exploitable | NOT confirmed — SERIALIZABLE + retry provides protection |

### The exact constraints that are safe to add now

Given the production data state (no duplicates, no terminal rows, all null `stripeSubscriptionId`):

#### Constraint 1: Partial unique index on live rows (providerId)

```sql
CREATE UNIQUE INDEX subscription_provider_active_unique
ON "Subscription" ("providerId")
WHERE status NOT IN ('CANCELLED', 'EXPIRED', 'INCOMPLETE_EXPIRED');
```

**Safe to apply immediately**: zero violations in production.  
**What it prevents**: Two TRIAL/ACTIVE/TRIALING/INCOMPLETE/PAST_DUE rows for the same provider.  
**What it allows**: Historical CANCELLED/EXPIRED rows alongside new live rows.

**Predicate coverage question**: Does `NOT IN ('CANCELLED', 'EXPIRED', 'INCOMPLETE_EXPIRED')` cover all intermediate states?

From the webhook source, `normalizeStatus()` can produce these values:
- `TRIALING` (from Stripe's `trialing`)
- `INCOMPLETE` (from Stripe's `incomplete`)
- `ACTIVE` (from Stripe's `active`)
- `PAST_DUE` (from Stripe's `past_due`)
- `CANCELLED` (from Stripe's `canceled`)
- `INCOMPLETE_EXPIRED` (from Stripe's `incomplete_expired`)
- `UNPAID` (from Stripe's `unpaid`)
- `PAUSED` (from Stripe's `paused`)
- `TRIAL` (from local creation)
- Any uppercase Stripe status verbatim

**Terminal statuses** (can never become active again): `CANCELLED`, `EXPIRED`, `INCOMPLETE_EXPIRED`  
**All others** are either active or can transition to active.

**Correct predicate**: `WHERE status NOT IN ('CANCELLED', 'EXPIRED', 'INCOMPLETE_EXPIRED')`

This correctly covers `TRIALING`, `INCOMPLETE`, `ACTIVE`, `TRIAL`, `PAST_DUE`, `UNPAID`, `PAUSED` — all of which can represent or lead to a live subscription.

#### Constraint 2: Partial unique index on non-null stripeSubscriptionId

```sql
CREATE UNIQUE INDEX subscription_stripe_id_unique
ON "Subscription" ("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;
```

**Safe to apply immediately**: zero violations in production.  
**What it prevents**: The same Stripe subscription linked to two Subscription rows.  
**What it allows**: Multiple rows with `stripeSubscriptionId = null` (local trial rows, historical rows before Stripe was linked).

**This is the more important invariant** for financial correctness: one Stripe subscription should correspond to exactly one local row.

#### What to NOT add

- `@@unique([providerId])` — too broad, breaks historical rows
- `@@unique([stripeSubscriptionId])` — breaks null rows (Prisma treats all nulls as distinct values for unique constraints, but a partial index is cleaner)

### Recommended constraint pair

```sql
-- Invariant 1: one live subscription per provider
CREATE UNIQUE INDEX subscription_provider_active_unique
ON "Subscription" ("providerId")
WHERE status NOT IN ('CANCELLED', 'EXPIRED', 'INCOMPLETE_EXPIRED');

-- Invariant 2: one local row per Stripe subscription
CREATE UNIQUE INDEX subscription_stripe_id_unique
ON "Subscription" ("stripeSubscriptionId")
WHERE "stripeSubscriptionId" IS NOT NULL;
```

Both are partial indexes, safe to add with zero pre-existing violations, and express the actual business invariants correctly.

---

## Pre-conditions for Applying Constraints

1. **Constraint 1 pre-condition**: Before adding, verify `subscription_provider_active_unique` would not violate. Run:
   ```sql
   SELECT "providerId", COUNT(*) FROM "Subscription"
   WHERE status NOT IN ('CANCELLED', 'EXPIRED', 'INCOMPLETE_EXPIRED')
   GROUP BY "providerId" HAVING COUNT(*) > 1;
   ```
   **Current result**: 0 rows. Safe to add.

2. **Constraint 2 pre-condition**: Before adding, verify `subscription_stripe_id_unique` would not violate. Run:
   ```sql
   SELECT "stripeSubscriptionId", COUNT(*) FROM "Subscription"
   WHERE "stripeSubscriptionId" IS NOT NULL
   GROUP BY "stripeSubscriptionId" HAVING COUNT(*) > 1;
   ```
   **Current result**: 0 rows. Safe to add.

3. **Code path compatibility**: The fallback `create()` in the webhook would now fail with a P2002 unique violation if a duplicate live row was attempted. The webhook does NOT currently catch P2002 as a recoverable error — it would propagate as a 500 and Stripe would retry. On retry, the live row would be found and the update path taken. This is safe but inelegant — the error handler should explicitly catch P2002 on the subscription create and treat it as an idempotent "already created" condition.

4. **`TRIALING` normalisation and access gate gap** (Issue A from SUB-04-A): This is a separate defect. Adding the unique constraint does not fix or worsen it.

---

## Final Status Table

| Question | Answer |
|---|---|
| Duplicate live rows in production today | ✅ None — zero violations |
| Duplicate stripeSubscriptionId in production today | ✅ None — zero violations |
| `TRIALING`/`INCOMPLETE` rows in production | ✅ None — all rows are TRIAL or ACTIVE (local only) |
| Does re-subscribe path create a new row? | ✅ No — existing rows updated in place via `updateMany({ where: { providerId } })` |
| Is the webhook fallback create() a proven race? | ✅ Not proven — SERIALIZABLE + withSerializableRetry provides protection for single-sub case |
| Safe to add partial unique on (providerId, live statuses)? | ✅ Yes — zero pre-existing violations |
| Safe to add partial unique on (stripeSubscriptionId, non-null)? | ✅ Yes — zero pre-existing violations |
| Should `@@unique([providerId])` be added? | ❌ No — incompatible with intentional historical multi-row design |
| Should predicate include TRIALING, INCOMPLETE, PAST_DUE? | ✅ Yes — use NOT IN ('CANCELLED', 'EXPIRED', 'INCOMPLETE_EXPIRED') |
| Code change needed alongside migration? | ✅ Yes — webhook create() should catch P2002 and treat as idempotent |
| SUB-22 status | **OPEN / P1 — ready for migration design approval** |

---

**Verification complete. No code changed.**

**Evidence base**: Live production data query (2026-09-11) + full source review of all creation paths + `withSerializableRetry` implementation + re-subscribe flow trace.

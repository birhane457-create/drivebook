# SUB-22 Verification: Missing Unique Constraint on Subscription.providerId

**Date**: 2026-09-11  
**Type**: VERIFICATION ONLY — no code changes  
**Finding**: SUB-22 — Subscription table allows multiple rows per provider  
**Severity**: HIGH / P1  
**Methodology**: Source-level inspection of schema, all creation paths, all read patterns, and admin tooling

---

## 1. Schema — Current State

**File**: `prisma/schema.prisma` (lines 396–413)

```prisma
model Subscription {
  id                   String    @id @default(cuid())
  providerId           String                        ← no @unique, no @@unique, no @@index
  tier                 String
  status               String    @default("ACTIVE")
  billingCycle         String    @default("monthly")
  monthlyAmount        Decimal   @db.Decimal(10, 2)
  stripeSubscriptionId String?                       ← no @unique
  stripeCustomerId     String?
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean   @default(false)
  trialEndsAt          DateTime?
  cancelledAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  provider             Provider  @relation(fields: [providerId], references: [id], onDelete: Cascade)
}
```

**Confirmed**: No unique constraint on `providerId`. No index on `providerId`. No unique constraint on `stripeSubscriptionId`. Multiple rows per provider are **structurally permitted** at the database level.

---

## 2. Intended Cardinality — Is One-Per-Provider the Design?

**Evidence from code comments and patterns**:

**From `app/api/stripe/webhook/route.ts` lines 1485–1487**:
```typescript
// If not found, find the most-recent non-stripe trial row for this instructor
// (race condition: customer.subscription.created fires before checkout.session.completed
// stamps the stripeSubscriptionId — so we link it rather than create a duplicate).
```

**From lines 1516–1518**:
```typescript
// Link the Stripe subscription to the existing trial row — prevents duplicate rows
logger.info(`🔗 Linking Stripe subscription ${subscription.id} to existing trial row ${trialRow.id}...`);
```

**Conclusion**: The codebase explicitly treats "one active row per provider" as the intended invariant. The code actively works to prevent duplicates via linking logic. However, this is **application-level enforcement only** — no database constraint backs it up.

---

## 3. All Subscription Creation Paths

### Path 1: `/api/register/route.ts` — User registration

**Lines ~147–162**:
```typescript
await tx.subscription.create({
  data: {
    provider: { connect: { id: provider.id } },
    tier: 'BASIC',
    status: 'TRIAL',
    ...
  },
})
```

**Context**: Runs inside the registration transaction. No pre-check for existing rows (none should exist for a new provider). Safe for new registrations. **Cannot produce duplicates** for genuinely new providers.

**Risk**: If registration fails partway and is retried, no idempotency guard prevents creating a second TRIAL row. **Low risk** in practice (unlikely scenario).

---

### Path 2: `/api/instructor/subscription/route.ts` — In-app trial/tier selection

**Lines 280–314** (web POST handler, inside `$transaction` with `Serializable` isolation):
```typescript
const raceCheck = await tx.subscription.findFirst({
  where: {
    providerId: user.provider!.id,
    status: { in: ['TRIAL', 'ACTIVE'] },
  },
});

if (raceCheck) {
  return { existing: raceCheck };   // ← early return, no create
}

const newSub = await tx.subscription.create({ ... });
```

**Protection**: Race check inside SERIALIZABLE transaction (SUB-02-B fix). Prevents concurrent calls from creating duplicates. **Application-level** protection.

**Risk**: If an EXPIRED or CANCELLED row exists and the provider starts a new trial, this creates a **second** Subscription row. The `status: { in: ['TRIAL', 'ACTIVE'] }` filter means EXPIRED/CANCELLED rows are not found by the race check — new TRIAL row is created alongside old inactive row.

**Is this intentional?** Yes — the codebase tolerates historical rows. The `findFirst(orderBy: createdAt desc)` pattern reads the most recent active one.

---

### Path 3: `/api/instructor/subscription/mobile/route.ts` — Mobile POST

**Lines 86–89**:
```typescript
const existing = await prisma.subscription.findFirst({
  where: { providerId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } },
});
```

Then inside `$transaction` with Serializable, line 118–121:
```typescript
const raceCheck = await tx.subscription.findFirst({
  where: { providerId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } },
});
```

Same SUB-02-B pattern. Same risk: historical rows accumulate.

---

### Path 4: `app/api/stripe/webhook/route.ts` — `handleSubscriptionUpdate()` fallback create

**Lines 1531–1546** — only reached when:
- No row found by `stripeSubscriptionId`
- No trial row found for the provider

```typescript
await tx.subscription.create({
  data: {
    providerId,
    tier: tier as any,
    status: normalizeStatus(status) as any,
    ...
  }
});
```

**Risk**: This is a **fallback create** with no unique check. If the provider already has a CANCELLED row (not found by `{ stripeSubscriptionId: null, status: { in: ['TRIAL', 'ACTIVE'] } }`) and a webhook creates a new row, this produces a second row.

**Specific scenario**:
1. Provider cancelled subscription (row status = 'CANCELLED', stripeSubscriptionId = 'sub_old')
2. Provider re-subscribes via Billing Portal
3. Stripe fires `subscription.created` with a NEW `stripeSubscriptionId`
4. Webhook `handleSubscriptionUpdate()`: looks for row with `stripeSubscriptionId = 'sub_new'` — not found
5. Looks for trial row with `stripeSubscriptionId = null` — not found (old row has `stripeSubscriptionId = 'sub_old'`)
6. **Falls through to `create()`** — produces second Subscription row

This is a **confirmed duplicate creation path** for re-subscribing providers.

---

### Path 5: `scripts/register-test-users.ts` — Script only

Development script, not production code. No concern.

---

## 4. Compensating Read Patterns — `findFirst` + `orderBy createdAt`

The following patterns explicitly compensate for multiple rows by taking the "most recent" one:

| Location | Pattern |
|---|---|
| `webhook/route.ts` line 1506–1510 | `findFirst({ where: { providerId, stripeSubscriptionId: null, status: { in: [...] } }, orderBy: { createdAt: 'desc' } })` |
| `mobile/route.ts` line 43–46 | `findFirst({ where: { ... }, orderBy: { createdAt: 'desc' } })` |
| `admin subscription route` line 373–374 | `findFirst({ where: { providerId, stripeSubscriptionId: null }, orderBy: { createdAt: 'desc' } })` |
| `admin sync` line ~151 | `subscriptions: { ..., orderBy: { createdAt: 'desc' }, take: 1 }` |
| `subscriptions/checkout` line 66–69 | `findFirst({ where: { providerId }, orderBy: { createdAt: 'asc' } })` (checking if they've EVER had a trial) |

**Confirmed**: Multiple compensating patterns exist. The system is **designed to tolerate** historical rows by reading the most-recent active one.

---

## 5. Admin Route — Explicitly Exposes Multiple Rows

**`GET /api/admin/instructors/[id]/subscription`** returns:
```typescript
subscriptions: instructor.subscriptions,  // plural — ALL rows, ordered by createdAt desc
```

The admin UI receives all rows. Admin tooling explicitly supports the existence of multiple historical Subscription rows.

**Admin POST `override_tier`** uses `updateMany`:
```typescript
await tx.subscription.updateMany({
  where: { providerId: params.id, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
  data: { tier: tier as any, status: newStatus as any },
});
```

This updates **all** active/trial rows — a defensive pattern against multiple rows.

---

## 6. Is `@@unique([providerId])` Safe to Add?

### Incompatible with the current model

**No — `@@unique([providerId])` cannot be safely added without data migration and a design change.**

Reasons:

**Reason 1: Historical rows by design**  
Expired/cancelled rows are intentionally retained alongside new active rows. A unique constraint on `providerId` would prevent this entirely. A `UNIQUE WHERE status IN ('TRIAL', 'ACTIVE')` partial index would be closer to the intent, but Prisma does not support partial unique indexes in schema syntax.

**Reason 2: Re-subscribe path creates second row**  
Path 4 above creates a new row when a provider re-subscribes. A global `@@unique([providerId])` would break this.

**Reason 3: Existing duplicate rows may already exist in production**  
The admin route exposes `subscriptions` (plural). Its existence suggests admins have seen multiple rows per provider. Applying `@@unique([providerId])` to a database with existing duplicates would fail at migration time.

**Reason 4: `stripeSubscriptionId` uniqueness is the more critical invariant**  
The operationally dangerous duplicate is two ACTIVE rows pointing to two different `stripeSubscriptionId` values for the same provider. A partial unique index like:
```sql
CREATE UNIQUE INDEX subscription_provider_active_unique
ON "Subscription" ("providerId")
WHERE status IN ('TRIAL', 'ACTIVE');
```
would be more surgically correct. But this too requires:
- Verifying no existing `(providerId, TRIAL/ACTIVE)` duplicates in production
- Handling the re-subscribe path that currently creates a second row

---

## 7. Concurrent Creation Risk — Can Two ACTIVE Rows Exist Simultaneously?

### Web and Mobile paths (SUB-02-A/B fixed)

The `raceCheck` inside SERIALIZABLE transaction prevents concurrent creation of two TRIAL/ACTIVE rows from the same path. **Protected for web/mobile trial creation.**

### Webhook path (not protected)

The webhook `handleSubscriptionUpdate()` fallback `create()` at line 1531 has **no equivalent raceCheck**. If two concurrent webhook deliveries of `subscription.created` both pass through the linking logic (because neither finds a matching row before the other commits), both will create a new Subscription row.

**However**, the idempotency system (`recordWebhookEvent`) with `@unique` on `idempotencyKey` prevents the same webhook event from being processed twice. The idempotency claim is recorded **first** inside the SERIALIZABLE transaction, before the `subscription.create()`. If two concurrent deliveries of the **same** event arrive, only one can claim the idempotency key.

**The unprotected case**: Two **different** Stripe events (e.g. `subscription.created` and `subscription.updated`) that both trigger `handleSubscriptionUpdate()` and both fall through to the create path simultaneously. These have different `idempotencyKey` values, so neither blocks the other. Both could create a row.

**How likely?** Stripe typically fires `subscription.created` before `subscription.updated`. In the normal flow, `subscription.created` creates the row; `subscription.updated` finds it via `findFirst` and updates it. The create path only triggers if no row exists for the subscription — which is true on first delivery of either event. If they arrive in the wrong order or nearly simultaneously, both could hit the `create()` branch.

---

## 8. Summary of Actual vs Intended Cardinality

| Row type | Multiple rows per provider? | Intentional? |
|---|---|---|
| Historical EXPIRED/CANCELLED rows | Yes — accumulate over time | Yes — by design (admin can view full history) |
| Active TRIAL + Active ACTIVE simultaneously | Should not happen — race check prevents it on web/mobile | No — undesirable |
| Two ACTIVE rows from re-subscribe | Can happen via webhook fallback path | Probably not intended |
| Two webhook-created ACTIVE rows (race) | Possible if `subscription.created` + `subscription.updated` race | Not intended |

---

## 9. Verdict

### SUB-22 Finding: Missing unique constraint on Subscription.providerId

**VERDICT: CONFIRMED OPEN — but `@@unique([providerId])` is the wrong fix**

The finding is confirmed: there is no database-level constraint preventing multiple Subscription rows per provider. The system compensates with application-level `findFirst(orderBy: createdAt desc)` patterns throughout.

However, a global `@@unique([providerId])` constraint is **incompatible** with the current data model because:
1. Historical rows (EXPIRED/CANCELLED) are intentionally retained
2. Re-subscribe path deliberately creates second rows
3. Existing production data likely has multiple rows per provider

**The correct fix scope is narrower**:

**Option A**: Partial unique index — `UNIQUE (providerId) WHERE status IN ('TRIAL', 'ACTIVE')` — prevents two simultaneously active rows without breaking historical data.

**Pre-conditions before any fix**:
1. Query production DB: `SELECT "providerId", COUNT(*) FROM "Subscription" WHERE status IN ('TRIAL', 'ACTIVE') GROUP BY "providerId" HAVING COUNT(*) > 1` → must return zero rows
2. Fix the re-subscribe webhook path so it updates an existing row rather than creating a new one
3. Fix the webhook race (concurrent `subscription.created` + `subscription.updated`) to also use `upsert` or `update-or-create` with idempotency

**Option B**: Add `@@index([providerId])` (not unique) to improve query performance and document the intentional multi-row design. This does not prevent duplicates but at least makes the pattern explicit and efficient.

---

## 10. Evidence Table

| Claim | Source | Verified |
|---|---|---|
| No unique constraint on `providerId` | `schema.prisma` lines 396–413 | ✅ |
| No index on `providerId` at all | `schema.prisma` (no `@@index`) | ✅ |
| System intentionally tolerates historical rows | Webhook comments lines 1485–1487, 1516 | ✅ |
| `findFirst(orderBy: createdAt desc)` is the compensating pattern | Multiple locations (see Section 4) | ✅ |
| Admin route returns plural `subscriptions` array | Admin GET route lines 37–52 | ✅ |
| SUB-02-A/B race check protects web/mobile trial creation | `instructor/subscription/route.ts` lines 280–314 | ✅ |
| Webhook fallback `create()` has no raceCheck | `webhook/route.ts` lines 1531–1546 | ✅ |
| Idempotency prevents same webhook event being processed twice | `webhook/route.ts` lines 91–98 | ✅ |
| `@@unique([providerId])` would break the re-subscribe path | Path 4 analysis + schema | ✅ |
| Partial `WHERE status IN ('TRIAL','ACTIVE')` index is closer to intent | Section 6 analysis | ✅ (analysis) |

---

**Verification complete. No code changed.**

**Next step before any fix**: Query production Supabase for existing `(providerId, TRIAL/ACTIVE)` duplicates. If any exist, they must be resolved before a partial unique index can be applied.

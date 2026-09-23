# PAY-H-04: SlotReservation Concurrency Gap — Investigation

**Status:** VERIFIED — REMEDIATION DESIGN IN PROGRESS
**Date:** 2026-09-22
**Branch:** audit/int-m03a-test-verified

---

## 1. Finding Summary

The `SlotReservation` table has no uniqueness or exclusion constraint. The application
enforces slot exclusivity through in-code range-overlap checks (TOCTOU pattern).
Two concurrent requests can both pass the overlap check and both insert overlapping
reservations before either can see the other's write.

The tracker originally listed the fix as:

> `@@unique([providerId, startTime])`

**That fix is rejected.** It does not prevent interval overlap — two rows with different
`startTime` values can still describe overlapping intervals. See Section 4.

---

## 2. Schema (confirmed)

```prisma
model SlotReservation {
  id         String   @id @default(cuid())
  providerId String
  sessionId  String
  startTime  DateTime
  endTime    DateTime
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([providerId, expiresAt])
  @@index([sessionId])
}
```

**No uniqueness constraint of any kind.** Three migrations have touched this table
since initial creation and none has added one.

Migration history:
- `20260613150000_add_missing_tables` — initial creation, no constraint
- `20260617000001_add_slot_reservation_end_time` — added `endTime` column, no constraint
- `20260816074701_add_user_provider_id` — renamed `instructorId`→`providerId`, no constraint

---

## 3. Both Creation Paths

### Path A — `app/api/availability/check-and-reserve/route.ts`

Used by the slot-picker UI. Three separate, sequential DB operations with **no
transaction wrapper**:

```
deleteMany (expired rows for this provider)
  ↓
findFirst  (overlap check — other sessions, non-expired)
  ↓
  if no conflict:
    create (new SlotReservation)
```

The `findFirst` overlap condition:
```typescript
{
  providerId,
  sessionId: { not: sessionId },         // exclude own session
  expiresAt: { gt: now },                // active only
  AND: [
    { startTime: { lt: endDateTime } },  // open-interval overlap
    { endTime: { gt: startDateTime } }
  ]
}
```

**TOCTOU exposure:** Two concurrent POST requests both call `findFirst`, both
get null (no conflict), both proceed to `create`. Two overlapping active
reservations now exist. There is no database operation that prevents this.

### Path B — `app/api/public/bookings/bulk/route.ts`

Used by the voice AI and booking form for immediate bookings. The check-and-create
is wrapped in `prisma.$transaction()`, but at **default READ COMMITTED isolation**.

```typescript
booking = await prisma.$transaction(async (tx) => {
  // Conflict check — Booking table only (NOT SlotReservation)
  const conflict = await tx.booking.findFirst({
    where: {
      providerId,
      status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
      OR: [ /* range overlap */ ]
    }
  });
  if (conflict) throw new Error('SLOT_TAKEN');

  // Create SlotReservation
  await tx.slotReservation.create({ ... });

  // Create Booking
  const newBooking = await tx.booking.create({ ... });
  return newBooking;
});
```

**Two defects in Path B:**

1. **READ COMMITTED does not prevent phantom reads.** Under READ COMMITTED, both
   concurrent transactions can read the same "no conflict" snapshot and both commit
   overlapping writes. Only SERIALIZABLE or explicit locking prevents this.

2. **Conflict check only inspects the `Booking` table.** An active `SlotReservation`
   created via Path A is invisible to the Path B check. A user who reserved a slot
   via the booking UI (Path A) is not protected against a concurrent Path B booking
   for the same interval.

---

## 4. Why `@@unique([providerId, startTime])` Is Wrong

The rejected constraint would prevent two rows with identical `(providerId, startTime)`.
It does not prevent:

```
Row A: providerId=X  startTime=10:00  endTime=11:00   (inserted first)
Row B: providerId=X  startTime=10:30  endTime=11:30   (inserted second)
```

Row B has a different `startTime` — it passes the unique constraint. Both rows
now exist with a 30-minute overlap. The invariant is violated.

---

## 5. Boundary Semantics (confirmed)

The overlap check uses **strict open-interval inequality**:

```
reservation.startTime < thisEndDateTime
AND
reservation.endTime   > thisStartDateTime
```

This is the standard half-open interval overlap test for `[A.start, A.end)` vs
`[B.start, B.end)`: overlap iff `A.start < B.end AND B.start < A.end`.

**Implication for back-to-back slots:** `10:00–11:00` and `11:00–12:00` do NOT
conflict (11:00 > 11:00 is false). Any fix must preserve this behaviour — adjacent
slots that share an exact boundary must remain bookable.

---

## 6. Expiry and Cleanup

- Cron: `lib/jobs/slotReservationCleanup.ts` runs every 10 minutes, deletes
  `expiresAt < now` rows.
- Inline: both `check-and-reserve` and `validate-slots` run `deleteMany({ expiresAt: { lt: now } })`
  before overlap checks, scoped to the `providerId`.
- Overlap checks filter `expiresAt: { gt: now }` — expired rows are never counted
  as active conflicts.
- On payment success (Stripe webhook): **SlotReservation is NOT deleted**. The row
  persists until the next cron sweep (~10 minutes). During this window it continues
  to block new reservations — which is intentional since the booking is confirmed.

---

## 7. sessionId Semantics

`sessionId` is a client-generated localStorage token (`bookingSessionId` in
`BookingContext`). It is not a foreign key to any table. Its purpose is to allow
the overlap check to exclude the current user's own reservations, so a user can
re-verify their held slot without self-blocking.

In Path B, `sessionId` is set to the idempotency key or `bulk-${Date.now()}`.

---

## 8. Existing Concurrency Tests

**None.** Zero tests exist for concurrent `SlotReservation` creation. The race
condition has never been exercised in the test suite.

---

## 9. Open Design Questions (blocking remediation)

Before any schema migration or code change is authorised, the following must be
answered:

### Q1 — btree_gist extension availability on Supabase production

`btree_gist` is the correct extension for a combined equality + range exclusion
constraint. Supabase documents it for exactly this range-overlap use case and
extensions can be enabled via the SQL editor.

**However, documentation does not establish the production state of DriveBook's
specific database.** Q1 remains:

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'btree_gist';
```

Run this via the Supabase SQL editor and record the result as audit evidence.
Do not infer production state from general Supabase extension support.

**Status: PENDING — production SQL query required**

### Q2/Q3 — `WHERE (expiresAt > NOW())` predicate: REJECTED

The investigation previously listed this as something to "prototype and verify".
On reflection, it should be **rejected outright**, not deferred to a prototype.

PostgreSQL requires partial-index predicates to use immutable or stable expressions
for index maintenance. `NOW()` and `CURRENT_TIMESTAMP` are classified as **STABLE**
by PostgreSQL, not IMMUTABLE. A partial exclusion constraint whose predicate
contains `NOW()` is not maintainable as an index — database cannot have an index
whose membership automatically changes as wall-clock time advances.

**The design:**
```sql
EXCLUDE USING GIST (
  "providerId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE ("expiresAt" > NOW())   -- REJECTED
```
is not valid and should not be implemented.

**Correct design direction — all-rows constraint:**

```sql
EXCLUDE USING GIST (
  "providerId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
```

No WHERE clause. The constraint covers all rows including expired ones.

**Consequence — the expiry gap becomes an explicit design decision:**

An expired reservation that has not yet been physically deleted will block a new
reservation for the same `(providerId, startTime, endTime)` interval until the
expired row is removed. The current cron runs every 10 minutes; during that window
a new reservation for the same slot would fail with a constraint violation even
though the blocking row is logically expired.

This is not a silent technical detail — it is a user-visible behaviour change.
The application must either:

**Option A (synchronous pre-delete):** Before calling `slotReservation.create()`,
delete expired rows for the same `(providerId, interval)` inline. Path A already
does a broader `deleteMany` scoped to `providerId`; tightening the scope to the
specific interval before the insert would clear the path synchronously.

**Option B (accept the gap):** Accept that in the 10-minute expiry window a slot
that became free may still appear blocked. Given reservations expire in 10 minutes,
a user would need to retry after the cron runs. This may be acceptable for the use
case but must be a deliberate decision.

**This decision must be explicit in the design document before the migration is
written.** It is not a default or an implementation detail.

**Status: PARTIAL CONSTRAINT DESIGN REJECTED — expiry gap decision required**

### Q4 — Path B conflict check must include SlotReservation

Path B (`bulk/bookings`) currently checks only the `Booking` table for conflicts.
An active `SlotReservation` created via Path A is invisible to Path B's check.

**This is a separate application defect from the DB constraint.** The exclusion
constraint will prevent the DB-level double-insert, but Path B will return an
opaque error to the caller rather than the clean 409 it currently returns for
booking conflicts.

After the DB constraint is in place, Path B must also check:
```typescript
await tx.slotReservation.findFirst({
  where: {
    providerId,
    expiresAt: { gt: now },
    AND: [
      { startTime: { lt: endTime } },
      { endTime: { gt: startTime } },
    ],
  },
})
```
and throw `'SLOT_TAKEN'` if found, before the `slotReservation.create()` call.
The DB constraint remains the final concurrency invariant; the application check
provides the clean error response.

**Status: FIX REQUIRED — not blocking constraint design, but required before deployment**

### Q5 — Prisma error code for exclusion constraint violation: prototype required

Prisma documents:
- `P2002` — unique constraint violation
- `P2004` — database constraint failure (generic)
- `P2010` — raw query error

A PostgreSQL `EXCLUDE USING GIST` violation is not a unique constraint — it
will likely surface as `P2004` or a raw error, not `P2002`.

**Q5 is an execution question, not a documentation question.** It requires an
isolated prototype on `localhost:5433/drivebook_test` with the following test
matrix:

| Test | Operation | Expected |
|------|-----------|----------|
| T1 | Insert `(X, 10:00, 11:00)` | Success |
| T2 | Insert `(X, 10:30, 11:30)` — overlaps T1 | Constraint violation |
| T3 | Insert `(X, 11:00, 12:00)` — adjacent to T1 | Success |
| T4 | Insert `(X, 09:00, 10:00)` — adjacent before T1 | Success |
| T5 | Delete T1, then insert `(X, 10:00, 11:00)` | Success |
| T6 | Concurrent inserts of `(X, 10:30, 11:30)` via Promise.all | Exactly one succeeds |
| **T7** | Insert expired row `(X, 10:00, 11:00, expiresAt=past)` then insert fresh `(X, 10:00, 11:00)` | **Second insert blocked until expired row deleted** |

T7 is the critical test for the expiry-gap decision above. Its outcome determines
whether Option A (synchronous pre-delete) or Option B (accept gap) is viable.

For T2, capture the exact Prisma exception:
```
error.constructor
error.code
error.message
error.meta
```
This is the error code the application must catch and map to HTTP 409.

**Status: EXECUTION PROTOTYPE REQUIRED — use localhost:5433/drivebook_test**

---

## 10. Recommended Sequence

The sequence follows the MM-12 methodology: hostile baseline first, then
constraint prototype, then design authorisation.

**Step 1 — Hostile baseline test (PAY-H-04-B)**
Write an HTTP integration test that fires two concurrent POST requests to
`/api/availability/check-and-reserve` with overlapping intervals. Confirm:
- Both requests return 200 (demonstrating the race exists)
- Two overlapping `SlotReservation` rows in the database

This is the PAY-H-04 equivalent of MM-12-B. Required before any schema change.

**Step 2 — btree_gist query on production** (Q1)
Run `SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist'`
via Supabase SQL editor. Record as audit evidence.

**Step 3 — Exclusion constraint prototype on isolated test DB** (Q5)
Apply `btree_gist` and the all-rows exclusion constraint to `drivebook_test`.
Run the T1–T7 test matrix above. Capture the Prisma error code from T2.
Observe T7 to make the Option A / Option B expiry-gap decision.

**Step 4 — Design authorisation**
With Q1–Q5 answered and baseline evidence recorded, write the formal remediation
design (PAY-H-04-C equivalent). Get authorisation before writing the migration.

**Step 5 — Migration + code fix**
Write migration, fix Path B conflict check, implement error handling.

**Step 6 — Independent verification**

---

## 11. Invariant Statement

The correct invariant for PAY-H-04 remediation:

> For a given `providerId`, no two `SlotReservation` rows (regardless of expiry
> state, pending deletion by cron) may have overlapping `[startTime, endTime)`
> intervals.
>
> "Overlapping" uses strict open-interval semantics:
> `A.startTime < B.endTime AND B.startTime < A.endTime`.
>
> Adjacent intervals sharing an exact boundary point are NOT considered overlapping
> (10:00–11:00 and 11:00–12:00 must both be creatable).
>
> **Note on expired rows:** The all-rows constraint means an expired-but-not-yet-
> deleted row continues to enforce the invariant. The application must ensure
> expired rows for the specific target interval are deleted before a new insert
> is attempted (Option A), or accept the 10-minute expiry window (Option B).

---

## 12. Constraint Prototype Results (2026-09-22)

**Script:** `scripts/payh04-constraint-prototype.mjs`
**DB:** `postgresql://postgres:testpass@localhost:5433/drivebook_test`
**Constraint installed:** `EXCLUDE USING GIST ("providerId" WITH =, tsrange("startTime", "endTime", '[)') WITH &&)`

### Q1 — btree_gist availability: ANSWERED

`btree_gist` was **not pre-installed** on the test database (0 rows in pg_extension).
Installed successfully as version 1.7 via `CREATE EXTENSION btree_gist`.

**Production implication:** `btree_gist` must be explicitly installed on the
Supabase production database before the migration runs. The migration must include:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```
Verify separately against production via Supabase SQL editor:
```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';
```

### T1–T7 Test Matrix Results

| Test | Description | Result |
|------|-------------|--------|
| T1 | Insert `(X, 10:00, 11:00)` | ✓ SUCCESS |
| T2 | Insert `(X, 10:30, 11:30)` — overlaps T1 | ✓ CONSTRAINT FIRED |
| T3 | Insert `(X, 11:00, 12:00)` — adjacent end boundary | ✓ SUCCESS — boundary preserved |
| T4 | Insert `(X, 09:00, 10:00)` — adjacent start boundary | ✓ SUCCESS — boundary preserved |
| T5 | Delete T1, re-insert `(X, 10:00, 11:00)` | ✓ SUCCESS — deletion clears constraint |
| T6 | 3× concurrent inserts of `(X, 14:00, 15:00)` | ✓ Exactly 1/3 succeeded — race-safe |
| T7 | Expired row `(X, 16:00, 17:00)`, then fresh `(X, 16:00, 17:00)` | **✗ BLOCKED — OPTION A REQUIRED** |

### Q5 — Prisma error code: ANSWERED

Exclusion constraint violations surface as **`PrismaClientUnknownRequestError`**,
not `PrismaClientKnownRequestError` (P2002). The `code` field is `none`.
The PostgreSQL error code `23P01` appears in the `message` string.

**Catch pattern for application code:**
```typescript
import { Prisma } from '@prisma/client';

function isExclusionConstraintViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientUnknownRequestError &&
    (err.message.includes('23P01') ||
     err.message.includes('SlotReservation_no_overlap'))
  );
}
```
Both the PostgreSQL error code (`23P01`) and the constraint name
(`SlotReservation_no_overlap`) appear in the message — either can be matched.
Using the constraint name is more robust against locale-specific error messages.

**T6 concurrent loser error** confirms the same error class for race losers:
`PrismaClientUnknownRequestError`, PostgreSQL code `23P01`.

### Q2/Q3 and T7 — Option A/B Expiry Decision: ANSWERED — OPTION A REQUIRED

**T7 result:** The fresh insert was **BLOCKED** by the expired-but-not-deleted row.

The all-rows constraint does not distinguish between active and expired rows —
`tsrange` treats both equally. An expired reservation at `(X, 16:00, 17:00)` with
`expiresAt` one second in the past still holds the GIST slot until physically deleted.

After deleting the expired row, the fresh insert succeeded immediately.

**Decision: OPTION A is required.**

The application must synchronously delete expired rows for the target interval
before calling `slotReservation.create()`. Path A already does a broader `deleteMany`
scoped to `providerId` before the overlap check. This must be tightened to also
cover the specific interval being reserved:

```typescript
// Before create(), delete expired rows that overlap the target interval
await prisma.slotReservation.deleteMany({
  where: {
    providerId,
    expiresAt: { lt: new Date() },
    AND: [
      { startTime: { lt: endDateTime } },
      { endTime:   { gt: startDateTime } },
    ],
  },
});
```

This ensures no logically-expired row holds the GIST slot at insert time.
The existing broader `deleteMany` can remain for general cleanup; the scoped
delete is the critical correctness fix.

---

## 13. Design Authorisation Status

All blocking questions answered with one production evidence gap outstanding.

| Q | Question | Status |
|---|----------|--------|
| Q1 test DB | btree_gist on localhost:5433 | VERIFIED — installed as v1.7; was not pre-installed |
| Q1 production DB | btree_gist on Supabase production | **PENDING** — must run `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'` via Supabase SQL editor before deployment; migration must include `CREATE EXTENSION IF NOT EXISTS btree_gist` regardless of result |
| Q2/Q3 | Partial constraint `WHERE (expiresAt > NOW())` | REJECTED (STABLE not IMMUTABLE); all-rows constraint confirmed correct |
| Q4 | Path B must check SlotReservation | CONFIRMED — required in fix scope |
| Q5 | Prisma error code | VERIFIED — `PrismaClientUnknownRequestError`, `code=none`, match on `'23P01'` or `'SlotReservation_no_overlap'` in message |
| Expiry gap | Option A vs B | VERIFIED — **Option A required**; T7 confirmed expired rows block constraint |
| Hostile baseline | Race confirmed in production route | EXECUTION VERIFIED — fd882fa9 |

**Status: SUBSTANTIVELY AUTHORISED** — production Q1 still pending but does not
block design or migration writing. It is a pre-deployment verification step.

### Required implementation architecture

The constraint and the application code must work in layers. The constraint is
the final invariant; the application check provides the clean 409 response. The
synchronous deletion is required so the constraint does not fire on a logically-
expired slot that the application considers available.

```
Path A and Path B
    │
    ├─ 1. deleteMany expired overlapping rows
    │      WHERE providerId = X
    │        AND expiresAt < now
    │        AND startTime < requestedEnd
    │        AND endTime   > requestedStart
    │
    ├─ 2. Application overlap check (findFirst on active rows)
    │      Provides clean 409 before hitting the constraint
    │
    └─ 3. slotReservation.create()
               │
               └── GIST EXCLUSION CONSTRAINT (SlotReservation_no_overlap)
                         ↓
                   final concurrency invariant
                   fires as 23P01 → catch PrismaClientUnknownRequestError
                   → HTTP 409 (same response as app-level check)
```

The application overlap check (step 2) provides fast rejection with a clean
error message before the constraint fires. The constraint (step 3) closes the
race that the application check cannot close alone. Both are required.

Step 1 (synchronous expiry deletion) is what makes step 3 correct — without it,
logically-expired rows would block valid reservations for up to 10 minutes.

### PAY-H-04-C requirements (next gate)

Migration components:
1. `CREATE EXTENSION IF NOT EXISTS btree_gist;`
2. `ALTER TABLE "SlotReservation" ADD CONSTRAINT "SlotReservation_no_overlap" EXCLUDE USING GIST ("providerId" WITH =, tsrange("startTime", "endTime", '[)') WITH &&)` — **no** `WHERE` clause
3. Path A: scoped `deleteMany` (expired, overlapping interval) before `create()`
4. Path B: add `SlotReservation` overlap check alongside existing `Booking` check
5. Both paths: catch `PrismaClientUnknownRequestError` with `23P01`/constraint name → HTTP 409
6. Pre-deployment: verify btree_gist on production Supabase DB

Hostile post-fix concurrency tests required (PAY-H-04-E equivalent) before CLOSED.
Migration must be tested against existing production-like reservation data.
WHERE expiresAt > NOW() must not appear anywhere in the migration.

---

## 14. Migration Preflight — REQUIRED BEFORE PRODUCTION DEPLOYMENT

The exclusion constraint applies to **all existing rows** in `SlotReservation`.
PostgreSQL will reject `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE` at migration
time if any existing rows already overlap. This would fail the deployment (not
silently skip the constraint), leaving the application deployed without the fix.

Three queries must be run against production via the Supabase SQL editor
**before** authorising the production migration. All three results must be
recorded as audit evidence.

### Query 1 — Existing overlap check (MUST return 0 rows)

```sql
SELECT
    a.id            AS reservation_a,
    b.id            AS reservation_b,
    a."providerId",
    a."startTime"   AS a_start,
    a."endTime"     AS a_end,
    b."startTime"   AS b_start,
    b."endTime"     AS b_end
FROM "SlotReservation" a
JOIN "SlotReservation" b
  ON a."providerId" = b."providerId"
 AND a.id < b.id
 AND a."startTime" < b."endTime"
 AND b."startTime" < a."endTime";
```

**Expected: 0 rows.**

If this returns any rows, the migration will fail. The overlapping rows must be
resolved (manually deleted or expired) before the migration can proceed.
This is a deployment blocker.

### Query 2 — Expired-row count (informational, guides pre-migration cleanup)

```sql
SELECT COUNT(*)
FROM "SlotReservation"
WHERE "expiresAt" < NOW();
```

A non-zero result **requires** pre-migration cleanup. Expired rows participate in
the all-rows exclusion constraint until physically deleted, and any that overlap
with other rows (active or expired) will cause Q1 to return rows — blocking the
migration. The correct procedure is:

1. Delete all expired rows:
   ```sql
   DELETE FROM "SlotReservation" WHERE "expiresAt" < NOW();
   ```
2. Re-run Query 1 to confirm 0 overlapping rows remain before proceeding.

### Query 3 — btree_gist extension state (production)

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'btree_gist';
```

**Expected: 1 row** (if pre-installed) or 0 rows (if absent — `CREATE EXTENSION
IF NOT EXISTS btree_gist` in the migration will install it).

The migration handles both cases. This query establishes the pre-migration
production state for audit evidence.

### Migration readiness gate

| Query | Result | Migration proceed? |
|-------|--------|--------------------|
| Q1: existing overlaps | 0 rows | YES |
| Q1: existing overlaps | > 0 rows | NO — resolve overlaps first |
| Q2: expired rows | 0 rows | YES |
| Q2: expired rows | > 0 | Run expiry delete, re-check Q1, then YES |
| Q3: btree_gist | present or absent | YES (migration installs if absent) |

### Migration locking consideration

`ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE` acquires an `ACCESS EXCLUSIVE` lock
on `SlotReservation` and validates all existing rows in a single pass.

The `ACCESS EXCLUSIVE` lock conflicts with all other lock modes, but PostgreSQL
lock acquisition **waits** behind any existing transaction that holds a conflicting
lock — it does not immediately block or error. The operational sequence is:

```
existing conflicting transaction (if any)
        ↓
  migration waits to acquire ACCESS EXCLUSIVE
        ↓
  lock acquired
        ↓
  constraint validation (full table scan)
        ↓
  normal SlotReservation access resumes
```

While the migration is waiting to acquire the lock, new read/write operations
on `SlotReservation` queue behind it. This means a long-running reservation
transaction could cause the migration to hold up subsequent normal operations.

The operational requirements are:

- Ensure no long-running `SlotReservation` transaction is active at migration time.
- Deploy off-peak when active booking volume is low.
- Monitor for lock wait — abort and retry if the migration cannot acquire the lock
  within an acceptable window.
- Have a rollback/abort procedure prepared before starting.

For DriveBook's short-lived reservation population (10-minute TTL, frequent cron
cleanup) the table should be small and the validation scan brief. The lock concern
is primarily about in-flight booking sessions at the moment of migration.

### Evidence required

Record the following before deployment:
- Q1 result (row count and any returned rows)
- Q2 result (count)
- Q3 result (extname, extversion or 0 rows)
- Timestamp of queries
- Whether pre-migration cleanup was required

These results, combined with the post-deployment production verification
(same pattern as MM-12 production verification checklist), constitute the
complete PAY-H-04 closure evidence.

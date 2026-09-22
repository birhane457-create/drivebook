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

### Q1 — Database enforcement strategy

Three candidates:

**Option A — PostgreSQL exclusion constraint (GIST)**
```sql
ALTER TABLE "SlotReservation"
ADD CONSTRAINT slot_no_overlap
EXCLUDE USING GIST (
  "providerId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE ("expiresAt" > NOW());
```
- Enforces the invariant at the DB level for all paths simultaneously.
- Requires `btree_gist` extension. Need to confirm it is available on Supabase.
- `WHERE (expiresAt > NOW())` makes it a partial exclusion — only active rows
  participate. Must verify that a predicate referencing `NOW()` is valid on the
  Supabase/PostgreSQL version in use.
- Back-to-back slots: `tsrange('[)', '[)')` uses half-open intervals, so `[10:00,11:00)`
  and `[11:00,12:00)` do not overlap. Preserves the existing boundary semantics.

**Option B — SERIALIZABLE transaction on both paths**
- Wrap Path A's three operations in `prisma.$transaction(fn, { isolationLevel: 'Serializable' })`.
- Change Path B's transaction to `isolationLevel: 'Serializable'`.
- Both paths must be in the same serialisation scope.
- PostgreSQL will detect the phantom-read anomaly and abort one transaction with
  `ERROR: could not serialize access due to concurrent update`.
- Requires application-level retry logic (currently absent).
- Does not produce a permanent DB invariant; relies on application code being correct.

**Option C — Advisory lock on providerId**
- `SELECT pg_advisory_xact_lock(hashtext($providerId))` at the start of both paths.
- Serialises all reservation attempts for the same provider.
- No schema change required.
- Performance bottleneck under high booking volume for a popular provider.
- Does not survive connection failure — advisory lock is released on disconnect.
  Needs to be inside a transaction to be transaction-scoped.

**Recommended:** Option A (exclusion constraint) as the primary invariant.
Option B (SERIALIZABLE) as the code-level defence. Both together is belt-and-suspenders.

### Q2 — Supabase extension availability

Must confirm before writing the migration:
```sql
SELECT * FROM pg_extension WHERE extname = 'btree_gist';
```
If not installed:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```
Need to verify whether Supabase projects allow `btree_gist` and whether it is
pre-installed on the production database.

### Q3 — Partial exclusion constraint validity

The `WHERE (expiresAt > NOW())` predicate in the exclusion constraint uses a
non-immutable function (`NOW()`). PostgreSQL requires exclusion constraint predicates
to be immutable or stable. Need to verify the exact PostgreSQL version and Supabase
behaviour with a partial GIST exclusion using `NOW()`.

Alternative: omit the WHERE clause and let expired rows participate in the exclusion
check (they will be filtered by the application-layer `expiresAt: { gt: now }` check
anyway). This is simpler and avoids the immutability concern, at the cost of
expired-but-not-yet-cleaned rows blocking new reservations for the same interval
for up to 10 minutes.

### Q4 — Path coordination

Currently Path A and Path B do not share any locking strategy. If Option A
(exclusion constraint) is chosen, the DB will enforce the invariant for both paths
simultaneously regardless of code structure. If Option B (SERIALIZABLE) is chosen,
both paths must be serialised or the guarantee is incomplete. The design must be
explicit about which paths are in scope.

### Q5 — Error handling for constraint violation

When the exclusion constraint fires, PostgreSQL raises an error that Prisma surfaces
as `PrismaClientKnownRequestError` with code `P2002` (for unique constraints) or
a raw DB error for exclusion constraints. The application must handle this gracefully:
- Path A: return 409 Conflict (current behaviour for "slot taken" — preserve it)
- Path B: throw `'SLOT_TAKEN'` (current behaviour — preserve it)

Must confirm how Prisma surfaces exclusion constraint errors vs unique constraint
errors and write appropriate catch logic.

---

## 10. Recommended Next Steps

1. **Confirm `btree_gist` availability on the Supabase production instance.**
   Run: `SELECT * FROM pg_extension WHERE extname = 'btree_gist';`
   If absent, determine whether `CREATE EXTENSION btree_gist` is permitted.

2. **Prototype the exclusion constraint on the isolated test DB (localhost:5433)**
   to confirm it blocks the concurrent reservation race before writing the
   production migration.

3. **Write the PAY-H-04 hostile baseline test** (equivalent to MM-12-B):
   Two concurrent POST requests to `check-and-reserve` with overlapping intervals.
   Confirm the race exists without the fix, then confirm the fix prevents it.
   Verify back-to-back slots still succeed.

4. **Unify Path B's conflict check** to include `SlotReservation` in addition to
   `Booking`, so that a Path A reservation blocks a concurrent Path B booking.

5. **Authorise the schema migration** only after steps 1–4 are complete.

---

## 11. Invariant Statement

The correct invariant for PAY-H-04 remediation:

> For a given `providerId`, no two active `SlotReservation` rows may have
> overlapping `[startTime, endTime)` intervals.
>
> "Active" means `expiresAt > NOW()`.
>
> "Overlapping" uses strict open-interval semantics:
> `A.startTime < B.endTime AND B.startTime < A.endTime`.
>
> Adjacent intervals sharing an exact boundary point are NOT considered overlapping
> (10:00–11:00 and 11:00–12:00 must both be creatable).

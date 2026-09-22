# MM-12-C: Admin Wallet Idempotency — Design Verification

**Status:** DESIGN VERIFIED — ready for implementation (MM-12-D)  
**Date:** 2026-08-15  
**Branch:** audit/int-m03a-test-verified  
**Depends on:** MM-12-A VERIFIED, MM-12-B EXECUTION VERIFIED  

---

## 1. Problem Statement (from baseline)

Two separate vulnerabilities were confirmed by MM-12-B execution evidence:

**Vulnerability 1 — Missing idempotency (both routes)**  
Admin credit and deduction routes accept every HTTP request as a new financial
operation. A duplicate submission (double-click, network retry, ambiguous-response
retry) creates a second `WalletTransaction` row and permanently inflates or
deflates the wallet balance.

**Vulnerability 2 — Non-atomic deduction (deduct-credit route only)**  
The balance check (`getWalletBalance`) and the debit creation
(`walletTransaction.create`) are two separate database operations with no lock
between them. Two concurrent requests both read the pre-deduction balance, both
pass the `balance >= amount` check, and both commit, producing a negative balance.

These are distinct problems requiring distinct fixes. A single mechanism does not
solve both.

---

## 2. Current Data Model (production, commit 66c097e2)

### ClientWallet
```
id           String   @id @default(cuid())
userId       String   @unique
balance      Decimal  @default(0)  @db.Decimal(12,2)   -- cache only
createdAt    DateTime @default(now())
updatedAt    DateTime @updatedAt
```
No row-version column. No lock column. `balance` is explicitly documented as a
performance cache; `getWalletBalance()` is the authoritative source (ledger sum).

### WalletTransaction
```
id          String   @id @default(cuid())
walletId    String
amount      Decimal  @db.Decimal(12,2)
type        String                          -- 'CREDIT' | 'DEBIT'
description String?
status      String   @default("PENDING")   -- 'CONFIRMED' | 'PENDING'
metadata    Json?
bookingId   String?
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```
**No uniqueness constraint on any column or combination.**  
The only existing uniqueness protection is a partial index on
`metadata->>'stripePaymentIntentId'` (WHERE NOT NULL), added by migration
`20260911000000` for the P0-01B Stripe payment dedup. That index covers
Stripe-sourced client credits only. Admin manual credits and deductions store
`null` metadata and are entirely unprotected.

### Existing idempotency precedent
Migration `20260603000002_add_booking_idempotency_key` established a separate
`BookingIdempotencyKey` table with `key TEXT PRIMARY KEY`, `response JSONB`,
and a `createdAt` index. That is the canonical idempotency pattern in this
codebase.

---

## 3. Design Question 1: Idempotency Identity

**Question:** What exactly constitutes the same administrative adjustment?

**Answer:** An explicit caller-supplied `Idempotency-Key` header, scoped per
wallet operation.

### Rationale

Inferring identity from request body fields is unsafe:
- Two separate $50 credits for the same student are legitimate (B13 confirmed).
- `reason` text is free-form and inconsistently formatted by callers.
- `amount` alone is meaningless — the same amount can repeat intentionally.
- Timestamp bucketing creates an arbitrary window that either misses fast retries
  or incorrectly rejects slow-but-distinct operations.

An explicit key eliminates all ambiguity. The caller knows whether a request is
a retry of a previous attempt. The server cannot know this from body fields alone.

### Key format and lifetime

```
Header:  Idempotency-Key: <UUID v4>
Scope:   walletId + operationType (CREDIT | DEBIT)
TTL:     24 hours — after which the key expires and can be reused
```

Scoping to `walletId + operationType` prevents the same key from accidentally
matching a credit on one wallet against a debit on another wallet, or a credit
operation against a debit operation on the same wallet.

A 24-hour TTL is appropriate for admin operations:
- Long enough to cover any realistic network retry window.
- Short enough to not permanently block key reuse after a day.
- Consistent with how Stripe and other payment APIs treat idempotency keys.

### What happens when the header is absent

The header is **required** for both routes. A request without
`Idempotency-Key` returns `400 Bad Request` with body:
```json
{ "error": "Idempotency-Key header is required" }
```

This is a breaking change to the admin wallet API surface. The frontend credit
and deduction forms must be updated to generate and send the header (MM-12-D
scope). The change is intentional: forcing explicit keys eliminates the class
of accidental duplicates entirely rather than attempting to detect them.

---

## 4. Design Question 2: Database Invariant

**Question:** Where is uniqueness enforced? It must be a database-level
invariant, not merely an application check.

**Answer:** A new `AdminWalletIdempotencyKey` table with a primary-key
constraint on the composite `(key, walletId, operationType)`.

### Schema (new table)

```sql
CREATE TABLE "AdminWalletIdempotencyKey" (
    "key"           TEXT         NOT NULL,
    "walletId"      TEXT         NOT NULL,
    "operationType" TEXT         NOT NULL,  -- 'CREDIT' | 'DEBIT'
    "transactionId" TEXT         NOT NULL,  -- WalletTransaction.id of first execution
    "response"      JSONB        NOT NULL,  -- serialized response body
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWalletIdempotencyKey_pkey"
        PRIMARY KEY ("key", "walletId", "operationType")
);

CREATE INDEX "AdminWalletIdempotencyKey_expiresAt_idx"
    ON "AdminWalletIdempotencyKey"("expiresAt");
```

### Why a separate table, not a column on WalletTransaction

1. Matches the established `BookingIdempotencyKey` precedent in this codebase.
2. `WalletTransaction` already has no unique column available to hang
   idempotency on without a schema change to that table.
3. A separate table keeps the idempotency lookup fast and independent of
   `WalletTransaction` table growth.
4. Allows TTL cleanup via a simple `DELETE WHERE expiresAt < NOW()` cron
   without touching financial ledger rows.

### Why not a unique index on WalletTransaction.metadata

The existing `stripePaymentIntentId` partial index demonstrates this approach
is feasible for Stripe payments, but it is not appropriate here:
- JSON partial index syntax is Postgres-specific and fragile to schema changes.
- Requiring `metadata` to carry the idempotency key mixes infrastructure
  concerns into a financial data field.
- It does not compose cleanly with the `operationType` scope requirement.

### Why a composite PK over `(key, walletId, operationType)`

A plain unique index on `key` alone would be sufficient if keys are globally
unique UUIDs. The composite is chosen because:
- It makes the scope explicit in the schema itself.
- It prevents a compromised or colliding key from affecting a different wallet.
- It allows the same UUID to appear in the index for both a credit and a debit
  if the caller reuses a UUID across operation types (which they should not, but
  the constraint does not block it catastrophically).

---

## 5. Design Question 3: Duplicate-Key Behavior

**Question:** What does the second request receive? It should safely return the
result of the already-completed operation rather than creating another
transaction or returning an error that the caller cannot distinguish from a
genuine failure.

**Answer:** HTTP 200 with the stored response body from the first execution.

### Lookup-before-execute flow

```
1. Parse Idempotency-Key header  →  400 if absent
2. Resolve walletId from params.id
3. SELECT FROM AdminWalletIdempotencyKey
       WHERE key = $key AND walletId = $walletId AND operationType = $type
4. If row found AND expiresAt > NOW():
       Return HTTP 200 with stored response.response  ← REPLAY
5. If row found AND expiresAt <= NOW():
       Delete old row, proceed as new request
6. Execute financial operation (see Q4 for deduction atomicity)
7. INSERT INTO AdminWalletIdempotencyKey (key, walletId, operationType,
       transactionId, response, expiresAt)
   ON CONFLICT DO NOTHING   ← race-safe insert
8. Return HTTP 200 with fresh response
```

Step 7 uses `ON CONFLICT DO NOTHING` (Prisma: `skipDuplicates` or raw SQL)
because two concurrent first-time requests may both reach step 7 simultaneously.
The financial operation in step 6 is already protected against double-execution
by the atomic deduction design (Q4). The idempotency insert being a no-op for
the loser is safe: the loser's financial work was rejected by the atomic check,
so there is no transaction to record.

### Response stored at step 7

The stored `response` field contains the JSON body that was returned to the
original caller, including `transactionId`, `previousBalance`, `newBalance`,
and `success: true`. The replay returns this body verbatim with HTTP 200.

This is important: the caller cannot distinguish a replayed 200 from an original
200, which is the correct behavior. The caller's retry logic is satisfied and
no duplicate financial operation occurred.

### Edge case: first request fails before step 7

If the financial operation succeeds but the idempotency row insert fails (e.g.,
network partition between app and DB), the idempotency key was never stored.
A retry will execute again. This is the standard "at least once" idempotency
trade-off. It is acceptable here because:
- The failure case requires the DB to accept `walletTransaction.create` but
  then immediately refuse the idempotency insert — an extremely narrow window.
- `reconcileWalletBalance` (already in production) detects and corrects any
  resulting drift as a safety net.
- The alternative (making both writes atomic) is covered by the Prisma
  `$transaction` wrapping in Q4, which keeps them in the same database round-trip.

---

## 6. Design Question 4: Atomic Deduction

**Question:** Idempotency alone does not fix B7. The balance validation and
debit creation must be made atomic. What strategy?

**Answer:** `SELECT ... FOR UPDATE` on `ClientWallet` inside a Prisma
interactive transaction, followed by a ledger-sum recalculation and conditional
insert within the same transaction.

### Why `SELECT FOR UPDATE` rather than SERIALIZABLE isolation

SERIALIZABLE would detect the concurrent read anomaly and abort one of the
transactions with a serialization failure, requiring retry logic in the
application. That is correct but adds complexity: the route would need an
explicit retry loop, and a naive retry without an idempotency key check would
create the duplicate that the key is meant to prevent.

`SELECT ... FOR UPDATE` on `ClientWallet` is simpler and more targeted:
- It locks only the one wallet row involved.
- The second concurrent request blocks at the lock acquisition until the first
  completes, then proceeds with the updated balance.
- No retry logic is needed in the application.
- Compatible with Prisma's interactive transactions (`prisma.$transaction(async tx => {...})`).

### Atomic deduction pseudocode

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Lock the wallet row — blocks concurrent deductions on this wallet
  const wallet = await tx.$queryRaw<ClientWallet[]>`
    SELECT * FROM "ClientWallet"
    WHERE "userId" = ${userId}
    FOR UPDATE
  `
  if (!wallet[0]) throw new Error('Wallet not found')

  // 2. Recalculate ledger balance inside the lock — authoritative
  const confirmed = await tx.walletTransaction.findMany({
    where: { walletId: wallet[0].id, status: 'CONFIRMED' },
    select: { type: true, amount: true },
  })
  const balance = confirmed.reduce((acc, t) =>
    t.type === 'CREDIT' ? acc + Number(t.amount) : acc - Number(t.amount), 0
  )

  // 3. Check — now safe, no concurrent read possible
  if (balance < amount) {
    throw new InsufficientBalanceError(balance, amount)
  }

  // 4. Create debit transaction — inside the same lock
  const walletTx = await tx.walletTransaction.create({
    data: { walletId: wallet[0].id, amount, type: 'DEBIT', status: 'CONFIRMED',
            description: reason }
  })

  // 5. Update cached balance field — also inside the lock
  await tx.clientWallet.update({
    where: { id: wallet[0].id },
    data: { balance: { decrement: amount } },
  })

  // 6. Store idempotency key — inside same transaction
  await tx.$executeRaw`
    INSERT INTO "AdminWalletIdempotencyKey"
      ("key", "walletId", "operationType", "transactionId", "response", "expiresAt")
    VALUES
      (${idempotencyKey}, ${wallet[0].id}, 'DEBIT', ${walletTx.id},
       ${JSON.stringify(responseBody)}::jsonb, ${expiresAt})
    ON CONFLICT DO NOTHING
  `

  return walletTx
})
```

Including the idempotency key insert in the same `$transaction` as steps 4–5
solves the edge case from Q3: if the DB accepts the debit but fails before the
idempotency row is written, the whole transaction rolls back — the debit is
undone and the key was never stored, so a retry executes cleanly.

### Credit route — no SELECT FOR UPDATE needed, but wrap in $transaction

Credits have no balance check so the TOCTOU race does not apply. However, the
idempotency key insert and the `walletTransaction.create` should still be wrapped
in the same `$transaction` for the same atomicity guarantee described above: the
key is stored if and only if the transaction row was created.

The credit route does not need `SELECT FOR UPDATE` because there is no
read-modify-write on a constraint (balance floor). A plain `$transaction` is
sufficient.

---

## 7. Schema Migration Required

One new migration is required before any application code change:

```sql
-- MM-12-D migration
CREATE TABLE "AdminWalletIdempotencyKey" (
    "key"           TEXT         NOT NULL,
    "walletId"      TEXT         NOT NULL,
    "operationType" TEXT         NOT NULL,
    "transactionId" TEXT         NOT NULL,
    "response"      JSONB        NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWalletIdempotencyKey_pkey"
        PRIMARY KEY ("key", "walletId", "operationType")
);

CREATE INDEX "AdminWalletIdempotencyKey_expiresAt_idx"
    ON "AdminWalletIdempotencyKey"("expiresAt");
```

No change to `WalletTransaction` or `ClientWallet` schema is required.
The migration is additive and non-destructive — safe to apply to production
without downtime.

---

## 8. Changes Required in Application Code

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `AdminWalletIdempotencyKey` model |
| `prisma/migrations/YYYYMMDD_mm12d_admin_wallet_idempotency/migration.sql` | New migration (above) |
| `app/api/admin/clients/[id]/wallet/add-credit/route.ts` | Require `Idempotency-Key` header; lookup before execute; wrap in `$transaction`; insert key row |
| `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts` | Require `Idempotency-Key` header; lookup before execute; `SELECT FOR UPDATE` inside `$transaction`; insert key row |
| `lib/services/wallet-helpers.ts` | Extract `deductWalletAtomic()` helper (optional — may keep logic in route); update `getOrCreateWallet` to be transaction-aware |
| Frontend admin credit/deduction forms | Generate UUID v4 `Idempotency-Key` on form load; attach as header |
| Cron / scheduled job | `DELETE FROM AdminWalletIdempotencyKey WHERE expiresAt < NOW()` |

The frontend change is a prerequisite for the API change if the admin UI is the
only caller. If there are other callers (scripts, internal tools), they must be
updated before the API change is deployed.

---

## 9. What This Design Does NOT Change

- `getWalletBalance()` — authoritative ledger-sum function is unchanged.
- `reconcileWalletBalance()` — still valid as a scheduled correctness check.
- `WalletTransaction` schema — no columns added or removed.
- `ClientWallet` schema — no columns added or removed.
- The existing `stripePaymentIntentId` partial index — unchanged.
- `checkPermission()` — RBAC is unchanged.
- The audit log entries — unchanged in structure.

---

## 10. Design Decisions Not Made Here (deferred to MM-12-D)

1. Whether `deductWalletAtomic()` is extracted to `wallet-helpers.ts` or kept
   inline in the route. Either is acceptable; the design is the same.
2. Exact TTL value (24h is proposed; implementer may adjust with justification).
3. Whether the cron cleanup is a new route, an existing cron job, or a
   `pg_cron` scheduled job.
4. Frontend UUID generation library (standard `crypto.randomUUID()` is available
   in all modern browsers and Node 14.17+).

---

## 11. Gate Summary

| Question | Answer | Status |
|----------|--------|--------|
| Q1: Idempotency identity | Explicit `Idempotency-Key` header, scoped to walletId + operationType, 24h TTL | ANSWERED |
| Q2: Database invariant | `AdminWalletIdempotencyKey` table, composite PK `(key, walletId, operationType)` | ANSWERED |
| Q3: Duplicate-key behavior | HTTP 200 replay of stored response; `ON CONFLICT DO NOTHING` for race safety | ANSWERED |
| Q4: Atomic deduction | `SELECT FOR UPDATE` on ClientWallet inside Prisma `$transaction`; idempotency insert in same transaction | ANSWERED |

All four design questions answered from production source. No open questions
remain that would block implementation.

---

## 12. Next Step

**MM-12-D: Implementation**  
Implement the migration, route changes, and frontend header generation as
specified above. Do not modify production wallet logic beyond what is described
in section 8.

Service-layer extraction (moving wallet logic to a dedicated service file) remains
deferred — it is not required for correctness and would expand the change surface
before MM-12-E independent verification.

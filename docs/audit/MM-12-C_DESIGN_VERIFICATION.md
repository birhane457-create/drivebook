# MM-12-C: Admin Wallet Idempotency — Design Verification

**Status:** DESIGN VERIFIED (concurrency correction applied) — ready for MM-12-D
**Date:** 2026-08-15
**Revision:** v2 — Q3 corrected per independent review of f7d0b442
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
MM-12-D must not turn `ClientWallet.balance` into a second source of truth.

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
No uniqueness constraint on any column or combination. The only existing
uniqueness protection is a partial index on `metadata->>'stripePaymentIntentId'`
(WHERE NOT NULL), added by migration `20260911000000` for the P0-01B Stripe
payment dedup. That index covers Stripe-sourced client credits only. Admin
manual credits and deductions store `null` metadata and are unprotected.

### Existing idempotency precedent
Migration `20260603000002_add_booking_idempotency_key` established a separate
`BookingIdempotencyKey` table with `key TEXT PRIMARY KEY`, `response JSONB`, and
a `createdAt` index. That is the canonical idempotency pattern in this codebase.

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
  or incorrectly blocks slow-but-distinct operations.

An explicit key eliminates all ambiguity. The caller knows whether a request is
a retry of a previous attempt. The server cannot know this from body fields alone.

### Key format and lifetime

```
Header:  Idempotency-Key: <UUID v4>
Scope:   walletId + operationType (CREDIT | DEBIT)
TTL:     24 hours — after which the key expires and can be reused
```

Scoping to `walletId + operationType` prevents the same key from matching a
credit on one wallet against a debit on another wallet, or a credit against a
debit on the same wallet.

### What happens when the header is absent

The header is **required** for both routes. A request without `Idempotency-Key`
returns `400 Bad Request`:
```json
{ "error": "Idempotency-Key header is required" }
```

This is a breaking change to the admin wallet API surface. The frontend credit
and deduction forms must be updated to generate and send the header (MM-12-D
scope).

---

## 4. Design Question 2: Database Invariant

**Question:** Where is uniqueness enforced?

**Answer:** A new `AdminWalletIdempotencyKey` table with a primary-key constraint
on the composite `(key, walletId, operationType)`.

### Schema (new table)

```sql
CREATE TABLE "AdminWalletIdempotencyKey" (
    "key"           TEXT          NOT NULL,
    "walletId"      TEXT          NOT NULL,
    "operationType" TEXT          NOT NULL,   -- 'CREDIT' | 'DEBIT'
    "transactionId" TEXT,                     -- NULL while in-flight; set on commit
    "response"      JSONB,                    -- NULL while in-flight; set on commit
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "AdminWalletIdempotencyKey_pkey"
        PRIMARY KEY ("key", "walletId", "operationType")
);

CREATE INDEX "AdminWalletIdempotencyKey_expiresAt_idx"
    ON "AdminWalletIdempotencyKey"("expiresAt");
```

Note: `transactionId` and `response` are nullable in the schema (unlike the
first draft). This is required by the claim-first flow in Q3: the row is
inserted before the financial operation completes, so these fields are
populated in a subsequent UPDATE within the same transaction.

### Why a separate table

1. Matches the `BookingIdempotencyKey` precedent already in the codebase.
2. `WalletTransaction` has no natural unique column to attach idempotency to.
3. Keeps idempotency lookups fast and independent of ledger table growth.
4. TTL cleanup (`DELETE WHERE expiresAt < NOW()`) touches no financial rows.

### Why composite PK over `(key, walletId, operationType)`

Makes the scope explicit in the schema. Prevents a key collision on one wallet
from affecting another wallet. The PK conflict is the serialisation point for
concurrent first-time requests (see Q3).

---

## 5. Design Question 3: Duplicate-Key Behavior

**Question:** What does the second request receive?

**Answer:** HTTP 200 replay of the stored response body. The idempotency key is
**claimed inside the database transaction, before the financial operation
executes**. This is the critical invariant: no losing concurrent request can
commit a financial effect.

### Why claim-first is required (the concurrent credit problem)

The v1 design proposed: lookup → execute → `INSERT ... ON CONFLICT DO NOTHING`.
That approach has a window for credits:

```
Request A: lookup (miss) → execute credit → insert key  ← wins
Request B: lookup (miss) → execute credit → insert key  ← ON CONFLICT, no-op
                               ^
                      B's financial effect is already committed
```

B's `WalletTransaction` row is committed before B discovers that A owns the key.
`ON CONFLICT DO NOTHING` discards B's idempotency row but cannot undo B's ledger
row. For deductions, the `SELECT FOR UPDATE` in Q4 serialises concurrent
financial operations, but credits have no such lock — the window is real and was
correctly identified in the independent design review.

The fix is to move the key insertion **before** the financial operation, inside
the same `$transaction`. PostgreSQL places a row-level lock on the PK tuple at
insert time. A concurrent insert of the same key blocks until the first
transaction commits or rolls back, then observes the committed row and can branch
without executing the financial operation.

### Correct claim-first flow (both routes)

```
BEGIN $transaction

  Step 1: INSERT INTO AdminWalletIdempotencyKey
              (key, walletId, operationType, transactionId, response, expiresAt)
          VALUES ($key, $walletId, $type, NULL, NULL, $expiresAt)
          ON CONFLICT (key, walletId, operationType) DO NOTHING
          RETURNING *

          ┌── returned a row (key newly claimed → this request owns it):
          │       continue to Step 2
          │
          └── returned nothing (key already exists):
                  SELECT transactionId, response, expiresAt
                  FROM AdminWalletIdempotencyKey
                  WHERE key=$key AND walletId=$walletId AND operationType=$type
                  │
                  ├── expiresAt <= NOW()  (expired):
                  │       DELETE the row
                  │       ROLLBACK, then restart as a new request
                  │
                  ├── response IS NOT NULL  (completed):
                  │       ROLLBACK
                  │       Return HTTP 200 with stored response  ← REPLAY
                  │
                  └── response IS NULL  (in-flight, concurrent winner):
                          ROLLBACK
                          Return HTTP 409 { error: 'Request in progress' }

  Step 2: Execute financial operation
              (credit:  walletTransaction.create
               debit:   SELECT FOR UPDATE → ledger check → walletTransaction.create)

  Step 3: UPDATE AdminWalletIdempotencyKey
          SET transactionId = $txId,
              response      = $responseBodyJsonb
          WHERE key=$key AND walletId=$walletId AND operationType=$type

COMMIT
```

Step 1 is the serialisation point. Two concurrent requests with the same key
race to insert the same PK tuple. PostgreSQL grants the insert lock to exactly
one; the other blocks at the INSERT statement. When the winner commits (Step 3
populates the response), the loser unblocks at its INSERT, gets zero rows back
from `RETURNING *`, reads the now-committed response, and replays it. No
duplicate financial operation is possible.

The `NULL` placeholder values in Step 1 represent a key that is claimed but
whose financial operation has not yet completed. A `NULL` response in the SELECT
branch means a concurrent winner holds the key and is still executing. The 409
response is narrow (milliseconds), distinguishable from a network error, and the
caller's retry after a short delay will reach the replay path.

### Acceptance invariant (stated explicitly for MM-12-D)

> For any `(Idempotency-Key, walletId, operationType)`, exactly one financial
> effect may be committed, regardless of sequential retries or concurrent
> first requests.

### Response stored at Step 3

The stored `response` JSONB contains the JSON body returned to the original
caller, including `transactionId`, `previousBalance`, `newBalance`, and
`success: true`. The replay returns this body verbatim with HTTP 200. The caller
cannot distinguish a replayed 200 from an original 200.

### Expiry handling

If the conflict-branch SELECT finds `expiresAt < NOW()`, delete the row within
the transaction and re-insert fresh (restart the flow as a new request). This
handles retries after the 24h TTL has elapsed.

---

## 6. Design Question 4: Atomic Deduction

**Question:** Idempotency alone does not fix B7. What makes the balance check
and debit creation atomic?

**Answer:** `SELECT ... FOR UPDATE` on `ClientWallet` inside the same Prisma
`$transaction` that runs the claim-first idempotency insert. Both the lock and
the key claim are inside the same transaction boundary.

### Why SELECT FOR UPDATE rather than SERIALIZABLE

SERIALIZABLE aborts one transaction on anomaly detection, requiring application
retry logic. `SELECT FOR UPDATE` on the single wallet row is simpler: the second
concurrent request blocks at the lock, then re-reads the authoritative ledger
balance (now reflecting the first deduction) and correctly fails the balance
check if the balance is insufficient.

No retry loop is needed in the application.

### Atomic deduction flow (deduct-credit route)

```typescript
await prisma.$transaction(async (tx) => {

  // Step 1 — claim idempotency key (same as Q3 flow above)
  const claimed = await tx.$queryRaw`
    INSERT INTO "AdminWalletIdempotencyKey" ...
    ON CONFLICT ... DO NOTHING
    RETURNING *
  `
  if (!claimed.length) { /* replay or 409 as per Q3 */ }

  // Step 2 — lock wallet row
  const [wallet] = await tx.$queryRaw<ClientWallet[]>`
    SELECT * FROM "ClientWallet" WHERE "userId" = ${userId} FOR UPDATE
  `
  if (!wallet) throw new Error('Wallet not found')

  // Step 3 — recalculate authoritative ledger balance inside the lock
  const txRows = await tx.walletTransaction.findMany({
    where: { walletId: wallet.id, status: 'CONFIRMED' },
    select: { type: true, amount: true },
  })
  const balance = txRows.reduce(
    (acc, t) => t.type === 'CREDIT' ? acc + Number(t.amount) : acc - Number(t.amount), 0
  )

  // Step 4 — balance check (now safe — no concurrent read possible)
  if (balance < amount) throw new InsufficientBalanceError(balance, amount)

  // Step 5 — create debit
  const walletTx = await tx.walletTransaction.create({
    data: { walletId: wallet.id, amount, type: 'DEBIT',
            status: 'CONFIRMED', description: reason },
  })

  // Step 6 — update cached balance (cache only — not authoritative)
  await tx.clientWallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: amount } },
  })

  // Step 7 — store response in idempotency row
  await tx.$executeRaw`
    UPDATE "AdminWalletIdempotencyKey"
    SET "transactionId" = ${walletTx.id},
        "response"      = ${JSON.stringify(responseBody)}::jsonb
    WHERE "key" = ${idempotencyKey}
      AND "walletId" = ${wallet.id}
      AND "operationType" = 'DEBIT'
  `

  return walletTx
})
```

The `ClientWallet.balance` updated in Step 6 remains a cache. `getWalletBalance()`
(the ledger sum) continues to be the authoritative read path for all balance
display and for the balance check in Step 3.

### Second acceptance invariant (stated explicitly for MM-12-D)

> For concurrent deductions, no committed transaction may cause the
> authoritative ledger-derived balance to fall below zero when the
> precondition was a non-negative sufficient balance.

### Credit route — no SELECT FOR UPDATE, but same $transaction structure

Credits have no balance floor to protect, so `SELECT FOR UPDATE` is not needed.
However, the claim-first idempotency insert and the `walletTransaction.create`
must be in the same `$transaction` so that the key is stored if and only if the
transaction row was created.

```typescript
await prisma.$transaction(async (tx) => {
  // Step 1 — claim idempotency key (same Q3 flow)
  // Step 2 — create credit transaction
  // Step 3 — update cached balance
  // Step 4 — store response in idempotency row
})
```

---

## 7. Schema Migration Required

One new migration — additive, non-destructive, safe to apply without downtime:

```sql
-- MM-12-D migration: mm12d_admin_wallet_idempotency
CREATE TABLE "AdminWalletIdempotencyKey" (
    "key"           TEXT          NOT NULL,
    "walletId"      TEXT          NOT NULL,
    "operationType" TEXT          NOT NULL,
    "transactionId" TEXT,
    "response"      JSONB,
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "AdminWalletIdempotencyKey_pkey"
        PRIMARY KEY ("key", "walletId", "operationType")
);

CREATE INDEX "AdminWalletIdempotencyKey_expiresAt_idx"
    ON "AdminWalletIdempotencyKey"("expiresAt");
```

No change to `WalletTransaction` or `ClientWallet`.

---

## 8. Application Code Changes Required

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `AdminWalletIdempotencyKey` model (nullable transactionId, response) |
| `prisma/migrations/YYYYMMDD_mm12d_.../migration.sql` | New migration above |
| `app/api/admin/clients/[id]/wallet/add-credit/route.ts` | Require header; claim-first flow inside `$transaction` |
| `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts` | Require header; claim-first + `SELECT FOR UPDATE` inside `$transaction` |
| Frontend admin credit/deduction forms | `crypto.randomUUID()` on form load; attach as `Idempotency-Key` header |
| Cron / scheduled job | `DELETE FROM AdminWalletIdempotencyKey WHERE expiresAt < NOW()` |

---

## 9. What This Design Does NOT Change

- `getWalletBalance()` — authoritative ledger-sum function, unchanged.
- `reconcileWalletBalance()` — still valid as a scheduled correctness check.
- `WalletTransaction` schema — no columns added or removed.
- `ClientWallet` schema — no columns added or removed.
- `ClientWallet.balance` remains a performance cache, not a source of truth.
- The existing `stripePaymentIntentId` partial index — unchanged.
- `checkPermission()` — RBAC unchanged.
- Audit log entries — unchanged in structure.

---

## 10. Gate Summary

| Question | Answer | Status |
|----------|--------|--------|
| Q1: Idempotency identity | Explicit `Idempotency-Key` header, scoped to `(walletId, operationType)`, 24h TTL | ANSWERED |
| Q2: Database invariant | `AdminWalletIdempotencyKey` table, composite PK `(key, walletId, operationType)` | ANSWERED |
| Q3: Duplicate-key behavior | Claim-first insert inside `$transaction`; replay completed response; 409 for in-flight concurrent request | ANSWERED (v2 — concurrent credit race corrected) |
| Q4: Atomic deduction | `SELECT FOR UPDATE` on ClientWallet inside same `$transaction` as key claim; ledger recalculated under lock | ANSWERED |

All four questions answered from production source. The concurrent credit race
identified in independent review is closed by the claim-first design.

---

## 11. MM-12-D Acceptance Invariants

Two invariants that MM-12-D verification tests must demonstrate:

**Invariant 1 (idempotency)**
> For any `(Idempotency-Key, walletId, operationType)`, exactly one financial
> effect may be committed to the database, regardless of sequential retries or
> concurrent first requests.

**Invariant 2 (deduction atomicity)**
> For concurrent deductions, no committed `WalletTransaction` may cause the
> authoritative ledger-derived balance to fall below zero when the balance was
> non-negative and sufficient at the start of the request.

---

## 12. Next Step

**MM-12-D: Implementation** — authorized once this document is accepted.

Implement the migration, route changes, and frontend header generation as
specified in section 8. Do not modify production wallet logic beyond what is
described here.

Service-layer extraction remains deferred — not required for correctness and
would expand the change surface before MM-12-E independent verification.

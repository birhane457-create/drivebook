# MM-14 / MM-15 — Verification Evidence

**Date:** 2026-09-16  
**Type:** Read-only code verification — no production changes  
**Source file:** `app/api/stripe/webhook/route.ts`  
**Functions read:** `handleDisputeClosed()` (lines 2066–2265), `handleTransferFailed()` (lines 2435–2563), `handleChargeRefunded()` (lines 2267–2434, for cross-reference)

---

## MM-14 — `charge.refunded` double-count after a lost dispute

### Finding

When a chargeback dispute is **lost**, Stripe automatically issues a refund on the original charge and fires a `charge.refunded` event shortly after `charge.dispute.closed`.

`handleDisputeClosed()` (status = 'lost') writes:
```typescript
await appendLedgerEntry({
  type: 'DISPUTE_LOST',
  amount: -totalLoss,       // confirmed outflow
  referenceId: bookingId,
  ...
})
```

`handleChargeRefunded()` then fires for the same booking. Its only guard against double-counting is:
```typescript
const existingRefunds = await tx.ledgerEntry.findMany({
  where: {
    referenceId: bookingId,
    type: { in: ['REFUND_ISSUED', 'REFUND_SYNCED'] },   // ← DISPUTE_LOST is NOT here
  },
  select: { amount: true },
});
const alreadyRecordedRefund = existingRefunds.reduce(...);
refundDelta = Math.max(0, refundedAmount - alreadyRecordedRefund);
```

Because `DISPUTE_LOST` is not in the type filter, `alreadyRecordedRefund = 0`, `refundDelta = refundedAmount > 0`, and a new `REFUND_SYNCED` entry is written for the full refund amount.

### What is double-counted

The same economic event (customer money returned after a lost chargeback) is recorded twice:
1. `DISPUTE_LOST` (written by `handleDisputeClosed`) — negative entry for outflow
2. `REFUND_SYNCED` (written by `handleChargeRefunded`) — negative entry for the same refund

`incrementLedger({ totalRefunded: refundDelta })` is called for the `REFUND_SYNCED` entry, over-counting `totalRefunded` on the `PlatformLedger`.

### What is NOT affected

- Customer wallet balance — `handleChargeRefunded()` writes no wallet transaction
- Booking status — the booking was already set to `CANCELLED` or `REFUNDED` via earlier handlers
- The actual money movement — Stripe processes the refund correctly regardless

### Required fix

Add `'DISPUTE_LOST'` (and optionally `'DISPUTE_WON'`) to the type filter in `handleChargeRefunded()`:

```typescript
type: { in: ['REFUND_ISSUED', 'REFUND_SYNCED', 'DISPUTE_LOST'] },
```

This means if a `DISPUTE_LOST` entry already accounts for the full refund amount, `refundDelta` becomes 0 and the `REFUND_SYNCED` write is skipped.

### Impact on MM-07 fix design

The MM-07 fix adds `LedgerEntry(REFUND_ISSUED)` writes to refund entry points so `handleChargeRefunded()` can detect application-initiated refunds. The MM-14 fix adds `DISPUTE_LOST` to the same guard. These must ship in the same commit — a guard that only checks for `REFUND_ISSUED`/`REFUND_SYNCED` will still double-count dispute-related refunds even after MM-07 is fixed.

**The combined fix to `handleChargeRefunded()`:**
```typescript
type: { in: ['REFUND_ISSUED', 'REFUND_SYNCED', 'DISPUTE_LOST'] },
```

### `handleDisputeClosed()` existing guard (duplicate event protection)

`handleDisputeClosed()` has a correct guard against duplicate `charge.dispute.closed` events:
```typescript
if (existingDispute?.resolvedAt) {
  logger.info(`Dispute ${dispute.id} already resolved — skipping...`);
  return;
}
```

This correctly prevents `DISPUTE_LOST` being written twice for the same dispute. The problem is one-directional: `handleChargeRefunded()` doesn't know about `DISPUTE_LOST`, not that `handleDisputeClosed()` runs multiple times.

---

## MM-15-A — Late `transfer.failed` reverses a successfully-retried payout

### Finding

`handleTransferFailed()` reverts the payout record with:
```typescript
const reverted = await prisma.payout.updateMany({
  where: { id: payoutId, status: 'PAID' },
  data: {
    status: 'FAILED',
    failureReason: `Transfer ${transferId} failed: ...`,
    stripeTransferId: null,
  },
});
```

The WHERE clause filters only on `payoutId` and `status: 'PAID'`. It does **not** filter on `stripeTransferId`.

### Attack / failure scenario

1. Payout executed → `stripe.transfers.create()` → transfer `tr_ORIGINAL`
2. Transfer `tr_ORIGINAL` fails → `transfer.failed` event queued in Stripe (delayed delivery)
3. Admin retries payout → `stripe.transfers.create()` → transfer `tr_RETRY` succeeds
4. Payout status: `PAID`, `stripeTransferId: tr_RETRY`
5. Late `transfer.failed` event for `tr_ORIGINAL` arrives
6. `handleTransferFailed()` reads `payoutId` from `transfer.metadata.payoutId`
7. WHERE matches: `id = payoutId, status = 'PAID'` → `reverted.count = 1`
8. Payout is reverted to `FAILED`, `stripeTransferId` nulled (was `tr_RETRY`)
9. Ledger `ADJUSTMENT` entry written — platform falsely re-credited
10. Instructor receives SMS saying their payout failed

The actual money from `tr_RETRY` has already landed in the instructor's bank account. The ledger now shows it as failed.

### Required fix

Add `stripeTransferId` to the WHERE clause:
```typescript
where: { id: payoutId, status: 'PAID', stripeTransferId: transferId },
```

This ensures the reversal only applies to the specific transfer that failed, not any later successful transfer for the same payout.

---

## MM-15-B — `handleTransferFailed()` non-atomic idempotency

### Finding

`recordWebhookEvent()` is called at the top of `handleTransferFailed()` using the global `prisma` client **outside any transaction**:

```typescript
// Top of function — outside transaction
await recordWebhookEvent(prisma, idempotencyKey, 'transfer.failed', transferId, { ... });

// Then later, NOT inside the same transaction:
const reverted = await prisma.payout.updateMany({ ... });
if (reverted.count > 0) {
  await appendLedgerEntry({ ... });
  await incrementLedger({ ... });
}
```

Compare with `handleChargeRefunded()` which correctly places `recordWebhookEvent()` inside its `$transaction`:
```typescript
await prisma.$transaction(async (tx) => {
  await recordWebhookEvent(tx, idempotencyKey, 'charge.refunded', ...);  // inside tx
  // all financial ops also inside tx
})
```

### Failure scenario

1. `transfer.failed` event arrives
2. `recordWebhookEvent()` succeeds — idempotency key committed to DB
3. `payout.updateMany()` succeeds — payout reverted to FAILED
4. `appendLedgerEntry()` throws (DB connection error, constraint violation, etc.)
5. `incrementLedger()` never called — `PlatformLedger.totalPaidOut` not decremented
6. Stripe delivers the event again
7. `recordWebhookEvent()` throws `DuplicateWebhookEventError` — handler returns 200
8. Financial reversal is incomplete; no retry possible

### Impact

Payout is FAILED in DB. Ledger shows money still paid out. `totalReserved` not restored. Until manual intervention, ledger and payout status are inconsistent.

### Required fix

Wrap the entire financial operation in a `$transaction`, using the transaction client for `recordWebhookEvent`:

```typescript
await prisma.$transaction(async (tx) => {
  await recordWebhookEvent(tx, idempotencyKey, 'transfer.failed', transferId, { ... });

  const reverted = await tx.payout.updateMany({
    where: { id: payoutId, status: 'PAID', stripeTransferId: transferId },  // MM-15-A fix
    data: { status: 'FAILED', ... },
  });

  if (reverted.count > 0) {
    await appendLedgerEntry({ ... });
    await incrementLedger({ ... });
  }
}, SERIALIZABLE_TX);
```

This is the same pattern `handleChargeRefunded()` already uses correctly.

---

## Cross-cutting finding: MM-07 fix scope

The MM-07 fix (add `REFUND_ISSUED` writes to all refund entry points) and the MM-14 fix (add `DISPUTE_LOST` to `handleChargeRefunded()` guard) must ship in the same commit. The order of changes:

1. Add `REFUND_ISSUED` ledger writes to MM-05-A/B/C refund entry points
2. Update `handleChargeRefunded()` type guard to include `'DISPUTE_LOST'`

After both changes, `handleChargeRefunded()` correctly detects:
- Application-initiated refunds (via `REFUND_ISSUED`)
- Dispute-driven refunds (via `DISPUTE_LOST`)
- Prior synced refunds (via `REFUND_SYNCED`)

---

## Summary

| Finding | Confirmed | Key evidence |
|---|---|---|
| MM-14: `charge.refunded` double-counts after lost dispute | ✅ | `handleChargeRefunded()` type filter does not include `DISPUTE_LOST` |
| MM-15-A: Late `transfer.failed` reverses retried payout | ✅ | WHERE clause missing `stripeTransferId` filter |
| MM-15-B: Non-atomic idempotency in `handleTransferFailed()` | ✅ | `recordWebhookEvent` outside `$transaction` |
| MM-14 fix must ship with MM-07 fix | ✅ | Same guard in `handleChargeRefunded()`; splitting creates gap window |

---

## Required Tests Before CLOSED (combined remediation set)

The following test cases must pass before any of MM-05-A/B/C, MM-07, MM-14, MM-15-A, MM-15-B can be marked CLOSED. They form a coupled correctness boundary. All must be present in the same test run.

### T1 — Application refund: exactly one ledger entry; `charge.refunded` creates no duplicate

```
Setup:    booking exists; approveCancellation() succeeds; REFUND_ISSUED written
Trigger:  charge.refunded fires for same bookingId
Assert:   LedgerEntry count for bookingId = 1 (REFUND_ISSUED only)
Assert:   REFUND_SYNCED NOT written
Assert:   totalRefunded incremented exactly once
```

### T2 — Dispute lost: exactly one DISPUTE_LOST; `charge.refunded` creates no REFUND_SYNCED

```
Setup:    handleDisputeClosed(status='lost') runs; DISPUTE_LOST written
Trigger:  charge.refunded fires for same bookingId (Stripe auto-fires after chargeback)
Assert:   LedgerEntry count for bookingId includes DISPUTE_LOST; no REFUND_SYNCED added
Assert:   totalRefunded NOT incremented by charge.refunded handler
```

### T3 — Normal dashboard refund: no prior refund/dispute entry; charge.refunded creates exactly one REFUND_SYNCED

```
Setup:    no REFUND_ISSUED, no DISPUTE_LOST for bookingId
Trigger:  charge.refunded fires
Assert:   exactly one REFUND_SYNCED written
Assert:   totalRefunded incremented once
```

### T4 — Transfer failure with matching stripeTransferId: payout reversal occurs exactly once

```
Setup:    payout in PAID state with stripeTransferId = 'tr_ORIGINAL'
Trigger:  transfer.failed event with transferId = 'tr_ORIGINAL'
Assert:   payout.status = FAILED
Assert:   payout.stripeTransferId = null
Assert:   ADJUSTMENT ledger entry written once
Assert:   totalPaidOut decremented; totalReserved incremented
```

### T5 — Late transfer.failed after successful retry: no reversal; payout remains PAID

```
Setup:    payout originally PAID with tr_ORIGINAL; retried; now PAID with tr_RETRY
Trigger:  late transfer.failed event with transferId = 'tr_ORIGINAL'
Assert:   payout.status = PAID (unchanged)
Assert:   payout.stripeTransferId = 'tr_RETRY' (unchanged)
Assert:   ADJUSTMENT ledger entry NOT written
Assert:   instructor NOT notified (no false SMS)
```

### T6 — MM-15-B transaction failure: webhook rolls back; Stripe retry is processable

```
Setup:    transfer.failed event arrives
Action:   force appendLedgerEntry to throw after recordWebhookEvent succeeds
Assert:   payout.status unchanged (not FAILED)
Assert:   WebhookEvent record NOT committed (transaction rolled back)
Assert:   second delivery of same event is processed (not rejected as duplicate)
Assert:   second delivery completes the reversal correctly
```

### T7 — Concurrent transfer.failed delivery: exactly one financial reversal

```
Setup:    payout in PAID state
Trigger:  two concurrent deliveries of the same transfer.failed event
Assert:   payout.status = FAILED (set exactly once)
Assert:   ADJUSTMENT ledger entry written exactly once
Assert:   second delivery returns 200 without writing a second reversal
```

---

## Invariants These Tests Enforce

1. `handleChargeRefunded()` only writes `REFUND_SYNCED` when no prior economic accounting exists for the full refund amount across types `REFUND_ISSUED`, `REFUND_SYNCED`, and `DISPUTE_LOST`
2. `handleTransferFailed()` only reverses the specific transfer that failed — not any later successful transfer for the same payout
3. `handleTransferFailed()` is atomic: either all financial operations commit or none do; the WebhookEvent record commits only with the financial ops
4. Each reversal path (refund, dispute, transfer failure) is idempotent — exactly one financial effect per economic event regardless of webhook delivery count

---

## Note on Commit Strategy

These seven test cases verify the combined correctness boundary. The six production changes (MM-05-A/B/C `REFUND_ISSUED` writes, MM-14 type filter extension, MM-15-A `stripeTransferId` filter, MM-15-B transaction wrapping) form a coupled set because they all interact through `handleChargeRefunded()`'s guard logic. They should ship in one commit so the invariants hold from the moment the code lands in `main`.

The reason is not that splitting commits is inherently unsafe — it is that any intermediate state where some entry points write `REFUND_ISSUED` but the `DISPUTE_LOST` type filter is not yet added leaves `charge.refunded` still double-counting dispute refunds during the gap.

Evidence commit (verification only): `ba61c1547db63f4bab15eb61a99492dd91ced855`

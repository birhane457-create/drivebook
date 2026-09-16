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

# Refund Policy

**Governing Law:** Western Australia  
**File:** `app/api/bookings/[id]/cancel/route.ts`

---

## Refund Tiers

| Notice Period | Refund |
|---------------|--------|
| ≥ 48 hours before lesson | 100% to client wallet |
| 24–48 hours before lesson | 50% to client wallet |
| < 24 hours before lesson | 0% |
| `isNonRefundable = true` | 0% always |
| Past booking | 0% |

---

## Policy Anchor

The refund tier is calculated against `MIN(originalStartTime, currentStartTime)`.

This prevents the exploit of:
1. Booking a lesson far in the future
2. Rescheduling it to tomorrow
3. Cancelling for a 100% refund (because the new time is > 48h away)

The original booking time is always used as the anchor.

---

## isNonRefundable

Set to `true` when an instructor reschedules a booking within the 24-hour window. Once set, the booking is 0% refundable regardless of when it is cancelled.

---

## Refund Destination

Refunds go to the client's DriveBook wallet as a CREDIT transaction — not back to the original payment card. This is by design: the wallet balance is used for future lessons.

For Stripe-paid bookings (subdomain flow), the refund is a wallet CREDIT, not a Stripe refund. If a client requires a card refund, an admin must process it manually via the Stripe Dashboard.

---

## Atomicity

The cancel + refund operation runs inside a Prisma `$transaction`. If the wallet CREDIT fails, the entire cancel rolls back — the booking stays `CONFIRMED` and no partial state is created.

---

## Admin Override

Admins can manually add wallet credit via `POST /api/admin/clients/[id]/wallet/add-credit` for out-of-band refunds.

---

## Refund After Payout (Post-Payout Adjustment)

If the instructor has already been paid out, refunds are blocked for non-admins. Admin override requires a reason and triggers a finance team alert:

```typescript
if (transaction.status === 'PAID' && !isAdmin) {
  throw new Error('Cannot refund — instructor already paid');
}
// Admin override logs to AuditLog and emails finance team
```

When a post-payout refund is processed, `recordRefundIssued()` in `payout-service.ts` is called with `postPayout: true`. This creates two ledger entries:

1. `REFUND_ISSUED` — records money out, increments `PlatformLedger.totalRefunded`
2. `ADJUSTMENT` — records a negative entry against the instructor, flagged for recovery from their next payout

This means the instructor's next payout will be reduced by the refund amount. The adjustment is visible in the `LedgerEntry` log with `referenceType: 'ADJUSTMENT'` and `metadata.postPayout: true`.

---

## Ledger Impact

| Event | LedgerEntry type | PlatformLedger delta |
|---|---|---|
| Normal refund | `REFUND_ISSUED` | `totalRefunded++` |
| Post-payout refund | `REFUND_ISSUED` + `ADJUSTMENT` | `totalRefunded++` |

`availableBalance` decreases on every refund: `totalCollected − totalPaidOut − totalRefunded`.

---

## Legal Requirements

### Display Before Payment
Policy must be shown before the client completes payment.

### Require Agreement
Client must check: "I agree to the cancellation policy"

### Store Agreement
`cancellationPolicyVersion` and `cancellationPolicyAgreedAt` are NOT fields on the `Booking` model. Agreement is tracked via `AuditLog`:

```typescript
await prisma.auditLog.create({
  data: {
    action: 'CANCELLATION_POLICY_AGREED',
    actorId: userId,
    actorRole: 'CLIENT',
    targetType: 'BOOKING',
    targetId: bookingId,
    metadata: {
      policyVersion: 'v1.0',
      agreedAt: new Date().toISOString(),
      timezone: 'Australia/Perth'
    }
  }
});
```

### Dispute Evidence (Stripe Chargebacks)
Provide: policy text shown before payment, checkbox agreement timestamp, cancellation time calculation, refund amount calculation.

---

## Exceptions

| Scenario | Refund |
|----------|--------|
| Instructor cancels | 100% regardless of notice |
| Platform issue | 100%, platform absorbs loss |
| Emergency | Case-by-case admin review |

---

## Related

- `docs/02-student/BOOKINGS.md` — Student cancellation flow
- `docs/03-instructor/BOOKINGS.md` — Instructor cancellation flow
- `docs/04-legal/CANCELLATION_POLICY.md` — Legal cancellation policy
- `docs/06-payments/PAYOUTS.md` — Payout state machine and ledger

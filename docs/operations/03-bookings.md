# 03 — Booking Operations

---

## Booking Lifecycle

```
PENDING_PAYMENT (10 min window)
    ↓ payment succeeds
CONFIRMED
    ↓ lesson ends + check-in recorded
COMPLETED
    ↓ or no check-in 3hr after end
NO_SHOW

Short-notice path:
PENDING (awaiting instructor approval, 2 hr window)
    ↓ approved
PENDING_PAYMENT
    ↓ or no approval in 2hr
EXPIRED
```

---

## Admin Cancellation

### Before cancelling on behalf of a user:
- [ ] Booking status is `PENDING_PAYMENT`, `PENDING`, or `CONFIRMED` — only these can be cancelled
- [ ] Check `isNonRefundable` flag — if true, $0 refund regardless of notice
- [ ] Calculate refund tier using cancellation-policy API
- [ ] Notify both parties if lesson is within 48 hours
- [ ] Record reason in cancellation note

### Fault-based cancellations:
- **Instructor fault** (no-show, emergency): issue 100% refund regardless of notice — requires justification in audit log
- **Student breach of terms**: issue 0% refund — requires SUPER_ADMIN sign-off

### Do NOT:
- Cancel `COMPLETED` or `CANCELLED` bookings
- Cancel without a reason
- Cancel `PENDING_PAYMENT` via full cancel flow — use slot-release path (no payment captured)

---

## Disputes

### On new dispute / chargeback:
1. **Immediately** set `instructor.payoutHold = true`
2. Document dispute ID and amount in audit log
3. Gather evidence: booking details, payment records, SMS confirmation, booking timeline
4. Stripe dispute response deadline: **7 days** from notification

### During active dispute:
- **Do not issue a refund** — Stripe may count it as double-refund
- Wait for Stripe resolution before processing wallet credit

### Dispute win (platform wins):
- [ ] Clear `payoutHold = false`
- [ ] Verify weekly cron ran correctly after hold cleared
- [ ] Audit log entry confirming resolution

### Dispute loss (student wins):
- [ ] Student payment already reversed by Stripe — do NOT also issue wallet refund
- [ ] Assess whether instructor owes platform
- [ ] SUPER_ADMIN decision required for instructor recovery

---

## Rescheduling

When a booking is rescheduled within the late window, `isNonRefundable` is set to `true` on the rescheduled booking. This prevents the exploit: book far future → reschedule close → cancel for full refund. Do not manually clear `isNonRefundable` without SUPER_ADMIN approval.

---

## PDA (Practical Driving Assessment) Bookings

PDA bookings have their own flow via `PDATestConfig`. They are blocked from regular availability slots. Do not cancel or reschedule a PDA booking via the standard cancel route — use the PDA admin page.

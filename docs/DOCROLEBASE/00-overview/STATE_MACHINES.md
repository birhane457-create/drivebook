# State Machines

All entity state transitions in DriveBook. Every transition is explicit — no implicit or silent state changes.

---

## Booking States

```
PENDING_PAYMENT
    │
    ├─► EXPIRED          (10-minute slot hold elapsed, no payment)
    │
    └─► CONFIRMED        (payment captured — Stripe webhook or wallet debit)
            │
            ├─► COMPLETED    (admin marks lesson done)
            │
            ├─► NO_SHOW      (admin marks no-show)
            │
            └─► CANCELLED    (client, instructor, or admin cancels)
```

### Transition Rules

| From | To | Who | Condition |
|------|----|-----|-----------|
| PENDING_PAYMENT | CONFIRMED | System | Payment captured (Stripe webhook or wallet confirm) |
| PENDING_PAYMENT | EXPIRED | System | 10-minute hold elapsed without payment |
| CONFIRMED | COMPLETED | Admin | `endTime <= now` |
| CONFIRMED | NO_SHOW | Admin | `startTime <= now` |
| CONFIRMED | CANCELLED | Client / Instructor / Admin | Any time before lesson |
| COMPLETED | CANCELLED | SUPER_ADMIN only | Requires override reason |

COMPLETED and CANCELLED are terminal states. No further transitions except SUPER_ADMIN override.

---

## Instructor States

```
PENDING
    │
    ├─► APPROVED         (admin approves after document review)
    │       │
    │       └─► SUSPENDED    (admin suspends)
    │               │
    │               └─► APPROVED    (admin reinstates)
    │
    └─► REJECTED         (admin rejects — terminal)
```

### Transition Rules

| From | To | Who | Condition |
|------|----|-----|-----------|
| PENDING | APPROVED | Admin | Documents verified, ABN checked |
| PENDING | REJECTED | Admin | Failed compliance check |
| APPROVED | SUSPENDED | Admin | Policy violation or compliance failure |
| SUSPENDED | APPROVED | Admin | Issue resolved |

Suspended instructors: cannot accept new bookings, existing confirmed bookings are not affected.

---

## Transaction States

```
PENDING
    │
    └─► COMPLETED        (payment confirmed)
            │
            ├─► SETTLED      (approved for payout — admin action)
            │
            ├─► REFUNDED     (refund issued)
            │
            └─► FAILED       (payment or payout failure)
```

Transactions are immutable — status is the only mutable field. All adjustments create new linked transaction records.

---

## Payout States

Two paths depending on payout method:

```
Stripe Connect:
  ELIGIBLE → PROCESSING → PAID
                       ↘ FAILED   (retryable)
                       ↘ ON_HOLD  (admin hold)

Bank Transfer / Manual:
  ELIGIBLE → PROCESSING → PENDING_TRANSFER → SENT → PAID
                       ↘ FAILED   (retryable)
                       ↘ ON_HOLD  (admin hold)
```

| State | Meaning |
|---|---|
| `ELIGIBLE` | Lesson ended 24h+ ago, not yet paid |
| `PROCESSING` | Concurrency lock acquired |
| `PAID` | Money confirmed moved (Stripe transfer OR admin confirmed receipt) |
| `FAILED` | Error — retryable, transactions untouched |
| `ON_HOLD` | Admin hold — must be explicitly released |
| `PENDING_TRANSFER` | Bank/manual only — approved, awaiting admin to physically transfer |
| `SENT` | Bank/manual only — admin recorded bank ref, awaiting confirmation |

**Invariant:** `PAID` is only set when money has actually moved. For Stripe Connect, this is the Stripe transfer confirmation. For bank/manual, this is the admin explicitly confirming receipt via `POST /api/admin/payouts/[payoutId]/mark-sent` with `action: "confirm"`. The ledger is only updated at that point.

A payout stuck in `PROCESSING` for >10 minutes is flagged by the reconciliation cron and triggers an alert.

---

## ABN Verification States

```
UNVERIFIED (default)
    │
    ├─► ACTIVE           (ABR confirms valid ABN, name match ≥0.8)
    │       │
    │       └─► REVIEW_REQUIRED   (daily recheck finds issue)
    │               │
    │               ├─► ACTIVE    (admin re-verifies)
    │               └─► UNVERIFIED (admin revokes)
    │
    └─► REVIEW_REQUIRED  (name match 0.5–0.79, or ABR lookup inconclusive)
            │
            ├─► ACTIVE    (admin manually verifies)
            └─► UNVERIFIED (admin rejects)
```

`withholdingTaxRate` is set automatically on every transition: ACTIVE → 0%, anything else → 47%.

---

## Client Wallet States

```
ACTIVE (balance > 0)
    │
    ├─► ZERO_BALANCE     (balance = 0, cannot book)
    │       │
    │       └─► ACTIVE   (top-up or admin credit)
    │
    └─► NEGATIVE         (edge case — refund dispute or admin deduction)
            │
            └─► ACTIVE   (admin investigation + correction)
```

Negative balance blocks new bookings. Requires admin investigation via Audit Log.

---

## Related

- [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) — What triggers each transition
- `docs/00-foundation/STATE_MACHINE.md` — Full booking state diagram with `validTransitions` code

# Student Wallet

**Route:** `/client-dashboard/wallet`  
**Auth required:** CLIENT role  
**APIs:** `GET /api/client/wallet/summary`, `POST /api/client/wallet-topup-intent`

---

## Purpose

The wallet holds pre-paid credit that students use to book lessons via the client dashboard. It is funded by Stripe payments (top-ups or package purchases).

---

## Balance Calculation

Balance is never stored as a field. It is always computed:

```
balance = SUM(CONFIRMED CREDIT transactions) − SUM(CONFIRMED DEBIT transactions)
```

The `GET /api/client/wallet/summary` endpoint returns:
- `balance` — current available balance
- `transactions` — recent wallet transaction history

---

## Top-Up

Students can add funds directly to their wallet:

1. Student enters a top-up amount (min $10, max $500 — configurable via `/admin/pricing`)
2. Calls `POST /api/client/wallet-topup-intent` → creates a PENDING `WalletTransaction`, then creates a Stripe PaymentIntent
3. If Stripe fails, the PENDING transaction is deleted immediately (no orphaned records)
4. Stripe Elements collects card details
5. On `payment_intent.succeeded` webhook:
   - Validates `amount_received` matches the PENDING transaction amount (rejects if mismatch)
   - Confirms the transaction to `CONFIRMED`
   - Balance is immediately available
   - **Receipt email sent** — `sendWalletTopUpReceipt()` fires showing credits added, previous balance, new balance with approx hours remaining

**URL shortcut:** `/client-dashboard/wallet?topup=XX.XX` — pre-fills the top-up amount. Used by the "Send Payment Link" feature when an instructor books on behalf of a client with insufficient balance.

---

## Wallet Transactions

Each transaction has:
- `amount` — AUD value
- `type` — `CREDIT` or `DEBIT`
- `description` — human-readable reason (e.g. "Lesson payment — John Smith", "Wallet top-up")
- `status` — `PENDING` or `CONFIRMED`

**CREDIT sources:**
- Stripe top-up
- Package purchase (full package amount credited on payment)
- Lesson cancellation refund (partial or full, depending on notice period)
- Admin manual credit

**DEBIT sources:**
- Lesson booking (per lesson)
- Lesson price increase on reschedule (duration extended)

---

## Package Flow

When a student purchases a package via the public booking form:
1. Stripe charges `packageTotalPaid` (e.g. $630 for 10 hours at $70/hr with 10% discount)
2. Wallet is CREDITED with $630
3. Wallet is DEBITED with `booking.price` (first lesson, e.g. $70)
4. Remaining $560 is available for future lessons from the client dashboard
5. **Receipt email sent** — `sendPackagePurchaseReceipt()` fires showing package details, payment breakdown, and wallet balance after first lesson debit

**Rate & discount locking:**
At package purchase time, the instructor's `hourlyRate` and the applied discount percentage are stored on the `Booking` record as `lockedHourlyRate` and `lockedDiscountPct`. When the student later books individual lessons from the package (`POST /api/client/confirm-package-booking`), the deduction uses `lockedHourlyRate` — not the instructor's current rate. This means:

- Instructor raises rate from $70 → $75 after package purchase → student's remaining hours still deduct at $70/hr
- Instructor lowers rate → student's package is unaffected (they paid the old rate)
- The discount % is also locked — a 10% package discount stays 10% for all lessons in that package

**Wallet top-up (not yet booked):**
A plain wallet top-up is just money — no rate is locked. If the instructor changes their rate between the top-up and the booking, the booking uses the current rate at booking time. The booking UI shows: "Book all lessons now to lock in the current rate."

---

## Limits

| Setting | Default | Configurable |
|---------|---------|-------------|
| Min top-up | $10 | Yes — `/admin/pricing` |
| Max top-up | $500 | Yes — `/admin/pricing` |

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — How wallet is debited on booking
- `docs/06-payments/WALLET.md` — Technical wallet mechanics
- `docs/06-payments/REFUNDS.md` — Refund policy

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

When a student purchases a package via the public booking form or subdomain:

**Book Later (no slot selected):**
1. `POST /api/public/bookings/bulk` with `bookingType: later`
2. No booking record created — only a `WalletTransaction (PENDING)` for the full package amount
3. Returns `{ transactionId }` — payment page opens at `/payment/wallet/[transactionId]`
4. On `payment_intent.succeeded` webhook: transaction confirmed to `CONFIRMED`
5. Wallet balance immediately available — student books lessons from dashboard
6. Receipt email sent

**Book Now (slot selected):**
1. `POST /api/public/bookings/bulk` with `bookingType: now` + scheduled slots
2. Booking created (`PENDING_PAYMENT`), slot held for 10 minutes
3. Returns `{ bookingId }` — payment page at `/booking/[id]/payment`
4. On `payment_intent.succeeded` webhook:
   - Wallet CREDITED with `packageTotalPaid`
   - Wallet DEBITED with `booking.price` (first lesson)
   - Remaining balance available for future lessons
5. Receipt email sent

**Rate & discount locking:**
At package purchase time, `lockedHourlyRate` and `lockedDiscountPct` are stored on the booking record. When the student later books individual lessons from the package, the deduction uses `lockedHourlyRate` — not the instructor's current rate.

**Wallet top-up (not yet booked):**
A plain wallet top-up is just money — no rate is locked. If the instructor changes their rate between the top-up and the booking, the booking uses the current rate at booking time.

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

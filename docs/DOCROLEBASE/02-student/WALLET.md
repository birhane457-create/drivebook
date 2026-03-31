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
2. Calls `POST /api/client/wallet-topup-intent` → creates a Stripe PaymentIntent
3. Stripe Elements collects card details
4. On `payment_intent.succeeded` webhook:
   - Creates a `CONFIRMED` CREDIT `WalletTransaction`
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
1. Stripe charges `packageTotalPaid` (e.g. $600 for 10 hours)
2. Wallet is CREDITED with $600
3. Wallet is DEBITED with `booking.price` (first lesson, e.g. $60)
4. Remaining $540 is available for future lessons from the client dashboard
5. **Receipt email sent** — `sendPackagePurchaseReceipt()` fires showing package details, payment breakdown, and wallet balance after first lesson debit

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

# Client Wallet — Technical Reference

**Model:** `ClientWallet`, `WalletTransaction`  
**Service:** `lib/services/wallet-helpers.ts`

---

## Data Model

```
ClientWallet
  id        ObjectId
  userId    ObjectId (unique — one wallet per user)
  balance   Float    (NOT used — computed from transactions)
  createdAt DateTime
  updatedAt DateTime

WalletTransaction
  id          ObjectId
  walletId    ObjectId
  amount      Float
  type        CREDIT | DEBIT
  description String?
  status      PENDING | CONFIRMED
  createdAt   DateTime
  updatedAt   DateTime
```

---

## Balance Computation

Balance is always computed, never stored:

```typescript
const credits = await tx.walletTransaction.aggregate({
  where: { walletId, type: 'CREDIT', status: 'CONFIRMED' },
  _sum: { amount: true }
});
const debits = await tx.walletTransaction.aggregate({
  where: { walletId, type: 'DEBIT', status: 'CONFIRMED' },
  _sum: { amount: true }
});
const balance = (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0);
```

---

## Transaction Types

| Type | Direction | Trigger |
|------|-----------|---------|
| Stripe top-up | CREDIT | `payment_intent.succeeded` webhook (wallet top-up flow) |
| Package purchase | CREDIT | `payment_intent.succeeded` webhook (subdomain booking) |
| Lesson booking | DEBIT | Booking creation (client dashboard or instructor) |
| Cancellation refund | CREDIT | Cancel route (based on refund tier) |
| Duration increase | DEBIT | Reschedule with longer duration |
| Duration decrease | CREDIT | Reschedule with shorter duration |
| Admin credit | CREDIT | `POST /api/admin/clients/[id]/wallet/add-credit` |
| Admin deduct | DEBIT | `POST /api/admin/clients/[id]/wallet/deduct-credit` |

---

## Concurrency

All wallet operations run inside a Prisma `$transaction`. The balance is re-read inside the transaction before creating a DEBIT to prevent overdraft under concurrent requests.

The rate limiter (5 req/min per user) further reduces the concurrency window.

---

## Wallet Summary API

`GET /api/client/wallet/summary` returns:
```json
{
  "balance": 540.00,
  "transactions": [
    { "amount": 600, "type": "CREDIT", "description": "Package purchase — 10 hours", "status": "CONFIRMED", "createdAt": "..." },
    { "amount": 60,  "type": "DEBIT",  "description": "Lesson — John Smith",         "status": "CONFIRMED", "createdAt": "..." }
  ]
}
```

---

## Related

- `docs/02-student/WALLET.md` — Student-facing wallet docs
- `docs/06-payments/REFUNDS.md` — Refund policy

---

## Reconciliation

Daily check — wallet balance must equal transaction sum:

```typescript
const credits = SUM(wallet.transactions WHERE type = 'CREDIT' AND status = 'CONFIRMED');
const debits  = SUM(wallet.transactions WHERE type = 'DEBIT'  AND status = 'CONFIRMED');
const expectedBalance = credits - debits;

if (wallet.balance !== expectedBalance) {
  ALERT(`Wallet ${wallet.id} mismatch: expected ${expectedBalance}, actual ${wallet.balance}`);
}
```

---

## Optimistic Locking (future hardening)

Current protection: balance re-read inside `$transaction` before DEBIT. If extreme concurrency becomes a concern, add a `version` field to `ClientWallet`:

```typescript
const updated = await tx.clientWallet.updateMany({
  where: { id: wallet.id, version: wallet.version },
  data: { version: { increment: 1 } }
});
if (updated.count === 0) throw new Error('WALLET_VERSION_CONFLICT');
```

---

## Related

- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Full reconciliation process, ledger reconstruction, payout protection
- `docs/02-student/WALLET.md` — Student-facing wallet docs
- `docs/06-payments/REFUNDS.md` — Refund policy

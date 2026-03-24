# Revenue Reporting

**Route:** `/admin/revenue`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/revenue/page.tsx`  
**API:** `GET /api/admin/revenue`  
**Ledger API:** `GET /api/admin/ledger`

---

## What It Shows

4 tabs:

### Overview
- Total platform revenue (date range)
- Total instructor payouts
- Platform net (revenue − payouts)
- GST collected
- Booking count, average booking value
- Platform ledger balance (live)

### Transactions
- Full transaction list with filters:
  - Date range
  - Instructor
  - Transaction type (`BOOKING_PAYMENT`, `REFUND`, `MANUAL_ADJUSTMENT`)
  - Status (`PENDING`, `COMPLETED`, `CANCELLED`)
- Each row: date, instructor, client, amount, platform fee, instructor payout, commission rate

### Refunds
- All refund transactions
- Refund reason, original booking, amount refunded
- Refund rate (% of total revenue)

### Export
- CSV export of all transactions in the selected date range
- Columns: date, bookingId, instructorName, clientName, amount, platformFee, instructorPayout, commissionRate, status

---

## Platform Ledger

The `PlatformLedger` singleton tracks running financial totals in real time. It is updated atomically on every payment, payout, and refund event.

| Field | Meaning |
|---|---|
| `totalCollected` | Total money received from students (all time) |
| `totalReserved` | Money earmarked for instructor payouts (not yet paid) |
| `totalPaidOut` | Total paid to instructors via Stripe transfers |
| `totalRefunded` | Total refunded to clients |
| `totalTaxWithheld` | Total ATO withholding retained by platform |
| `availableBalance` | `totalCollected − totalPaidOut − totalRefunded` (computed on read) |

`availableBalance` is the safe payout ceiling — no payout can exceed it.

**API:** `GET /api/admin/ledger`

```json
{
  "ledger": {
    "totalCollected": 45000.00,
    "totalReserved": 8500.00,
    "totalPaidOut": 32000.00,
    "totalRefunded": 1200.00,
    "totalTaxWithheld": 620.00,
    "availableBalance": 11800.00
  },
  "recentEntries": [...]
}
```

---

## Ledger Entries

Every financial event appends an immutable `LedgerEntry` record. These are never updated after creation — they form the audit trail for reconciliation.

| Type | Trigger |
|---|---|
| `PAYMENT_COLLECTED` | Stripe webhook: payment captured |
| `PAYOUT_PAID` | Instructor payout transferred |
| `TAX_WITHHELD` | ATO withholding recorded on payout |
| `REFUND_ISSUED` | Booking refund processed |
| `ADJUSTMENT` | Post-payout refund deduction |

Recent entries are returned in the `/api/admin/ledger` response.

---

## Date Range Filter

- Presets: Today, This Week, This Month, Last Month, Last 3 Months, Custom
- Custom range: date picker

---

## API Response

`GET /api/admin/revenue?from=&to=&instructorId=&type=`

Returns:
```json
{
  "summary": {
    "totalRevenue": 12500.00,
    "totalPayouts": 10625.00,
    "platformNet": 1875.00,
    "gstCollected": 1136.36,
    "bookingCount": 208
  },
  "transactions": [...],
  "ledger": {
    "totalCollected": 45000.00,
    "totalReserved": 8500.00,
    "totalPaidOut": 32000.00,
    "totalRefunded": 1200.00,
    "totalTaxWithheld": 620.00,
    "availableBalance": 11800.00
  }
}
```

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — Processing instructor payouts
- `docs/06-payments/COMMISSIONS.md` — Commission rate details
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Financial rules

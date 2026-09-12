# Admin Revenue

**Route:** `/admin/revenue`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/revenue/page.tsx`
**API:** `GET /api/admin/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD`

---

## Overview

The revenue page is the financial reporting centre. It shows platform commission, gross lesson revenue, instructor payouts, and refunds — all filterable by date range. Every number is derived from `BOOKING_PAYMENT` transactions only. Wallet top-ups and package purchases are excluded from commission calculations.

---

## Date Filter

Six presets:

| Preset | Range |
|--------|-------|
| Today | Current calendar day |
| 7 days | Last 7 days |
| 30 days | Last 30 days |
| This month | 1st of current month to today |
| 3 months | Last 90 days |
| All time | 2020-01-01 to today |

Custom date range also available via date pickers. Changing the range re-fetches all data.

---

## Stats Cards

### Top row — selected period

| Card | Description |
|------|-------------|
| Commission Earned | Platform fee collected on completed lessons in the period |
| Gross Lesson Revenue | Total paid by students for lessons |
| Instructor Payouts | Total paid out to instructors |
| Refunds Issued | Total refunded in the period + refund count |

### Bottom row — all-time context

| Card | Description |
|------|-------------|
| All-Time Commission | Total platform commission ever |
| This Month Commission | Current month vs last month growth rate |
| Pending Payouts | Total awaiting processing — links to `/admin/payouts` |
| Total Refunds (all time) | All-time refund total + count |

---

## Tabs

### Overview

**Monthly commission trend (last 6 months):**
Horizontal bar chart showing gross revenue (light blue) and commission (dark blue) per month. Lesson count shown per row.

**All-time summary:**
Three-column panel: all-time gross, all-time instructor payouts, all-time platform commission.

**Top instructors by payout (selected period):**
Ranked list showing: rank badge, instructor name (links to `/admin/instructors/[id]`), lesson count, gross amount, payout amount, platform fee.

### Transactions

Table of all `BOOKING_PAYMENT` transactions in the selected period.

Columns: Date, Instructor (links to instructor detail), Student, Lesson Fee, Platform Commission, Instructor Payout, Booking Status, Transaction Status.

CSV export available.

### Refunds

Table of all `REFUNDED` transactions in the selected period.

Columns: Date, Instructor, Student, Amount Refunded, Note.

Info banner: "Refunds are processed from the Payouts → Withheld tab."

CSV export available.

### Export

Four CSV export options, all using the currently selected date range:

| Export | Contents |
|--------|---------|
| Lesson Transactions | Date, instructor, student, lesson fee, commission, payout, booking status, txn status |
| Refunds Report | All refunded transactions with notes |
| Monthly Summary | Gross, commission, instructor payout, lesson count per month |
| Instructor Earnings | Gross, commission, payout per instructor |

---

## API

### `GET /api/admin/revenue`

Query params: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD).

Response shape:

```json
{
  "rangeCommission": number,
  "rangeGross": number,
  "rangeInstructorPayout": number,
  "rangeLessons": number,
  "rangeRefunds": number,
  "rangeRefundCount": number,
  "totalCommission": number,
  "totalGross": number,
  "totalInstructorPayouts": number,
  "totalCompletedLessons": number,
  "thisMonthCommission": number,
  "lastMonthCommission": number,
  "thisMonthGross": number,
  "pendingPayouts": number,
  "completedPayouts": number,
  "totalRefunds": number,
  "refundCount": number,
  "pendingRefunds": number,
  "totalTransactions": number,
  "topInstructors": [...],
  "revenueByMonth": [...],
  "recentTransactions": [...],
  "refundedTransactions": [...],
  "from": "string",
  "to": "string"
}
```

---

## What "Commission" Means

Commission = `Transaction.platformFee` on `BOOKING_PAYMENT` transactions with `status = COMPLETED`.

It does NOT include:
- Wallet top-up fees
- Package purchase fees
- Subscription revenue (tracked separately)

The commission rate per booking is determined at booking creation time by `lib/services/platform-pricing.ts` based on the instructor's subscription tier and whether it's a new student's first booking.

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — Processing instructor payouts
- [REVENUE_REPORTING.md](./REVENUE_REPORTING.md) — Platform ledger and balance
- `docs/06-payments/COMMISSIONS.md` — Commission rate structure

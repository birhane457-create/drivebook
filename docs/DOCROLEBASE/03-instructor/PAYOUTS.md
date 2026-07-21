# Instructor Payouts & Earnings

**Status:** ✅ COMPLETE — July 2026  
**Route (Earnings):** `GET /api/instructor/earnings/this-week`  
**Full Earnings Route:** `GET /api/instructor/earnings`  
**Full Earnings Page:** `/dashboard/earnings`  
**Payout Settings:** `/dashboard/settings/payout`  
**Payout History API:** `GET /api/instructor/payouts`

---

## Overview

The platform tracks both **earnings** (what the instructor is owed) and **payouts** (what has actually been transferred). Both are fully implemented as of June 2026.

---

## Weekly Earnings API

**Route:** `GET /api/instructor/earnings/this-week`

**Authentication:** Required (NextAuth session)

**Purpose:** Returns this week's earnings summary for the `EarningsThisWeekCard` on the instructor dashboard.

**Response:**
```json
{
  "weekStart": "2026-06-09T00:00:00.000Z",
  "weekEnd": "2026-06-15T23:59:59.999Z",
  "completedCount": 5,
  "totalEarned": 425.50,
  "hourlyRate": 85.00
}
```

---

## Full Earnings Page

**Route:** `/dashboard/earnings`  
**API:** `GET /api/instructor/earnings`

- Weekly breakdown — completed lessons grouped by week → day → individual lesson
- Commission deducted per lesson (locked at booking creation time)
- Scheduled upcoming lessons (earnings potential)
- Downloadable weekly receipts (`.txt` format)
- Platform vs offline earnings split
- Trend comparison (this week vs last week)

---

## Payout Schedule Card (Dashboard)

**Component:** `components/instructor/PayoutScheduleCard.tsx`  
**API:** `GET /api/instructor/payouts`

Shown on the main instructor dashboard. Displays:
- Next payout date (e.g. "Fri, 13 Jun")
- Days until next payout ("in 2 days")
- Pending transfer amount
- Recent 3 payouts with reference numbers, amounts, and status
- Help text explaining weekly Stripe payouts

**Next payout estimate logic:**
- Stripe Connect: add 7 days to last payout, adjust to next Friday
- Bank/Manual: add 7 days to last payout
- No history: next Friday from today

**Links:**
- "View all payouts →" → `/dashboard/earnings`
- "Manage settings →" → `/dashboard/settings/payout`

---

## Payout Settings Page

**Route:** `/dashboard/settings/payout`  
**API:** `GET/POST /api/instructor/payout-settings`

Configures payout method (Stripe Connect, bank transfer, manual), ABN/tax details, and GST registration.

---

## Instructor Payout Calculation

```
grossAmount  = sum of instructorPayout across eligible completed platform transactions
taxWithheld  = grossAmount × (withholdingTaxRate / 100)
netAmount    = grossAmount - taxWithheld
```

Withholding rule:
- `abnVerified = true` → 0% withholding
- No ABN or unverified → 47% (ATO statutory rate)

Commission rate is locked at booking creation time from `PlatformSettings`. Existing bookings are never retroactively affected by rate changes.

---

## Payout Eligibility

A booking becomes eligible for payout 24 hours after `COMPLETED`. Admin processes payouts via `/admin/payouts`.

Payouts withheld if:
- Booking is under dispute
- `stripeAccountId` not set (for Stripe Connect)
- Booking marked `NO_SHOW`
- Admin placed payout `ON_HOLD`
- ABN not verified (`abnVerified = false`)

---

## Payout Methods

| Method | How it works |
|---|---|
| `stripe_connect` | Automatic weekly transfer to Stripe Connect account |
| `bank_transfer` | Admin manually transfers to BSB/account on file |
| `manual` | Admin arranges payment directly |

---

## Related

- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- [SETTINGS.md](./SETTINGS.md) — Payout settings configuration
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Commission rates by tier
- `docs/05-admin/PAYOUTS.md` — How admin processes payouts

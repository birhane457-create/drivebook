# Instructor Earnings

**Route:** `/dashboard/earnings`  
**Auth required:** INSTRUCTOR role  
**File:** `app/dashboard/earnings/page.tsx`  
**API:** `GET /api/instructor/earnings`

---

## What It Shows

The earnings page focuses on **platform earnings** — what DriveBook processes and pays you. This is the main business metric.

### 💳 Platform Earnings
- Weekly breakdown by day (bar chart)
- Daily lesson list with per-lesson payout
- Commission deducted per lesson
- Scheduled upcoming platform lessons
- Receipt download per lesson
- Trend comparison (this week vs last week)

**This is what matters:** Platform bookings = verified DriveBook revenue.

---

## Offline Lessons (Optional Feature)

Offline lessons are an **optional retention service** for instructors who have existing students they want to keep. They are:
- Not part of platform earnings metrics
- Not included in payout calculations
- Tracked separately for instructor records
- Optional feature (not required)

See [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) for details on logging offline lessons.

---

## Earnings Calculation

**Platform earnings only.** For each completed platform booking:

```
instructorPayout = booking.price × (1 - commissionRate / 100)
```

**Offline bookings:** Not included in earnings calculations. They are tracked separately as a retention feature.

Commission rate is determined at booking creation time from `PlatformSettings`:

| Tier | Default Commission | Instructor Keeps |
|------|--------------------|-----------------|
| BASIC | 15% | 85% |
| PRO | 12% | 88% |
| STUDIO | 11% | 89% |
| BUSINESS | 10% | 90% |

The actual `commissionRate` used is stored on the `Booking` and `Transaction` records at creation time and never changes. Admins can schedule rate changes in advance via `/admin/pricing` — existing bookings are never retroactively affected.

Note: The `newStudentBonus` concept was removed in May 2026. Commission is now a flat rate per tier.

---

## API Response Structure

`GET /api/instructor/earnings` returns platform earnings data:

```json
{
  "totalEarnings": 2700,
  "totalGross": 3000,
  "totalFees": 300,
  "completedCount": 25,
  "thisMonthEarnings": 2500,
  "thisMonthGross": 2778,
  "thisMonthFees": 278,
  "thisMonthCount": 10,
  "pendingPayouts": 350,
  "pendingCount": 1,
  "scheduledTotal": 450,
  "scheduledCount": 3,
  "transactions": [...],
  "platform": {
    "totalEarnings": 2700,
    "totalGross": 3000,
    "totalFees": 300,
    "pendingPayouts": 350,
    "scheduledTotal": 450
  }
}
```

**Platform object** contains verified DriveBook earnings only. Offline lessons are not included in earnings calculations.

---

## Payout Processing

**Only platform earnings are processed for payout.** Offline lessons are a retention feature and do not generate payouts.

---

## Withholding Tax

At payout time, ATO withholding tax is deducted from the gross payout:

```
grossAmount  = sum of instructorPayout across eligible platform transactions
taxWithheld  = grossAmount x (withholdingTaxRate / 100)
netAmount    = grossAmount - taxWithheld
```

Withholding rule:
- **Verified ABN** (`abnVerified = true`) → 0% withholding
- **No ABN, or ABN present but not yet verified** → 47% (ATO statutory rate)

Having an ABN on file is not enough — it must be verified via the ABR API or by an admin. Set your ABN at `/dashboard/settings/payout`. Once submitted, an admin or the ABR lookup will verify it. Until verified, the 47% rate applies.

---

## GST

If `gstRegistered = true` on your instructor profile, the GST component (1/11 of gross) is recorded on each payout for your reporting. You are responsible for remitting GST to the ATO via your own BAS.

---

## Payout Eligibility

A booking becomes eligible for payout 24 hours after `COMPLETED` status. The admin processes payouts via `/admin/payouts`.

**Only platform bookings** generate payouts. Offline lessons do not.

Payouts are withheld if:
- The booking is under dispute
- Your `stripeAccountId` is not set (for Stripe Connect payouts)
- The booking was marked `NO_SHOW`
- An admin has placed the payout `ON_HOLD`
- Your ABN is not verified (`abnVerified = false`) — payout is blocked until admin or ABR confirms your ABN

---

## Payout Method

Set at `/dashboard/settings/payout`:

| Method | How it works |
|---|---|
| `stripe_connect` | Automatic transfer to your Stripe Connect account |
| `bank_transfer` | Admin transfers to your BSB/account on file |
| `manual` | Admin arranges payment directly |

---

## Receipt Download

Each completed lesson has a downloadable receipt showing:
- Client name
- Date and duration
- Lesson price
- Platform fee (commission)
- Instructor gross payout
- Tax withheld (if applicable)
- GST breakdown (if applicable)
- Net payout amount

---

## Related

- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — How offline bookings work
- [DASHBOARD.md](./DASHBOARD.md) — Earnings summary on home
- [SETTINGS.md](./SETTINGS.md) — Tax and Payout settings
- `docs/06-payments/COMMISSIONS.md` — Commission rate details
- `docs/05-admin/PAYOUTS.md` — How payouts are processed

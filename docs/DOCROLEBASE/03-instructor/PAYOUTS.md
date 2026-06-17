# Instructor Payouts & Earnings

**Status:** ✅ VERIFIED COMPLETE (June 14, 2026) — Code vs docs aligned  
**Date added:** June 2026  
**Route (Earnings):** `GET /api/instructor/earnings/this-week`
**Full Earnings Route:** `GET /api/instructor/earnings`
**Full Earnings Page:** `/dashboard/earnings`  
**Payout Settings:** `/dashboard/settings/payout`

---

## Overview

⚠️ **IMPORTANT DISTINCTION:**

This document now covers **TWO SEPARATE SYSTEMS**:

1. **Weekly Earnings** (✅ IMPLEMENTED) — How much the instructor earned this week from completed lessons
2. **Payout Schedule** (⏳ NOT YET IMPLEMENTED) — When the instructor will be paid and payout history

**Current State:**
- ✅ Earnings tracking: Complete and working
- ⏳ Payout schedule: Database model missing, needs implementation

---

## Weekly Earnings API

**Route:** `GET /api/instructor/earnings/this-week` 

**Authentication:** Required (NextAuth session)

**Purpose:** Returns this week's earnings summary for the dashboard card

**Response:**

```json
{
  "weekStart": "2026-06-09T00:00:00.000Z",
  "weekEnd": "2026-06-15T23:59:59.999Z",
  "weekStartDisplay": "Jun 9",
  "weekEndDisplay": "Jun 15",
  "completedCount": 5,
  "totalEarned": 425.50,
  "hourlyRate": 85.00,
  "bookings": [
    {
      "id": "booking_123",
      "date": "9/06/2026",
      "price": 85.00
    }
  ]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `weekStart` | String (ISO) | Monday 00:00 of the current week |
| `weekEnd` | String (ISO) | Sunday 23:59 of the current week |
| `weekStartDisplay` | String | Formatted for UI (e.g., "Jun 9") |
| `weekEndDisplay` | String | Formatted for UI (e.g., "Jun 15") |
| `completedCount` | Number | Count of completed lessons this week |
| `totalEarned` | Number | Sum of all completed lesson prices (gross before commission) |
| `hourlyRate` | Number | Instructor's configured hourly rate |
| `bookings` | Array | List of completed lessons with booking ID, date, and price |

**Notes:**
- Only includes platform bookings (`source !== 'offline'`)
- Only completed lessons (`status === 'COMPLETED'`)
- Calculation: Monday-Sunday boundary (not Friday-Friday)
- Response time: ~100-150ms

---

## Full Earnings Dashboard Page

**Route:** `/dashboard/earnings`

**What it displays:**
- Total earnings (all-time platform bookings)
- This week's earnings breakdown by day
- Last week's comparison
- This month's total
- Scheduled lessons (future earnings potential)
- Downloadable weekly receipts
- Gross vs commission vs net calculations
- Mobile-responsive dark theme

**Features:**
- ✅ Groups transactions by week and day
- ✅ Shows scheduled lessons (future earnings)
- ✅ Download receipts in PDF format
- ✅ Commission rate calculation
- ✅ Fully responsive (mobile, tablet, desktop)

---

## Payout Settings Page

**Route:** `/dashboard/settings/payout`

**What it displays:**
- ABN verification status
- Stripe Connect onboarding (if not connected)
- Bank transfer details (BSB, account number)
- Tax registration status
- Withholding tax calculation
- Payout method selection

**Features:**
- ✅ Real-time ABN verification via Australian Business Register
- ✅ Stripe Connect integration with onboarding flow
- ✅ Bank account configuration
- ✅ GST registration toggle
- ✅ Tax details auto-persist

**Note:** This page configures WHERE and HOW the instructor receives payments, but does NOT show payout history or schedule (that's a future feature).

---

## Payout Methods (Configured)

**Stripe Connect** (recommended)
- Automatic payouts to connected bank account
- Typically weekly (admin-triggered or scheduled)
- Commission rate deducted automatically
- Tax withholding applied (if required)
- Setup: Instructor completes Stripe Connect onboarding at `/dashboard/settings/payout`

**Bank Transfer** (future)
- Manual request-based payouts
- Instructor requests, admin approves
- Not yet fully implemented

**Manual** (legacy)
- No automatic payouts
- Admin manually sends payment

---

## Instructor Payout Calculation

When a payout is processed (by admin or scheduled cron):

1. **Gross Amount:** Sum of all completed lesson prices from previous week
2. **Commission Deduction:** `gross * commissionRate` (based on subscription tier)
3. **Instructor Payout:** `gross - commission`
4. **Withholding Tax:** Applied if ABN not verified (for Australian tax compliance)
5. **Final Amount:** Transferred to instructor's configured payout method

**Example:**
- Gross: $500.00
- Commission Rate (BASIC tier): 20%
- Commission: $100.00
- Instructor Payout: $400.00
- Withholding Tax: $0 (ABN verified)
- Final Transfer: $400.00

---

## 🚫 Payout Schedule Feature (NOT YET IMPLEMENTED)

The following features are **documented in this section but not yet implemented in code**:

### Dashboard Payout Card
- Would show: "Next payout on Friday, June 13"
- Would show: Pending payout amount
- Would show: Recent 3 payouts with amounts
- **Status:** Component `PayoutScheduleCard.tsx` does NOT exist
- **Status:** No `Payout` database model exists

### Payout History & Status
- Would display: Paid/processing/pending payouts
- Would show: Payout reference numbers
- Would show: When each payout was processed
- **Status:** Not implemented

### Payout Status Tracking
- ELIGIBLE, PENDING, PROCESSING, SENT, PAID, ON_HOLD, FAILED
- **Status:** Not implemented

---

## Related Documentation

- [EARNINGS.md](./EARNINGS.md) — Full earnings breakdown system
- [SETTINGS.md](./SETTINGS.md) — Account settings (includes payout settings)
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Commission rates by tier
- [DASHBOARD.md](./DASHBOARD.md) — Dashboard overview and cards

---

## Summary

**What Works (✅):**
- Instructors see earnings for this week on the dashboard
- Full earnings page shows detailed breakdown by day/week/month
- Payout settings page allows configuration of payout method
- Commission calculation is accurate

**What's Missing (⏳):**
- Payout schedule card on dashboard
- Payout history (when instructor was actually paid)
- Payout status tracking
- "Next payout date" visibility

The current system tracks **what instructors earn**, but not yet **when they'll be paid**. This is a planned feature that requires:
- `Payout` database model
- Payout processing logic (admin/cron-triggered)
- Payout history API
- Dashboard payout status card component

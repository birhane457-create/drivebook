# Instructor Payouts & Earnings

**Last updated:** July 2026  
**Status:** ✅ Complete

---

## Overview

The platform tracks **earnings** (what the instructor is owed from completed lessons) and **payouts** (what has actually been transferred). Both are fully implemented.

---

## Earnings Page

**Route:** `/dashboard/earnings`  
**API:** `GET /api/instructor/earnings`

Shows:
- Stats: This Week, Last Week, This Month, Scheduled (upcoming confirmed)
- Collapsible "Scheduled Lessons" section — upcoming platform bookings with expected payout per lesson
- Weekly earnings history grouped by week → day → individual lesson
- Per-week summary: hours worked, lesson count, gross, commission deducted, net earned
- Package lessons tagged with 📦 badge
- Download Weekly Receipt button (`.txt` via `GET /api/instructor/receipts/weekly?weekStart=`)
- Offline earnings tracked separately (instructor-logged cash/bank lessons)

**Payout note in footer:** "Payouts processed automatically every Tuesday morning (AWST)"

---

## Payout History API

**Route:** `GET /api/instructor/payouts`  
**File:** `app/api/instructor/payouts/route.ts`

Returns:

| Field | Description |
|---|---|
| `payouts` | Last 10 completed (PAID) payouts, most recent first |
| `pendingPayouts` | Any payouts in ELIGIBLE, PROCESSING, PENDING_TRANSFER, SENT, or ON_HOLD |
| `nextPayoutDate` | Next Tuesday 2am AWST in ISO format (when the cron runs) |
| `totalPending` | Sum of `netAmount` across all pending payouts |
| `payoutMethod` | `stripe_connect`, `bank_transfer`, or `manual` |
| `isConnected` | `true` if Stripe Connect is fully set up and active |

Used by the `PayoutScheduleCard` component on the main dashboard.

---

## Payout Schedule Card (Dashboard)

**Component:** `components/instructor/PayoutScheduleCard.tsx`  
**API:** `GET /api/instructor/payouts`

Shows on the main instructor dashboard:
- Next payout date (next Tuesday 2am AWST)
- Days until next payout
- Pending transfer amount
- Recent 3 payouts with reference numbers, amounts, status

---

## When Payouts Run

The automated cron runs **every Monday 6pm UTC = Tuesday 2am AWST**.

**Schedule entry:** `"0 18 * * 1"` (Monday 6pm UTC)

Only Stripe Connect instructors are processed automatically. Bank/manual transfer instructors are handled by admin each week.

---

## Payout Eligibility

A transaction becomes eligible when **all** of these are true:

| Check | Condition |
|---|---|
| Transaction status | `SETTLED` (not just `COMPLETED`) |
| Booking status | `CONFIRMED` or `COMPLETED` |
| Dispute buffer | Lesson ended > `lateCancellationWindowHours × 2` hours ago (default 48h, DB-backed) |
| Deleted booking | `deletedAt = null` |
| Payout hold | `instructor.payoutHold = false` |
| ABN gate | No ABN on file, OR ABN is `abnVerified = true` |
| Stripe Connect | For stripe_connect method: `stripeAccountId` set, `chargesEnabled = true`, `payoutsEnabled = true` |
| Not yet in a payout | Not covered by an existing PROCESSING/PAID/ON_HOLD/PENDING_TRANSFER/SENT payout |

**Offline bookings (`source = 'offline'`) are never included in platform payouts** — they are instructor-handled cash/bank payments.

---

## Payout Calculation

```
grossAmount         = sum of transaction.instructorPayout for all eligible transactions
adjustmentDeduction = any unrecovered ADJUSTMENT ledger entries (post-payout refund clawbacks)
grossAfterAdj       = max(0, grossAmount - adjustmentDeduction)
taxWithheld         = grossAfterAdj × (withholdingTaxRate / 100)
netAmount           = grossAfterAdj - taxWithheld
gstAmount           = grossAfterAdj / 11   (only if instructor.gstRegistered = true)
```

**Withholding tax rule:**
- `abnVerified = true` → admin should set `withholdingTaxRate = 0` on the instructor record
- No ABN, or ABN unverified → `withholdingTaxRate = 47%` (ATO statutory rate)
- The rate is the `instructor.withholdingTaxRate` field — it does NOT automatically change when ABN is verified. Admin must manually set it via ABN verification action.

---

## Payout State Machine

```
Stripe Connect path:
  ELIGIBLE → PROCESSING → PAID
                       └→ FAILED (retryCount incremented; CRITICAL alert sent)

Bank / Manual path:
  ELIGIBLE → PROCESSING → PENDING_TRANSFER  (no money moved yet)
                               ↓  (admin records bank ref)
                            SENT  (admin notified, awaiting instructor confirmation)
                               ↓  (admin confirms receipt)
                            PAID  (ledger updated)

Any state from ELIGIBLE or FAILED:
  → ON_HOLD  (admin freezes — `holdReason` set; no money moves)
  → ELIGIBLE (admin releases hold)
```

**Idempotency:** SHA-256 of sorted transaction IDs → unique `idempotencyKey` on `Payout`. Safe to retry any step.

**Concurrency lock:** `ELIGIBLE → PROCESSING` transition uses `updateMany` with status guard. If `0 rows updated`, another process holds the lock — operation returns current state without error.

---

## Post-Payout Refund Clawback

If a refund is issued **after** a payout has already been processed for those transactions:
1. A negative `ADJUSTMENT` ledger entry is created for the instructor
2. On the next payout run, `buildPayout()` reads unrecovered ADJUSTMENT entries and deducts them from `grossAmount`
3. Instructor receives an email listing the deductions and total amount withheld
4. The ADJUSTMENT entry is marked `recovered = true` so it's never double-deducted

---

## Payout Methods

| Method | How it works |
|---|---|
| `stripe_connect` | Automatic weekly Stripe transfer. Money moves in `executePayout()`. |
| `bank_transfer` | Admin manually transfers → records bank reference → confirms receipt. Two-step. Ledger only updated on confirmation. |
| `manual` | Admin arranges payment outside the platform. Same two-step as bank transfer. |

---

## What Instructors Can See

Via `/dashboard/earnings`:
- ✅ Completed lessons and net earnings per week
- ✅ Scheduled upcoming lessons with expected payout
- ✅ Platform vs offline earnings split
- ✅ Downloadable weekly receipts

Via `/dashboard/earnings` and the PayoutScheduleCard:
- ✅ Next payout date (Tuesday 2am AWST)
- ✅ Pending payout amount
- ✅ Recent payout history (last 10)
- ✅ Stripe Connect setup status

**Not visible to instructors:**
- Individual `Transaction` status (`SETTLED` / `PROCESSING`)
- `Payout.idempotencyKey` or `stripeTransferId`
- Ledger entries or platform financial totals
- Details of adjustment deductions (they receive an email when deductions occur)

---

## Related

- [EARNINGS.md](./EARNINGS.md) — Full earnings breakdown
- [SETTINGS.md](./SETTINGS.md) — Payout settings and Stripe Connect setup
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Commission rates by tier
- `docs/operations/02-finance.md` — Admin payout operations guide

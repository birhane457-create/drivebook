# Instructor Earnings

**Route:** `/dashboard/earnings`  
**Auth required:** INSTRUCTOR role  
**File:** `app/dashboard/earnings/page.tsx`  
**API:** `GET /api/instructor/earnings`

---

## What It Shows

- Weekly earnings breakdown (bar chart by day)
- Daily lesson list with per-lesson payout
- Scheduled upcoming lessons (confirmed, not yet completed)
- Receipt download per lesson

---

## Earnings Calculation

For each completed booking:

```
instructorPayout = booking.price × (1 - commissionRate / 100)
```

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

## Withholding Tax

At payout time, ATO withholding tax is deducted from the gross payout:

```
grossAmount  = sum of instructorPayout across eligible transactions
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

- [DASHBOARD.md](./DASHBOARD.md) — Earnings summary on home
- [SETTINGS.md](./SETTINGS.md) — Tax and Payout settings
- `docs/06-payments/COMMISSIONS.md` — Commission rate details
- `docs/05-admin/PAYOUTS.md` — How payouts are processed

# Commission Rates

**Source of truth:** `PlatformSettings` DB record (singleton, key = `"default"`)  
**Admin UI:** `/admin/pricing`  
**Service:** `lib/services/platform-pricing.ts`

---

## Per-Tier Rates (defaults)

| Tier | Commission | Instructor Keeps |
|------|-----------|-----------------|
| BASIC | 15% | 85% |
| PRO | 12% | 88% |
| BUSINESS | 10% | 90% |

---

## New Student Bonus

Applied on the first booking between a client and instructor (`isFirstBooking: true`):

| Tier | New Student Bonus | Instructor Keeps |
|------|-------------------|-----------------|
| BASIC | 8% | 92% |
| PRO | 10% | 90% |
| BUSINESS | 12% | 88% |

---

## How Rates Are Applied

At payment intent creation (`POST /api/payments/create-intent`):

1. Fetch instructor's `subscriptionTier`
2. Call `getCommissionRate(tier)` → reads from `PlatformSettings` DB record
3. Falls back to hardcoded defaults if no DB record exists
4. Store rate in Stripe metadata
5. Calculate and store on booking:
   ```
   platformFee      = price × commissionRate / 100
   instructorPayout = price − platformFee
   commissionRate   = rate used (stored for audit)
   ```

The rate is locked at booking creation time and never changes, even if the admin updates `PlatformSettings` later.

---

## Withholding Tax

`PlatformSettings` also stores `withholdingTaxRate` — the ATO withholding percentage applied to instructor payouts. Default: 47% (ATO statutory rate).

This is separate from commission. It is applied at payout time, not at booking time:

```
grossAmount  = sum of instructorPayout across eligible transactions
taxWithheld  = grossAmount × (withholdingTaxRate / 100)
netAmount    = grossAmount − taxWithheld
```

Withholding rule:
- **Verified ABN** (`abnVerified = true`) → 0% withholding
- **No ABN, or ABN present but not yet verified** → 47% (ATO statutory rate)

An ABN on file alone is not sufficient — it must be verified via the ABR API or by an admin before withholding is waived. Instructors set their ABN at `/dashboard/settings/payout`; admins verify it at `/admin/instructors/[id]`.

---

## GST

If `instructor.gstRegistered = true`, the GST component (1/11 of gross) is recorded on the `Payout` for reporting purposes. The instructor is responsible for remitting GST to the ATO via their own BAS. DriveBook does not collect or remit GST on behalf of instructors.

---

## Changing Rates

Admin updates rates via `/admin/pricing` → `POST /api/admin/pricing`. Changes take effect on the next new booking. Existing bookings are not retroactively affected.

---

## Where Rates Are NOT Stored

`commissionRate` and `newStudentBonus` are NOT stored on the `Instructor` model. They are always derived at runtime from `PlatformSettings` (or `lib/config/subscriptions.ts` as fallback).

---

## Config Fallback

`lib/config/subscriptions.ts` defines `SUBSCRIPTION_PLANS` with default rates. These are used:
- As fallback if `PlatformSettings` DB record doesn't exist
- In the subscription dashboard UI to display plan benefits

---

## Calculation Examples

**BASIC instructor ($140 lesson, 15% commission, no ABN):**
```
Booking Price:        $140.00
Platform Fee (15%):   $ 21.00
Instructor Gross:     $119.00
Tax Withheld (47%):   $ 55.93
Instructor Net:       $ 63.07
```

**PRO instructor ($140 lesson, 12% commission, verified ABN):**
```
Booking Price:        $140.00
Platform Fee (12%):   $ 16.80
Instructor Gross:     $123.20
Tax Withheld (0%):    $  0.00
Instructor Net:       $123.20
```

---

## Rules

1. Rate is locked at payment intent creation — never changes after that
2. Price adjustments (duration edits) use the same commission rate as the original booking
3. Refunds do NOT apply commission — full amount returned to client, platform absorbs the loss
4. The actual rate used is stored in Stripe metadata (`commissionRate` field) for auditability

---

## Related

- `docs/05-admin/SETTINGS.md` — Admin pricing configuration
- `docs/07-subscriptions/TIERS.md` — Tier feature comparison
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Full financial rules
- `lib/services/platform-pricing.ts` — Runtime rate lookup

# Admin Settings

**Routes:** `/admin/settings`, `/admin/pricing`  
**Auth required:** ADMIN or SUPER_ADMIN  
**Files:** `app/admin/settings/page.tsx`, `app/admin/pricing/page.tsx`  
**APIs:** `GET/POST /api/admin/settings`, `GET/POST /api/admin/pricing`, `GET/POST /api/admin/rate-changes`, `DELETE /api/admin/rate-changes/[id]`  
**Last updated:** May 2026

---

## Platform Settings (`/admin/settings`)

General platform configuration stored in `PlatformSettings` (singleton DB record).

**File:** `components/admin/PlatformSettingsForm.tsx`

Settings include:
- Platform name, admin email, support contact details
- Booking window (min advance hours, max advance days)
- Notification channel preferences (in-app, email, SMS per event type)

---

## Pricing Settings (`/admin/pricing`)

Commission rates and financial configuration. All values persist to the `PlatformSettings` DB record and take effect immediately on new bookings.

**File:** `components/admin/PricingSettingsForm.tsx`

### Commission Rates (per tier)

| Field | Default | Description |
|-------|---------|-------------|
| `basicCommissionRate` | 15% | Platform commission for BASIC tier |
| `proCommissionRate` | 12% | Platform commission for PRO and STUDIO tiers |
| `businessCommissionRate` | 10% | Platform commission for BUSINESS tier |

### Package Discounts

| Field | Default | Description |
|-------|---------|-------------|
| `package6Discount` | 5% | Discount for 6-hour package |
| `package10Discount` | 10% | Discount for 10-hour package |
| `package15Discount` | 12% | Discount for 15-hour package |
| `discountPaidBy` | shared | Who absorbs the discount: `platform`, `instructor`, or `shared` |

### Other Fees

| Field | Default | Description |
|-------|---------|-------------|
| `platformFeePercentage` | 3.6% | Additional platform fee on top of commission |
| `drivingTestPackagePrice` | $225 | Fixed price for driving test package |
| `cancellationFee` | $0 | Fixed fee charged on cancellation |
| `lateCancellationWindowHours` | 24h | Hours before lesson that triggers late cancellation |
| `noShowPenaltyAmount` | $0 | Penalty for no-show |

### Wallet Limits

| Field | Default |
|-------|---------|
| `walletTopUpMin` | $10 |
| `walletTopUpMax` | $500 |

### GST

| Field | Default |
|-------|---------|
| `gstEnabled` | true |
| `gstRate` | 10% |

### Peak Surcharge

| Field | Default |
|-------|---------|
| `peakSurchargeEnabled` | false |
| `peakSurchargePercent` | 0% |

---

## Rate Change Scheduler

**Component:** `components/admin/RateChangeScheduler.tsx`  
**APIs:** `GET/POST /api/admin/rate-changes`, `DELETE /api/admin/rate-changes/[id]`  
**DB model:** `PlatformRateChange`

Allows admins to schedule commission rate changes with a future effective date. This gives instructors advance notice before rates change.

**How it works:**
1. Admin creates a rate change with: tier, field, new rate, effective date, reason
2. Record stored as `status: PENDING`
3. Instructors on the affected tier see a notice on their subscription page
4. On the effective date, `GET /api/cron/apply-rate-changes` (runs daily at 00:05 UTC) applies the change to `PlatformSettings` and notifies all affected instructors by email + in-app notification
5. Record updated to `status: APPLIED`

**Cancelling a pending change:** `DELETE /api/admin/rate-changes/[id]` — sets `status: CANCELLED`.

**Important:** Rate changes only affect new bookings from the effective date. Existing confirmed bookings retain the rate at time of booking.

---

## How Changes Take Effect

Changes saved via `POST /api/admin/pricing` are upserted to the `PlatformSettings` singleton record. The next payment intent creation reads the new rates via `lib/services/platform-pricing.ts`. Existing bookings are not retroactively affected.

---

## Related

- `docs/DOCROLEBASE/06-payments/COMMISSIONS.md` — Commission rate details
- `lib/services/platform-pricing.ts` — How rates are read at runtime
- `app/api/cron/apply-rate-changes/route.ts` — Rate change cron
- `components/admin/RateChangeScheduler.tsx` — Rate change UI

---

## Platform Settings (`/admin/settings`)

General platform configuration stored in `PlatformSettings` (singleton DB record).

**File:** `components/admin/PlatformSettingsForm.tsx`

Settings include:
- Platform name
- Admin email
- Support contact details
- Booking window (min advance hours, max advance days)
- Notification preferences

---

## Pricing Settings (`/admin/pricing`)

Commission rates and financial configuration. All values persist to the `PlatformSettings` DB record and take effect immediately on new bookings.

**File:** `components/admin/PricingSettingsForm.tsx`

### Commission Rates (per tier)

| Field | Default | Description |
|-------|---------|-------------|
| `basicCommissionRate` | 15% | Platform commission for BASIC tier |
| `proCommissionRate` | 12% | Platform commission for PRO tier |
| `businessCommissionRate` | 10% | Platform commission for BUSINESS tier |

Note: The `newStudentBonus` fields still exist in `PlatformSettings` for legacy reasons but are no longer used in commission calculations (removed May 2026).

### Package Discounts

| Field | Default | Description |
|-------|---------|-------------|
| `package6Discount` | 5% | Discount for 6-hour package |
| `package10Discount` | 10% | Discount for 10-hour package |
| `package15Discount` | 12% | Discount for 15-hour package |
| `discountPaidBy` | shared | Who absorbs the discount: `platform`, `instructor`, or `shared` |

### Other Fees

| Field | Default | Description |
|-------|---------|-------------|
| `platformFeePercentage` | 3.6% | Additional platform fee on top of commission |
| `drivingTestPackagePrice` | $225 | Fixed price for driving test package |
| `cancellationFee` | $0 | Fixed fee charged on cancellation |
| `lateCancellationWindowHours` | 24h | Hours before lesson that triggers late cancellation |
| `noShowPenaltyAmount` | $0 | Penalty for no-show |

### Wallet Limits

| Field | Default |
|-------|---------|
| `walletTopUpMin` | $10 |
| `walletTopUpMax` | $500 |

### GST

| Field | Default |
|-------|---------|
| `gstEnabled` | true |
| `gstRate` | 10% |

### Peak Surcharge

| Field | Default |
|-------|---------|
| `peakSurchargeEnabled` | false |
| `peakSurchargePercent` | 0% |

---

## How Changes Take Effect

Changes saved via `POST /api/admin/pricing` are upserted to the `PlatformSettings` singleton record. The next payment intent creation reads the new rates via `lib/services/platform-pricing.ts`. Existing bookings are not retroactively affected.

---

## Related

- `docs/06-payments/COMMISSIONS.md` — Commission rate details
- `lib/services/platform-pricing.ts` — How rates are read at runtime
- `docs/01-architecture/DATABASE_SCHEMA.md` — PlatformSettings model

# DriveBook — Hardcoded Values Reference

> **Purpose:** Single reference for every value that is intentionally or residually hardcoded.
> Before searching the codebase, check here first.
> When a value changes, update both the code and this document.

---

## 1. Values Controlled via PlatformSettings (DB)

These are **not** hardcoded anymore. Change them via the admin pricing page (`/admin/pricing`)
or directly in the `PlatformSettings` table. The DB defaults match the table below.

| Setting | DB Field | Default | Used In |
|---|---|---|---|
| Basic commission rate | `basicCommissionRate` | 15% | `getCommissionRate()`, all booking routes |
| PRO commission rate | `proCommissionRate` | 12% | `getCommissionRate()`, all booking routes |
| STUDIO commission rate | `studioCommissionRate` | 11% | `getCommissionRate()` |
| BUSINESS commission rate | `businessCommissionRate` | 10% | `getCommissionRate()`, all booking routes |
| Platform fee | `platformFeePercentage` | 3.6% | `getPlatformFeeRate()`, `calculatePackagePriceDynamic` |
| 6-hour package discount | `package6Discount` | 5% | `calculatePackagePriceDynamic` |
| 10-hour package discount | `package10Discount` | 10% | `calculatePackagePriceDynamic` |
| 15-hour package discount | `package15Discount` | 12% | `calculatePackagePriceDynamic` |
| Late cancellation window | `lateCancellationWindowHours` | 24h | All cancel routes, CancelDialog, weekly-payouts cron |
| Full refund window | `lateCancellationWindowHours * 2` | 48h | Derived — never stored separately |
| Dispute / payout buffer | `lateCancellationWindowHours * 2` | 48h | `cron/weekly-payouts/route.ts` |
| Cancellation fee | `cancellationFee` | $0 | Cancel routes |
| No-show penalty | `noShowPenaltyAmount` | $0 | Cleanup cron |
| Wallet top-up min | `walletTopUpMin` | $10 | Add funds page |
| Wallet top-up max | `walletTopUpMax` | $500 | Add funds page |
| GST rate | `gstRate` | 10% | Receipt/invoice generation |
| GST enabled | `gstEnabled` | true | Receipt/invoice generation |
| Withholding tax rate | `withholdingTaxRate` | 47% | ABN-unverified payout calculation |
| Peak surcharge % | `peakSurchargePercent` | 0% | Booking price calculation (not yet active) |
| Peak surcharge enabled | `peakSurchargeEnabled` | false | Booking price calculation |

**How to change:** `/admin/pricing` → saves to `PlatformSettings` table.
**How it's read in code:** `lib/services/platform-pricing.ts` → `getPlatformPricing()` / `getCommissionRate()` / `getPlatformFeeRate()`
**Fallback:** If the DB row doesn't exist yet, code falls back to the defaults in `lib/services/platform-pricing.ts` → `const DEFAULTS`.

---

## 2. Subscription Tier Prices (env var, not DB)

These are tied to Stripe product/price IDs and can only change with a Stripe product update.
Override via `.env` — do not hardcode in source.

| Value | env var | Current default | File |
|---|---|---|---|
| BASIC monthly price | `BASIC_MONTHLY_PRICE` | $29 | `lib/config/subscriptions.ts` |
| BASIC annual price | `BASIC_ANNUAL_PRICE` | $290 | `lib/config/subscriptions.ts` |
| PRO monthly price | `PRO_MONTHLY_PRICE` | $79 | `lib/config/subscriptions.ts` |
| PRO annual price | `PRO_ANNUAL_PRICE` | $790 | `lib/config/subscriptions.ts` |
| STUDIO monthly price | `STUDIO_MONTHLY_PRICE` | $129 | `lib/config/subscriptions.ts` |
| STUDIO annual price | `STUDIO_ANNUAL_PRICE` | $1,290 | `lib/config/subscriptions.ts` |
| BUSINESS monthly price | `BUSINESS_MONTHLY_PRICE` | $199 | `lib/config/subscriptions.ts` |
| BUSINESS annual price | `BUSINESS_ANNUAL_PRICE` | $1,990 | `lib/config/subscriptions.ts` |
| Trial days BASIC/PRO/STUDIO | `BASIC_TRIAL_DAYS` etc | 14 | `lib/config/subscriptions.ts` |
| Trial days BUSINESS | `BUSINESS_TRIAL_DAYS` | 30 | `lib/config/subscriptions.ts` |

**Stripe price IDs** (must be set in `.env` — no safe fallback):

| env var | Purpose |
|---|---|
| `STRIPE_BASIC_MONTHLY_PRICE_ID` | Stripe price object for BASIC monthly |
| `STRIPE_BASIC_ANNUAL_PRICE_ID` | Stripe price object for BASIC annual |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe price object for PRO monthly |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe price object for PRO annual |
| `STRIPE_STUDIO_MONTHLY_PRICE_ID` | Stripe price object for STUDIO monthly |
| `STRIPE_STUDIO_ANNUAL_PRICE_ID` | Stripe price object for STUDIO annual |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | Stripe price object for BUSINESS monthly ⚠️ not yet created |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | Stripe price object for BUSINESS annual ⚠️ not yet created |

---

## 3. Operational Limits (hardcoded, intentional)

These are operational/security constants that don't belong in the DB.
Change by editing the source file directly — they rarely change and have no admin UI.

| Value | Where | Current | Reason hardcoded |
|---|---|---|---|
| JWT session max age | `lib/auth.ts` | 7 days | Security — not a business config |
| Slot reservation TTL | `app/api/availability/` | 10 min | UX constant |
| Booking expiry (unpaid) | `cron/cleanup-expired-bookings` | 10 min | UX constant |
| Short-notice booking expiry | `cron/cleanup-expired-bookings` | 2 hours | Business rule |
| Auto-complete after check-in | `cron/cleanup-expired-bookings` | 2 hours past end | Business rule |
| Auto-no-show (no check-in) | `cron/cleanup-expired-bookings` | 3 hours past end | Business rule |
| Idempotency key TTL | `cron/cleanup-expired-bookings` | 24 hours | Matches Stripe idempotency window |
| Payout batch size | env `PAYOUT_BATCH_SIZE` | 20 | Vercel 60s timeout constraint |
| Availability cache TTL | `lib/services/availability.ts` | 30 seconds | Performance — in-process cache |
| AI query max rounds | `app/api/admin/ai-query/route.ts` | 5 | Cost control |
| AI max tokens per response | `app/api/admin/ai-query/route.ts` | 1,500 | Cost control |
| AI request timeout | `app/api/admin/ai-query/route.ts` | 15s | Vercel function timeout margin |
| AI message history limit | `app/api/admin/ai-query/route.ts` | 20 messages | Context window cost |
| Admin AI rate limit | `lib/ratelimit.ts` | 20/min per admin | Abuse prevention |
| Booking rate limit | `lib/ratelimit.ts` | 10/min per instructor | Abuse prevention |
| Auth rate limit | `lib/ratelimit.ts` | 5 attempts / 15 min per IP | Security |
| OTP expiry | `app/api/verifications/otp/` | 5 min | Security |
| OTP max attempts | `app/api/verifications/otp/confirm/` | 3 | Security |
| VAPI slot hold duration | `VAPI_SYSTEM_PROMPT.md` | 10 min | Communicated to caller verbally |
| Max business name length | `lib/branding/getDisplayIdentity.ts` | 80 chars | UI layout constraint |
| Recommendation search radius | `app/api/instructors/recommendations/` | 50 km | Default when instructor has no radius set |
| Document expiry alert window | `cron/document-expiry-check/` | 30 days | Business rule |
| Package credit validity | bulk booking response | 12 months | Business rule (stated to student) |

---

## 4. Rate Limits (all in `lib/ratelimit.ts`)

Change by editing `lib/ratelimit.ts` directly.

| Limiter | Rate | Used on |
|---|---|---|
| `bookingRateLimit` | 10 / 1 min | Booking creation |
| `bookingActionRateLimit` | 10 / 1 min | Booking actions (cancel, reschedule) |
| `bulkBookingRateLimit` | Configurable | Bulk / voice bookings |
| `webhookRateLimit` | 100 / 1 min | Stripe webhooks |
| `apiRateLimit` | 100 / 1 min | General API |
| `authRateLimit` | 5 / 15 min | Login |
| `reviewRateLimit` | 10 / 1 hr | Review submissions |
| `setupTokenRateLimit` | 20 / 15 min | Password setup links |
| `adminActionRateLimit` | 20 / 1 min | Admin AI queries |

---

## 5. Static UI Values (display only, no business logic impact)

These appear in marketing/public pages. They are documentation-style — wrong values look bad
but don't affect money. Update when subscription pricing changes.

| Value | File | Notes |
|---|---|---|
| Pricing table ($29/$79/$129/$199) | `app/instructor-terms/page.tsx` | Static legal page — update on price change |
| Pricing table | `app/help/instructors/page.tsx` | Help page — update on price change |
| PackagePricingShowcase example prices ($792, $900) | `components/landing/PackagePricingShowcase.tsx` | Marketing showcase — illustrative only |
| VAPI support phone | `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` | `SUPPORT_PHONE: 0488 000 000` — update when support line changes |
| VAPI support email | `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` | `SUPPORT_EMAIL: support@drivebook.com.au` |

---

## 6. VAPI / AI Receptionist Values (in `VAPI_SYSTEM_PROMPT.md`)

The system prompt has a dedicated update block at the top. Edit only that block.

```
SUPPORT_PHONE: 0488 000 000
SUPPORT_EMAIL: support@drivebook.com.au
```

Other VAPI constants (not in the update block — rarely change):
- Current year: `2026` — update annually or VAPI will book lessons in the past year
- Slot hold duration: `10 minutes` — matches `SLOT_HOLD_MINUTES` in booking config
- Service area: `Western Australia only`

---

## 7. Removed / Deprecated Values

These were hardcoded and have been removed. Do not re-introduce them.

| Value | Was in | Removed | Replacement |
|---|---|---|---|
| `newStudentBonus` (first-booking extra commission) | `payment.ts`, `packages.ts`, `subscriptions/webhook` | May 2026 / July 2026 | Will be replaced by referral system |
| `commissionRate` on `Instructor` model | Prisma schema | May 2026 | `getCommissionRate(tier)` from `platform-pricing` |
| `PLATFORM_COMMISSION_RATE` env var fallback | `lib/services/stripe.ts` | July 2026 | `getCommissionRate()` per call |
| Hardcoded `48` / `24` in cancel routes | 5 files | July 2026 | `PlatformSettings.lateCancellationWindowHours` |
| `DISPUTE_BUFFER_HOURS = 48` in payouts cron | `cron/weekly-payouts` | July 2026 | `lateCancellationWindowHours * 2` from DB |
| Client-side refund calculation in `CancelDialog` | `components/CancelDialog.tsx` | July 2026 | Fetches `/api/bookings/:id/cancellation-policy` |
| Stale `getSubscriptionPricing()` in `payment.ts` | `lib/services/payment.ts` | July 2026 | `lib/config/subscriptions.ts` is the source |
| Stale `calculateRevenueProjection()` | `lib/services/payment.ts` | July 2026 | Dead code — removed |

---

## Quick Reference: Where to change what

| I want to change... | Go to |
|---|---|
| Commission rates | `/admin/pricing` → PlatformSettings |
| Platform fee percentage | `/admin/pricing` → PlatformSettings |
| Package discounts | `/admin/pricing` → PlatformSettings |
| Cancellation window (24h / 48h) | `/admin/pricing` → PlatformSettings.lateCancellationWindowHours |
| Subscription prices | `.env` → `BASIC_MONTHLY_PRICE` etc, then update Stripe product |
| Stripe price IDs | `.env` → `STRIPE_*_PRICE_ID` |
| AI receptionist support contact | `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` top block |
| Session expiry | `lib/auth.ts` → `maxAge` |
| Payout batch size | `.env` → `PAYOUT_BATCH_SIZE` |
| Rate limits | `lib/ratelimit.ts` |
| Booking expiry time | `app/api/cron/cleanup-expired-bookings/route.ts` |

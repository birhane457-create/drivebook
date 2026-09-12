# Subscription Tiers

**Config:** `lib/config/subscriptions.ts`  
**DB rate override:** `PlatformSettings` (admin → `/admin/pricing`)  
**Admin UI:** `/admin/pricing`  
**Last updated:** 2026-09-01

---

## Tier Comparison

| Feature | BASIC | PRO | STUDIO | PREMIUM |
|---------|-------|-----|--------|---------|
| Monthly price | \$29 | \$79 | \$129 | \$199 |
| Annual price | \$290 | \$790 | \$1,290 | \$1,990 |
| Trial days | 14 | 14 | 14 | 30 |
| Commission rate | 15% | 12% | 11% | 10% |
| Max instructors | 1 | 1 | 1 | 1 |
| Offline bookings | ✗ | ✓ | ✓ | ✓ |
| Branded booking page | ✗ | ✓ | ✓ | ✓ |
| Custom slug | ✗ | ✓ | ✓ | ✓ |
| Custom domain | ✗ | ✗ | ✓ | ✓ |
| Priority support | ✗ | ✓ | ✓ | ✓ |
| API access | ✗ | ✗ | ✗ | ✓ |

---

## Commission Rates

Default rates are in `lib/config/subscriptions.ts`. Admins can override them via `/admin/pricing` → `PlatformSettings` DB.

Changes apply to new bookings only — existing bookings retain the rate at time of booking.

See `docs/DOCROLEBASE/06-payments/COMMISSIONS.md` for full details.

---

## Stripe Price IDs (Test Mode)

Set in `.env` and `Vercel` environment variables:

\\\
STRIPE_BASIC_MONTHLY_PRICE_ID
STRIPE_BASIC_ANNUAL_PRICE_ID
STRIPE_PRO_MONTHLY_PRICE_ID
STRIPE_PRO_ANNUAL_PRICE_ID
STRIPE_STUDIO_MONTHLY_PRICE_ID
STRIPE_STUDIO_ANNUAL_PRICE_ID
STRIPE_PREMIUM_MONTHLY_PRICE_ID
STRIPE_PREMIUM_ANNUAL_PRICE_ID
\\\

**Note:** All price IDs above are test mode. Replace with live mode IDs before go-live.

---

## Tier-Specific Features

### BASIC
Solo instructor. Standard commission. No branding, no offline bookings.

### PRO
Adds: offline/cash booking tracking, branded booking page (`slug.drivebook.com.au`), custom slug (`name.drivebook.com.au`), lower commission, priority support.

### STUDIO
Adds: custom domain (`yourdomain.com.au`), 1 year free domain included, even lower commission.

### PREMIUM
Adds: business name on all public surfaces, AI receptionist answers as your business, full white-label, API access, lowest commission (10%).

**"Coming Soon" in PREMIUM:**
- Direct payments (0% commission) — Phase 2, NOT implemented
- Multi-provider management — Future BUSINESS tier

---

## BUSINESS Tier (Coming Soon)

Multi-instructor school management. Lowest commission. Team calendar, API access.

**Currently deferred — UI placeholder only ("Coming Soon" badge).**
# Instructor Subscription Tiers

**Last Updated:** July 2026  
**Route:** `/dashboard/subscription`  
**Files:** `components/SubscriptionPlans.tsx`, `lib/config/subscriptions.ts`, `app/dashboard/subscription/page.tsx`

---

## Overview

DriveBook uses a 4-tier subscription model. BASIC, PRO, and STUDIO are live and purchasable. BUSINESS is defined but marked "Coming Soon" — not purchasable until multi-instructor management is complete.

---

## Tier Comparison

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---------|-------|-----|--------|----------|
| Monthly price | $29 | $79 | $129 | $199 |
| Annual price | $290 | $790 | $1,290 | $1,990 |
| Trial days | 14 | 14 | 14 | 30 |
| Commission rate | 15% | 12% | 11% | 10% |
| Max instructors | 1 | 1 | 1 | 999 |
| Public booking page | ✅ | ✅ | ✅ | ✅ |
| Custom slug | ❌ | ✅ | ✅ | ✅ |
| Branded booking page (logo + white-label nav) | ❌ | ✅ | ✅ | ✅ |
| Brand colours (on booking page) | ✅ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ | ✅ |
| Offline booking tracking | ❌ | ✅ | ✅ | ✅ |
| SMS notifications | ❌ | ✅ | ✅ | ✅ |
| Priority support | ❌ | ✅ | ✅ | ✅ |
| Multiple instructors | ❌ | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | ❌ | ✅ |
| UI status | Live | Live | Live | Coming Soon |

**Note:** `newStudentBonus` was removed in May 2026. Commission is a flat rate per tier with no first-booking modifier.

---

## Trial Period

All tiers include a free trial (BASIC/PRO/STUDIO: 14 days, BUSINESS: 30 days).

Trial is **per-instructor, not per-tier**. Changing tiers during a trial preserves the original trial end date — it is never reset. Full access to all tier features during trial, no payment method required upfront.

---

## Commission Rates

Configurable via `/admin/pricing` → `PlatformSettings`. Values in `lib/config/subscriptions.ts` are defaults — DB values take precedence at runtime. Admins can schedule rate changes in advance; instructors are notified before the effective date.

---

## Schema Fields

```prisma
customSlug       String?   // slug for slug.drivebook.com.au (PRO+)
customDomain     String?   // full custom domain (STUDIO+)
domainVerified   Boolean   @default(false)
domainVerifiedAt DateTime?
```

---

## Feature Access Gates

| Gate | Where enforced |
|------|---------------|
| Branded booking page | `app/subdomain/[slug]/page.tsx` — `isPro` check (PRO/STUDIO/BUSINESS) |
| Custom domain | `app/api/instructor/domain/verify/route.ts` — 403 for non-STUDIO/BUSINESS |
| Branding API | `app/api/public/instructor/[id]/branding/route.ts` — PRO/STUDIO/BUSINESS |
| Branding settings UI | `app/dashboard/branding/page.tsx` — upgrade wall for BASIC |
| Offline booking tracking | `POST /api/bookings/offline` — 403 with `upgradeRequired: true` for BASIC |

---

## Stripe Price IDs

Set in `.env` and Vercel environment variables. All IDs above are test mode — replace with live IDs before go-live.

```
STRIPE_BASIC_MONTHLY_PRICE_ID=
STRIPE_BASIC_ANNUAL_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
STRIPE_STUDIO_MONTHLY_PRICE_ID=
STRIPE_STUDIO_ANNUAL_PRICE_ID=
STRIPE_BUSINESS_MONTHLY_PRICE_ID=   (not yet active)
STRIPE_BUSINESS_ANNUAL_PRICE_ID=    (not yet active)
```

---

## Related

- `docs/DOCROLEBASE/07-subscriptions/TIERS.md` — Canonical tier reference
- `lib/config/subscriptions.ts` — Tier definitions and defaults
- `components/SubscriptionPlans.tsx` — UI component
- `app/dashboard/subscription/page.tsx` — Subscription management page

# Instructor Subscription Tiers

**Last Updated:** July 2026  
**Route:** `/dashboard/subscription`  
**Files:** `components/SubscriptionPlans.tsx`, `lib/config/subscriptions.ts`, `app/dashboard/subscription/page.tsx`

---

## Overview

DriveBook uses a 4-tier subscription model. BASIC, PRO, STUDIO, and PREMIUM are all live and purchasable. A 5th tier (BUSINESS — multi-provider) is shown in the UI as "Coming Soon" with no backend implementation.

---

## Tier Comparison

| Feature | BASIC | PRO | STUDIO | PREMIUM |
|---------|-------|-----|--------|----------|
| Monthly price | $29 | $79 | $129 | $199 |
| Annual price | $290 | $790 | $1,290 | $1,990 |
| Trial days | 14 | 14 | 14 | 30 |
| Commission rate | 15% | 12% | 11% | 10% |
| Max providers per account | 1 | 1 | 1 | 1 |
| Public booking page | ✅ | ✅ | ✅ | ✅ |
| Custom slug | ❌ | ✅ | ✅ | ✅ |
| Branded booking page (logo + white-label nav) | ❌ | ✅ | ✅ | ✅ |
| Brand colours (on booking page) | ✅ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ | ✅ |
| Offline booking tracking | ❌ | ✅ | ✅ | ✅ |
| SMS notifications | ❌ | ✅ | ✅ | ✅ |
| Priority support | ❌ | ✅ | ✅ | ✅ |
| Multiple providers | ❌ | ❌ | ❌ | Coming Soon (BUSINESS tier) |
| API access | ❌ | ❌ | ❌ | ✅ |
| UI status | Live | Live | Live | **Live** |

**Note:** `newStudentBonus` was removed in May 2026. Commission is a flat rate per tier with no first-booking modifier.

**PREMIUM tier — phase 2 note:** PREMIUM includes "Option for direct payments (0% commission)" in its feature list. This means the provider connects their own Stripe account and clients pay them directly. **This is not yet implemented.** All payments currently route through the DriveBook Stripe account (PLATFORM mode). `paymentMode=DIRECT` throws a runtime error if set.

---

## Trial Period

All tiers include a free trial (BASIC/PRO/STUDIO: 14 days, PREMIUM: 30 days).

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
| Branded booking page | `app/subdomain/[slug]/page.tsx` — `isPro` check (PRO/STUDIO/PREMIUM) |
| Custom domain | `app/api/instructor/domain/verify/route.ts` — 403 for non-STUDIO/PREMIUM |
| Branding API | `app/api/public/instructor/[id]/branding/route.ts` — PRO/STUDIO/PREMIUM |
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
STRIPE_PREMIUM_MONTHLY_PRICE_ID=   (not yet active)
STRIPE_PREMIUM_ANNUAL_PRICE_ID=    (not yet active)
```

---

## Related

- `docs/DOCROLEBASE/07-subscriptions/TIERS.md` — Canonical tier reference
- `lib/config/subscriptions.ts` — Tier definitions and defaults
- `components/SubscriptionPlans.tsx` — UI component
- `app/dashboard/subscription/page.tsx` — Subscription management page

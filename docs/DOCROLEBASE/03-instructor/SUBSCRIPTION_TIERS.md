# Instructor Subscription Tiers

**Last Updated:** April 2026  
**Route:** `/dashboard/subscription`  
**File:** `components/SubscriptionPlans.tsx`, `lib/config/subscriptions.ts`

---

## Overview

DriveBook uses a 4-tier subscription model for instructors. Three tiers are live and purchasable. Business is defined in the system but marked "Coming Soon" in the UI — it is not purchasable until multi-instructor management features are complete.

---

## Tier Comparison

| Feature | BASIC | PRO | STUDIO | BUSINESS |
|---------|-------|-----|--------|----------|
| Monthly price | $29 | $79 | $129 | $199 |
| Annual price | $290 | $790 | $1290 | $1990 |
| Trial days | 14 | 14 | 14 | 30 |
| Commission rate | 15% | 12% | 11% | 10% |
| New student bonus | 8% | 10% | 10% | 12% |
| Public booking page | ✅ | ✅ | ✅ | ✅ |
| Default URL (by ID) | ✅ | ✅ | ✅ | ✅ |
| Custom slug | ❌ | ✅ | ✅ | ✅ |
| Branded booking page | ❌ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ✅ | ✅ | ✅ |
| Multiple instructors | ❌ | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | ❌ | ✅ |
| UI status | Live | Live | Live | Coming Soon |

---

## BASIC — $29/month

Entry tier for individual instructors just getting started.

**What you get:**
- Single instructor account
- Unlimited bookings
- Google Calendar sync
- Email notifications
- Basic analytics
- Student reviews
- Mobile app access
- Public booking page at `<id>.drivebook.com.au`
- 15% commission per booking
- 8% bonus for new students

**Limitations:**
- No custom slug or domain
- No branded booking page (DriveBook branding shown)
- No priority support

---

## PRO — $79/month

For instructors growing their business and wanting a professional presence.

**Everything in Basic, plus:**
- Custom slug (e.g. `john.drivebook.com.au`)
- Branded booking page — custom logo, colors, white-label nav
- Advanced analytics & insights
- SMS notifications
- Waiting list management
- PDA test tracking
- Document management
- Check-in/Check-out system
- Custom service areas
- 12% commission per booking
- 10% bonus for new students
- Priority email support

---

## STUDIO — $129/month

For instructors who want their own domain and a fully white-labelled experience.

**Everything in Pro, plus:**
- Custom domain (bring your own — e.g. `book.yourdrivingschool.com.au`)
- 1 year free domain included (planned)
- Fully white-label booking experience on your own domain
- 11% commission per booking
- 10% bonus for new students
- Priority support

**Domain setup:**
1. Instructor enters their domain in `/dashboard/branding`
2. System verifies DNS CNAME points to `cname.vercel-dns.com`
3. `domainVerified = true` stored on instructor record
4. Domain added to Vercel project for SSL (manual step currently)

**Schema fields:**
```
customDomain     String?
domainVerified   Boolean   @default(false)
domainVerifiedAt DateTime?
```

---

## BUSINESS — $199/month (Coming Soon)

Multi-instructor school management. Not yet purchasable.

**Planned features (not yet implemented):**
- Multiple instructor accounts under one school
- Fleet management
- Staff governance
- Multi-account billing
- API access
- Advanced reporting
- Dedicated account manager
- Priority phone support
- 10% commission per booking
- 12% bonus for new students

**Current status:**
- Defined in `lib/config/subscriptions.ts` and `prisma/schema.prisma`
- Shown in `/dashboard/subscription` as a greyed-out card with "Coming Soon" badge
- Button is disabled — cannot be purchased
- Will be enabled once multi-instructor management is built and reviewed

---

## Trial Period

All tiers include a free trial:
- BASIC, PRO, STUDIO: 14 days
- BUSINESS: 30 days (when available)

During trial:
- Full access to all tier features
- No payment method required upfront
- Trial end date stored in `instructor.trialEndsAt`
- After trial expires, subscription must be activated to continue

---

## Commission & Bonus Rates

Commission and bonus rates are configurable via `/admin/pricing` → `PlatformSettings` in DB. The values in `lib/config/subscriptions.ts` are defaults — the DB values take precedence at runtime.

```
instructorPayout = lessonAmount - commission - newStudentBonus
platformRevenue  = platformFee + commission + newStudentBonus
```

`newStudentBonus` only applies to the first booking a student makes with that instructor.

---

## Stripe Integration

Each tier has monthly and annual Stripe Price IDs configured via environment variables:

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

Subscription management:
- `POST /api/instructor/subscription` — create or change plan
- `POST /api/instructor/subscription/billing-portal` — open Stripe Billing Portal
- `POST /api/instructor/subscription/change-plan` — upgrade/downgrade

---

## Feature Access Gates

Feature access is checked at the component level using `instructor.subscriptionTier`:

| Gate | Where enforced |
|------|---------------|
| Branded booking page | `app/subdomain/[slug]/page.tsx` — `isPro` check |
| Custom domain | `app/subdomain/[slug]/page.tsx` — `isPro` check |
| Branding settings | `app/dashboard/branding/page.tsx` — shows upgrade wall for BASIC |
| Custom slug | `app/api/instructor/branding/route.ts` |

**Note:** Color customization (`brandColorPrimary`, `brandColorSecondary`) applies to all tiers on the subdomain page. Logo and white-label nav require PRO+.

---

## Related

- `docs/SUBSCRIPTION_SYSTEM.md` — Technical subscription implementation
- `lib/config/subscriptions.ts` — Tier definitions and defaults
- `components/SubscriptionPlans.tsx` — UI component
- `app/dashboard/subscription/page.tsx` — Subscription management page
- `docs/SUBDOMAIN_SYSTEM.md` — Domain and branding by tier

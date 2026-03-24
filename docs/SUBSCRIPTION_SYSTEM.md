# Subscription & Trial System

Last updated: 2026-03-22

---

## Overview

DriveBook uses a three-tier subscription model for instructors. Subscriptions are managed via a combination of Prisma/MongoDB records and Stripe. Trial periods are tracked in the database without requiring a payment method upfront.

---

## Tiers

Default values defined in `lib/config/subscriptions.ts` and overridable via the admin pricing page (`/admin/pricing`) which persists to the `PlatformSettings` DB model. Payment intent creation reads live rates from DB via `lib/services/platform-pricing.ts`.

| Tier     | Monthly | Annual | Commission (default) | New Student Bonus (default) | Trial Days |
|----------|---------|--------|----------------------|-----------------------------|------------|
| BASIC    | $29     | $290   | 15%                  | 8%                          | 14 days    |
| PRO      | $79     | $790   | 12%                  | 10%                         | 14 days    |
| BUSINESS | $199    | $1990  | 10%                  | 12%                         | 30 days    |

---

## Schema Fields

### `Instructor` model (relevant fields)

```
subscriptionTier    String    @default("BASIC")
subscriptionStatus  String    @default("TRIAL")
trialEndsAt         DateTime?
stripeCustomerId    String?
stripeAccountId     String?
maxInstructors      Int       @default(1)
```

**Missing from schema (gap):** `commissionRate` and `newStudentBonus` are referenced in `app/api/instructor/subscription/route.ts` GET and POST handlers, and in the subscription dashboard page — but these fields do NOT exist on the `Instructor` model in `schema.prisma`. The Prisma client will throw a validation error if you try to select them. Commission rates are defined in `lib/config/subscriptions.ts` and should be derived from `subscriptionTier` at runtime, not stored on the instructor record.

### `Subscription` model

```
id                   ObjectId
instructorId         ObjectId
tier                 String           (BASIC | PRO | BUSINESS)
status               String           (TRIAL | ACTIVE | PAST_DUE | CANCELLED)
billingCycle         String           (monthly | annual)
monthlyAmount        Float
stripeSubscriptionId String?          (null during trial)
stripeCustomerId     String?
currentPeriodStart   DateTime
currentPeriodEnd     DateTime
cancelAtPeriodEnd    Boolean
trialEndsAt          DateTime?        (field exists on model but not in schema.prisma — not populated)
cancelledAt          DateTime?        (referenced in DELETE route but not in schema.prisma)
createdAt            DateTime
updatedAt            DateTime
```

**Note:** `trialEndsAt` and `cancelledAt` are referenced in API code but are not defined in `schema.prisma` on the `Subscription` model. Trial end date is stored on `Instructor.trialEndsAt` instead.

---

## Current State (as of 2026-03-22)

Instructor: Debesay Birhane (`customDomain: sssssss`)

```
subscriptionTier:    BASIC
subscriptionStatus:  TRIAL
trialEndsAt:         2026-03-26  (expires in ~4 days from last check)
stripeCustomerId:    cus_U34eulX2Wox98D  (Stripe customer exists)
stripeSubscriptionId: null  (no paid subscription yet)
```

Subscription record:
```
tier:               BASIC
status:             TRIAL
billingCycle:       monthly
monthlyAmount:      $29
currentPeriodEnd:   2026-03-28
stripeSubscriptionId: null
```

The instructor is on a BASIC trial. The Stripe customer record exists but no active Stripe subscription has been created (no payment method added yet).

---

## API Routes

### `GET /api/instructor/subscription`
Returns current tier, status, trial end date, and all plan definitions. References `commissionRate` and `newStudentBonus` in the select — these fields don't exist in the schema, so this will silently return `undefined` for those fields (MongoDB/Prisma doesn't error on unknown selects in some versions, but the Prisma client validation will reject them).

### `POST /api/instructor/subscription`
- If instructor is on TRIAL with no `stripeSubscriptionId` and clicks their current plan → creates a Stripe Checkout session to add payment method
- Otherwise → creates or updates a trial `Subscription` record in DB, updates `Instructor.subscriptionTier`, sets `trialEndsAt`
- Does NOT require payment upfront

### `DELETE /api/instructor/subscription`
Marks `cancelAtPeriodEnd: true` and sets `cancelledAt` on the `Subscription` record. Note: `cancelledAt` is not in `schema.prisma`.

### `POST /api/instructor/subscription/change-plan`
- Trial users (no `stripeSubscriptionId`): updates DB only, no Stripe call
- Active users (has `stripeSubscriptionId`): calls `stripe.subscriptions.update` with proration
- Logs to audit log via `lib/services/auditLogger.ts`

### `POST /api/instructor/subscription/billing-portal`
- If instructor has `stripeCustomerId` → creates Stripe Billing Portal session
- If no `stripeCustomerId` → creates a Stripe Checkout session to add payment method
- Supports Stripe Connect via `stripeAccountId`

### `POST /api/subscriptions/checkout`
- If `STRIPE_SECRET_KEY` is not set → starts trial directly in DB (no Stripe)
- If Stripe is configured → creates Stripe Checkout session with `trial_period_days` from plan config

### `GET|POST|DELETE /api/instructor/subscription/mobile`
Mobile-specific endpoint using JWT auth (not NextAuth sessions). Reads real DB values — instructor subscription tier/status, active subscription record — and derives commission rates from `SUBSCRIPTION_PLANS` config. Supports GET (current subscription), POST (create/update trial), and DELETE (cancel).

---

## Dashboard UI

**Route:** `/dashboard/subscription`  
**File:** `app/dashboard/subscription/page.tsx`  
**Component:** `components/SubscriptionPlans.tsx`

### What it shows
- Trial status banner with days remaining (or expired warning)
- Active subscription banner with renewal date and commission rate
- PAST_DUE warning banner
- Three plan cards (BASIC, PRO, BUSINESS) with monthly/annual toggle
- "Manage Billing & Payment" button → opens Stripe Billing Portal or Checkout

### What it does NOT show
- Commission rate and new student bonus in the "Your Plan Benefits" section only renders when `subscriptionStatus === 'ACTIVE'` — trial users don't see it
- The `commissionRate` and `newStudentBonus` values shown come from `instructor.commissionRate` / `instructor.newStudentBonus` — fields that don't exist in the schema (will be `undefined`)

### Branding page gate
`/dashboard/branding` shows an "Upgrade to PRO" wall for `subscriptionTier === 'BASIC'`. PRO and BUSINESS users see the full branding settings. This check is done client-side only — the API itself allows all tiers to save branding.

---

## Feature Access by Tier

Defined in `lib/config/subscriptions.ts` under `limits`:

| Feature           | BASIC | PRO  | BUSINESS |
|-------------------|-------|------|----------|
| customDomain      | ✗     | ✗    | ✓        |
| brandedPages      | ✗     | ✓    | ✓        |
| prioritySupport   | ✗     | ✓    | ✓        |
| apiAccess         | ✗     | ✗    | ✓        |
| maxInstructors    | 1     | 1    | 999      |

**Note:** The branding dashboard (`/dashboard/branding`) gates on `PRO || BUSINESS` — but the config says `brandedPages` is only `true` for BUSINESS. The UI is more permissive than the config. Colors apply to all tiers on the subdomain page; logo/name white-labelling requires `showBrandingOnBookingPage === true` (PRO/BUSINESS gate in UI).

---

## Stripe Integration Status

| Feature                        | Status                          |
|--------------------------------|---------------------------------|
| Stripe customer creation       | Done — `stripeCustomerId` saved |
| Stripe Checkout (new sub)      | Implemented                     |
| Stripe Billing Portal          | Implemented                     |
| Stripe Webhook handler         | Exists at `app/api/stripe/webhook/route.ts` |
| Stripe Subscription IDs        | Not yet set — `STRIPE_*_PRICE_ID` env vars use placeholder fallbacks (`price_basic_monthly` etc.) |
| Actual paid subscription       | Not active for current instructor |

Stripe Price IDs must be set in `.env` / Vercel dashboard before checkout will work:
```
STRIPE_BASIC_MONTHLY_PRICE_ID=
STRIPE_BASIC_ANNUAL_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
STRIPE_BUSINESS_MONTHLY_PRICE_ID=
STRIPE_BUSINESS_ANNUAL_PRICE_ID=
```

---

## Known Gaps

1. ~~`commissionRate` and `newStudentBonus` referenced in subscription API and dashboard but not in `schema.prisma` Instructor model~~ **Fixed** — API now derives these from `SUBSCRIPTION_PLANS[tier]` config; no DB fields needed
2. ~~`cancelledAt` field referenced in DELETE route but not in `schema.prisma` Subscription model~~ **Fixed** — added to `Subscription` model in schema
3. ~~`trialEndsAt` on `Subscription` model referenced in code but not in `schema.prisma`~~ **Fixed** — added to `Subscription` model in schema
4. ~~Mobile subscription route returns hardcoded mock data~~ **Fixed** — route now reads real DB values and derives rates from config
5. ~~Stripe Price IDs are placeholder strings~~ **Fixed** — real Price IDs set in `.env`
6. ~~`commissionRate` shown in subscription dashboard "Your Plan Benefits" section will be `undefined`~~ **Fixed** — dashboard now derives from `SUBSCRIPTION_PLANS[tier]`

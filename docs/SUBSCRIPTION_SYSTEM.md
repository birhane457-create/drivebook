# Subscription System

**Last updated:** May 2026  
**Status:** Fully implemented and working  
**Canonical reference:** `docs/DOCROLEBASE/07-subscriptions/`

---

## Overview

DriveBook uses a 4-tier subscription model for instructors. Subscriptions are managed via Stripe. The system handles trials, upgrades, downgrades, billing portal, and post-portal sync.

For full documentation, see:
- `docs/DOCROLEBASE/07-subscriptions/TIERS.md` — Tier features and commission rates
- `docs/DOCROLEBASE/07-subscriptions/BILLING.md` — Billing cycles, portal, failed payments
- `docs/DOCROLEBASE/07-subscriptions/UPGRADE_FLOW.md` — Upgrade/downgrade/cancel flow
- `docs/DOCROLEBASE/07-subscriptions/TRIAL.md` — Trial period behaviour
- `docs/DOCROLEBASE/03-instructor/SUBSCRIPTION_TIERS.md` — Instructor-facing reference

---

## Tiers

| Tier | Monthly | Annual | Commission | Trial | Status |
|------|---------|--------|------------|-------|--------|
| BASIC | $29 | $290 | 15% | 14 days | Live |
| PRO | $79 | $790 | 12% | 14 days | Live |
| STUDIO | $129 | $1,290 | 11% | 14 days | Live |
| BUSINESS | $199 | $1,990 | 10% | 30 days | Coming Soon |

Note: The `newStudentBonus` concept was removed in May 2026. Commission is a flat rate per tier.

---

## DB Models

### `Instructor` model (subscription fields)

```
subscriptionTier    String    @default("BASIC")
subscriptionStatus  String    @default("TRIAL")
trialEndsAt         DateTime?
stripeCustomerId    String?
```

### `Subscription` model

```
id                   String
instructorId         String
tier                 String
status               String    @default("ACTIVE")
billingCycle         String    @default("monthly")
monthlyAmount        Float
stripeSubscriptionId String?
stripeCustomerId     String?
currentPeriodStart   DateTime
currentPeriodEnd     DateTime
cancelAtPeriodEnd    Boolean   @default(false)
trialEndsAt          DateTime?
cancelledAt          DateTime?
```

### `PlatformRateChange` model

```
id            String
tier          String    // BASIC | PRO | STUDIO | BUSINESS | ALL
field         String    // basicCommissionRate | proCommissionRate | businessCommissionRate
currentRate   Float
newRate       Float
effectiveDate DateTime
reason        String
status        String    @default("PENDING")  // PENDING | APPLIED | CANCELLED
notifiedAt    DateTime?
appliedAt     DateTime?
createdBy     String
```

---

## APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/instructor/subscription` | Get current subscription + all plan definitions |
| POST | `/api/instructor/subscription` | Create trial or change tier during trial |
| DELETE | `/api/instructor/subscription` | Cancel subscription (sets cancelAtPeriodEnd) |
| POST | `/api/instructor/subscription/billing-portal` | Open Stripe Billing Portal (active subscribers) or Checkout (trial) |
| POST | `/api/instructor/subscription/sync` | Sync subscription state from Stripe after portal return |
| GET | `/api/admin/rate-changes` | List scheduled rate changes |
| POST | `/api/admin/rate-changes` | Schedule a rate change |
| DELETE | `/api/admin/rate-changes/[id]` | Cancel a pending rate change |
| GET | `/api/cron/apply-rate-changes` | Apply due rate changes (daily cron) |

---

## Upgrade/Downgrade Flow

**Trial instructors:** `POST /api/instructor/subscription` with new tier. DB updated immediately. Trial end date preserved.

**Active paid instructors:** `POST /api/instructor/subscription/billing-portal` → Stripe Billing Portal → return with `?portal_return=true` → `POST /api/instructor/subscription/sync` pulls latest state from Stripe.

The webhook (`customer.subscription.updated`) also fires and updates the DB as a second confirmation. Tier is derived from the Stripe price ID if metadata is missing (handles Billing Portal upgrades).

---

## Scheduled Rate Changes

Admins schedule rate changes via `/admin/pricing` → Rate Change Scheduler. The `apply-rate-changes` cron applies them on the effective date and notifies all affected instructors.

---

## Stripe Webhook Events Handled

| Event | Handler |
|-------|---------|
| `customer.subscription.created` | `handleSubscriptionUpdate` — creates/updates Subscription record |
| `customer.subscription.updated` | `handleSubscriptionUpdate` — syncs tier, status, period |
| `customer.subscription.deleted` | `handleSubscriptionCancelled` — sets status CANCELLED |
| `customer.subscription.trial_will_end` | `handleTrialEnding` — sends 3-day warning email |
| `invoice.payment_succeeded` | `handleInvoicePaymentSucceeded` — sets status ACTIVE, clears trialEndsAt |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` — sets status PAST_DUE |

---

## Commission Rate Source

Commission rates are read at payment intent creation from `PlatformSettings` DB record via `lib/services/platform-pricing.ts`. The rate is locked on the booking at creation time and never changes.

Config fallback: `lib/config/subscriptions.ts` defines defaults used when no DB record exists.

---

## Known Gaps (resolved)

All previously documented gaps have been fixed:
- `commissionRate` and `newStudentBonus` are no longer referenced as Instructor model fields — derived from config
- `cancelledAt` added to Subscription model
- `trialEndsAt` added to Subscription model
- Billing Portal return now syncs subscription state via `/api/instructor/subscription/sync`
- Webhook derives tier from price ID when metadata is missing (Billing Portal upgrades)

# Subscription System

**Status:** ✅ Current  
**Last Updated:** 2026-09-01  
**Verified Against:** `lib/config/subscriptions.ts`, `lib/services/platform-pricing.ts`, `prisma/schema.prisma`

---

## Overview

DriveBook uses a 4-tier subscription model for providers. Subscriptions are managed via Stripe. The system handles trials, upgrades, downgrades, billing portal, and post-portal sync.

**BUSINESS tier (multi-provider management)** is shown in UI as "Coming Soon" but has NO backend implementation and NO Stripe price IDs.

---

## Active Tiers

**Source of truth:** `lib/config/subscriptions.ts` → `SUBSCRIPTION_PLANS`

| Tier | Monthly | Annual | Commission | Trial | Max Providers | Status |
|------|---------|--------|------------|-------|---------------|--------|
| BASIC | \$29 | \$290 | 15% | 14 days | 1 | ✅ Live |
| PRO | \$79 | \$790 | 12% | 14 days | 1 | ✅ Live |
| STUDIO | \$129 | \$1,290 | 11% | 14 days | 1 | ✅ Live |
| PREMIUM | \$199 | \$1,990 | 10% | 30 days | 1 | ✅ Live |
| BUSINESS | TBD | TBD | TBD | TBD | Unlimited | ⏳ Coming Soon |

**Note on naming:**
- **PREMIUM** = 4th active tier for single providers with full white-label
- **BUSINESS** = future 5th tier for multi-provider schools (not implemented)

---

## Commission Rate Source

Commission rates are read from `PlatformSettings` DB record at booking creation time via `lib/services/platform-pricing.ts` → `getCommissionRate(tier)`.

**DB field mapping:**
- `basicCommissionRate` → BASIC tier (15%)
- `proCommissionRate` → PRO tier (12%)
- `studioCommissionRate` → STUDIO tier (11%)
- `businessCommissionRate` → **PREMIUM tier (10%)** ← DB column name unchanged for compatibility

**Important:** The rate is locked on the booking at creation time — never re-derived at payout time.

**Config fallback:** `lib/config/packages.ts` → `DEFAULT_SETTINGS` provides hardcoded defaults when no DB record exists.

---

## Tier Features

**Source:** `lib/config/subscriptions.ts` → `SUBSCRIPTION_PLANS[tier].limits`

| Feature | BASIC | PRO | STUDIO | PREMIUM |
|---------|-------|-----|--------|---------|
| Max providers | 1 | 1 | 1 | 1 |
| Unlimited bookings | ✓ | ✓ | ✓ | ✓ |
| Google Calendar sync | ✓ | ✓ | ✓ | ✓ |
| Email notifications | ✓ | ✓ | ✓ | ✓ |
| Basic analytics | ✓ | ✓ | ✓ | ✓ |
| Customer reviews | ✓ | ✓ | ✓ | ✓ |
| Mobile app access | ✓ | ✓ | ✓ | ✓ |
| Advanced analytics | ✗ | ✓ | ✓ | ✓ |
| SMS notifications | ✗ | ✓ | ✓ | ✓ |
| Waiting list | ✗ | ✓ | ✓ | ✓ |
| Document management | ✗ | ✓ | ✓ | ✓ |
| Branded booking page | ✗ | ✓ | ✓ | ✓ |
| Custom slug | ✗ | ✓ | ✓ | ✓ |
| Custom domain | ✗ | ✗ | ✓ | ✓ |
| Full white-label | ✗ | ✗ | ✓ | ✓ |
| Priority support | ✗ | ✓ | ✓ | ✓ |
| API access | ✗ | ✗ | ✗ | ✓ |
| AI receptionist as your business | ✗ | ✗ | ✗ | ✓ |

**"Coming Soon" features listed in PREMIUM:**
- Direct payments (0% commission) — Phase 2, NOT implemented
- Multi-provider management — Future BUSINESS tier

---

## Payment Mode

Two payment modes exist on `Provider` schema:
- `PLATFORM` (default) — all payments flow through DriveBook Stripe
- `DIRECT` — payments go to provider's own Stripe account

**Status:** `DIRECT` mode is Phase 2 and NOT implemented. Any account set to `paymentMode=DIRECT` will throw error at checkout via `lib/utils/account.ts` → `assertPlatformPaymentMode()`.

---

## DB Schema

**Subscription fields on `Provider` model** (`prisma/schema.prisma`):

\\\prisma
subscriptionTier    String    @default("BASIC")   // BASIC | PRO | STUDIO | PREMIUM
subscriptionStatus  String    @default("TRIAL")   // TRIAL | ACTIVE | PAST_DUE | CANCELLED
trialEndsAt         DateTime?
stripeCustomerId    String?
stripeAccountId     String?
paymentMode         String    @default("PLATFORM") // PLATFORM | DIRECT (DIRECT = Phase 2)
businessModel       String    @default("SAAS")     // MARKETPLACE | SAAS
accountType         String    @default("INDIVIDUAL") // INDIVIDUAL | BUSINESS
\\\

**Key distinctions:**
- `subscriptionTier` = pricing tier (BASIC/PRO/STUDIO/PREMIUM)
- `accountType` = legal entity type (INDIVIDUAL vs BUSINESS organization)
- `businessModel` = platform role (MARKETPLACE vs SAAS)
- `paymentMode` = payment routing (PLATFORM vs DIRECT)

---

## Subscription Status Values

| Status | Meaning |
|--------|---------|
| `TRIAL` | Free trial period, full access |
| `ACTIVE` | Paid subscription, full access |
| `PAST_DUE` | Payment failed, read-only mode |
| `CANCELLED` | Cancelled or expired, read-only mode |

---

## Stripe Price IDs

**Source:** `lib/config/subscriptions.ts` → `STRIPE_PRICE_IDS`

Set via environment variables:
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

**Note:** All IDs above are test mode. Replace with live mode IDs before go-live.

**BUSINESS tier:** No price IDs — not implemented.

---

## API Routes

- `POST /api/instructor/subscription/billing-portal` — create Stripe billing portal session
- `POST /api/instructor/subscription/sync` — sync subscription state from Stripe
- `GET /api/admin/pricing` — admin pricing configuration
- `POST /api/admin/pricing` — update platform pricing
- `POST /api/cron/apply-rate-changes` — apply scheduled commission rate changes

---

## Helper Functions

**`lib/config/subscriptions.ts`:**
- `getPlanDetails(tier)` — get plan config
- `calculateCommission(amount, tier)` — calculate commission split
- `getTrialEndDate(tier)` — calculate trial end date
- `isTrialExpired(trialEndsAt)` — check if trial expired
- `canAccessFeature(tier, feature)` — feature gate check
- `getStripePriceId(tier, billingCycle)` — get Stripe price ID

**`lib/services/platform-pricing.ts`:**
- `getPlatformPricing()` — fetch from DB or fallback
- `getCommissionRate(tier)` — get commission % for tier

---

## Related Documentation

- Billing details → `docs/DOCROLEBASE/07-subscriptions/BILLING.md`
- Trial enforcement → `docs/DOCROLEBASE/07-subscriptions/TRIAL_ENFORCEMENT.md`
- Upgrade flow → `docs/DOCROLEBASE/07-subscriptions/UPGRADE_FLOW.md`
- Stripe setup → `docs/STRIPE_SETUP_GUIDE.md`

---

## Code Files

| File | Purpose |
|------|---------|
| `lib/config/subscriptions.ts` | Plan config, prices, features |
| `lib/services/platform-pricing.ts` | Commission rate lookup |
| `lib/config/packages.ts` | Default fallback values |
| `lib/utils/account.ts` | Payment mode guards |
| `prisma/schema.prisma` | Provider subscription fields |
| `app/api/instructor/subscription/` | Subscription API routes |

---

**End of Document**
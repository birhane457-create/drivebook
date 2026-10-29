---
inclusion: always
---

# DriveBook Account Architecture — Commercial Offers and Feature Entitlements

**Decision recorded:** 2026-10-27  
**Applies to:** All code that gates features, creates subscriptions, or describes commercial offerings.

---

## The Governing Rule

> **Provider structure defines capacity. The active subscription defines entitlement. Structure alone must never grant a feature or upgrade a subscription.**

Setting an account to `MULTI_PROVIDER` must not independently grant multi-instructor management. The subscription must authorise it, and the multi-provider functionality must be implemented and operational before it is exposed.

---

## Canonical Definitions

| Concept | Meaning | Current status |
|---|---|---|
| **Provider structure** | Whether an account operates one provider or multiple providers | Single-provider only; multi-provider is future work |
| **Subscription tier** | The level of features the subscription authorises | BASIC, PRO, STUDIO, PREMIUM |
| **White-label** | Branding entitlements granted by the subscription | PREMIUM: full white-label for one provider |
| **Commercial offer** | The product a customer purchases (tier + payment rules + agreement) | Proposed concept — not yet a DB field |
| **Business tier** | A future subscription that enables multi-provider management | Not implemented; not available for sale |
| **Business type** | Service vertical (driving, tradie, etc.) | Separate from structure and tier |
| **Commercial model** | Marketplace or SaaS | Separate from structure and tier |

---

## Two Commercial Catalogues

### Catalogue A — DriveBook Marketplace
For providers who acquire customers through the DriveBook Marketplace.

| Tier | Features | Commission |
|---|---|---|
| BASIC | Standard bookings | 15% |
| PRO | + custom slug, AI receptionist, branding | 12% |
| STUDIO | + custom domain | 11% |
| PREMIUM | + full white-label for one provider | 10% |

**Governing agreement:** Marketplace Terms and Conditions (subscription fee + commission + platform payment handling).

### Catalogue B — DriveBook SaaS
For providers who bring their own customers and operate their business using DriveBook.

| Offer | Scope | Status |
|---|---|---|
| SaaS Premium | Single provider — full white-label, direct-payment arrangement (phase 2) | Current (when implemented) |
| SaaS Business | Multi-provider organisation | Future — not yet available |

**Governing agreement:** SaaS Terms and Conditions (direct payments, white-label branding, website capabilities, single-provider and future multi-provider arrangements).

**Important:** SaaS direct payments must not be activated until the payment flow is implemented and verified.

---

## Feature Tier vs Commercial Offer

Marketplace PREMIUM and SaaS Premium can **share the same Premium feature entitlements** (white-label, custom domain, custom slug). They differ in:
- Price and commission/payment rules
- Governing agreement
- Payment processing arrangement

**Target implementation (not yet a DB field):**
```typescript
// Proposed — do not add to DB until all subscription, Stripe checkout/webhook,
// trial, renewal, commission and dashboard dependencies are inventoried.
type CommercialOffer =
  | 'MARKETPLACE_BASIC' | 'MARKETPLACE_PRO' | 'MARKETPLACE_STUDIO' | 'MARKETPLACE_PREMIUM'
  | 'SAAS_PREMIUM'
  | 'SAAS_BUSINESS'; // future
```

---

## Multi-Provider — What Is and Is Not Implemented

**Current:** Every account is single-provider. `getAccountFeatures().multiInstructor` returns `false` for all tiers.

**Future SaaS Business:** Will introduce multi-provider management. When implemented it must:
1. Have the Business tier subscription active
2. Have provider-limit enforcement in place
3. Have team management features operational
4. Have the SaaS agreement accepted for the Business tier

Business may inherit Premium's white-label features, but this must be explicitly recorded in the subscription feature matrix — not inferred from account structure.

---

## Implementation Sequence

1. Inventory all existing `accountType` references — determine which mean legal entity, provider structure, or feature entitlement.
2. Establish canonical terminology; map existing values without changing production behaviour.
3. Verify current PREMIUM white-label paths and reconcile any conflicting feature checks. ← **Done at f09c6c3d**
4. Prepare data model and permission boundaries for future multi-provider support, while enforcing the current single-provider limit.
5. Record the future Business subscription as planned (not implemented) and define its entitlements separately before development begins.

---

## Key Code Locations

| Concern | File |
|---|---|
| Feature flags | `lib/utils/account.ts` → `getAccountFeatures()` |
| Payment mode guard | `lib/utils/account.ts` → `assertPlatformPaymentMode()` |
| Subdomain renderer branding | `app/subdomain/[slug]/page.tsx` → `isBrandingEligible` |
| Custom-domain renderer | `app/custom-domain/page.tsx` |

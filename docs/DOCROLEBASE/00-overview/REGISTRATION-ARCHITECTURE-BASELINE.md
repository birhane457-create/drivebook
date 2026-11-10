# DriveBook — Registration Architecture Baseline

**Status:** DESIGN — not yet fully implemented  
**Version:** 1.0  
**Date:** 2026-11-10  
**Authority:** This document defines the target registration model. It supersedes ad-hoc implementation decisions made across individual commits.

---

## Purpose

This document establishes the complete provider registration architecture:
- The registration steps and what each one collects.
- The organisation model and how it differs from the account structure.
- Commercial agreement records and how they differ from privacy consent.
- The AI receptionist capability boundaries by business type.
- The three-state feature classification (designed / available / coming soon).
- What must be implemented before each capability can be activated.

This document does **not** cover payment processing, Stripe webhooks, or payout logic.

---

## Core Design Principle — Three States

Every field, screen, and capability in the registration system must be in exactly one of three states:

| State | Meaning |
|---|---|
| **Designed** | The data structure and registration path exist. The feature is not yet activated. |
| **Available** | The capability is implemented, tested, and enabled for the relevant account type and subscription. |
| **Coming soon** | The path or feature is known. It is explicitly marked disabled. It cannot be activated. |

A field existing in the database is not permission to activate a feature. Coming-soon paths must be visible in the UI and clearly labelled, but their registration actions must be disabled.

---

## Registration Steps (target architecture)

### Step 1 — Select business category

Two choices presented:

**A. Driving instruction**  
For independent driving instructors and driving schools.  
Proceeds to Step 2.

**B. Other trades and services**  
For plumbing, electrical, beauty, tax/accounting, and other supported industries.  
Proceeds to industry sub-selection, then directly to Step 4 (SaaS, no model selection needed).

---

### Step 2 — Select organisation type (driving instruction only)

Two choices:

**A. Independent instructor**  
One provider operating under their own name or business name.  
`organisationType = INDIVIDUAL_INSTRUCTOR`  
Proceeds to Step 3.

**B. Driving school** *(coming soon — disabled)*  
An organisation with one or more instructors operating under a school identity.  
`organisationType = DRIVING_SCHOOL`  
Collect: school name, owner/administrator details, ABN, number of instructors, locations, intended use.  
**Disabled until multi-provider support is implemented.** Shows interest-capture form only.  
*Design note:* `organisationType = DRIVING_SCHOOL` must NOT activate `accountType = BUSINESS`  
or multi-provider permissions. These are separate dimensions.

---

### Step 3 — Select commercial model (driving instruction only)

Two choices, with explicit description of what each means operationally:

**A. DriveBook Marketplace**  
"Students discover and book my driving instruction services through DriveBook. DriveBook manages payments and pays me weekly."  
`businessModel = MARKETPLACE` / `paymentMode = PLATFORM`

**B. DriveBook SaaS**  
"I bring my own students and use DriveBook to manage my bookings and business."  
`businessModel = SAAS` / `paymentMode = DIRECT`  
Clear notice: *"Direct online payments are not yet available. You can use all booking, scheduling, and business management features now."*

Other trades and services: always `SAAS` / `DIRECT`. No model selection shown.

---

### Step 4 — Account and business details

Collect the information appropriate to the selected industry and organisation type.

**All providers:**
- Full name (account holder)
- Email address
- Password (min 8 chars)
- Mobile number

**Driving instruction — additional:**
- No additional fields at registration. Profile completion (rate, areas, licence, insurance) happens in the dashboard post-approval.

**Other trades — additional:**
- No additional fields at registration. Profile completion happens in the dashboard.

**Driving school (coming soon):**
- School/organisation name
- Owner name and contact
- ABN
- Number of instructors (informational only — no accounts created)
- Primary service areas
- Brief description of intended use

---

### Step 5 — Agreement and privacy consent

#### Privacy consent
Collected for all providers. Separate from commercial agreement.  
Records:
- `privacyPolicyVersion` — exact version accepted
- `privacyPolicyAcceptedAt` — timestamp
- `privacyPolicyAccepted: boolean` — must be true for registration to proceed

Privacy consent is **always required**. The API must reject registration without it.

#### Commercial agreement

The commercial agreement type is derived server-side from `businessModel`. It is never supplied by the browser.

| Business model | Agreement type |
|---|---|
| `MARKETPLACE` | `MARKETPLACE_TERMS` |
| `SAAS` | `SAAS_TERMS` |

Records:
- `commercialAgreementType: MARKETPLACE_TERMS | SAAS_TERMS`
- `commercialAgreementVersion: string` — exact version accepted (or `'PENDING'` if not yet published)
- `commercialAgreementStatus: PENDING | ACCEPTED` — `PENDING` until the terms document exists and is published
- `commercialAgreementAcceptedAt: DateTime | null`

**Important:** Until the SaaS Terms are written and published, all SaaS registrations receive `commercialAgreementStatus = PENDING`. The checkbox is not shown. The API records the pending state without requiring acceptance. Final acceptance is required before SaaS-specific commercial services are activated.

Marketplace Terms (existing): shown to all `MARKETPLACE` providers. Required before registration proceeds.

---

### Step 6 — Account creation and email verification

The API creates:
1. `User` record (email, hashed password, role = 'provider', verification token)
2. `Provider` record with all derived fields:
   - `industry` — from selected businessType
   - `organisationType` — from selected organisation type (Step 2)
   - `businessModel` — derived from commercial model selection
   - `paymentMode` — derived from businessModel
   - `commercialAgreementType`, `commercialAgreementStatus`, `commercialAgreementVersion`, `commercialAgreementAcceptedAt`
   - `privacyPolicyVersion`, `privacyPolicyAcceptedAt`
3. Business configuration from template
4. Trial subscription

**Email verification:** Required before dashboard access is granted. The auth callback enforces `emailVerified = true` for provider logins.

**Duplicate email:** Returns `400 Email already registered`. Never reveals whether the email is associated with a provider or client account.

---

### Step 7 — Provider discovery (optional, post-login)

After first login (not part of the registration form itself):

- Shown when `ProviderDiscovery` record does not exist, or exists with `skipped = true`.
- Optional "Explore DriveBook capabilities" button opens the capability introduction.
- Discovery question: "What would you like to achieve with DriveBook?" with 6 selectable capabilities.
- Optional free-text "other needs" field.
- Skip is permitted. Skipped discovery is resumable from the dashboard.
- **Minimum validation:** when `skipped = false`, at least one capability must be selected or `otherNeeds` must be non-empty.
- Discovery answers do not activate features, modify permissions, or change subscription.

---

## Organisation Model

`organisationType` is a separate field from `accountType`, `subscriptionTier`, and `businessModel`. They must not be conflated.

| Field | Values | Purpose |
|---|---|---|
| `industry` | driving, plumber, electrician, beauty, tax, other | What type of service the provider offers |
| `organisationType` | INDIVIDUAL_INSTRUCTOR, DRIVING_SCHOOL | Structural type of the registration |
| `businessModel` | MARKETPLACE, SAAS | Commercial relationship with DriveBook |
| `paymentMode` | PLATFORM, DIRECT | Where customer payments are processed |
| `accountType` | INDIVIDUAL, BUSINESS | Multi-provider account structure — only set when multi-provider functionality is active |

**Rule:** `organisationType = DRIVING_SCHOOL` does not set `accountType = BUSINESS`. The driving school path is designed but disabled. `accountType = BUSINESS` activates multi-provider permissions and must remain gated until that capability is implemented and verified.

---

## AI Receptionist — Capability Boundaries by Business Type

The AI receptionist description in discovery and marketing must reflect what is actually configured for each business type.

| Business type | Can book | Can initiate quote request | Description |
|---|---|---|---|
| Driving instruction | ✅ Yes | ❌ No | Can book lessons, check availability, reschedule, send confirmations |
| Tax/accounting | ✅ Yes (consultations) | ❌ No | Can book consultations and appointments |
| Beauty | ✅ Yes | ❌ No | Can book appointments |
| Plumbing | ❌ No | ✅ Yes (collect info) | Can collect job details, communicate a configured call-out charge, create a quote request for provider review |
| Electrician | ❌ No | ✅ Yes (collect info) | Same as plumbing |

**Quote handling distinction:**  
- "Initiating a quote request" = collecting customer details and job description, then notifying the provider. The AI does not produce a price.
- "Fixed call-out charge" = communicating a provider-configured price (e.g. $150 call-out fee). The AI reads this from configuration; it does not calculate it.
- "Final job quote" = requires the provider to assess the work. The AI never produces this.

The generic trade template currently configures `aiCanBook: false` / `aiCanQuote: true` with `allowedActions: ['quote', 'message']`. Before presenting AI booking as a capability to trade providers, the template must be updated to reflect the intended booking-first behaviour and re-tested.

---

## Commercial Agreement Fields — Schema Change Required

These fields must be added to the `Provider` model:

```prisma
// Commercial agreement — derived from businessModel at registration
// PENDING until the relevant terms document is published and accepted
commercialAgreementType    String?   // MARKETPLACE_TERMS | SAAS_TERMS
commercialAgreementStatus  String    @default("PENDING") // PENDING | ACCEPTED
commercialAgreementVersion String?   // e.g. "1.0" or "PENDING"
commercialAgreementAcceptedAt DateTime?

// Privacy consent — separate from commercial agreement
privacyPolicyVersion       String?
privacyPolicyAcceptedAt    DateTime?
```

The existing `termsAcceptedAt` and `termsVersion` fields remain for backward compatibility and continue to record Marketplace Terms acceptance for existing providers.

---

## Organisation Type Field — Schema Change Required

```prisma
// Organisation type — separate from accountType and businessModel
// INDIVIDUAL_INSTRUCTOR: single provider operating independently
// DRIVING_SCHOOL: organisation with multiple instructors (coming soon)
organisationType  String  @default("INDIVIDUAL_INSTRUCTOR")
```

---

## Vercel Deployment Status

The Vercel deployment for `05b6d375` is reported as failing by the independent reviewer. The cause has not been established. Pre-existing TypeScript errors (1,435 errors across 44 files, pre-dating this work) are known to cause Vercel build failures in this repository. The registration and discovery changes added in `8a78f122` and `05b6d375` do not introduce TS errors in the files they touch.

**Required before next deployment:**
- Investigate whether the Vercel failure is caused by the new files or is a pre-existing build issue.
- If pre-existing: document the known TS error count baseline and determine whether Vercel is configured to treat warnings as errors.

---

## Implementation Backlog (not yet implemented)

Ordered by priority:

| Item | Blocking |
|---|---|
| `organisationType` field on Provider | Driving-school registration design |
| Commercial agreement fields on Provider | SaaS Terms acceptance recording |
| Privacy consent fields on Provider | Privacy consent enforcement at API level |
| Minimum discovery validation (1+ selection when not skipped) | Discovery data quality |
| Driving-school interest capture (disabled path) | Complete registration UI |
| SaaS Terms document | Commercial agreement acceptance for SaaS providers |
| AI receptionist generic trade template: booking-first behaviour | Accurate capability description for trades |
| Capability availability labels from actual entitlement gates | Accurate discovery presentation |
| Vercel build failure root cause | Deployment |

---

## What Must Not Change (invariants)

- 503 guards for DIRECT payment checkout remain until DIRECT payment path is implemented and verified.
- `getAccountFeatures().directPayments` remains `false`.
- No payment processing, Stripe webhook, or payout logic is modified as part of this work.
- `accountType = BUSINESS` is not set during registration regardless of organisation type selected.
- Discovery answers do not activate features, modify permissions, or change subscription.

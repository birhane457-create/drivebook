# Subscription Management Audit

**Status:** FINDINGS RECORDED — source/runtime verification pending  
**Date:** 2026-11-14  
**Repository:** `birhane457-create/drivebook`  
**Proposed disposition:** Option C — narrowly scoped temporary SaaS subscription-validation bypass, followed by the Payment Flows audit and a complete subscription architecture decision.

> **Evidence qualification:** This document records the findings and proposed architecture supplied for this audit. The findings have not been independently reproduced against the current Git source, database, or deployed runtime in this document-writing step. Do not treat the reported behaviours as independently verified until the evidence checklist below is completed.

---

## 1. Executive summary

The reported subscription implementation applies Marketplace subscription assumptions to SaaS providers. If confirmed, this creates a business-model mismatch:

- Marketplace providers use DriveBook's discovery and platform-payment model and are intended to have a paid subscription lifecycle.
- SaaS providers bring their own customers and use the SaaS product model. Requiring them to purchase a Marketplace subscription would be an incorrect commercial dependency.
- A 14-day trial expiry must not automatically make a SaaS provider read-only merely because the provider has no Marketplace subscription.

The proposed long-term direction is to separate subscription policy and feature entitlement by business model. The immediate recommendation is **Option C**, but only as a tightly scoped compatibility fix. It must not grant SaaS providers unrestricted access to paid features or enable DIRECT payments, which remain separately gated.

## 2. Reported findings

| ID | Finding | Reported impact | Model |
|---|---|---|---|
| SUB-01 | Registration creates trial subscriptions for all providers | SaaS accounts enter a 14-day Marketplace-style trial lifecycle | SaaS |
| SUB-02 | Subscription logic does not distinguish business models | SaaS providers are evaluated using Marketplace subscription assumptions | SaaS |
| SUB-03 | Subscription validation blocks access after trial expiry | SaaS providers may be prevented from creating bookings or serving clients | SaaS |
| SUB-04 | No defined FREE SaaS tier | SaaS providers may be forced to purchase a subscription for baseline functionality | SaaS |

**Verification status:** These are reported findings, not independently confirmed source or runtime findings. Before implementation, inspect the registration transaction, trial-subscription creation helper, subscription validation call sites, tier definitions, feature-entitlement functions, booking routes and dashboard guards.

## 3. Current and proposed commercial policy

### 3.1 Marketplace

| Attribute | Proposed policy |
|---|---|
| Business model | `MARKETPLACE` |
| Payment mode | `PLATFORM` |
| Subscription | Required |
| Trial | 14 days |
| Tiers | BASIC → PRO → STUDIO → PREMIUM |
| Product model | Students discover and book providers through DriveBook |
| After trial expiry without an active paid subscription | Restricted/read-only according to the existing Marketplace policy |

Marketplace subscription behaviour must remain unchanged by the temporary SaaS fix.

### 3.2 SaaS

| Attribute | Proposed policy |
|---|---|
| Business model | `SAAS` |
| Payment mode | `DIRECT` (currently separately blocked/unavailable) |
| Subscription | Optional for baseline SaaS access |
| Trial | No mandatory 14-day trial |
| Tiers | Proposed FREE → PREMIUM |
| Product model | Provider brings their own customers |
| Baseline access | Bookings, clients, calendar and reports, subject to implementation and existing safety controls |
| Premium access | Additional paid capabilities, once their entitlement rules are implemented |

**Important:** Optional subscription does not mean every SaaS capability is free. A FREE tier must be an explicit entitlement policy, not an absence of validation. PREMIUM-only capabilities must remain gated.

The proposed SaaS feature list is a product-policy proposal. Each item must be checked against actual implementation and operational dependencies before being advertised as available.

## 4. Recommended implementation approach

### Option C — minimal, scoped bypass first

Implement the smallest safe change to prevent SaaS providers from being blocked by Marketplace trial expiry while the broader audit continues.

Required constraints:

1. The bypass must apply only when the persisted provider business model is exactly `SAAS`.
2. The server must load the provider's business model from trusted database state. Do not trust a browser-supplied business model or payment mode.
3. The bypass must affect only the specific subscription-expiry validation that incorrectly blocks baseline SaaS access.
4. It must not bypass authentication, account status, provider approval, permission checks, booking eligibility, safety checks, or any unrelated access-control decision.
5. It must not grant PREMIUM entitlements, white-label features, custom domains, AI receptionist access, multi-provider functionality, or any other paid capability.
6. It must not enable DIRECT payment routes or alter Stripe, wallet, payout, refund, fee, or settlement behaviour.
7. Marketplace validation and Marketplace trial/paid-subscription behaviour must remain unchanged.
8. Add regression tests proving both the SaaS exception and Marketplace non-regression.

**Do not implement a broad rule such as “if SaaS, return valid” at a shared authorization boundary.** That could turn a narrow expiry exception into an entitlement or security bypass.

### Suggested validation shape

The following is illustrative pseudocode, not an instruction to copy without inspecting the actual validation contract:

```ts
// Provider businessModel must come from the database.
if (provider.businessModel === "SAAS") {
  // Skip only the Marketplace subscription-expiry restriction
  // for baseline SaaS access.
  // Continue all other account, permission and feature checks.
}

if (provider.businessModel === "MARKETPLACE") {
  // Preserve existing Marketplace subscription validation.
}
```

The implementation should use the project's existing result types and validation structure. Do not introduce a second, conflicting entitlement system as part of this temporary fix.

## 5. Long-term target architecture

### 5.1 Separate subscription policy from feature access

Introduce a central feature-access policy only after the current entitlement model and all call sites have been mapped.

Proposed interface:

```ts
getFeatureAccess(businessModel, tier, status)
```

The final contract should return explicit feature entitlements and the reason for any denial. It must not infer product mode from account type or accept client-provided entitlement values.

### 5.2 Proposed entitlement matrix

| Capability | Marketplace BASIC–PREMIUM | SaaS FREE | SaaS PREMIUM |
|---|---|---|---|
| Provider's own booking management | According to existing tier rules | Proposed | Proposed |
| Client management | According to existing tier rules | Proposed | Proposed |
| Calendar/scheduling | According to existing tier rules | Proposed | Proposed |
| Reports/analytics | According to existing tier rules | Proposed baseline; define limits | Proposed expanded access |
| Platform discovery | Marketplace product capability | Not included | Not included unless separately contracted |
| Platform payment processing | PLATFORM model, subject to existing rules | Not available | Not available until DIRECT is implemented |
| White-label experience | Only existing Marketplace branding entitlements | No | Proposed, only when fully implemented |
| Custom domain | Existing tier and implementation rules | No | Proposed, subject to verification |
| AI receptionist | Existing tier and safety gates | No | Proposed, subject to implementation and AI security gates |
| Multi-provider / driving school | Not enabled by this proposal | No | Not enabled by this proposal |

This matrix is a target proposal, not a statement that these capabilities are currently implemented or available. Keep product labels aligned with actual runtime entitlements.

### 5.3 Tier representation

Before adding `FREE`, inspect:

- Prisma enums and database constraints;
- subscription creation and update helpers;
- Stripe Price/Product mappings;
- webhook handlers;
- billing portal and checkout flows;
- cron jobs and trial-expiry jobs;
- feature-entitlement helpers;
- dashboard and API subscription guards;
- analytics, reporting and admin interfaces.

If `FREE` is added, it must be supported consistently across those layers. Do not write `subscriptionTier = 'FREE'` into production until the schema, application types, database and all consumers support that value.

A SaaS provider with no paid subscription may be represented by an explicit no-subscription state rather than a synthetic subscription row. Choose one canonical representation and document its lifecycle. Avoid creating an ACTIVE subscription record that has no corresponding billing or subscription semantics merely to satisfy existing code.

## 6. Data migration — proposed, not approved

The following SQL is **not approved for execution**:

```sql
UPDATE "Provider"
SET
  "subscriptionTier" = 'FREE',
  "subscriptionStatus" = 'ACTIVE',
  "trialEndsAt" = NULL
WHERE "businessModel" = 'SAAS';
```

Reasons this must not be run yet:

1. The current database enum or column constraints may not accept `FREE`.
2. The application may require a Subscription relation rather than relying only on Provider fields.
3. Existing SaaS records may be test fixtures, not genuine customers.
4. Updating status to ACTIVE could misrepresent a paid subscription or create inconsistent billing state.
5. The migration may affect historical trial records, audit logs, reporting or webhook reconciliation.

Before any backfill:

- inventory affected Provider and Subscription records;
- distinguish test fixtures from genuine providers;
- inspect foreign keys and dependent billing records;
- define the canonical FREE/no-subscription representation;
- prepare a reversible migration and before/after counts;
- test on a disposable database;
- obtain explicit approval before production execution.

No production data change is authorised by this audit document.

## 7. Implementation plan

| Phase | Task | Risk | Exit criteria |
|---|---|---|---|
| 0 | Independently verify SUB-01 to SUB-04 in source and runtime | Medium | Exact call sites, data model and observed behaviour documented |
| 1 | Implement narrowly scoped SaaS expiry bypass | Medium | SaaS baseline access no longer blocked by Marketplace trial expiry; other checks remain active |
| 2 | Add regression tests | High | SaaS expired/no-subscription cases pass; Marketplace trial and expired cases unchanged; premium entitlements remain gated |
| 3 | Continue Payment Flows audit | High | Payment, booking, wallet, refund and payout findings documented independently |
| 4 | Design final model-aware subscription policy | Medium | Approved SaaS FREE/PREMIUM and Marketplace tier policy, with entitlement matrix |
| 5 | Implement central feature access | High | All relevant API and UI gates use the same server-side entitlement policy |
| 6 | Backfill only if required | High | Disposable DB verification, approved migration, reconciliation and rollback plan |

The earlier estimate of approximately nine working days is provisional. It is not a delivery commitment; the actual scope depends on the number of subscription-validation call sites, schema constraints and test coverage.

## 8. Required regression tests for Option C

At minimum, verify:

| Test | Expected result |
|---|---|
| SaaS provider with expired trial | Baseline access is not blocked solely by Marketplace trial expiry |
| SaaS provider with no subscription record | Baseline access follows the explicit SaaS policy |
| SaaS provider requesting PREMIUM-only feature | Denied unless the provider has the required entitlement |
| SaaS provider attempting DIRECT checkout | Still blocked by the existing DIRECT-payment guard |
| Marketplace provider with active trial | Existing behaviour unchanged |
| Marketplace provider with active paid subscription | Existing behaviour unchanged |
| Marketplace provider with expired trial and no paid subscription | Existing restriction unchanged |
| Unauthenticated or suspended provider | Existing denial remains effective |
| Client attempts to spoof `businessModel` or tier | Server ignores the client value and uses persisted state |
| Provider account has inconsistent businessModel/paymentMode | Fail safely; do not grant SaaS bypass |

Tests must exercise the real validation function and relevant API call sites. Source-presence assertions alone are insufficient.

## 9. Dependencies and boundaries

This audit does not authorise changes to:

- Marketplace payment collection, platform fees, instructor payouts or refund rules;
- Stripe Connect configuration or webhook behaviour;
- wallet balance, ledger ownership, credit expiry or payout logic;
- SaaS DIRECT payment implementation;
- account permissions or role definitions;
- white-label, custom-domain, AI receptionist or multi-provider entitlements;
- production subscription records.

SaaS subscription policy must remain separate from the SaaS DIRECT payment implementation. A provider can be classified as SaaS while DIRECT payment capability remains unavailable.

## 10. Evidence checklist and audit status

| Evidence item | Status |
|---|---|
| Registration route creates a trial for every provider | Reported — source verification required |
| Trial creation helper and all callers identified | Not verified |
| Subscription validation branches on business model | Reported absent — source verification required |
| All subscription validation call sites mapped | Not verified |
| Actual post-trial SaaS booking failure reproduced | Reported — runtime verification required |
| FREE absent from schema and all tier consumers | Reported — source/schema verification required |
| Feature-entitlement dependencies mapped | Not verified |
| Production SaaS provider inventory confirmed | Not verified |
| Option C implemented | Not implemented by this document |
| Regression tests executed independently | Not executed |
| Production data migration | Not approved |

**Audit disposition:** Keep the findings open until source inspection and controlled runtime tests establish the actual behaviour. If confirmed, implement Option C as a narrow temporary correction, then continue the Payment Flows audit. Complete the model-aware subscription and feature-entitlement design before implementing the full FREE/PREMIUM architecture.

---

## 11. Decision record

**Recommended option: C — minimal SaaS subscription-expiry bypass, then continue the Payment Flows audit.**

Rationale:

- It addresses the reported immediate SaaS access problem without prematurely redesigning the entire subscription system.
- It limits the scope of change while the Payment Flows audit is still in progress.
- It avoids introducing a FREE tier into the schema and billing lifecycle before all dependencies are understood.
- It preserves Marketplace subscription behaviour.
- It keeps SaaS feature entitlement and DIRECT payment enablement as separate decisions.

**Approval boundary:** This is a recommendation, not authorisation to change code, commit changes, or modify production data. Implementation requires a separate explicit instruction.

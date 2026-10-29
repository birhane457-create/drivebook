# Account Architecture Decision

**Status:** Accepted for current implementation scope  
**Scope:** Single-provider accounts and existing subscription tiers  
**Future multi-provider support:** Reserved; not implemented or available for sale

## Decision

DriveBook keeps provider structure, subscription entitlement, commercial model, and payment routing as separate concepts.

- **Provider structure** describes capacity: `SINGLE_PROVIDER` now; `MULTI_PROVIDER` is a future capability.
- **Subscription tier** describes paid feature entitlement: `BASIC`, `PRO`, `STUDIO`, and `PREMIUM` are current tiers. `BUSINESS` as a multi-provider subscription is future-only.
- **Business model** describes the commercial relationship: `MARKETPLACE` or `SAAS`.
- **Payment mode** describes money flow: `PLATFORM` is supported; `DIRECT` remains unimplemented.

Governing invariant: **Provider structure defines capacity. The active subscription defines feature entitlement.** Structure alone must never grant paid features, activate a subscription, or change a tier.

## White-label decision

1. `PREMIUM` includes full white-label branding for a single provider, subject to the existing branding configuration.
2. White-label entitlement is determined by subscription tier, not by `accountType`, provider structure, or the future existence of multiple providers.
3. A `BUSINESS` account-structure value must not independently grant white-label.
4. The future `BUSINESS` subscription tier does **not** automatically inherit `PREMIUM` entitlements. Multi-provider limits, branding inheritance, and any other inherited features require an explicit approved feature matrix before implementation or sale.
5. This decision does not implement multi-provider operations or direct payments.

## Implementation guidance

- Keep existing `accountType` uses until a complete source inventory establishes whether each use means legal entity, provider structure, or a feature entitlement. Do not perform a blind rename.
- Use centralized feature-entitlement helpers where available.
- In the subdomain renderer, distinguish branding eligibility from any unrelated “Pro” badge or marketing state. `PREMIUM` must be eligible for the branding path.
- Keep current provider provisioning single-provider. Future multi-provider work must introduce explicit structural limits and server-side enforcement.
- Any change to the feature matrix must update the living subscription and branding documentation in the same change.

## Consequences

- A BASIC account with `accountType = BUSINESS` does not gain white-label from that field.
- A PREMIUM single-provider account can use the white-label renderer.
- No tier or account structure may imply that DIRECT payments are implemented.
- Future multi-provider entitlement remains blocked until the feature matrix and implementation are separately approved.

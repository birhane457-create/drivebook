# DriveBook Membership — Architecture Decisions

**Stage:** PRE-IMPLEMENTATION PLAN
**Status:** Decisions recorded for planning; implementation still deferred.

## AD-001 — Membership is a bounded product domain

Membership is a product domain within DriveBook, not a new business-vertical preset.

**Reason:** Membership serves customers across provider categories and should not inherit provider-vertical configuration semantics.

## AD-002 — Free first

The MVP member tier is FREE.

**Reason:** The first objective is to prove member value and partner-funded revenue without adding payment friction.

## AD-003 — Member value is discounts/offers

Discounts and useful partner offers are central to the product proposition.

**Reason:** A free membership needs an ongoing reason for a user to remain a member.

## AD-004 — Provider-funded revenue

DriveBook revenue initially comes from partner/customer acquisition arrangements.

Commercial terms may be percentage-based, flat-fee, conversion-based, or another agreed model.

**Reason:** The provider receives the customer; the provider funds the acquisition channel.

## AD-005 — Partner is not Provider

A Membership partner is a separate concept from a DriveBook instructor/provider.

**Reason:** Insurance, fuel, dealership, servicing, roadside, tax/accounting and other partners do not necessarily have a DriveBook instructor/provider relationship.

## AD-006 — Existing User identity

Membership references the existing `User) identity.

**Reason:** Avoid duplicate identity and authentication systems.

## AD-007 — Existing payment infrastructure is future reuse

Premium Membership, if introduced, should reuse existing payment/Stripe infrastructure through a Membership-specific subscription layer.

**Reason:** Avoid a second payment system while keeping Membership billing separate from instructor subscriptions.

## AD-008 — Existing financial systems are patterns, not Membership storage

Instructor payout and wallet systems may provide security/idempotency design patterns, but Membership should not store partner obligations in those domains.

## AD-009 — Existing shared services require explicit dependency documentation

Authentication, RBAC, audit logging, email/SMS and payment infrastructure may be reused when approved.

Each dependency must be documented; Membership-specific business logic remains inside the Membership boundary.

## AD-010 — No Membership AI in MVP

AI is deferred until the Membership product and data semantics are stable.

**Reason:** AI should reflect a stable product rather than define unstable business semantics.

## AD-011 — Partner validation before broad build

The first real partner relationship should validate the commercial loop before a large multi-category marketplace is built.

## AD-012 — Documentation-first until core baseline stabilizes

Membership planning may continue while the main application is being stabilized, but application implementation waits for the agreed stable main baseline.

## AD-013 — No silent expansion

Any requirement to modify booking, wallet, instructor payout, authentication, Stripe webhook semantics, middleware security, or `drivebook-hybrid` must be treated as a new architecture decision rather than an incidental Membership dependency.

## Decision status

These decisions describe the current plan. Commercial, legal/privacy and final implementation decisions remain subject to explicit approval.

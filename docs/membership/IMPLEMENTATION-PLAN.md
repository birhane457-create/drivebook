# DriveBook Membership — Implementation Plan

**Stage:** PLANNED — IMPLEMENTATION DEFERRED
**Branch:** `staging/membership-product-review`
**Code status:** NONE
**Implementation authority:** NOT GRANTED

## 1. Objective

Build Membership as a bounded DriveBook product that initially costs members nothing and creates value through genuine partner discounts and offers.

Commercial loop:

`Member → Offer → Referral → Conversion → Partner payment → DriveBook revenue`

The implementation must be small enough to validate the model before expanding it.

## 2. Phase 0 — Product and architecture approval

**Current phase.**

Deliverables:

- product blueprint;
- independent reviews;
- open-decision register;
- architecture decision;
- partner/commercial validation;
- privacy/consent decisions;
- final MVP scope.

Exit condition:

**MVP architecture approved by the product owner.**

No application code is produced in this phase.

## 3. Phase 1 — Repository baseline

Before implementation:

1. Select the stable core-application `main` SHA after the main audit/remediation work reaches its agreed baseline.
2. Rebase the Membership staging branch onto that baseline.
3. Re-check the Membership dependency list against the new baseline.
4. Confirm no Membership work conflicts with core audit/security remediation.
5. Create a dedicated implementation branch from the stable baseline.

Do not implement from the current diverged staging branch without this baseline step.

## 4. Phase 2 — MVP domain

Initial conceptual entities:

- MembershipMember
- MembershipPartner
- MembershipOffer
- MembershipReferral

Use the existing `User` as identity.

Do not initially create:

- Premium subscription;
- automated partner payouts;
- loyalty points;
- broad marketplace infrastructure;
- partner self-service portal;
- Membership AI.

## 5. Phase 3 — Member experience

Initial member journey:

1. User becomes eligible for Membership under the approved enrollment rule.
2. Member can view active offers.
3. Member selects an offer.
4. DriveBook creates a referral/tracking event.
5. Member is sent to the partner.
6. Partner conversion is reconciled.
7. DriveBook records the commercial result.

The exact enrollment and communication rules remain subject to product/privacy approval.

## 6. Phase 4 — Referral attribution

Referral records must distinguish lifecycle evidence rather than relying only on a status label.

Potential evidence:

- clickedAt;
- attributedAt;
- convertedAt;
- commissionEarnedAt;
- paidAt;
- attributionExpiresAt;
- partner conversion reference;
- deterministic idempotency key.

The system must prevent duplicate conversion/commission processing.

## 7. Phase 5 — Partner management

MVP administration should support only what is necessary to manage the validated partner relationship:

- partner activation/deactivation;
- offer creation/update/expiry;
- commercial terms;
- referral visibility;
- conversion reconciliation;
- commission reporting.

Use centralized server-side authorization.

Exact permissions are to be defined during implementation planning.

## 8. Phase 6 — Partner revenue

Do not assume one commercial model.

Support the validated agreement, which may be:

- percentage;
- fixed lead fee;
- fixed conversion fee;
- another documented model.

For the first partner, manual settlement may be preferable if it reduces implementation risk.

Automated partner payout should be a separate approved phase.

## 9. Phase 7 — Future Premium

Only after the free Membership model demonstrates value should Premium be considered.

Future architecture:

`Membership → MembershipSubscription → existing Stripe infrastructure`

Do not reuse instructor SaaS subscription state.

Do not put Membership payments into wallet accounting.

Prefer the existing unified Stripe webhook infrastructure with explicit Membership event metadata.

## 10. Phase 8 — Expansion

Only after MVP validation:

- additional partner categories;
- additional offers;
- partner portal;
- automated reconciliation;
- automated settlement;
- richer member dashboard;
- Premium Membership;
- Membership AI.

Each expansion should be a separately approved work item.

## 11. Testing plan

When implementation begins:

### Unit tests

- membership eligibility;
- offer visibility;
- referral creation;
- attribution;
- expiry;
- conversion validation;
- idempotency;
- commission calculation.

### Authorization tests

- member cannot access another member's referral data;
- unauthorized staff cannot manage partners;
- authorized staff can perform permitted operations.

### Integration tests

- referral lifecycle;
- partner conversion reconciliation;
- duplicate conversion handling;
- commission calculation;
- future Stripe Membership events.

### Security tests

- tenant/user ownership;
- referral token integrity;
- partner access boundaries;
- consent enforcement;
- audit event integrity;
- replay/idempotency protection.

## 12. Documentation requirement

Every implementation commit should clearly identify whether it changes:

- Membership only;
- an existing shared service;
- an existing schema entity;
- authentication/RBAC;
- payment infrastructure;
- audit infrastructure.

Shared-system changes require explicit documentation because Membership is intended to remain bounded.

## 13. Definition of MVP complete

Membership MVP is complete when:

1. A member can access the approved free Membership experience.
2. A real partner offer can be displayed.
3. A referral can be attributed.
4. A conversion can be recorded with evidence.
5. Duplicate processing is prevented.
6. Partner revenue can be reconciled.
7. Member/partner data boundaries are enforced.
8. Relevant actions are auditable.
9. No unauthorized coupling to booking/wallet/instructor subscriptions exists.
10. The complete flow is tested against the stable main baseline.

## 14. Current instruction

**PLAN COMPLETE. IMPLEMENTATION DEFERRED.**

Do not create application code from this document until implementation authority is explicitly granted.

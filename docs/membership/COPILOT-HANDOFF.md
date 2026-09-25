# DriveBook Membership — GitHub Copilot Review Handoff

**Stage:** STAGE 1 — PRODUCT / ARCHITECTURE REVIEW
**Branch:** `staging/membership-product-review`
**Implementation authority:** NOT GRANTED
**Code changes:** NOT REQUESTED

## Mission

Review the proposed DriveBook Membership product against the actual repository and identify technical constraints, reusable infrastructure, risks, and boundaries.

Copilot must review and report. It must not implement Membership code on this branch.

## Read first

1. `docs/membership/STATUS.md`
2. `docs/membership/README.md`
3. `docs/membership/PRODUCT-BLUEPRINT.md`
4. `docs/membership/REVIEW-QUESTIONS.md`

## Repository investigation

Inspect the existing application for:

- User/account identity and lifecycle.
- Existing authentication and authorization patterns.
- Existing Stripe/payment and subscription infrastructure.
- Existing wallet and transaction infrastructure.
- Existing audit/logging mechanisms.
- Existing notification/email/SMS infrastructure.
- Existing database conventions and naming patterns.
- Existing event/webhook patterns.
- Existing admin/provider patterns that could be relevant to partner management.
- Existing preset/template/vertical architecture.
- Existing privacy/consent handling.
- Any existing customer/referral/affiliate/loyalty concepts that were missed by the initial product review.

## Required output

Create a review report under `docs/membership/` only.

The report should identify:

### A. Reusable infrastructure

For each reusable existing component:

- exact file/path;
- what it currently does;
- how Membership could reuse it;
- whether reuse would create coupling or security risk.

### B. Existing systems Membership should NOT modify

Identify core areas that should remain untouched during Membership MVP unless an explicit architecture decision is approved.

Pay particular attention to:

- booking/payment ownership;
- wallet accounting;
- authentication;
- Stripe webhook processing;
- audit/security controls;
- provider payout logic.

### C. Minimum MVP architecture

Propose the smallest Membership domain and API surface needed to prove:

`Member → Offer → Referral → Conversion → DriveBook revenue`

Do not design a complete marketplace before partner validation.

### D. Data-model recommendation

Separate:

- genuinely required MVP entities;
- useful future entities;
- entities that should not be created yet.

Explain all foreign-key relationships to existing DriveBook entities.

### E. Future Premium compatibility

Explain how a future paid Membership could reuse existing payment infrastructure without forcing Membership into the booking/wallet domain.

### F. Security and privacy

Identify:

- member/partner data boundaries;
- consent requirements;
- partner access model;
- referral attribution integrity;
- commission-record integrity;
- audit requirements.

### G. Product disagreements

Explicitly challenge any assumption in the current blueprint that the repository contradicts or that should be validated before implementation.

## Review discipline

Do not treat proposed tables, routes, partner categories, commission percentages, or automatic enrollment rules as approved architecture.

Do not:

- modify application code;
- modify Prisma schema;
- create APIs;
- create migrations;
- change payment logic;
- change authentication;
- change production configuration.

This stage exists to produce a clear technical review for the product decision.

## Handoff requirement

A future implementation team must be able to read the review and determine exactly:

`what is proposed → what already exists → what can be reused → what must stay isolated → what is still undecided → what is approved for MVP`

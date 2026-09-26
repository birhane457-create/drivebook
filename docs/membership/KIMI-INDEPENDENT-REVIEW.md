# DriveBook Membership — Kimi Independent Review

**Stage:** STAGE 1 — PRODUCT / ARCHITECTURE REVIEW
**Implementation authority:** NOT GRANTED
**Review role:** Independent repository-level architecture review

## 1. Branch state

The Membership work is isolated on `staging/membership-product-review`.

At the time of this review, the branch contains documentation-only Membership work under `docs/membership/`. No application code, Prisma schema, API implementation, UI, migration, or production configuration has been authorized.

The branch must be rebased onto the final stable `main` baseline before any future implementation work.

## 2. Identity and authentication

Membership should use the existing `User` identity. No parallel authentication or member identity system is recommended.

For future referral attribution, anonymous visitors may need a pseudonymous referral/tracking token that can later be associated with `userId) after authentication. This should not become a second identity system.

## 3. Authorization

Membership administration should follow the existing centralized permission model rather than broad role checks.

Potential future permissions should be defined only when the actual Membership admin surface is approved. Examples include partner management, offer management, referral visibility, commission visibility, and payout management.

Authorization should occur server-side inside the relevant routes/services.

## 4. Stripe and subscriptions

Future Premium Membership should remain separate from instructor SaaS subscriptions.

Preferred architecture:

- Membership-specific subscription state.
- Reuse the existing unified Stripe webhook infrastructure.
- Identify Membership Stripe events using explicit metadata.
- Keep Membership billing logic in a Membership service/domain.
- Do not add a second Stripe webhook endpoint without a specific operational reason.

The existing instructor subscription and provider-tier structures should not be repurposed for Membership.

## 5. Partner payouts

Instructor payout infrastructure should be treated as a security/idempotency pattern, not reused as the Membership data model.

Membership should not write referral-partner obligations into instructor payout, provider payout, wallet, or booking accounting structures.

For the first commercial validation, manual partner settlement may be preferable to building automated settlement before real partner terms are known.

## 6. Audit logging

Membership referral/commission state changes may require durable audit records.

Examples:

- partner approval;
- offer changes;
- referral attribution;
- conversion acceptance/rejection;
- commission earned;
- payout approval/payment;
- administrative overrides.

Financial or referral state transitions should use transactional audit writes where appropriate.

Membership should have an explicit retention decision and must not silently inherit unresolved retention questions from existing AuditLog usage.

## 7. Notifications

Membership may eventually reuse the main application's existing email/SMS/notification infrastructure.

Do not reuse the `drivebook-hybrid` voice microservice for Membership. It is a separate service with its own security boundaries and provides no necessary Membership dependency.

## 8. Preset architecture

Membership should not be modeled as another business-vertical preset.

The existing preset system describes provider/business verticals. Membership is a customer relationship/product domain that can cross those vertical boundaries.

## 9. Minimum data-model direction

The smallest useful conceptual Membership domain is:

### MembershipMember

A Membership relationship to an existing `User`.

### MembershipPartner

An external commercial partner. This should remain distinct from `Provider), because partners can include insurers, fuel businesses, dealerships, service businesses, accountants, and other organizations that are not DriveBook instructors.

### MembershipOffer

A specific partner offer/campaign.

### MembershipReferral

Tracks the attribution lifecycle.

Recommended lifecycle evidence should include distinct timestamps such as:

- `clickedAt`
- `attributedAt`
- `convertedAt`
- `commissionEarnedAt`
- `paidAt`
- `attributionExpiresAt`

A deterministic idempotency key or equivalent duplicate-processing protection should be considered for conversion/payment processing.

These remain architecture proposals. No schema implementation is authorized.

## 10. Core systems to keep isolated during MVP

Membership should not modify, merely to support MVP:

- Booking;
- Transaction;
- ClientWallet;
- WalletTransaction;
- instructor Payout structures;
- Provider subscription-tier structures;
- core authentication;
- Stripe webhook semantics;
- middleware authentication behavior;
- `drivebook-hybrid`.

Any exception should be documented as an explicit architecture decision.

## 11. Product boundary

The preferred commercial loop remains:

`Member → Offer → Referral → Conversion → Attribution → DriveBook revenue`

The first implementation should validate that loop with a real commercial partner before building a broad multi-category marketplace.

## 12. Future Premium

Future paid Membership should be layered onto the Membership domain and reuse existing payment infrastructure where appropriate.

Do not couple Premium Membership billing to instructor subscription state or wallet accounting.

## 13. Open questions

The following remain open and should be resolved before implementation:

- first partner category;
- partner commercial terms;
- definition of qualified referral;
- definition of conversion;
- evidence required before commission becomes earned;
- treatment of cancellation/refund/disputed referrals;
- member data shared with partners;
- consent and communication rules;
- automatic versus invitation-based enrolment;
- exact MVP entities and API surface.

## 14. Review conclusion

The current documentation-only Membership stage is appropriate.

The next technical step should be an independent GitHub Copilot repository review. Copilot should inspect exact source references and build/type/test implications, but must not implement code.

After the independent reviews are consolidated, produce a single Membership architecture decision document before granting implementation authority.

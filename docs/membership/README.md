# DriveBook Membership

**Stage:** STAGING — PRODUCT REVIEW / DOCUMENTATION ONLY
**Branch:** `staging/membership-product-review`
**Implementation status:** NO APPLICATION CODE
**Current owner:** Product/AI review stage
**Core-app dependency:** Main application audit/remediation is still in progress

## Purpose

DriveBook Membership is proposed as a separate product line that keeps a long-term relationship with drivers after their immediate driving-lesson journey.

The initial proposition is:

**Free membership → useful member discounts → partner gets a customer → partner pays DriveBook.**

## Current MVP direction

- Member pays: **$0 initially**.
- Member value: real discounts and special offers from participating providers.
- Provider value: customer acquisition through DriveBook.
- DriveBook revenue: percentage, flat referral fee, conversion fee, or another agreed partner model.
- Paid/Premium membership: future option only; not part of the MVP.
- AI features: future option only; not part of the MVP.

## Product categories under consideration

Potential categories include insurance, fuel, vehicle servicing/tyres, dealerships, roadside assistance, tax/accounting, and other useful driver services.

These are proposals, not committed integrations. Partner validation should come before category-specific implementation.

## Domain isolation rule

Membership-specific documentation and future Membership implementation should remain under `docs/membership/` and, when code is eventually authorized, a clearly bounded Membership domain.

Existing DriveBook services may be reused where appropriate, but every dependency must be documented explicitly. Examples may include:

- Existing `User` identity.
- Existing payment/Stripe infrastructure for a future Premium tier.
- Existing authentication and authorization infrastructure.
- Existing audit/logging infrastructure where required.

Reusing an existing service does not make that service part of the Membership domain. The dependency must be named and its purpose recorded.

## Handoff rule

A future engineering team should be able to open this folder and immediately determine:

1. what Membership is;
2. what has been decided;
3. what is only a proposal;
4. what stage the work is in;
5. what is explicitly out of scope;
6. what existing DriveBook systems are dependencies;
7. what decisions are still waiting for review.

## Review request

Other AI/engineering agents are invited to challenge the product concept and proposed structure before implementation begins. Record recommendations and disagreements in the Membership documents rather than changing application code.

## Implementation gate

No production implementation is authorized by this stage.

Implementation should begin only after the core application reaches an agreed stable baseline, product review is complete, partner assumptions are validated, and the Membership MVP architecture is approved.
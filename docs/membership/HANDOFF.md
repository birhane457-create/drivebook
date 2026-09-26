# DriveBook Membership — Handoff

## Current position

**Product plan complete.**
**Implementation deferred.**
**No Membership application code.**

Start with:

1. `STATUS.md`
2. `README.md`
3. `PRODUCT-BLUEPRINT.md`
4. `ARCHITECTURE-DECISIONS.md`
5. `IMPLEMENTATION-PLAN.md`
6. `OPEN-DECISIONS.md)
7. independent review documents.

## Current stage

**STAGE 1 — PRODUCT / ARCHITECTURE REVIEW**

The plan is sufficiently defined for future implementation planning, but implementation authority has not been granted.

## What is decided

- Free Membership first.
- Member value is real discounts/offers.
- Providers/partners fund customer acquisition.
- Membership is a bounded domain.
- Existing User identity is reused.
- Existing shared infrastructure can be reused only through explicit dependencies.
- Premium is future.
- AI is future.
- Broad marketplace expansion is future.
- Core booking/wallet/instructor payout/authentication/voice security systems remain isolated unless a documented architecture decision says otherwise.

## What is not decided

- first partner/category;
- exact commercial terms;
- qualified referral definition;
- conversion evidence;
- commission-earned definition;
- attribution window;
- cancellation/refund treatment;
- partner data access;
- member consent and communications;
- automatic enrollment rules;
- final schema/API shape;
- exact admin permissions.

## Implementation sequence

`Stable main baseline → rebase → architecture confirmation → MVP implementation branch → domain/schema → APIs → member experience → partner/reconciliation flow → testing → security review → controlled integration`

## Handoff rule

Do not infer implementation authority from this folder.

The next team should first read this file and `STATUS.md`, then inspect the exact stable main SHA before writing code.

## Branch note

This staging branch may be behind current `main`. It must be rebased onto the selected stable main baseline before implementation work begins.

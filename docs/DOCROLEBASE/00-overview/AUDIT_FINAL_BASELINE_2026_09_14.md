# DriveBook — Final Baseline Audit Handoff

**Audit date:** 2026-09-14  
**Auditor:** Assistant source-code audit  
**Repository:** `birhane457-create/drivebook`  
**Branch audited:** `main`  
**Role boundary:** Assistant audits source and records findings. Kiro owns production-code implementation. Kiro is explicitly allowed to re-check, disagree, and correct this audit where current local source or tests provide stronger evidence.

## 1. Purpose

This document is the baseline handoff for the whole-application audit. It replaces the previous pattern of treating one fixed feature area as representative of the application.

The audit standard is applied to each relevant surface:

- authentication and session handling
- authorization and role/permission enforcement
- object ownership and tenant boundaries
- request validation and type safety
- state-machine correctness
- transaction/concurrency safety
- money and ledger integrity
- sensitive-data exposure
- external side effects and recovery
- rate limiting / abuse resistance
- timezone/date handling
- error handling and fail-open behaviour
- test coverage and verification evidence
- legacy/duplicate implementation paths

## 2. Audit disposition

**Overall status: NOT PRODUCTION READY.**

The repository contains substantial security and transactional controls, but multiple P0/P1 findings remain. The most important remaining risks are financial integrity, authorization/data exposure, state consistency, and duplicated/legacy paths.

This is a baseline audit, not a claim that every line of the repository is defect-free. A route/page is considered covered only when its security and state disposition is recorded. Items marked VERIFY are deliberately not promoted to confirmed findings until Kiro/local execution or additional source evidence resolves them.

## 3. Confirmed P0 findings

### P0-01 — Wallet top-up ownership failure
**Surface:** `app/api/client/wallet-add/route.ts`

The endpoint validates that a Stripe PaymentIntent succeeded and that its amount matches, but does not establish that the PaymentIntent belongs to the authenticated user's wallet before crediting that wallet. A valid PaymentIntent belonging to another user can therefore be replayed against the current user's wallet if the identifier is obtained.

**Required implementation:** bind PaymentIntent to the authenticated wallet/user using server-controlled durable state and/or Stripe customer metadata, and make crediting idempotent.

### P0-02 — Client reschedule input validation gap
**Surface:** `app/api/client/bookings/[id]/reschedule/route.ts`

The route does not demonstrate a strict request schema for duration/date fields. Invalid or negative duration values reach pricing/business logic. This creates a direct financial-integrity risk and can produce invalid booking state.

**Required implementation:** Zod schema; integer duration bounds; valid date/time; authoritative package/rate rules; ownership; conflict protection; idempotent state transition.

### P0-03 — Review persistence field mismatch
**Surface:** `app/api/reviews/route.ts`

The POST path writes `reviewComment`, while the Prisma model uses `customerReview`. The use of `as any` masks the type mismatch. This is a confirmed source-level correctness defect and must be fixed before relying on review submission.

### P0-04 — Instructor payout verification fields are client-controlled
**Surface:** `app/api/instructor/payout-settings/route.ts`

The request can supply verification/tax fields including `abnVerified`, `abnStatus`, `abnEntityName`, and `withholdingTaxRate`, and the route persists them. Verification state must be derived from a trusted server/admin process rather than instructor input.

## 4. Confirmed P1 findings

### P1-01 — Custom-domain trust boundary
**Surface:** `middleware.ts`

Hostname classification uses `includes(rootDomain)` rather than an exact-root or dot-boundary check. A hostname containing the configured root-domain string can therefore enter the first-party/custom-domain path unexpectedly.

### P1-02 — Maintenance secret in query parameter
**Surface:** `middleware.ts`

Maintenance bypass accepts a secret through a query parameter and transfers it to a cookie. Query parameters can leak through logs, browser history, analytics, proxies, and referrers.

### P1-03 — Public booking detail exposes pickup address
**Surface:** `app/api/public/bookings/[id]/route.ts`

An unauthenticated UUID endpoint returns booking details including pickup address. A UUID is an identifier, not an authorization mechanism. Location-sensitive customer data needs a stronger access mechanism and minimum disclosure.

### P1-04 — Public sensitive actions lack demonstrated abuse controls
**Surfaces:** public booking verification, cancellation, rescheduling, payment summary.

Phone/token verification and token-authorized self-service actions need endpoint-specific rate limiting, expiry, one-time/replay protection, and careful token comparison/storage. The payment-summary code comment claims constant-time comparison while using ordinary `===` comparison.

### P1-05 — Public cancellation/refund is not a durable state machine
**Surface:** `app/api/public/bookings/[id]/cancel/route.ts`

Booking cancellation and Stripe refund are separate external side effects. If the refund fails after cancellation, the system requires durable reconciliation rather than leaving the system dependent on logs/manual intervention.

### P1-06 — Public reschedule consumes verification before final success
**Surface:** `app/api/public/bookings/[id]/reschedule/route.ts`

The verification token is cleared before the final state transition is safely committed. A failed operation can consume a valid token. Date construction also uses server-local `Date` construction, creating timezone risk.

### P1-07 — Availability reservation race
**Surface:** `app/api/availability/check-and-reserve/route.ts`

Availability is checked and reservation is created as separate operations without a demonstrated database invariant/exclusion mechanism preventing concurrent overlapping reservations. Client-provided session IDs also require explicit ownership/lifecycle rules.

### P1-08 — PaymentIntent created inside DB transaction without Stripe idempotency
**Surfaces:** `app/api/payments/create-intent/route.ts`, `app/api/client/wallet-topup-intent/route.ts`, `lib/services/stripe.ts`.

A Prisma rollback cannot roll back a Stripe PaymentIntent. Network ambiguity can therefore produce orphan Stripe objects or duplicate money intents. Money-moving Stripe calls need durable idempotency keys tied to a business operation.

### P1-09 — Auth login abuse controls are not demonstrated
**Surface:** `lib/auth.ts` and credential login flow.

No sufficiently strong login-specific rate limit/progressive lockout was established during source review. Public email-existence checking also creates enumeration risk unless separately rate limited and intentionally designed.

### P1-10 — Unauthenticated debug session endpoint
**Surface:** `app/api/debug/session/route.ts`.

The endpoint exposes session information without an authenticated boundary. It should be removed from production or gated behind a safe development-only mechanism.

### P1-11 — Exclusion-based instructor dashboard role gate
**Surface:** `app/dashboard/layout.tsx`.

The dashboard redirects known CLIENT/admin roles but otherwise allows authenticated roles to fall through to the instructor dashboard. Authorization should be positive allow-listing of the intended role rather than exclusion.

### P1-12 — Subscription state matching has race/ambiguity risks
**Surfaces:** Stripe webhook and subscription routes.

`checkout.session.completed` contains a broad provider-based `updateMany` fallback. Subscription updates can fall back to the most recent local TRIAL/ACTIVE row with a null Stripe subscription ID. These are unsafe identity fallbacks when concurrent checkout/webhook events exist.

Additional subscription risks retained for implementation: nullable/non-unique Stripe subscription ID, lack of active/trial uniqueness invariant, local-vs-Stripe duplicated state, admin override divergence, trial-expiry race, billing-cycle semantics, customer creation race, webhook/email idempotency proof, legacy checkout path, mobile duplicate subscription logic, and Stripe API-version drift.

### P1-13 — Subscription validation fails open on database errors
**Surface:** `lib/middleware/subscriptionValidation.ts`.

Database failure returns `{ valid: true, readOnly: false }`. A dependency outage must not silently grant paid capability.

### P1-14 — Instructor documents can bypass signed delivery
**Surface:** `app/api/admin/instructors/[id]/documents/[type]/route.ts`.

The normal path uses a signed URL from `publicId`, but a legacy fallback can return a stored URL directly when publicId extraction fails. Sensitive compliance documents must not silently fall back to public URLs.

### P1-15 — Instructor payout data exposure/logging
**Surface:** `app/api/instructor/payout-settings/route.ts`.

Full bank account details are exposed by the GET/POST path and ABN is logged. Bank details should be masked/minimised and sensitive identifiers removed from logs. Encryption-at-rest requirements also need explicit confirmation.

### P1-16 — Staff task filter is not applied server-side
**Surface:** `app/staff/dashboard/page.tsx` + `app/api/staff/tasks/route.ts`.

The UI requests `assignedToMe=true`, but the API does not apply the filter. This is a functional correctness defect and can cause staff to see tasks outside the selected scope.

### P1-17 — Staff auto-assignment race
**Surface:** `app/api/staff/tasks/route.ts`.

Selecting the least-loaded staff member and incrementing load are separate operations. Concurrent assignments can exceed intended workload limits.

### P1-18 — Admin AI silently converts DB failures to zeros
**Surface:** `lib/admin/ai-tools.ts`.

Multiple catch paths convert query errors into zero/empty results. The AI can therefore report "zero risk", zero revenue, or empty operational data when the real condition is database failure. AI-facing operational data must distinguish zero from unavailable.

### P1-19 — Admin AI compliance data-model drift
**Surface:** `lib/admin/ai-tools.ts`.

The instructor-risk tooling still references provider-level compliance fields despite the driving compliance model being represented in `DrivingProviderProfile`; `as any` can hide this schema drift.

### P1-20 — Mobile JWT trust is long-lived and not visibly revocable
**Surfaces:** `lib/mobile-auth.ts`, mobile booking/check-in/out routes.

The mobile JWT path uses long-lived bearer credentials without a demonstrated server-side revocation/device-session mechanism. Sensitive actions should use revocable sessions or equivalent controls and fresh role/ownership validation.

### P1-21 — Check-out can select an inappropriate transaction
**Surface:** `app/api/bookings/[id]/check-out/route.ts`.

The route can locate a transaction by booking and update it to COMPLETED without sufficiently restricting transaction type/state. This risks corrupting financial transaction state.

### P1-22 — Instructor reschedule has external-side-effect drift risk
**Surface:** `app/api/bookings/[id]/reschedule/route.ts`.

Database booking state is changed before calendar update. Calendar failure is logged but does not create durable reconciliation state. The transaction also lacks demonstrated SERIALIZABLE retry semantics for the slot conflict claim.

### P1-23 — Sensitive credential projection in auth
**Surface:** `lib/auth.ts`.

Credential authentication loads a broad `customers: true, provider: true` graph when the session only needs a small identity projection. This unnecessarily pulls sensitive Provider fields, including OAuth/bank-related data, into application memory.

### P1-24 — Upload and legacy `@ts-nocheck` surfaces require hardening
**Surfaces include:** staff members, mobile clients/wallet, waiting list, public instructors, instructor consent/service areas, PDA service, upload/debug/legacy routes.

`@ts-nocheck` is not itself a vulnerability, but it materially reduces compiler protection in security-sensitive code. These paths require explicit validation, ownership, and type-safe tests before being treated as equivalent to strongly typed routes.

## 5. Additional P2 / VERIFY findings

- Account enumeration through email-existence checks and distinguishable login errors.
- Review GET appears to need pagination/bounds.
- Review rating validation should explicitly constrain integer 1–5 and reject NaN/infinity.
- Review aggregate calculation can race unless aggregate update is atomic or recomputable safely.
- Customer/provider objects returned from booking/reschedule endpoints may exceed minimum necessary disclosure.
- `rescheduledFrom` history is append-only JSON and may grow without a bounded strategy.
- Public payment token lifecycle/entropy/expiry requires explicit verification.
- Soft-delete filtering needs repository-wide verification so deleted records cannot leak into normal queries.
- External email/SMS/calendar/Cloudinary side effects need durable retry/reconciliation or idempotency where business-critical.
- Direct payment mode exists in code (`DirectPaymentAdapter` / `createDirectPaymentIntent`) but is not consistently supported across the entire payment lifecycle. It must be treated as partially implemented until end-to-end paths are proven.
- Service-area API currently returns an empty array because the `ServiceArea` model is not implemented; documentation/UI must not imply persistence that does not exist.
- Mobile development config contains a hard-coded local IP/TODO and is not a production configuration source.
- Deprecated platform-identity compatibility code remains and should be removed only after call-site migration is complete.
- Receipt/white-label documentation contains outstanding TODOs that need classification as launch-blocking or backlog.

## 6. Controls that should be preserved

The audit also found several good controls that should not be weakened while fixing other areas:

- Main authenticated booking creation uses Zod validation and server-side pricing.
- Booking creation checks provider approval/subscription and customer ownership.
- Booking creation uses SERIALIZABLE transaction configuration/retry work already introduced.
- Admin dashboard and APIs have role/permission architecture, including granular staff permissions and SUPER_ADMIN handling.
- Client dashboard uses positive CLIENT-role gating.
- Instructor reschedule verifies provider ownership and blocks completed/cancelled/past bookings.
- Stripe webhook work has already moved toward conditional updates and SERIALIZABLE retry handling.
- Review insert/booking-related ownership controls exist even though review persistence has the field-name defect.
- Sensitive document delivery has a signed-URL path; the legacy fallback must be removed rather than weakening the signed path.

## 7. Implementation ordering

Kiro should implement in this order unless local evidence changes the risk assessment:

1. P0 financial/authorization defects.
2. P0 correctness defects that block core workflows.
3. Public token/payment/cancellation/reschedule security.
4. Stripe subscription identity/race/idempotency/state-machine controls.
5. Authentication/mobile/debug security.
6. Instructor payout/documents and PII minimisation.
7. Booking/availability concurrency and calendar reconciliation.
8. Admin/staff permission and AI data-integrity issues.
9. Legacy/@ts-nocheck and architecture drift.
10. P2 hardening, cleanup, documentation and UX.

## 8. Kiro re-check protocol

Kiro may and should disagree with any finding where the current local checkout proves a different fact. A disagreement is resolved by evidence, not by preference.

For every finding Kiro addresses:

1. identify the exact source path and current commit;
2. reproduce the alleged condition where practical;
3. implement the fix in Kiro's local working tree;
4. add or update regression tests;
5. run typecheck/build/lint/tests relevant to the change;
6. record the result in `AUDIT_IMPLEMENTATION_PROGRESS_2026_09_14.md`;
7. only mark CLOSED after source and test evidence support closure.

If implementation changes introduce new findings, record them rather than hiding them under an existing item.

## 9. Closure standard

The baseline audit is considered operationally closed only when:

- every P0 is CLOSED;
- every P1 is CLOSED or has an explicit documented launch decision;
- every VERIFY item has a disposition;
- payment/subscription/booking state machines have end-to-end tests;
- no production debug route or unsafe legacy path remains reachable;
- critical external side effects have idempotency/reconciliation;
- role, ownership and sensitive-data boundaries are tested;
- production build/typecheck/test evidence is recorded.

Until then, DriveBook remains **NOT PRODUCTION READY**.

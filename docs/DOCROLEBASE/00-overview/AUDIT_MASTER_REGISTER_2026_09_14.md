# DriveBook Whole-App Audit — Master Register

**Date:** 2026-09-14
**Branch audited:** `main`
**Scope:** source-code-first whole application review
**Role split:** This register records audit findings and evidence. Kiro implements approved fixes and regression tests. This document does not authorize production-code changes.

## Audit rule

This audit is deliberately separated from the fix/re-audit loop. The objective is to establish the complete baseline first. A finding is not closed because an older document says it was fixed; current `main` source must support closure.

Statuses:
- `AUDITED — NO MATERIAL FINDING`: current source reviewed for the relevant control and no material issue found in the inspected path.
- `FINDING`: source contains a material defect or security/reliability risk.
- `VERIFY`: credible risk requires runtime/concurrency/infrastructure proof.
- `LEGACY`: parallel implementation exists; reachability must be established.
- `DOC DRIFT`: implementation and architecture/living docs disagree.
- `TEST GAP`: behaviour may be correct but regression evidence is insufficient.

## Coverage model

Every application surface is assessed across these dimensions:

1. Authentication/session
2. Role and permission authorization
3. Object ownership / tenant isolation
4. Input validation
5. State-machine correctness
6. Concurrency / idempotency
7. Financial integrity
8. Sensitive-data exposure
9. External side effects and recovery
10. Rate limiting / abuse resistance
11. Timezone/date correctness
12. Error handling / observability
13. Tests and documentation

---

# 1. Coverage register

## A. Public/customer acquisition and booking

**Status: AUDITED — FINDINGS**

Surfaces inspected:
- public instructor/profile/booking pages
- `/api/public/bookings/**`
- `/api/bookings/**`
- payment-intent flow
- public booking status/self-service
- public cancel/reschedule
- reviews
- registration/account creation

Material findings are listed below as `PUB-*`, `BOOK-*`, `PAY-*`, and `REV-*`.

## B. Student/client dashboard

**Status: AUDITED — FINDINGS**

Surfaces covered:
- client dashboard layout/pages
- profile/settings
- bookings and rescheduling
- wallet/top-up/add-credit flows
- notifications
- reviews
- recommendations/quotes-related client routes

Material findings: `PAY-01`, `PAY-02`, `CLIENT-01`, plus the public/client reschedule findings.

## C. Instructor dashboard

**Status: AUDITED — FINDINGS**

Surface inventory includes dashboard home, bookings/list/detail/edit/reschedule/new/offline, clients/list/detail, earnings, analytics, progress/feedback, PDA tests/configuration, availability/exceptions, settings, payout settings, profile, branding, subscription, documents, help, schedule, business records, and associated APIs.

Material findings: `INST-01` through `INST-08`, plus shared booking/payment findings.

## D. Admin dashboard

**Status: AUDITED — FINDINGS / VERIFY**

Covered areas:
- admin layout and RBAC
- instructors and approvals
- clients
- bookings
- finance/ledger/revenue
- subscriptions
- pricing
- staff/RBAC
- voice lines
- documents
- AI/Copilot
- audit/operational tooling

Material findings: `ADMIN-01` through `ADMIN-06`, plus subscription/financial findings.

## E. Authentication and session infrastructure

**Status: AUDITED — FINDINGS**

Covered:
- NextAuth credentials authentication
- JWT/session callbacks
- cookies
- idle timeout
- middleware edge authentication
- mobile bearer JWT
- role conventions
- registration

Material findings: `AUTH-01` through `AUTH-05`.

## F. Financial/payment infrastructure

**Status: AUDITED — FINDINGS**

Covered:
- Stripe PaymentIntent creation/verification
- wallet top-up
- booking payment
- refunds/cancellations
- transaction/ledger/payout models
- Stripe webhooks
- subscription billing
- commission calculation
- direct/platform payment modes

Material findings: `PAY-01` through `PAY-08`, `SUB-*`, and `FIN-*`.

## G. Integrations and external side effects

**Status: AUDITED — FINDINGS / VERIFY**

Covered:
- Stripe
- Google Calendar
- Twilio/SMS
- email
- Cloudinary
- AI providers
- custom domains/subdomains
- mobile/Capacitor
- cron/background operations

Material findings: `EXT-01` through `EXT-06`.

## H. Database/schema and architecture

**Status: AUDITED — FINDINGS**

Covered:
- Prisma schema
- ownership relations
- uniqueness
- duplicated state
- legacy fields/routes
- generic core vs driving extension
- payment/account dimensions

Material findings: `DB-01` through `DB-06`.

---

# 2. Critical findings

## PAY-01 — Wallet credit endpoint does not prove PaymentIntent ownership

**Priority: P0**
**Status: CONFIRMED**
**File:** `app/api/client/wallet-add/route.ts`

The route verifies that a supplied Stripe PaymentIntent succeeded and that the amount matches, but does not establish that the PaymentIntent belongs to the authenticated client. A valid succeeded PaymentIntent belonging to another customer can therefore be supplied if its amount matches. The endpoint then credits the authenticated user's wallet.

**Required fix:** bind PaymentIntent ownership to the authenticated user/customer/wallet through server-created metadata or Stripe customer identity, and enforce that binding before crediting.

## PAY-02 — Wallet top-up intent can orphan a successful Stripe PaymentIntent on timeout/retry

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `app/api/client/wallet-topup-intent/route.ts`

A local PENDING WalletTransaction is created, then Stripe PaymentIntent creation occurs. There is no Stripe idempotency key visible in the call. If Stripe creates the intent but the network response is lost, the local cleanup can delete the pending transaction while Stripe has a successful intent with no local transaction to reconcile.

**Required fix:** stable Stripe idempotency key derived from a durable local operation, retain/reconcile pending records on ambiguous Stripe failures, and test timeout/retry ordering.

## PAY-03 — PaymentIntent creation is performed without a visible Stripe idempotency key

**Priority: P1**
**Status: CONFIRMED**
**File:** `lib/services/stripe.ts`

The `paymentIntents.create` wrapper does not show an idempotency key. All callers that create money-moving PaymentIntents therefore require separate duplicate-protection analysis.

**Required fix:** make idempotency mandatory for payment-intent creation and derive keys from durable business-operation IDs.

## BOOK-01 — Client reschedule accepts unsafe duration/date/time input

**Priority: P0**
**Status: CONFIRMED**
**File:** `app/api/client/bookings/[id]/reschedule/route.ts`

The request interface is not schema-validated. `duration` can be negative or otherwise invalid, and date/time parsing uses JavaScript `Date` normalization. Price is derived from instructor hourly rate multiplied by the supplied duration. A negative duration can therefore produce a negative price and a wallet CREDIT path.

**Required fix:** Zod schema with strict date/time/duration bounds; reject invalid dates and non-positive durations; enforce maximum lesson duration; calculate price from authoritative package/rate rules.

## BOOK-02 — Client reschedule conflict check is not proven concurrency-safe

**Priority: P1**
**Status: VERIFY**
**File:** `app/api/client/bookings/[id]/reschedule/route.ts`

Conflict detection occurs inside a transaction, but no SERIALIZABLE configuration is visible on this route. Under concurrent requests, two transactions may both observe no conflict and commit overlapping slots depending on PostgreSQL isolation/locking behaviour.

**Required fix:** use the established serializable retry pattern or a database exclusion/locking strategy and add concurrent reschedule tests.

## BOOK-03 — Instructor reschedule conflict check has the same concurrency concern

**Priority: P1**
**Status: VERIFY**
**File:** `app/api/bookings/[id]/reschedule/route.ts`

The route describes its conflict check as TOCTOU-safe, but the transaction is not visibly configured with the repository's SERIALIZABLE retry helper. The claim therefore requires proof rather than accepting the comment as evidence.

## BOOK-04 — Instructor reschedule lacks explicit end-after-start validation

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `app/api/bookings/[id]/reschedule/route.ts`

The schema validates that both values are ISO datetimes and blocks a past start, but does not explicitly reject `endTime <= startTime` or enforce duration bounds.

## BOOK-05 — Client reschedule and instructor reschedule use server-local date construction

**Priority: P1**
**Status: CONFIRMED**

Client reschedule constructs `new Date(year, month - 1, day, hour, minute)`, which uses the server timezone. This can shift the intended lesson time for instructors in other Australian or future supported timezones.

## PUB-01 — Public booking status endpoint exposes pickup address without authentication

**Priority: P1**
**Status: CONFIRMED**
**File:** `app/api/public/bookings/[id]/route.ts`

The unauthenticated UUID path returns `pickupAddress`, price, booking status/times, and instructor information. The source comment says no PII is returned, but a pickup address is location-sensitive personal information. UUID secrecy is not equivalent to authorization.

**Required fix:** remove location-sensitive fields from unauthenticated responses and require token/phone ownership for details that identify the customer's location.

## PUB-02 — Phone-based public booking access has no visible rate limit

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `app/api/public/bookings/[id]/route.ts`

The endpoint compares a supplied phone number to the booking phone but no endpoint-specific rate limiting is visible. This is a low-entropy secret and should not be brute-forceable.

## PUB-03 — Public cancel/reschedule token ownership is weaker for bookings without linked users

**Priority: P1**
**Status: CONFIRMED RISK**
**Files:** `app/api/public/bookings/[id]/cancel/route.ts`, `app/api/public/bookings/[id]/reschedule/route.ts`

The token is checked against a user record. If the booking/customer relationship has no user ID, the route can fall back to the token holder's identity without a strict booking-to-user binding. The exact intended behaviour for legacy/no-account bookings must be made explicit and tested.

## PUB-04 — Public cancel/reschedule routes require rate-limit review

**Priority: P1**
**Status: CONFIRMED RISK**

Sensitive self-service actions should have rate limiting and replay resistance. Existing rate-limit documentation covers internal booking actions but does not establish equivalent protection for all public token-based routes.

## REV-01 — Review submission writes a non-schema field

**Priority: P0**
**Status: CONFIRMED**
**File:** `app/api/reviews/route.ts`

The Prisma schema defines `Booking.customerReview`, while the review POST code writes `reviewComment`. The route uses `as any`, hiding the mismatch from TypeScript. Prisma runtime will reject an unknown field rather than persist it.

**Required fix:** use the actual schema field consistently and remove the type escape.

## REV-02 — Review email HTML interpolates user-controlled content

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `app/api/reviews/route.ts`

Customer name and review comment are interpolated into HTML email without visible HTML escaping. Depending on the mail renderer, this can produce markup injection or unsafe links/content.

## REV-03 — Review aggregate update can race

**Priority: P2**
**Status: VERIFY**

The review write is atomic, but the subsequent full-table aggregation and Provider update are separate. Concurrent reviews can calculate from different snapshots and leave an incorrect aggregate until another review occurs.

## INST-01 — Payout settings allow client-controlled ABN verification state

**Priority: P0**
**Status: CONFIRMED**
**File:** `app/api/instructor/payout-settings/route.ts`

The request schema accepts `abnVerified`, `abnStatus`, `abnEntityName`, and withholding tax state. The route persists verification fields supplied by the instructor when the ABN is unchanged. This lets the account holder assert verification rather than an authoritative verifier/admin process.

**Required fix:** client may submit ABN identity data only; verification status, verifier, verification timestamp, and tax treatment must be server/admin-controlled.

## INST-02 — Payout settings exposes full bank account number

**Priority: P1**
**Status: CONFIRMED**
**File:** `app/api/instructor/payout-settings/route.ts`

GET and POST responses include `bankAccount` in full. Dashboard APIs should return masked values unless the full value is strictly required.

## INST-03 — Payout settings logs ABN in application logs

**Priority: P1**
**Status: CONFIRMED**
**File:** `app/api/instructor/payout-settings/route.ts`

The route logs incoming and existing ABN values. Sensitive financial/tax identifiers should not be written to ordinary application logs.

## INST-04 — Instructor dashboard layout does not explicitly enforce provider role

**Priority: P1**
**Status: CONFIRMED**
**File:** `app/dashboard/layout.tsx`

The layout redirects CLIENT and admin roles but otherwise renders the instructor dashboard for any authenticated role. The API layer provides some protection, but the dashboard boundary itself should explicitly require the intended provider role while preserving PENDING instructor access.

## INST-05 — Instructor booking check-in/out trusts JWT role/provider fields for mobile auth

**Priority: P1**
**Status: CONFIRMED RISK**
**Files:** `app/api/bookings/[id]/check-in/route.ts`, `app/api/bookings/[id]/check-out/route.ts`

Bearer JWTs are verified cryptographically but their role/provider claims are trusted without a fresh DB role/provider lookup. This differs from `requireRole()`'s documented fresh-DB security model.

## INST-06 — Check-out transaction can update any existing Transaction for the booking

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `app/api/bookings/[id]/check-out/route.ts`

The fallback path finds the first Transaction by `bookingId` and changes its status to `COMPLETED`, regardless of transaction type. The invariant should be a specific booking-payment transaction, not arbitrary financial history.

## INST-07 — Cloudinary document upload can leave orphaned external files

**Priority: P2**
**Status: CONFIRMED RISK**
**File:** `app/api/instructor/documents/route.ts`

The external upload occurs before the DB write. A DB failure after upload leaves an unreferenced file. Recovery/deletion semantics are not established.

## INST-08 — Compliance documents are stored as Cloudinary URLs rather than demonstrably signed/private references

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `app/api/instructor/documents/route.ts`

The document upload persists `result.url` and returns it. For sensitive licence, police, WWCC, insurance and identity documents, repository evidence should establish private storage and short-lived signed access rather than permanent public URLs.

## ADMIN-01 — Debug session endpoint is available as an application route

**Priority: P1**
**Status: CONFIRMED**
**File:** `app/api/debug/session/route.ts`

The endpoint returns the current session object and expiry without any authorization guard. Even if intended for development, it is inside the deployed application route tree.

**Required fix:** remove it from production or gate it behind an explicit development/admin-only control.

## ADMIN-02 — Admin AI tools silently convert DB failures to zero/empty values

**Priority: P1**
**Status: CONFIRMED**
**File:** `lib/admin/ai-tools.ts`

Many metrics use `.catch(() => 0)` or empty objects. The AI system can therefore report apparently valid zero metrics when database queries fail. This violates the AI prompt's instruction not to make up data and can cause operational decisions based on false health signals.

## ADMIN-03 — AI instructor-risk tool references compliance fields inconsistent with the extension migration comments

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `lib/admin/ai-tools.ts`

The tool comments say driving compliance fields moved to `DrivingProviderProfile`, while the query still selects provider-level expiry fields. The use of `as any` hides schema drift. This can produce missing/incorrect risk signals.

## ADMIN-04 — Admin AI question text is persisted in audit metadata

**Priority: P2**
**Status: CONFIRMED RISK**
**File:** `app/api/admin/ai-query/route.ts`

Up to 500 characters of each admin question are stored. Because admins may paste customer or financial information into the Copilot, the retention/privacy boundary for this free text must be explicit.

## AUTH-01 — Login has no visible credential-attempt rate limit

**Priority: P1**
**Status: CONFIRMED RISK**
**File:** `lib/auth.ts`

Credential authorization performs bcrypt verification but no login-specific rate limiting or progressive lockout is visible. The application has other rate-limit infrastructure, but authentication abuse requires a dedicated control.

## AUTH-02 — Authentication returns distinguishable instructor account states

**Priority: P2**
**Status: CONFIRMED RISK**
**File:** `lib/auth.ts`

`EMAIL_NOT_VERIFIED` and `INSTRUCTOR_NOT_APPROVED` are thrown as distinct errors. Depending on NextAuth error propagation, this can reveal account state to login callers.

## AUTH-03 — Session/layout role checks trust JWT role where fresh DB authorization is preferable

**Priority: P1**
**Status: CONFIRMED ARCHITECTURAL RISK**

`app/admin/layout.tsx` and `app/client-dashboard/layout.tsx` use session role directly. API `requireRole()` exists specifically to close stale-JWT role windows. Sensitive mutations must not rely on the layout role check.

## AUTH-04 — Mobile JWT and NextAuth are two separate authorization mechanisms

**Priority: P1**
**Status: CONFIRMED ARCHITECTURAL RISK**

Mobile bearer JWT handling is duplicated in multiple booking routes. The audit must ensure the same role, account-status, expiry, revocation and ownership semantics are enforced for both mechanisms.

## AUTH-05 — `auth.ts` loads complete Provider/Customer relations during password authorization

**Priority: P2**
**Status: CONFIRMED PERFORMANCE/DATA-MINIMISATION RISK**

The credential lookup uses `include: { customers: true, provider: true }`, even though the returned session needs only a small projection. This unnecessarily loads sensitive Provider fields such as OAuth/banking information into the auth process.

## APP-01 — Custom-domain first-party detection uses substring matching

**Priority: P1**
**Status: CONFIRMED**
**File:** `middleware.ts`

`hostname.includes(rootDomain)` is broader than exact-root-or-subdomain matching. Host routing is a trust boundary and should use explicit domain boundaries.

## APP-02 — Maintenance bypass credential is transported as a URL query parameter

**Priority: P1**
**Status: CONFIRMED**
**File:** `middleware.ts`

A secret query parameter is accepted and copied to a cookie. URL credentials can leak through history, logs, referrers and monitoring.

## APP-03 — DIRECT payment mode is partially implemented but public booking still hard-blocks it

**Priority: P1**
**Status: DOC/ARCHITECTURE DRIFT + CONFIRMED**

The repository contains a DirectPaymentAdapter and a direct PaymentIntent branch, while other code still calls DIRECT "not yet implemented" and blocks it. Registration assigns DIRECT for non-driving accounts. The correct conclusion is not simply "DIRECT unsupported"; it is **partially implemented/inconsistent and unsafe to enable as a general mode until the entire lifecycle is coherent**.

## DB-01 — Subscription Stripe ID is not unique in the current Prisma schema

**Priority: P1**
**Status: CONFIRMED**
**File:** `prisma/schema.prisma`

`Subscription.stripeSubscriptionId` is nullable without `@unique`. Duplicate local rows can therefore reference one Stripe subscription unless another database-level constraint exists outside the shown schema.

## DB-02 — Active/trial subscription uniqueness per provider is not established

**Priority: P1**
**Status: CONFIRMED RISK**

No schema-level uniqueness invariant prevents multiple simultaneous ACTIVE/TRIAL subscriptions for one provider.

## DB-03 — Provider and Subscription duplicate lifecycle state

**Priority: P1**
**Status: CONFIRMED**

Tier/status/trial/Stripe identifiers exist in both models. This is a deliberate denormalisation only if transition and reconciliation rules are explicit.

## DB-04 — Booking model combines platform booking, package, payment, attendance, review, request/quote and compliance-adjacent fields

**Priority: P2**
**Status: CONFIRMED ARCHITECTURAL RISK**

The large multi-purpose Booking record increases the chance that unrelated workflows mutate each other's fields. State ownership and invariants need to be documented.

## DB-05 — Soft deletion is not a universal query invariant

**Priority: P1**
**Status: VERIFY**

Some queries explicitly filter `deletedAt: null`, while others use direct `findUnique`/`findMany` patterns. A repository-wide review is required to prove deleted bookings/customers cannot reappear in public, financial or operational views.

## DB-06 — Legacy/parallel routes remain in the payment and account surface

**Priority: P1**
**Status: LEGACY / REACHABILITY CHECK**

Examples include legacy subscription checkout, wallet-add alongside wallet-topup-intent, mobile subscription logic, and parallel booking/self-service routes. Every parallel path must be proven live, intentionally supported, or retired.

---

# 3. Subscription findings retained from the dedicated audit

The subscription chain remains open for the following findings already recorded in `AUDIT_FINDINGS_2026_09_14.md` and `SUBSCRIPTION_PRODUCTION_CHAIN_AUDIT_MAIN_2026-09-14.md`:

- `SUB-H-01` broad provider-level webhook fallback
- `SUB-H-02` subscription.updated find-then-update claim race
- `SUB-H-03` Provider/Subscription duplicate state
- `SUB-H-04` Stripe subscription uniqueness
- `SUB-H-05` local period reset semantics
- `SUB-H-06` billing-cycle consistency
- `SUB-H-07` trial expiry/conversion race
- `SUB-H-08` instructor cancellation/Stripe convergence
- `SUB-H-09` admin override drift
- `SUB-H-10` missing-ID sync recovery
- `SUB-H-11` email-vs-ID Stripe customer correlation
- `SUB-H-12` legacy checkout route
- `SUB-H-13` Stripe API-version drift

These remain open until Kiro implements and regression-tests them.

---

# 4. External side-effect findings

## EXT-01 — External calls inside/around database state transitions need failure recovery

Stripe, Cloudinary, Google Calendar, email, SMS and AI calls are not transactional with PostgreSQL. Every workflow must define the state to persist before the call, after the call, and on ambiguous timeout.

## EXT-02 — Email/SMS failures are often deliberately non-fatal, but durable retry coverage must be proven

Non-blocking `.catch()` prevents user operations from failing because messaging is unavailable, but the system needs a durable retry/outbox mechanism for business-critical notifications.

## EXT-03 — Google Calendar update after booking mutation can leave calendar/database drift

Reschedule updates DB first and Calendar afterward. Calendar failure is logged but not durably reconciled in the inspected route.

## EXT-04 — Cloudinary upload/database update has the inverse drift problem

External file can exist while DB reference does not.

## EXT-05 — AI operational metrics can be wrong without query-failure signalling

See `ADMIN-02`.

## EXT-06 — Cron jobs require state-transition idempotency review

Trial expiry, slot cleanup, lesson reminders and payouts must be audited for repeated execution, overlap and partial failure.

---

# 5. What is currently considered sound in inspected paths

The following controls were found and should be preserved while fixing the findings:

- `requireRole()` re-reads user role from DB for sensitive authorization.
- Admin APIs increasingly use explicit `requirePermission()` checks.
- Main booking creation uses server-side pricing rather than trusting client price fields.
- Main booking creation uses a SERIALIZABLE retry wrapper.
- Booking check-in/out have atomic null guards against duplicate attendance transitions.
- Review creation has an atomic duplicate guard, although the field-name bug prevents the intended write from being reliable.
- Wallet top-up amount bounds and rate limiting are present.
- Stripe webhook event idempotency and serializable transaction work from earlier fixes remain important foundations.
- Provider/customer ownership checks exist in several instructor/client routes and should be standardised rather than replaced.

These are **control observations**, not production-readiness certification.

---

# 6. Closure criteria

The whole-app audit is considered closed only when:

1. Every route/page in the application inventory has a disposition in a route-level coverage matrix.
2. Every sensitive API has explicit authentication, authorization, ownership and state-transition evidence.
3. Every money-moving workflow has a durable idempotency/reconciliation model.
4. Every external side effect has an ambiguous-failure recovery path.
5. Every P0/P1 finding has a Kiro implementation plus regression test evidence.
6. Legacy routes are proven reachable or retired.
7. Current schema constraints match the documented invariants.
8. Current docs reflect actual implementation rather than planned/future architecture.
9. A clean production build/typecheck/test run is recorded after fixes.
10. No unresolved P0 remains, and remaining P1s have explicit accepted risk or closure evidence.

**Current conclusion: NOT PRODUCTION READY.**

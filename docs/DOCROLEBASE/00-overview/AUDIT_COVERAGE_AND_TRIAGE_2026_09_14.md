# DriveBook Whole-App Audit — Coverage, Verified Findings & Priority

**Date:** 2026-09-14
**Branch:** `main`
**Purpose:** Establish the current audit position before further Kiro implementation work.

> This document is an audit/control document. It does not itself authorize production code changes. Kiro remains the implementation and regression-test agent.

## 1. Audit position

The repository has a substantial existing inspection history and a generated API reference documenting **169 API routes**. Existing DOCROLEBASE inspection records also cover the public booking flow, instructor dashboard, student dashboard, admin dashboard, payment/wallet, Stripe webhooks, cron, voice AI, notifications, and security.

However, historical "Area complete" labels are not treated as proof of current correctness. The current code has changed materially since those inspections, including subscription/RBAC changes, Provider/DrivingProviderProfile refactors, tier rename work, and financial transaction hardening.

Therefore the current audit status is:

**COMPREHENSIVE INVENTORY + RISK AUDIT IN PROGRESS; PRODUCTION SIGN-OFF NOT ESTABLISHED.**

The API reference establishes route inventory, but a route-by-route source verification is still required before claiming 100% code-level coverage.

## 2. Surface inventory

### Public
- Public website and SEO pages
- Instructor discovery/search
- Instructor/subdomain websites
- Public booking wizard
- Book-now payment
- Book-later checkout
- Public payment-summary/status flows
- Public cancellation/reschedule flows
- Registration/authentication

### Student
Documented dashboard surface includes:
- `/client-dashboard`
- bookings list/detail
- wallet
- packages
- profile
- progress
- reviews
- PDA tests
- notifications
- help
- booking entry/wizard
- post-payment confirmation

### Instructor
Documented instructor dashboard surface includes:
- dashboard/today workspace
- bookings/list/detail/edit/reschedule/new
- clients/list/detail
- earnings
- analytics
- progress/lesson feedback
- PDA tests/configuration
- availability/exceptions
- settings
- payout settings
- profile
- branding
- subscription
- business records/configuration
- service areas
- packages/custom packages
- documents
- domain/subdomain
- voice receptionist
- devices
- expenses
- quotes
- receipts
- help and related account pages

### Admin
Documented admin surface includes:
- dashboard
- instructors/detail/document review
- clients/detail/wallet
- bookings
- revenue
- payouts
- pricing
- settings
- reviews
- support
- audit log
- credits
- staff governance
- test centres
- Copilot
- voice lines
- disputes
- cron jobs

### APIs
`docs/DOCROLEBASE/08-technical/API_REFERENCE.md` documents 169 routes across authentication, public, availability, bookings, business, calendar, client, cron, dashboard, instructor, admin, analytics, notifications, payments, PDA, locations/services, mobile push, staff, verification, voice, upload, and debug/dev routes.

## 3. Verified current findings

### P0/P1 — financial/security blockers

#### AUD-H-01 — Wallet payment intent lacks transaction-to-session ownership enforcement
**Status:** CONFIRMED

`app/api/payments/create-intent/route.ts` requires a session for the `transactionId` path but then loads the `WalletTransaction` by ID without comparing `transaction.wallet.userId` to the authenticated user. The route therefore relies on possession of a transaction ID rather than proving ownership.

**Risk:** An authenticated user who obtains another user's transaction ID may be able to create a PaymentIntent against that user's wallet transaction.

**Priority:** P0/P1 — requires immediate remediation and test.

#### AUD-H-02 — External Stripe call is performed inside a database transaction and is described incorrectly as atomic
**Status:** CONFIRMED RISK

`app/api/payments/create-intent/route.ts` creates the Stripe PaymentIntent inside the Prisma transaction and then updates the Booking row in the same transaction. PostgreSQL transaction rollback cannot roll back a Stripe API call.

**Risk:** A DB rollback/serialization failure after Stripe creation can leave an orphaned Stripe PaymentIntent. Conversely, retry logic around DB transactions can repeat an external side effect unless the Stripe operation itself is idempotently correlated.

**Priority:** HIGH.

#### AUD-H-03 — Instructor payout settings allow the instructor to submit verification state
**Status:** CONFIRMED

`app/api/instructor/payout-settings/route.ts` accepts `abnVerified`, `abnStatus`, `abnEntityName`, and `withholdingTaxRate` from the instructor request. When the ABN is unchanged, the route writes these client-supplied verification fields. It permits a client-supplied `withholdingTaxRate` when `abnVerified === true`.

**Risk:** An instructor can potentially self-assert ABN verification and alter tax-withholding state that should be controlled by authorised verification/admin logic.

**Priority:** P0/P1 financial/compliance blocker.

#### AUD-H-04 — Private compliance-document upload stores a permanent Cloudinary URL despite the private-document contract
**Status:** CONFIRMED

`lib/services/cloudinary.ts` states private documents must store only `publicId` and must use short-lived signed URLs. `uploadInstructorDocument()` nevertheless returns both URL and publicId, and `app/api/instructor/documents/route.ts` stores `result.url` in the DrivingProviderProfile for compliance documents.

The admin document endpoint also contains a legacy fallback that can return the stored URL directly when publicId extraction fails.

**Risk:** Compliance documents may be accessible through permanent Cloudinary URLs, defeating the intended signed-URL access model.

**Priority:** P0/P1 privacy/security blocker.

#### AUD-H-05 — Public reschedule has a check-then-write booking race
**Status:** CONFIRMED RISK

`app/api/public/bookings/[id]/reschedule/route.ts` performs `availabilityService.checkDoubleBooking()` and subsequently updates the booking without a transaction/locking invariant covering the conflict check and write.

**Risk:** Concurrent reschedule requests can both observe a free slot and write overlapping bookings.

**Priority:** HIGH.

#### AUD-H-06 — Slot reservation creation has a check-then-create race
**Status:** CONFIRMED RISK

`app/api/availability/check-and-reserve/route.ts` checks for active reservations and overlapping bookings and then creates a `SlotReservation` separately. There is no demonstrated database exclusion/unique invariant that makes the check and create atomic.

**Risk:** Concurrent booking flows can both reserve the same slot.

**Priority:** HIGH.

### Security / trust boundary

#### AUD-H-07 — Custom-domain detection uses substring matching
**Status:** CONFIRMED

`middleware.ts` uses `hostname.includes(NEXT_PUBLIC_ROOT_DOMAIN)` rather than an explicit exact-domain or domain-boundary check.

**Risk:** A hostname containing the configured root-domain text can be classified as first-party, weakening the host-routing trust boundary.

**Priority:** HIGH.

#### AUD-H-08 — Maintenance bypass secret travels through a query parameter
**Status:** CONFIRMED

`middleware.ts` accepts `?bypass=<MAINTENANCE_BYPASS_KEY>` and then writes that secret into a cookie.

**Risk:** URL credentials can enter history, logs, analytics, copied links, and referrer contexts.

**Priority:** HIGH.

#### AUD-H-09 — Subscription entitlement middleware fails open on database failure
**Status:** CONFIRMED

`lib/middleware/subscriptionValidation.ts` returns full valid access after a DB error.

**Risk:** Database failure can become entitlement bypass for routes relying on this helper.

**Priority:** HIGH.

#### AUD-H-10 — Role conventions are inconsistent
**Status:** CONFIRMED

Instructor code uses lowercase `provider`, while admin roles use uppercase `ADMIN`/`SUPER_ADMIN`/`CLIENT`.

**Risk:** Case-sensitive role checks are vulnerable to implementation drift and route-level mistakes.

**Priority:** HIGH architectural/security consistency issue.

#### AUD-H-11 — Authorization is distributed across multiple independent gates
**Status:** CONFIRMED ARCHITECTURAL RISK

Current authorization is split across middleware authentication, DB role checks, permissions, Provider existence, approval status, subscription validation, and ownership checks. This is defensible only if every sensitive endpoint applies the required combination.

**Priority:** HIGH — requires endpoint authorization matrix.

### Subscription / Stripe

#### SUB-H-01 — Broad Provider-only subscription fallback remains
**Status:** CONFIRMED

`checkout.session.completed` can fall back to updating all subscription rows for a provider when precise correlation fails.

**Priority:** HIGH.

#### SUB-H-02 — `customer.subscription.updated` has non-atomic local row claiming
**Status:** CONFIRMED

The handler can select a most-recent trial/active row and update it after a separate read.

**Priority:** HIGH.

#### SUB-H-03 — Provider and Subscription duplicate subscription state
**Status:** CONFIRMED

Subscription tier/status/trial/Stripe identity are represented in both models.

**Priority:** HIGH architectural/data-integrity issue.

#### SUB-H-04 — `stripeSubscriptionId` is not unique in the current schema
**Status:** CONFIRMED

`prisma/schema.prisma` contains `stripeSubscriptionId String?` without `@unique`.

**Priority:** HIGH.

#### SUB-H-05 — Instructor subscription lifecycle has local period calculations that can diverge from Stripe
**Status:** CONFIRMED RISK

Subscription-management paths calculate period dates locally, including a 30-day period assumption in mobile subscription management.

**Priority:** HIGH.

#### SUB-H-06 — Mobile subscription path is a separate, weaker lifecycle implementation
**Status:** CONFIRMED

`app/api/instructor/subscription/mobile/route.ts` is `@ts-nocheck`, duplicates lifecycle logic, updates Provider separately from Subscription, and cancellation only changes local state.

**Priority:** HIGH.

#### SUB-H-07 — Legacy subscription checkout remains live in the repository
**Status:** LEGACY / REACHABILITY CHECK

`app/api/subscriptions/checkout/route.ts` is an independent Stripe Checkout implementation, uses `@ts-nocheck`, `customer_email`, and does not create the local Subscription before Stripe checkout.

**Priority:** HIGH until reachability is proven/route retired.

#### SUB-H-08 — Stripe API versions differ
**Status:** CONFIRMED

Subscription code uses both `2026-01-28.clover` and `2026-02-25.clover`.

**Priority:** HIGH consistency/release risk.

### Architecture

#### ARCH-H-01 — Non-driving registration persists unsupported DIRECT payment mode
**Status:** CONFIRMED

`app/api/register/route.ts` maps every non-driving business type to `SAAS / DIRECT`, while steering says DIRECT payment implementation is not yet available. The runtime payment-mode guard later rejects DIRECT payments.

**Priority:** HIGH.

#### ARCH-H-02 — Registration core records are transactional but Business template creation is outside the transaction
**Status:** CONFIRMED

User, Provider and Subscription are created transactionally; Business template creation occurs afterward and is non-fatal.

**Priority:** HIGH until lazy repair/invariant is proven.

## 4. Material data/AI findings

### DATA-H-01 — Provider contains sensitive OAuth and financial information
**Status:** CONFIRMED DATA-SENSITIVITY RISK

Provider stores Google access/refresh tokens, bank details, ABN/tax information, Stripe identifiers and other operational data.

A repository-wide projection audit is required to prove no broad Provider serialization exposes these fields.

**Priority:** HIGH.

### DATA-H-02 — Private-document access contract is inconsistent
**Status:** CONFIRMED

See AUD-H-04. The code comments and signed-URL design do not match the actual upload persistence path.

### AI-H-01 — Admin AI tools fail closed at the data layer but can silently convert query failures into zero values
**Status:** CONFIRMED RELIABILITY RISK

`lib/admin/ai-tools.ts` uses many `.catch(() => 0)`/empty-object fallbacks. This can produce an apparently valid but incomplete health/risk picture when database queries fail.

**Priority:** MEDIUM/HIGH depending on operational use.

### AI-H-02 — Instructor-risk AI logic references fields moved to DrivingProviderProfile
**Status:** CONFIRMED CODE/DATA DRIFT

`lib/admin/ai-tools.ts` selects `insuranceExpiry`/other compliance fields directly from Provider despite the current refactor moving driving-specific compliance fields into DrivingProviderProfile.

**Risk:** Risk scoring may silently omit compliance-expiry signals.

**Priority:** HIGH for admin operational correctness.

## 5. Testing gaps

The repository has meaningful regression tests, including subscription/webhook retry work, but current evidence does not establish complete behavioural coverage for the application.

Required minimum matrices include:

- Every sensitive API: authentication + role + permission + ownership.
- Public booking: concurrent slot reservation, concurrent reschedule, duplicate submission, expired payment, duplicate webhook.
- Wallet: cross-user transaction ID, duplicate PaymentIntent, failed DB after Stripe side effect.
- Subscription: checkout-created/updated ordering, duplicate customers, trial expiry versus payment, cancellation, annual/monthly, mobile/web parity.
- Documents: permanent URL exposure, signed URL expiry, admin permission, instructor ownership.
- Admin: every permission preset against every sensitive operation.
- AI: tool failure, stale/missing data, data-scope validation.

## 6. Existing work that should be treated as implementation progress, not automatic closure

The following Kiro-reported work remains useful evidence but requires source/test verification before the associated audit item is closed:

- F-09 — SERIALIZABLE transaction wrapping.
- F-10 — atomic webhook idempotency.
- F-12 — PaymentIntent correlation metadata.
- F-13 — subscription correlation improvements.
- Admin RBAC permission enforcement.
- BUSINESS → PREMIUM tier rename.

Implementation completion and audit closure are deliberately separate statuses.

## 7. Priority order for Kiro

### P0 — address before any production launch
1. AUD-H-01 — wallet transaction ownership.
2. AUD-H-03 — instructor self-service ABN/withholding verification.
3. AUD-H-04 — private compliance-document URL exposure.
4. SUB-H-01 — broad subscription fallback.
5. SUB-H-02 — subscription webhook race.

### P1 — production blockers / immediately after P0
6. AUD-H-02 — Stripe external side effect inside DB transaction.
7. AUD-H-05 — public reschedule race.
8. AUD-H-06 — slot reservation race.
9. AUD-H-07 — custom-domain trust boundary.
10. AUD-H-08 — maintenance bypass secret in URL.
11. AUD-H-09 — entitlement fail-open.
12. SUB-H-03/04/05/06/07/08 — subscription state/constraints/mobile/legacy/API-version work.
13. ARCH-H-01 — unsupported DIRECT registration.
14. DATA-H-01 — Provider projection audit.
15. AI-H-02 — stale compliance-field references.

### P2 — hardening after blockers
- AI fail-soft query handling.
- `@ts-nocheck` reduction in critical routes.
- role naming normalization/migration.
- audit-log failure policy review.
- rate-limit and abuse-control consistency.
- notification/calendar/email side-effect recovery.
- stale public-page cache semantics.
- SEO/sitemap final verification.

## 8. Audit closure criteria

The whole-app audit is considered complete only when:

1. All 169 documented API routes are mapped to their actual source files.
2. Every public, student, instructor, admin, business, mobile, cron and webhook route has a recorded auth/ownership/permission disposition.
3. Every major state machine has an invariant and concurrency review.
4. Database constraints have been checked against the intended invariants.
5. Legacy routes are classified as live, intentionally supported, or retired.
6. Critical external side effects have an idempotency/recovery strategy.
7. Current code and DOCROLEBASE/steering no longer materially contradict each other.
8. P0/P1 findings are either fixed and regression-tested or explicitly accepted by the product owner with documented risk.
9. A final re-audit is performed after Kiro's fixes.
10. Only then should a production-readiness decision be made.

## 9. Source references used for this audit

- `docs/DOCROLEBASE/08-technical/API_REFERENCE.md` — 169-route inventory.
- `docs/DOCROLEBASE/03-instructor/DASHBOARD.md` — instructor surface inventory.
- `docs/DOCROLEBASE/02-student/DASHBOARD.md` — student surface inventory.
- `docs/DOCROLEBASE/05-admin/DASHBOARD.md` — admin surface inventory.
- `docs/DOCROLEBASE/INSPECTION.md` — historical inspection and prior fixes.
- `.kiro/steering/platform-model.md` — architecture reference.
- `middleware.ts`, auth/RBAC modules, payment/booking/subscription/document/AI routes — current source verification.

# DriveBook Whole-App Production Readiness Audit

## Purpose

This is the source-code-first audit baseline for Kiro implementation work. It examines the application as a system rather than treating the subscription chain in isolation.

**Baseline branch:** `main`

**Baseline commit:** `c0b2d3a127e3bb02afd076fbf34c11fc0be877f4`

**Audit date:** 2026-09-14

**Role split:** This document records findings. Kiro is responsible for local-tree comparison, implementation, regression testing, and updating the living DOCROLEBASE documents after code changes. This audit does not authorize production code changes by itself.

## Audit standard

Findings are classified as:

- **CONFIRMED** — directly evidenced in the inspected source code.
- **RISK / VERIFY** — credible risk identified, but the inspected source is not sufficient to prove exploitability or production impact.
- **DOC/ARCHITECTURE DRIFT** — code and the platform steering/living documentation disagree.
- **TEST GAP** — the behaviour may be correct, but the repository evidence does not establish adequate regression coverage.
- **LEGACY / REACHABILITY CHECK** — old or parallel implementation exists and must be proven unreachable or retired.

Priority:

- **HIGH** — security, financial integrity, authorization, data ownership, or production correctness risk.
- **MEDIUM** — material reliability, consistency, lifecycle, or maintainability issue.
- **LOW** — cleanup, documentation, or non-blocking engineering debt.

---

# 1. Executive assessment

DriveBook has substantial production-oriented infrastructure: centralized RBAC, NextAuth sessions, Prisma/PostgreSQL, Stripe webhooks with event idempotency, transactional booking/payment logic, wallet/ledger models, admin audit logging, subscription state, custom domains, mobile/Capacitor support, calendar integration, and AI/admin tooling.

However, the codebase currently contains several **cross-boundary consistency problems**. The most important pattern is that the same business fact is represented or mutated in multiple places without one authoritative transition mechanism. This affects subscriptions, provider state, payments, booking state, and some authentication/authorization paths.

The application should **not be treated as production-ready solely because individual security fixes or TypeScript checks pass**. The remaining risk is primarily system-level: race conditions, parallel/legacy routes, DB/Stripe drift, authorization boundaries, and insufficient behavioural regression tests.

Highest-risk areas found in this whole-app pass:

1. Subscription lifecycle and Stripe/local-state convergence.
2. Middleware custom-domain trust boundary.
3. Subscription entitlement fail-open behaviour on database failure.
4. Non-driving registration assigns `paymentMode= DIRECT` although the platform steering explicitly says DIRECT is not implemented and throws at runtime.
5. Duplicate Provider + Subscription representations of subscription state.
6. Admin subscription operations can deliberately create DB/Stripe divergence.
7. Trial expiry/conversion concurrency remains unproven.
8. Legacy/parallel payment and checkout routes remain present.
9. Role/identity conventions are inconsistent (`provider` lowercase versus admin uppercase roles).
10. Sensitive integrations and external side effects are not consistently demonstrated as idempotent.

---

# 2. Architecture baseline

The platform steering defines four independent dimensions: subscription tier, account type, payment model, and business model. It also defines a generic Provider core with driving-specific extensions and requires feature gates to use `getAccountFeatures()` rather than raw tier strings.

The steering file is therefore the architectural reference against which implementation findings below are judged.

Evidence: `.kiro/steering/platform-model.md`.

The repository currently has a large Next.js App Router surface with public, client, instructor, admin, business, booking, payment, calendar, branding, voice, cron, analytics, and authentication routes. `package.json` also includes Capacitor mobile support, Stripe, Twilio, Cloudinary, Google APIs, OpenAI, Resend/Nodemailer, Upstash rate limiting, and Vitest.

Evidence: `package.json`, `app/api/**`, `lib/**`.

---

# 3. HIGH — security and authorization findings

## APP-H-01 — Custom-domain host detection uses substring matching

**Status:** CONFIRMED

**Evidence:** `middleware.ts` determines the first-party domain with:

```text
hostname.includes(NEXT_PUBLIC_ROOT_DOMAIN)
```

The intended trust boundary is a hostname belonging to DriveBook's own domain, but substring matching is broader than suffix/domain-boundary matching. A malicious hostname containing the configured root-domain string can be misclassified as first-party.

**Impact:** Host-based routing and custom-domain isolation should not rely on substring containment. This is a security boundary because the middleware decides whether to rewrite requests to `/custom-domain`.

**Priority:** HIGH

**Required Kiro verification:** Test exact root domain, legitimate subdomains, custom domains, deceptive hostnames containing the root domain, ports, preview hosts, and case normalization. Replace the matching rule with an explicit domain-boundary check if confirmed appropriate.

---

## APP-H-02 — Maintenance bypass secret is accepted through a query parameter

**Status:** CONFIRMED

**Evidence:** `middleware.ts` accepts `?bypass=<MAINTENANCE_BYPASS_KEY>` and then stores the same secret value in a cookie.

**Impact:** Secrets in URLs can enter browser history, reverse-proxy logs, analytics, copied URLs, referrer contexts, and monitoring systems. The bypass token should not need to be transported as a URL credential.

**Priority:** HIGH

**Required Kiro verification:** Replace URL-secret transport with a safer authenticated/admin mechanism or a one-time exchange. Review cookie flags and invalidation semantics at the same time.

---

## APP-H-03 — Subscription entitlement check fails open on database failure

**Status:** CONFIRMED

**Evidence:** `lib/middleware/subscriptionValidation.ts` catches database errors and returns `{ valid: true, readOnly: false }`.

The same module explicitly describes this as "Fail open — never block on a DB error".

**Impact:** A database outage or query failure can turn an entitlement check into full instructor access. This is especially dangerous for POST/PUT/PATCH/DELETE routes that rely on this helper.

**Priority:** HIGH

**Required Kiro verification:** Inventory every caller of `requireActiveSubscription()` and determine whether each route has an independent authorization/approval check. Define a deliberate fail-closed policy for entitlement enforcement while preserving safe read-only access where required.

---

## APP-H-04 — Instructor authorization uses a lowercase role convention that differs from admin roles

**Status:** CONFIRMED

**Evidence:** `lib/auth.ts` and `lib/auth/requireRole.ts` use `role === 'provider'` for instructors, while admin authorization uses uppercase roles such as `ADMIN` and `SUPER_ADMIN`.

**Impact:** Mixed role conventions increase the chance that a route or middleware checks the wrong spelling/case. This becomes especially dangerous during refactors and code generation.

**Priority:** HIGH

**Required Kiro verification:** Establish the complete role catalogue from schema, registration, auth, middleware, admin RBAC, and every route. Either formalize the mixed convention intentionally or normalize it with migration-safe handling.

---

## APP-H-05 — Authorization is split between edge authentication, DB role checks, permissions, approval status, and subscription checks

**Status:** CONFIRMED ARCHITECTURAL RISK

**Evidence:** `middleware.ts` authenticates protected API requests at the edge; `requireRole.ts` re-reads users from DB; `requirePermission()` delegates to the RBAC checker; `requireInstructor()` additionally checks role, provider existence, and approval status; subscription validation is separate.

**Impact:** Multiple gates are individually sensible but create a distributed authorization model. A newly added route can easily apply authentication but omit one of the business authorization dimensions.

**Priority:** HIGH

**Required Kiro verification:** Produce an endpoint authorization matrix showing, for every sensitive route: authentication, role, permission, ownership, provider approval, subscription entitlement, and business-type gate.

---

# 4. HIGH — subscription lifecycle and Stripe consistency

## SUB-H-01 — Checkout completion still contains a broad provider-level subscription update fallback

**Status:** CONFIRMED

**Evidence:** `app/api/stripe/webhook/route.ts` first attempts a constrained claim of a trial/active subscription. If that does not claim a row and no exact Stripe subscription row is found, the handler falls back to an `updateMany({ where: { providerId } })` operation.

**Impact:** Multiple historical/local subscription rows can be mutated by a single Stripe checkout event. This defeats the purpose of precise correlation and can corrupt subscription history.

**Priority:** HIGH

**Required Kiro verification:** Prove whether the fallback is reachable in legitimate event ordering. If it is, replace it with deterministic correlation and explicit failure/manual-reconciliation handling.

---

## SUB-H-02 — `customer.subscription.updated` contains find-then-update row claiming

**Status:** CONFIRMED

**Evidence:** `handleSubscriptionUpdate()` first searches for a row by Stripe subscription ID. When not found, it searches for the most recent local trial/active row with a null Stripe subscription ID and then updates that row.

**Impact:** Concurrent webhook deliveries can select the same candidate row or different candidates. Event ordering across `checkout.session.completed`, `customer.subscription.created`, and `customer.subscription.updated` is not controlled by the webhook event-id idempotency mechanism.

**Priority:** HIGH

**Required Kiro verification:** Implement or prove an atomic ownership/claim invariant and add concurrency tests for all three event types.

---

## SUB-H-03 — Subscription state is duplicated between Provider and Subscription

**Status:** CONFIRMED

**Evidence:** `Provider` stores `subscriptionTier`, `subscriptionStatus`, `trialEndsAt`, `stripeCustomerId`, and `stripeAccountId`; `Subscription` independently stores tier, status, billing cycle, amounts, Stripe IDs, period dates, cancellation fields, and trial end.

**Impact:** Every lifecycle transition has at least two state representations. Drift is possible even when each individual write succeeds.

**Priority:** HIGH

**Required Kiro verification:** Define authoritative fields and a transition protocol. If Provider fields are retained as a denormalized entitlement cache, document exactly when and how they are updated and reconciled.

---

## SUB-H-04 — Subscription uniqueness is not established in the live schema evidence

**Status:** CONFIRMED RISK

**Evidence:** `Subscription.stripeSubscriptionId` is nullable and the current schema excerpt does not declare it `@unique`. Existing F13 documentation proposes a unique constraint, but documentation alone does not prove the constraint exists in the current schema/database.

**Impact:** More than one local subscription row can potentially reference the same Stripe subscription unless the database migration has independently established uniqueness.

**Priority:** HIGH

**Required Kiro verification:** Inspect current Prisma migrations and production-equivalent schema. Confirm the database constraint, not just the Prisma model/documentation.

---

## SUB-H-05 — Instructor subscription change resets period semantics locally

**Status:** CONFIRMED RISK

**Evidence:** `app/api/instructor/subscription/route.ts` preserves the original trial end in some tier changes but sets `currentPeriodEnd` to approximately now + 30 days.

**Impact:** This can diverge from Stripe's actual billing period, especially for annual plans or changes near period boundaries.

**Priority:** HIGH

**Required Kiro verification:** Define whether tier change means immediate Stripe price change, new checkout, or local-only plan selection. Current period fields must come from the authoritative billing event rather than an assumed 30-day interval.

---

## SUB-H-06 — Billing-cycle correctness is not guaranteed across all subscription paths

**Status:** CONFIRMED RISK

**Evidence:** The instructor subscription route accepts `billingCycle`, while some local lifecycle logic uses generic period calculations. The legacy checkout route also independently constructs Stripe sessions.

**Impact:** Monthly/annual plan mismatches can produce incorrect amounts, periods, or entitlement dates.

**Priority:** HIGH

**Required Kiro verification:** Trace monthly and annual selection from UI → route → Stripe Price ID → webhook → Subscription row → Provider state → display. Add a matrix test for every live tier/cycle.

---

## SUB-H-07 — Trial expiry and payment conversion concurrency is not proven safe

**Status:** CONFIRMED RISK

**Evidence:** The codebase has trial state on both Provider and Subscription, while subscription conversion is performed by Stripe webhooks and trial expiry is also represented in application logic/cron documentation.

**Impact:** Expiry can race with checkout completion or subscription-created events, producing an expired local subscription after a valid payment or vice versa.

**Priority:** HIGH

**Required Kiro verification:** Identify every trial-expiry writer. Use conditional state transitions and test expiry-versus-conversion concurrency.

---

## SUB-H-08 — Instructor cancellation must be traced separately from admin cancellation

**Status:** CONFIRMED RISK

**Evidence:** Admin subscription cancellation explicitly calls Stripe for a linked subscription. The audit did not find equivalent proof that the primary instructor cancellation path always synchronizes Stripe before or alongside local state.

**Impact:** An instructor can appear cancelled locally while Stripe continues billing, or remain active locally after Stripe cancellation.

**Priority:** HIGH

**Required Kiro verification:** Trace the actual instructor cancel route and all UI entry points. Confirm Stripe update/cancel, webhook convergence, local timestamps, and failure recovery.

---

## SUB-H-09 — Admin override can intentionally create Stripe/DB divergence

**Status:** CONFIRMED

**Evidence:** `app/api/admin/instructors/[id]/subscription/route.ts` supports `override_tier`, which updates Provider and Subscription rows directly without requiring a corresponding Stripe price/subscription change.

**Impact:** The admin UI can create a local entitlement that does not match the paid Stripe subscription. This may be intentional for comped/manual accounts, but the code does not establish a separate explicit override mode in the subscription model.

**Priority:** HIGH

**Required Kiro verification:** Decide whether overrides are local entitlements, Stripe-linked changes, or both. Record reason, duration, actor, and reconciliation semantics if local override is intentional.

---

## SUB-H-10 — Admin force-sync cannot discover a missing Stripe subscription ID

**Status:** CONFIRMED

**Evidence:** The admin `sync` action requires a local `stripeSubscriptionId`; if none exists it returns an error rather than discovering the provider's Stripe customer subscriptions.

**Impact:** The exact class of drift caused by lost/missing local Stripe IDs cannot be repaired through the normal force-sync operation.

**Priority:** HIGH

**Required Kiro verification:** Add a safe discovery/reconciliation workflow using Stripe customer ownership and duplicate checks, or explicitly document manual recovery.

---

## SUB-H-11 — Stripe customer correlation is split between email-based and ID-based checkout

**Status:** CONFIRMED

**Evidence:** `app/api/instructor/subscription/route.ts` uses an existing `stripeCustomerId` where available, while `app/api/subscriptions/checkout/route.ts` creates checkout with `customer_email`.

**Impact:** Separate checkout paths can create multiple Stripe Customer records for the same DriveBook provider.

**Priority:** HIGH

**Required Kiro verification:** Establish one customer-creation/reuse policy. Prove uniqueness under concurrent checkout requests.

---

## SUB-H-12 — Legacy subscription checkout route remains present

**Status:** LEGACY / REACHABILITY CHECK

**Evidence:** `app/api/subscriptions/checkout/route.ts` independently creates Stripe subscription checkout sessions and contains its own trial-detection logic.

**Impact:** A parallel subscription lifecycle can diverge from the newer instructor subscription route.

**Priority:** HIGH

**Required Kiro verification:** Search all callers and UI references. If live, reconcile it with the canonical lifecycle. If obsolete, retire it safely.

---

## SUB-H-13 — Stripe API versions differ between subscription operations

**Status:** CONFIRMED

**Evidence:** Subscription/admin code uses `2026-02-25.clover`, while the instructor subscription route uses `2026-01-28.clover`.

**Impact:** Different Stripe API semantics/types can be exercised by different routes.

**Priority:** HIGH

**Required Kiro verification:** Establish the repository-wide supported Stripe API version and remove accidental drift.

---

# 5. HIGH — registration, account model, and platform-model integrity

## APP-H-06 — Non-driving registration assigns DIRECT payment mode although DIRECT is explicitly not implemented

**Status:** CONFIRMED

**Evidence:** `app/api/register/route.ts` derives:

```text
Driving → MARKETPLACE / PLATFORM
Everything else → SAAS / DIRECT
```

But `.kiro/steering/platform-model.md` explicitly states `paymentMode = DIRECT` is Phase 2, not implemented, and throws at runtime via the payment-mode guard.

**Impact:** Non-driving provider registration can create accounts in a state the platform says is unsupported. This is a direct code-versus-architecture contradiction.

**Priority:** HIGH

**Required Kiro verification:** Determine whether non-driving verticals are actually live. If not live, registration must not persist an unsupported payment mode. If they are intended to be live, the steering and payment architecture must be updated before enabling them.

---

## APP-H-07 — Registration creates core identity/subscription transactionally but Business template creation is outside the transaction

**Status:** CONFIRMED

**Evidence:** User, Provider, and initial Subscription are created in a transaction. Business template creation happens afterward and is explicitly treated as non-fatal.

**Impact:** A provider can exist without its expected business configuration. The code says this can be repaired later, but the invariant and repair path need to be proven.

**Priority:** HIGH

**Required Kiro verification:** Identify dashboard lazy-repair behaviour and ensure missing template data cannot expose broken routes or incorrect permissions.

---

## APP-H-08 — Initial trial configuration is inconsistent with tier-specific trial definitions

**Status:** CONFIRMED RISK

**Evidence:** Registration always starts the initial local subscription as BASIC and uses `BASIC_TRIAL_DAYS` rather than deriving the trial from the selected tier. The platform steering defines tier-specific trial periods, including 30 days for PREMIUM.

**Impact:** If registration is intended to select a tier or if another path assumes trial length follows tier, local state can diverge from plan configuration.

**Priority:** MEDIUM

**Required Kiro verification:** Establish whether all new providers always start BASIC trial. If yes, document this as canonical; if no, derive trial duration from the actual tier.

---

# 6. HIGH — payment, booking, wallet, and financial integrity

## PAY-H-01 — Financial state is distributed across Booking, Transaction, WalletTransaction, PlatformLedger, LedgerEntry, and Payout

**Status:** CONFIRMED ARCHITECTURAL RISK

**Evidence:** `prisma/schema.prisma` contains all of these financial representations.

**Impact:** Financial correctness depends on consistent cross-model transitions and idempotency, not merely individual database writes.

**Priority:** HIGH

**Required Kiro verification:** Build a complete money-flow matrix: client charge → transaction → platform fee → provider payout → wallet adjustments → refund → dispute → payout reversal/reconciliation. For each event identify exactly one source transaction and all derived records.

---

## PAY-H-02 — Booking and payment are separate state machines and require cross-state invariants

**Status:** CONFIRMED ARCHITECTURAL RISK

**Evidence:** Booking has states such as PENDING, PENDING_PAYMENT, CONFIRMED, COMPLETED, CANCELLED, EXPIRED and payment fields such as `isPaid`, `paymentCaptured`, and `paymentIntentId`.

**Impact:** Boolean payment fields can contradict booking status unless every transition is centralized and tested.

**Priority:** HIGH

**Required Kiro verification:** Define allowed combinations and reject impossible states. Test duplicate webhooks, delayed webhooks, expired holds, refunds, and manual/admin interventions.

---

## PAY-H-03 — Public payment-status access uses a payment token and must be treated as a bearer credential

**Status:** CONFIRMED RISK

**Evidence:** Public booking payment-status route reads `paymentToken` and `paymentIntentId` from Booking.

**Impact:** Any bearer token exposed through logs, URLs, screenshots, referrers, or email forwarding can become an authorization credential.

**Priority:** HIGH

**Required Kiro verification:** Trace token generation, entropy, expiry, rotation, scope, response contents, and whether knowing a booking ID alone can bypass token checks.

---

## PAY-H-04 — SlotReservation has no visible uniqueness constraint preventing duplicate active reservations for the same provider/time

**Status:** CONFIRMED RISK

**Evidence:** `SlotReservation` has indexes on provider/expiry and session ID but no database-level exclusion/unique constraint covering overlapping time intervals.

**Impact:** Concurrent booking requests can potentially reserve the same slot unless application transactions lock and validate correctly.

**Priority:** HIGH

**Required Kiro verification:** Trace the reservation transaction and booking creation path. Add concurrency tests. For PostgreSQL, consider whether an exclusion constraint or equivalent locking strategy is appropriate.

---

## PAY-H-05 — Payment/booking route duplication exists

**Status:** LEGACY / REACHABILITY CHECK

**Evidence:** The repository contains multiple payment-related paths including `app/api/payments/create-intent/`, `app/api/create-payment-intent/`, public payment-status routes, bulk booking payment logic, and SaaS payment services.

**Impact:** Parallel payment implementations are a common source of inconsistent authorization, idempotency, amount validation, and webhook metadata.

**Priority:** HIGH

**Required Kiro verification:** Map every payment endpoint and caller. Mark canonical versus legacy. Confirm every reachable path uses the same financial invariants.

---

## PAY-H-06 — Webhook event idempotency does not by itself guarantee business-operation idempotency

**Status:** CONFIRMED ARCHITECTURAL RISK

**Evidence:** `WebhookEvent.idempotencyKey` is unique, but different valid Stripe events for the same subscription/payment can arrive in different orders.

**Impact:** Event-level deduplication prevents duplicate handling of the same event but does not prevent invalid state transitions caused by different events.

**Priority:** HIGH

**Required Kiro verification:** Define monotonic or state-aware transitions for each webhook family and reject stale transitions.

---

# 7. MEDIUM — authentication and session findings

## AUTH-M-01 — Authentication uses a JWT session with DB revalidation only on sensitive role/permission helpers

**Status:** CONFIRMED ARCHITECTURAL RISK

**Evidence:** `lib/auth.ts` stores role/provider/customer information in the JWT. `requireRole()` explicitly re-reads the DB because JWT role can become stale.

**Impact:** Routes that use session fields directly can observe stale identity or business state.

**Priority:** MEDIUM

**Required Kiro verification:** Search for direct use of `session.user.role`, `session.user.providerId`, `businessType`, and `paymentModel` in sensitive server routes. Sensitive actions should use authoritative DB state.

---

## AUTH-M-02 — Registration has IP rate limiting, but login/reset/verification paths need the same complete threat-model review

**Status:** TEST GAP / VERIFY

**Evidence:** Registration explicitly uses `checkRateLimitStrict()` and `authRateLimit`. The codebase also has login, password reset, verification, and set-password routes, but this audit pass did not establish equivalent protection across all authentication flows.

**Priority:** MEDIUM

**Required Kiro verification:** Produce an auth endpoint matrix covering rate limits, enumeration resistance, token expiry, one-time use, password policy, audit logging, and account lockout/abuse controls.

---

## AUTH-M-03 — `auth.ts` contains stale/misleading backward-compatibility comments

**Status:** DOC/ARCHITECTURE DRIFT

**Evidence:** The JWT callback contains comments such as a migration from an old token field while the visible code checks the same `providerId` property on both sides of the compatibility condition.

**Impact:** Security-sensitive auth code should not contain contradictory migration comments because future maintainers may preserve or remove the wrong logic.

**Priority:** LOW

---

# 8. MEDIUM — data model and privacy findings

## DATA-M-01 — Provider contains sensitive operational credentials and banking information

**Status:** CONFIRMED

**Evidence:** Provider stores Google access/refresh tokens, bank BSB/account information, ABN data, Stripe IDs, compliance flags, and payout information.

**Impact:** A broad Provider query can expose more information than a route needs. The model itself is not a security boundary; every select/include must be treated as sensitive.

**Priority:** HIGH

**Required Kiro verification:** Search all `provider.find*` queries and audit response serialization. Confirm that OAuth tokens and banking fields are never returned to client components or generic admin APIs without explicit need.

---

## DATA-M-02 — Customer notes and booking notes can contain unstructured personal information

**Status:** CONFIRMED RISK

**Evidence:** Customer and Booking include free-text `notes`, addresses, phone, email, pickup coordinates, and other operational information.

**Impact:** Free-text PII increases the risk of accidental disclosure through logs, AI prompts, exports, admin summaries, and email notifications.

**Priority:** MEDIUM

**Required Kiro verification:** Audit all AI/admin/export/email serialization of Customer and Booking objects.

---

## DATA-M-03 — Soft-deleted Booking records require a consistent visibility rule

**Status:** CONFIRMED RISK

**Evidence:** Booking has `deletedAt` and `deletedBy`, but the schema alone does not establish that all dashboard/public/admin queries consistently exclude soft-deleted records.

**Priority:** MEDIUM

**Required Kiro verification:** Search all Booking reads and define the canonical visibility filter by actor/context.

---

# 9. MEDIUM — admin/RBAC findings

## RBAC-M-01 — Admin RBAC is substantially implemented but endpoint coverage needs proof rather than assumption

**Status:** CONFIRMED / TEST GAP

**Evidence:** Admin routes such as ledger, pricing, voice lines, instructors, disputes, clients, audit log, settings, cron jobs, and subscription management use `requirePermission()`.

**Impact:** Centralized permission checks are good, but the risk is uneven coverage across the full `/api/admin/**` tree.

**Priority:** MEDIUM

**Required Kiro verification:** Enumerate every admin route and verify GET/POST/PUT/PATCH/DELETE each has the correct permission and object-level ownership constraints.

---

## RBAC-M-02 — Admin subscription sync selects a local subscription row separately from the Provider Stripe ID

**Status:** CONFIRMED RISK

**Evidence:** The admin sync action queries the latest active/trial/past-due Subscription row, while Stripe retrieval is driven by the Provider-level Stripe subscription ID.

**Impact:** If multiple local rows exist, Stripe data may be written into a row selected by recency rather than exact Stripe subscription identity.

**Priority:** HIGH

**Required Kiro verification:** Update sync to target the exact Subscription row by Stripe subscription ID, with explicit handling for missing rows.

---

# 10. MEDIUM — external integrations and side effects

## INT-M-01 — External side effects are mixed with DB state transitions

**Status:** CONFIRMED ARCHITECTURAL RISK

**Evidence:** Registration writes DB state and then sends emails; subscription admin actions call Stripe and then write DB; webhook handlers combine Stripe event processing with DB updates and downstream notifications.

**Impact:** Network failure after DB commit or DB failure after external success can create one-sided state.

**Priority:** HIGH

**Required Kiro verification:** Identify all Stripe/email/SMS/calendar side effects and define retry/idempotency/reconciliation semantics. Do not assume a DB transaction can roll back an external API call.

---

## INT-M-02 — Email sending failures are intentionally non-fatal in registration

**Status:** CONFIRMED

**Evidence:** Registration catches welcome/admin notification email errors and continues successfully.

**Impact:** A user can be created without receiving the verification email or an admin alert. This may be acceptable, but there must be a resend/retry mechanism.

**Priority:** MEDIUM

**Required Kiro verification:** Confirm verification-email resend and admin operational visibility for failed notifications.

---

## INT-M-03 — Google Calendar OAuth tokens are stored directly on Provider

**Status:** CONFIRMED

**Evidence:** Provider includes `googleAccessToken`, `googleRefreshToken`, and expiry fields.

**Impact:** Compromise of a broad Provider query becomes equivalent to compromise of external calendar access.

**Priority:** HIGH

**Required Kiro verification:** Audit encryption-at-rest assumptions, select projections, logging, admin visibility, token refresh/revocation, and whether tokens are ever serialized to the client.

---

# 11. MEDIUM — AI/admin copilot

## AI-M-01 — AI admin architecture correctly specifies read-only tools, but data minimization must be verified in implementation

**Status:** TEST GAP / VERIFY

**Evidence:** `.kiro/steering/ai-admin-copilot.md` requires server-side whitelisted read-only functions and sanitised JSON, and documents implemented daily brief/health/risk/report features.

**Priority:** MEDIUM

**Required Kiro verification:** Audit actual `lib/admin/ai-tools.ts`, AI query route, daily brief route, prompts, tool return objects, logging, and cache contents. Confirm no credentials, OAuth tokens, banking data, or unnecessary PII enter LLM prompts.

---

## AI-M-02 — AI output must never become an authorization or financial decision source

**Status:** ARCHITECTURAL REQUIREMENT

**Evidence:** Steering describes AI as an interpretation layer over existing admin data.

**Priority:** HIGH if violated.

**Required Kiro verification:** Confirm all AI paths are read-only and recommendations cannot directly mutate payments, subscriptions, bookings, payouts, permissions, or provider status.

---

# 12. MEDIUM — vertical architecture

## VERT-M-01 — Generic platform and driving-specific code coexist and require strict business-type guards

**Status:** CONFIRMED ARCHITECTURAL RISK

**Evidence:** Steering defines Provider as generic and DrivingProviderProfile as the driving extension. Registration currently supports driving, plumber, electrician, beauty, and tax templates.

**Impact:** Shared components/routes can accidentally assume instructor/student/lesson terminology or driving compliance fields for other verticals.

**Priority:** MEDIUM

**Required Kiro verification:** Search shared components, API routes, emails, analytics, and dashboard code for unguarded driving assumptions.

---

## VERT-M-02 — `businessModel` is derived from business type at registration, but schema defaults to SAAS

**Status:** CONFIRMED DESIGN RISK

**Evidence:** Provider schema defaults `businessModel` to `SAAS`; registration explicitly sets driving to `MARKETPLACE`. Provider schema defaults `paymentMode` to `PLATFORM`, while registration explicitly sets non-driving to `DIRECT`.

**Impact:** Different creation paths can produce different architecture semantics for otherwise equivalent Provider records.

**Priority:** MEDIUM

**Required Kiro verification:** Inventory every Provider creation path and ensure required model dimensions are always explicitly assigned.

---

# 13. MEDIUM — documentation and code drift

## DOC-M-01 — Platform steering and code currently disagree about non-driving payment mode

**Status:** CONFIRMED

**Evidence:** See APP-H-06. Steering says DIRECT is Phase 2/not implemented; registration persists DIRECT for non-driving.

**Priority:** HIGH because this is executable architecture drift, not merely prose drift.

---

## DOC-M-02 — Existing subscription documentation and implementation artifacts contain legacy BUSINESS terminology

**Status:** CONFIRMED

**Evidence:** Steering defines PREMIUM as the live solo-provider tier and BUSINESS as future multi-provider, while existing docs/UI compatibility code still contain BUSINESS references.

**Priority:** MEDIUM

**Required Kiro verification:** Distinguish legitimate accountType/business-model uses from obsolete subscription-tier uses before changing anything. Do not blanket-replace `BUSINESS`.

---

## DOC-M-03 — Living DOCROLEBASE documentation must be reconciled after fixes

**Status:** CONFIRMED PROCESS REQUIREMENT

**Evidence:** `.kiro/steering/doc-sync.md` requires every code change to be followed by a living-doc update in the same session.

**Priority:** MEDIUM

**Required Kiro action:** After implementation, update the relevant living docs rather than treating this audit file as the permanent system description.

---

# 14. TESTING and verification gaps

## TEST-H-01 — End-to-end state-transition tests are insufficiently demonstrated

**Status:** TEST GAP

The repository has Vitest and targeted tests, but source inspection does not establish complete concurrency coverage for:

- checkout.completed vs subscription.created vs subscription.updated
- duplicate webhook delivery
- out-of-order webhook delivery
- trial expiry vs paid conversion
- concurrent checkout requests
- duplicate Stripe customer creation
- cancellation vs renewal/payment
- refund vs booking expiry
- payout creation vs duplicate processing
- wallet debit vs concurrent top-up
- booking slot reservation races

**Priority:** HIGH

---

## TEST-H-02 — Security tests should be endpoint-matrix driven

**Status:** TEST GAP

Required matrix dimensions:

- anonymous / authenticated / wrong role
- correct provider / different provider
- pending / approved / suspended / rejected
- active trial / expired trial / active paid / past due / cancelled
- driving / non-driving
- admin permission present / absent
- stale JWT / current DB role
- valid / expired / reused bearer token

**Priority:** HIGH

---

## TEST-M-01 — Build/lint/type-check success is not equivalent to behavioural correctness

**Status:** CONFIRMED ENGINEERING PRINCIPLE

`package.json` exposes `build`, `lint`, and Vitest, but the audit standard must require behavioural tests for money, authorization, state transitions, and external integrations.

**Priority:** MEDIUM

---

# 15. Canonical audit workstreams for Kiro

Kiro should not implement these findings in arbitrary order. Compare each item against the local working tree first and classify it as:

`CONFIRMED` / `ALREADY FIXED` / `NOT APPLICABLE` / `INTENTIONAL DESIGN` / `NEEDS TEST` / `FALSE POSITIVE`.

Then use these workstreams:

### Workstream A — Security boundary

1. APP-H-01 custom-domain host validation.
2. APP-H-02 maintenance bypass.
3. APP-H-03 entitlement fail-open.
4. APP-H-04 role catalogue.
5. APP-H-05 authorization matrix.
6. DATA-M-01 sensitive Provider projections.
7. INT-M-03 Google OAuth token protection.

### Workstream B — Subscription state machine

1. SUB-H-01 checkout fallback.
2. SUB-H-02 webhook claim race.
3. SUB-H-03 duplicate state.
4. SUB-H-04 uniqueness constraint.
5. SUB-H-05 period semantics.
6. SUB-H-06 billing cycle.
7. SUB-H-07 trial expiry race.
8. SUB-H-08 instructor cancellation.
9. SUB-H-09 admin override semantics.
10. SUB-H-10 recovery/discovery.
11. SUB-H-11 customer correlation.
12. SUB-H-12 legacy checkout reachability.
13. SUB-H-13 Stripe API version.

### Workstream C — Financial state machine

1. PAY-H-01 ledger model.
2. PAY-H-02 booking/payment invariants.
3. PAY-H-03 payment token security.
4. PAY-H-04 slot reservation concurrency.
5. PAY-H-05 payment-route consolidation.
6. PAY-H-06 webhook state ordering.
7. INT-M-01 external side-effect recovery.

### Workstream D — Account/vertical architecture

1. APP-H-06 unsupported DIRECT mode.
2. APP-H-07 business template repair.
3. APP-H-08 trial semantics.
4. VERT-M-01 business-type guards.
5. VERT-M-02 Provider creation invariants.
6. DOC-M-02 BUSINESS/PREMIUM terminology.

### Workstream E — Authentication/RBAC

1. AUTH-M-01 stale JWT usage.
2. AUTH-M-02 auth abuse controls.
3. RBAC-M-01 endpoint permission coverage.
4. RBAC-M-02 admin sync row targeting.
5. TEST-H-02 authorization matrix.

### Workstream F — AI/data privacy

1. AI-M-01 actual prompt/tool data audit.
2. AI-M-02 authorization/financial isolation.
3. DATA-M-02 free-text PII propagation.

---

# 16. Definition of production-ready for this audit

Do not declare the application production-ready merely because TypeScript compiles or individual fixes pass.

The minimum evidence should include:

- One canonical subscription state-transition model.
- Deterministic Stripe ↔ local correlation.
- Database uniqueness constraints for externally unique identifiers.
- Concurrency tests for subscription and booking races.
- No broad fallback mutation of historical subscription rows.
- Explicit cancellation semantics and Stripe convergence.
- Explicit trial expiry semantics and conversion race protection.
- One canonical customer/checkout path or formally reconciled legacy paths.
- One supported Stripe API version.
- No fail-open authorization/entitlement path that grants write access on DB errors.
- Complete admin permission coverage.
- Complete object ownership checks on user/provider/customer resources.
- Sensitive Provider fields excluded from client/API responses by default.
- OAuth credentials protected and never sent to AI/client surfaces.
- Custom-domain and maintenance-mode trust boundaries hardened.
- Payment/booking/wallet/ledger invariants tested.
- Living DOCROLEBASE documentation reconciled with actual code after implementation.

---

# 17. Relationship to the subscription audit

The earlier subscription-specific audit remains useful as a focused lifecycle document, but this whole-app audit changes the implementation context: subscription correctness cannot be solved independently of authentication, Provider identity, payment state, booking state, admin overrides, Stripe customer correlation, and external side effects.

Kiro should therefore use this document as the **system-level baseline**, then use the subscription audit as the detailed subscription workstream reference.

**Important:** This document records findings and verification requirements. It is not an implementation specification and does not imply that every finding is confirmed in Kiro's local working tree. Kiro must independently compare and test before changing production code.

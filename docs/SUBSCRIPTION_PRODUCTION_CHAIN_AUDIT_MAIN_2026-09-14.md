# DriveBook Subscription Production Chain Audit — Current `main`

**Audit date:** 2026-09-14  
**Repository:** `birhane457-create/drivebook`  
**Branch:** `main`  
**Audited baseline commit:** `0a8243c16b6df8769abdaa652e5d298c37777a3b`  
**Scope:** Complete subscription lifecycle, not only Area 6/F-13  
**Implementation:** No production code changes made by this audit

## 1. Purpose

This document is a source-code-first audit of the subscription production chain on the current GitHub `main` branch. It is intended for Kiro/local-tree review and implementation planning.

This is an audit, not an implementation approval. Kiro must compare each finding with its local working tree and existing tests before changing production code.

## 2. Executive conclusion

**Production billing status: NOT YET PROVEN READY.**

The current `main` contains meaningful security improvements: Stripe signature verification, webhook event idempotency, SERIALIZABLE transaction handling/retry infrastructure, Stripe customer correlation in the newer instructor flow, and live Stripe sync facilities. However, the complete subscription chain still contains material consistency and race-condition risks.

The most important confirmed findings are:

1. **F-13 remains incomplete:** `customer.subscription.created/updated` still has a trial-linking path that must be proven atomic; the checkout path also contains a broad `providerId` fallback update.
2. **Instructor cancellation is DB-only in the web and mobile DELETE routes:** those routes set local cancellation state but do not cancel the Stripe subscription.
3. **Trial expiry can race with Stripe conversion:** cron selects expired `TRIAL` rows before changing them, so a conversion can race with expiry unless the final transition is conditional.
4. **A legacy `/api/subscriptions/checkout` path remains materially different from the newer instructor subscription flow.** It uses `customer_email`, its own trial logic, and can create Stripe subscriptions without creating the corresponding local `Subscription` row first.
5. **Provider and Subscription duplicate subscription state:** tier/status/trial timing are represented in both models and are updated in multiple places without a single authoritative state-transition service.
6. **Trial creation is not atomic across Subscription + Provider** in the web and mobile routes.
7. **Mobile subscription implementation materially diverges from web:** it is `@ts-nocheck`, uses a separate JWT path, does not copy Stripe customer correlation into newly created local subscriptions, and does not cancel Stripe.
8. **Billing portal trial path forces monthly billing**, even though the normal subscription API supports monthly/annual billing. This needs an explicit product decision/test.
9. **Stripe API versions are inconsistent:** subscription routes use `2026-01-28.clover`, while the unified webhook/admin routes use `2026-02-25.clover`.
10. **Subscription entitlement middleware fails open on DB errors**, returning full access. This is an explicit security/product-policy decision that should not remain accidental.
11. **Administrative overrides can intentionally create DB/Stripe drift.** The behaviour needs to be documented as an entitlement override or constrained.
12. **The database does not currently enforce uniqueness of `stripeSubscriptionId`;** the F-13 guide proposes it, but the current schema does not show that constraint.

## 3. State representation

### 3.1 Provider and Subscription duplicate state — P1 — CONFIRMED CURRENT

`Provider` stores `subscriptionTier`, `subscriptionStatus`, and `trialEndsAt`. `Subscription` separately stores tier, status, trial/period fields, cancellation fields, and Stripe identifiers. The current instructor GET reads Provider state for the headline status and separately selects the newest active/trial Subscription row.

This is not automatically wrong, but it creates an invariant problem: every write path must keep both representations consistent. The current code performs separate writes in multiple routes.

**Required decision for Kiro:** define the authoritative subscription state and invariants before broad refactoring. Do not blindly remove fields because existing UI/access-control code depends on Provider state.

## 4. Trial creation and changes

### 4.1 Web trial creation — P1 — CONFIRMED CURRENT

`POST /api/instructor/subscription` checks for an existing active/trial row, then creates/updates the `Subscription` and subsequently updates `Provider` in separate database operations. The first-trial path copies `Provider.stripeCustomerId` into the new Subscription, which is correct for F-13 correlation, but the two model writes are not one transaction.

Concurrent first-trial requests can both pass `findFirst()` and attempt creation. There is no demonstrated database invariant preventing multiple active/trial rows per provider.

### 4.2 Trial tier changes — P1 — PARTIALLY CORRECT

The web route intentionally preserves the original `trialEndsAt`, which is correct for a single trial window. However, it recalculates `currentPeriodEnd` as now + 30 days while changing tier. That field's semantic meaning must be verified against the paid billing period; it should not silently represent a new trial window.

### 4.3 Mobile trial creation — P1 — CONFIRMED CURRENT

`POST /api/instructor/subscription/mobile` duplicates the web logic, does not copy `stripeCustomerId` into a newly created Subscription, and also performs Subscription and Provider writes separately.

## 5. Stripe customer and checkout creation

### 5.1 Customer creation race — P1 — CONFIRMED RISK

The newer web and billing-portal routes reuse `Provider.stripeCustomerId` when present. When absent, they use check-then-create logic: create a Stripe Customer, then persist the ID. Two concurrent requests can theoretically create two Stripe Customers before either request persists the ID.

**Required test:** concurrent checkout/portal requests for a provider with no Stripe customer ID.

### 5.2 New instructor subscription checkout — PASS WITH RISKS

The newer instructor route uses a Stripe customer ID rather than `customer_email`, and passes `providerId`, tier and billing cycle in metadata. This is the correct direction.

The remaining customer-creation race and F-13 webhook claim race still need resolution/testing.

### 5.3 Legacy `/api/subscriptions/checkout` — P0/P1 — CONFIRMED CURRENT

`POST /api/subscriptions/checkout` remains present. It has materially different semantics:

- uses `customer_email` rather than the stored Stripe customer;
- determines whether the user has had a trial by looking for any Subscription row;
- can create a Stripe subscription without first creating the local Subscription row;
- has its own no-Stripe fallback that only updates Provider;
- is documented in API references alongside the newer subscription API.

This route must be classified as active/legacy/dead. If active, it must follow the same subscription state machine and correlation rules. If dead, remove/deprecate it safely and update documentation.

## 6. F-13 trial-row claim / webhook ordering

### 6.1 `checkout.session.completed` — P1 — PARTIALLY FIXED

The current checkout handler contains an atomic conditional `updateMany` path using provider/customer correlation and `stripeSubscriptionId: null`, which is the correct concurrency primitive.

However, the current handler also contains a broad fallback update by `providerId`. That fallback can associate the wrong Subscription row when more than one row exists or when the intended row is not the one represented by the event.

**Do not use:** broad `updateMany({ where: { providerId } })` for Stripe subscription ownership.

### 6.2 `customer.subscription.created/updated` — P0/P1 — CONFIRMED NEEDS COMPLETION

`handleSubscriptionUpdate()` still contains the trial-linking path that searches for an existing row and then updates it. Event idempotency protects duplicate delivery of the same Stripe event, but it does not make two different valid events atomic with respect to the same trial row.

The intended invariant is an atomic conditional claim using authoritative `providerId + stripeCustomerId + stripeSubscriptionId IS NULL` and an appropriate active/trial status condition. The loser of a concurrent claim should re-read and accept a consistent already-linked row rather than overwrite it.

### 6.3 Event ordering — P1 — NEEDS TEST

The following valid sequences must be tested, including concurrent delivery:

- checkout.session.completed → subscription.created → subscription.updated
- subscription.created → checkout.session.completed → subscription.updated
- subscription.updated → checkout.session.completed
- subscription.created and checkout.session.completed concurrently
- repeated delivery of each individual event

Webhook event-id idempotency does not solve ordering between different event IDs.

## 7. Webhook infrastructure

### 7.1 Signature verification — PASS

The unified webhook verifies the Stripe signature before processing. Missing webhook secret is rejected rather than processed.

### 7.2 Event idempotency — PASS WITH TEST REQUIREMENT

The current webhook moved the idempotency claim inside transactional processing and maps duplicate unique-key races to a duplicate-event result. This is materially stronger than a pre-check.

Existing Area 6 tests reportedly cover this infrastructure, but full subscription lifecycle tests are still required.

### 7.3 Serializable transactions — PASS WITH SCOPE LIMIT

The webhook has SERIALIZABLE transaction configuration and retry infrastructure. This reduces database race failures but does not automatically make non-transactional Stripe API calls or separate routes safe.

## 8. Billing Portal

### 8.1 Active subscription — P1 — NEEDS OWNERSHIP VALIDATION

The portal route selects the newest local active/trial/past-due row and uses its Stripe subscription ID. If duplicate local rows exist, the selected row may not represent the Stripe customer/subscription the instructor actually owns.

### 8.2 Trial → Stripe subscription — P1 — CONFIRMED SEMANTIC GAP

For a trial with no Stripe subscription, the route creates Checkout using the selected target tier but explicitly calls `getStripePriceId(tier, 'monthly')`. There is no annual billing-cycle input in this path.

It also calculates remaining trial days from Provider.trialEndsAt and sends that to Stripe. This requires a precise decision about whether Stripe's trial end and the local trial end must be identical to the second, or whether day-level rounding is acceptable.

### 8.3 Stripe customer race — P1

Same check-then-create race described in §5.1 exists here.

## 9. Post-portal synchronization

### 9.1 Sync route — P1 — CONFIRMED CURRENT RISK

`POST /api/instructor/subscription/sync` selects the newest local active/trial/past-due row, retrieves Stripe using that row's Stripe subscription ID, then updates Provider and Subscription transactionally.

The transaction is good, but discovery is local-row dependent. If the local Stripe ID is missing/wrong or duplicate rows exist, sync cannot discover the correct Stripe subscription from the customer itself.

Kiro should define whether this is intentionally a safety-net only or whether sync must reconcile by `Provider.stripeCustomerId` when the local link is missing.

## 10. Cancellation

### 10.1 Web instructor DELETE — P0/P1 — CONFIRMED CURRENT

`DELETE /api/instructor/subscription` marks the local Subscription `cancelAtPeriodEnd=true` and writes `cancelledAt`, but the route shown on current `main` does not call Stripe.

This creates DB/Stripe drift for active paid subscriptions if the endpoint is reachable from production UI.

Kiro must verify whether the UI uses Stripe Billing Portal instead and whether this endpoint is active or legacy. Do not assume it is unused.

### 10.2 Mobile DELETE — P0/P1 — CONFIRMED CURRENT

The mobile DELETE route likewise only changes the local Subscription and does not call Stripe.

### 10.3 Admin cancellation — BETTER / PARTIAL PARITY

Admin cancellation does call Stripe `cancel_at_period_end=true` when a Stripe subscription exists, and immediate cancellation calls Stripe cancellation. The no-Stripe path is DB-only by design.

### 10.4 Cancellation timestamp semantics — P2

`cancelledAt` is written when cancellation is requested while the subscription remains active until period end. The field therefore appears to mean cancellation-request time, not actual cancellation/end time. This needs explicit documentation or a better field name.

## 11. Trial expiry

### 11.1 Expiry cron — P0/P1 — CONFIRMED RACE RISK

`check-trial-expiry` first finds rows where `status='TRIAL'` and `trialEndsAt < now`, then processes them. A Stripe conversion can occur after selection but before the expiry update.

The expiry transition must be conditional on the row still being `TRIAL`, and concurrency must be tested against the webhook conversion path.

### 11.2 Deterministic race rule — REQUIRED

Define one explicit rule:

- if a valid paid Stripe subscription has already been created/linked, conversion to ACTIVE wins;
- expiry must not overwrite an already ACTIVE/paid row;
- if no valid Stripe subscription exists, expiry wins.

This must be represented by conditional database transitions and tests, not only application-level timing assumptions.

## 12. Subscription entitlement enforcement

### 12.1 Middleware — P1 — CONFIRMED CURRENT

`lib/middleware/subscriptionValidation.ts` correctly treats active subscriptions and unexpired trials as full access and expired/cancelled/past-due states as read-only.

The implementation is used by multiple mutation routes, including bookings, clients, profile and settings.

### 12.2 DB error fail-open — P1 — CONFIRMED CURRENT

On any database error, `checkSubscriptionAccess()` returns `{ valid: true, readOnly: false }`.

That means a transient database failure can grant full instructor entitlement instead of denying protected mutations. This is a fail-open authorization decision.

Kiro must make an explicit product/security decision. For protected paid capabilities, fail-closed is generally safer; if fail-open is retained, it must be documented and bounded.

### 12.3 Route coverage — P1 — NEEDS COMPLETE INVENTORY

Current search confirms subscription enforcement in several mutation routes, but the complete set of instructor mutation endpoints must be inventoried. A middleware helper existing in the codebase does not prove complete enforcement.

## 13. Mobile/web parity

**P1 — CONFIRMED CURRENT.**

Mobile subscription handling is a separate implementation with `// @ts-nocheck`, JWT authentication, duplicated trial logic, no Stripe customer correlation on new local Subscription rows, local-only cancellation, and no demonstrated Stripe checkout/payment-management parity.

This is not merely code duplication; it creates different subscription semantics depending on client.

Kiro should either unify both clients behind a shared subscription service or formally document the intentional differences.

## 14. Database invariants

### 14.1 Stripe subscription uniqueness — P1 — NOT ENFORCED IN CURRENT SCHEMA

The current schema contains nullable `stripeSubscriptionId` but the audit search did not find an implemented unique constraint/index for it. The F-13 implementation guide proposes adding one after cleanup.

Recommended invariant: one local Subscription row per Stripe subscription ID.

Before adding a unique constraint, audit existing rows for duplicates and decide how to repair them.

### 14.2 Provider active/trial uniqueness — P1 — NOT PROVEN

The application uses `findFirst()` for the current active/trial subscription in multiple routes. There is no demonstrated database invariant guaranteeing at most one active/trial Subscription per Provider.

This is the root of several selection and race risks.

## 15. Admin operations

### 15.1 Force sync — P1

Admin sync relies on the Provider's stored Stripe subscription ID. It cannot discover a missing ID automatically.

### 15.2 Manual Stripe linking — P0/P1 — HIGH IMPACT

The admin route supports manually linking a Stripe subscription ID. This is an intentionally powerful recovery operation, but it must verify at minimum:

- Stripe subscription exists;
- Stripe customer belongs to the expected provider/customer;
- no other local row already owns the Stripe subscription;
- target local row belongs to the same provider;
- tier/status/customer mismatches are surfaced rather than silently overwritten.

### 15.3 Override tier — P1

Admin can change local tier/status without necessarily changing Stripe. This can be valid as an entitlement override, but the system must clearly distinguish an override from Stripe billing state and expose drift intentionally.

## 16. Pricing and billing configuration

### 16.1 Current tiers — PASS

Current application configuration uses `BASIC`, `PRO`, `STUDIO`, `PREMIUM`.

### 16.2 BUSINESS references — P1 — DOCUMENTATION/UI CLEANUP

Current steering documentation says BUSINESS does not exist in `SUBSCRIPTION_PLANS`, while current documentation and UI still contain legacy BUSINESS/Coming Soon references. The dashboard also contains legacy BUSINESS-to-PREMIUM display handling.

This should be reconciled so live billing, UI, documentation and database terminology have one authoritative vocabulary.

### 16.3 Billing cycle parity — P1

The main instructor POST supports monthly/annual billing, but the trial Billing Portal checkout path currently chooses monthly. This must be confirmed as intentional or corrected by Kiro.

## 17. Stripe API version consistency

**P1 — CONFIRMED CURRENT.**

Current code uses `2026-01-28.clover` in instructor subscription/billing-portal/sync and `2026-02-25.clover` in the unified webhook/admin subscription code.

Standardize where practical or document why different versions are required. Test webhook object compatibility before changing the version globally.

## 18. Email and side effects

Subscription webhooks coexist with booking payments, wallet credits, refunds, disputes and transfers in the unified webhook. Event-id idempotency prevents duplicate processing of the same event but does not automatically make different valid event types email-idempotent.

Kiro should inventory subscription emails and tie them to explicit state transitions, especially conversion, payment failure, recovery, cancellation and trial-ending notifications.

## 19. Required lifecycle test matrix

Before production sign-off, test at minimum:

### Trial
- first trial creation
- concurrent first-trial creation
- tier change during trial
- trial expiry
- trial renewal/resubscribe policy
- Provider/Subscription consistency

### Conversion
- checkout.completed first
- subscription.created first
- subscription.updated first
- concurrent checkout + subscription event
- duplicate event delivery
- already-linked subscription
- wrong provider metadata
- wrong Stripe customer
- multiple local rows

### Billing
- monthly
- annual
- trial remaining days
- upgrade
- downgrade
- proration
- payment method update
- invoice success
- invoice failure
- recovery

### Cancellation
- trial cancellation
- paid cancellation at period end
- immediate admin cancellation
- cancellation webhook
- cancellation followed by recovery/resubscribe
- local endpoint vs Billing Portal parity

### Expiry
- cron alone
- webhook alone
- concurrent cron + webhook
- expired local row with paid Stripe subscription
- already ACTIVE row selected by expiry query

### Security
- invalid webhook signature
- missing webhook secret
- duplicate webhook delivery
- DB serialization conflict
- Stripe customer mismatch
- Stripe subscription mismatch
- admin cross-provider link attempt
- unauthorized mobile JWT
- subscription DB failure during protected mutation

## 20. Priority register

| ID | Finding | Priority | Current classification |
|---|---|---:|---|
| SUB-04-A | Trial row claim not atomic in all webhook paths | P0/P1 | CONFIRMED / INCOMPLETE F-13 |
| SUB-04-B | Broad provider-only checkout fallback | P0/P1 | CONFIRMED |
| SUB-09-A | Instructor cancellation does not call Stripe | P0/P1 | CONFIRMED; verify active/legacy |
| SUB-12-A | Trial expiry/conversion race | P0/P1 | CONFIRMED RISK |
| SUB-17-A | Legacy checkout path | P0/P1 | CONFIRMED CURRENT |
| SUB-01-A | Provider + Subscription duplicate state | P1 | CONFIRMED ARCHITECTURAL RISK |
| SUB-02-A | Trial creation not atomic | P1 | CONFIRMED |
| SUB-07-A | Local/Stripe trial timing | P1 | CONFIRMED NEEDS DECISION/TEST |
| SUB-08-A | Sync depends on selected local row | P1 | CONFIRMED |
| SUB-11-A | Admin sync cannot discover missing Stripe sub | P1 | CONFIRMED |
| SUB-13-A | DB error fails open | P1 | CONFIRMED |
| SUB-16-A | Mobile/web divergence | P1 | CONFIRMED |
| SUB-18-A | BUSINESS/PREMIUM references | P1 | CONFIRMED |
| SUB-19-A | Stripe API version drift | P1 | CONFIRMED |
| SUB-21-A | Cross-event email idempotency not proven | P1 | NEEDS TEST/DESIGN |
| SUB-23-A | Stripe customer creation race | P1 | CONFIRMED RISK |
| SUB-27-A | Admin override can create billing drift | P1 | CONFIRMED DESIGN RISK |
| SUB-28-A | `stripeSubscriptionId` uniqueness not enforced | P1 | CONFIRMED |
| SUB-29-A | Active/trial uniqueness per provider not enforced | P1 | NOT PROVEN |
| SUB-25-A | `cancelledAt` semantic ambiguity | P2 | CONFIRMED |
| SUB-26-A | Billing-cycle parity | P1 | CONFIRMED GAP |

## 21. What is already strong

The audit does **not** conclude that the subscription system is broadly insecure. Current `main` has several solid controls:

- cryptographic Stripe webhook verification;
- fail-closed rejection when webhook secret is absent;
- atomic webhook event idempotency design;
- SERIALIZABLE transaction configuration and retry support;
- Stripe customer correlation in the newer web checkout flow;
- Stripe subscription metadata containing provider correlation;
- transactional post-portal DB synchronization;
- admin permission gating for subscription management;
- explicit read-only treatment for inactive subscription states;
- current live tiers aligned to `BASIC/PRO/STUDIO/PREMIUM` in the main configuration.

These controls reduce risk but do not resolve lifecycle state races or architectural duplication by themselves.

## 22. Kiro handoff protocol

Kiro should process this document in this order:

1. Compare every finding with the local working tree.
2. Mark each item `CONFIRMED`, `ALREADY FIXED`, `NOT APPLICABLE / LEGACY`, `INTENTIONAL DESIGN`, `NEEDS TEST`, or `FALSE POSITIVE`.
3. Produce a disagreement report for any difference between this GitHub baseline and the local tree.
4. Inspect existing tests before writing new implementation code.
5. Build the actual route/event/state-transition matrix.
6. Decide the minimum safe fixes for confirmed P0/P1 findings.
7. Implement changes only after that comparison.
8. Run regression and concurrency tests.
9. Re-audit the resulting code before production sign-off.

**Do not treat this audit as permission to implement every recommendation automatically.**

## 23. Final audit decision

**Current `main`: CONDITIONAL / NOT READY FOR LIVE SUBSCRIPTION BILLING WITHOUT FURTHER VERIFICATION.**

The immediate technical focus should be F-13 completion, trial-expiry/conversion race handling, cancellation/Stripe synchronization verification, legacy checkout reachability, and the subscription database invariants. The broader architectural findings should then be resolved or explicitly accepted with documented risk.

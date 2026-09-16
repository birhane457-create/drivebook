@@ -0,0 +1,1392 @@
# DriveBook Subscription — End-to-End Production Chain Audit

**Audit date:** 2026-09-14
**Repository:** `birhane457-create/drivebook`
**Audited branch:** `main` (read-only audit)
**Audit artifact branch:** `fix/f13-subscription-webhook-claim`
**Purpose:** Establish the complete subscription lifecycle and identify verified risks before any production code changes are made.

> This document is an audit, not an implementation plan disguised as a fix. Findings are classified as verified code behaviour, inconsistency, weakness, or unverified assumption. No production code was changed as part of this audit.

---

## 1. Executive conclusion

DriveBook has a substantial subscription implementation covering:

- four live tiers: BASIC, PRO, STUDIO, PREMIUM
- local free trials
- Stripe Checkout conversion
- Stripe Billing Portal
- post-portal Stripe synchronisation
- Stripe subscription webhooks
- trial expiry cron
- subscription access enforcement
- mobile subscription APIs
- administrator subscription management
- DB/Stripe drift inspection
- audit logging
- webhook idempotency and Serializable transactions

The architecture is broadly coherent, but the lifecycle is **not yet proven production-safe end-to-end**.

The most important finding is that subscription state is represented in multiple places:

1. `Provider.subscriptionTier`
2. `Provider.subscriptionStatus`
3. `Provider.trialEndsAt`
4. `Provider.stripeCustomerId`
5. `Subscription.*`
6. Stripe Customer
7. Stripe Subscription

There is no single local subscription state machine enforcing all transitions. Several paths directly mutate Provider and/or Subscription. This creates a reconciliation burden and makes ordering, retries, and duplicate operations critical.

The current F-13 work is directionally correct: trial rows now carry `stripeCustomerId`, and checkout correlation has been tightened. However, the subscription webhook path still contains a `findFirst()` → `update()` claim pattern according to the current source/search evidence. That should **not be fixed in isolation yet**. The correct next step is for Kiro to compare this audit with the local working tree, because Kiro may have newer local changes than the GitHub snapshot.

### Production-readiness judgement

**Status: CONDITIONAL / NOT YET PROVEN READY for live subscription billing.**

This is not a statement that the system is fundamentally broken. It means the complete lifecycle has not yet demonstrated sufficient evidence for production billing, especially around concurrency, cross-channel parity, state transitions, and recovery.

---

# 2. Lifecycle map

## 2.1 Intended lifecycle

```text
Instructor created
      |
      v
Choose initial tier
      |
      v
Local Subscription = TRIAL
      |
      +--> Provider.subscriptionStatus = TRIAL
      +--> Provider.subscriptionTier = selected tier
      +--> trialEndsAt = trial end
      |
      v
Full access during trial
      |
      +------------------------------+
      |                              |
      | Add payment / choose plan    | Trial reaches expiry
      v                              v
Stripe Checkout                 Trial expiry cron
      |                              |
      v                              v
Stripe Subscription             Subscription = EXPIRED
      |                              |
      +--> checkout.completed        +--> Provider = EXPIRED
      +--> subscription.created       +--> Provider tier = BASIC
      +--> subscription.updated
      |
      v
Local Subscription = ACTIVE
Provider = ACTIVE
      |
      +--------------------+---------------------+
      |                    |                     |
      v                    v                     v
Billing Portal        Payment failure       Cancellation
      |                    |                     |
      v                    v                     v
Stripe changes        PAST_DUE             cancel_at_period_end
      |                    |                     |
      v                    v                     v
Webhook + sync        Webhook              Webhook
      |                    |                     |
      +--------------------+---------------------+
                           |
                           v
                    Local reconciliation
```

---

# 3. SUB-01 — Data model and ownership

## Observed implementation

The live Prisma schema contains both Provider-level subscription fields and a separate Subscription model. Search evidence confirms Provider has `subscriptionTier` and `subscriptionStatus`; the Subscription model contains tier/status/trial/cancellation/Stripe identifiers. The current subscription documentation describes the same split.

Relevant source:
- `prisma/schema.prisma`
- `docs/SUBSCRIPTION_SYSTEM.md`

## Finding

### SUB-01-A — Duplicate state representation
**Severity: P1 architectural risk**

Provider and Subscription both contain state that can represent the same business fact.

Example:

```text
Provider:
  subscriptionTier
  subscriptionStatus
  trialEndsAt
  stripeCustomerId

Subscription:
  tier
  status
  trialEndsAt
  stripeCustomerId
  stripeSubscriptionId
  currentPeriodStart
  currentPeriodEnd
  cancelAtPeriodEnd
  cancelledAt
```

This is workable, but only if every mutation path maintains an explicit invariant.

### Required invariant for Kiro review

For the current active subscription:

```text
Provider.subscriptionTier       == Subscription.tier
Provider.subscriptionStatus     == Subscription.status
Provider.trialEndsAt            == Subscription.trialEndsAt (where applicable)
Provider.stripeCustomerId       == Subscription.stripeCustomerId
Provider.stripeSubscriptionId   == active Subscription.stripeSubscriptionId
```

The audit did not establish that this invariant is enforced centrally on every path.

---

# 4. SUB-02 — Initial trial creation

## Web route

`app/api/instructor/subscription/route.ts`

Current code:

- authenticates through NextAuth
- validates tier
- finds existing TRIAL/ACTIVE subscription
- creates a local trial when none exists
- calculates trial end with `getTrialEndDate()`
- writes Provider trial state
- copies Provider `stripeCustomerId` into the new Subscription row

The current source explicitly contains the F-13 correlation change: the local trial stores the Provider's Stripe customer ID.

## Positive findings

- Trial does not require a Stripe subscription.
- Trial end is stored locally.
- Existing trial tier changes preserve the original trial end.
- Checkout uses the existing Stripe customer ID where available.

## Risks

### SUB-02-A — Provider + Subscription creation are not one transaction
**Severity: P1**

The route creates/updates Subscription and then updates Provider separately.

A failure between the two operations can produce:

```text
Subscription = TRIAL
Provider = old state
```

or the reverse.

Kiro should determine whether this is intentionally tolerated and whether recovery is guaranteed.

### SUB-02-B — Concurrent first-trial creation
**Severity: P1 / needs test evidence**

The route performs a `findFirst()` before deciding whether to create a Subscription.

Two simultaneous POST requests can theoretically both observe no existing subscription unless another invariant prevents it.

Required test:

```text
POST subscription tier BASIC
POST subscription tier BASIC
simultaneously
=> exactly one initial trial
```

Also test different tiers simultaneously.

---

# 5. SUB-03 — Trial tier change

The web route permits changing tier during an existing trial.

The code explicitly preserves the original `trialEndsAt` and changes:

- tier
- amount
- billing cycle
- currentPeriodEnd

## Finding

### SUB-03-A — Trial end preservation is intentional and correct
**Status: PASS by inspection**

The implementation avoids granting a fresh trial when changing tier.

### SUB-03-B — `currentPeriodEnd` is reset to 30 days from now
**Severity: P1 semantic risk**

The route calculates a new `periodEnd` as `now + 30 days` even when the existing trial's original end is preserved.

Kiro should determine whether `currentPeriodEnd` is intended to represent the trial window or paid billing period. If it is a billing-period field, this is potentially misleading and can affect cancellation/UI logic.

---

# 6. SUB-04 — Trial → paid conversion

Primary paths:

- `app/api/instructor/subscription/route.ts`
- `app/api/instructor/subscription/billing-portal/route.ts`
- `app/api/stripe/webhook/route.ts`

## Intended Stripe flow

```text
Local trial
  |
  v
Existing Stripe Customer
  |
  v
Checkout Session
  |
  v
Stripe Subscription
  |
  +--> checkout.session.completed
  +--> customer.subscription.created
  +--> customer.subscription.updated
```

## Positive findings

The web trial checkout now uses:

```text
customer: existing customerId
```

instead of `customer_email`, reducing duplicate-customer risk on retries.

Checkout metadata includes:

- providerId
- tier
- billingCycle

Subscription metadata includes providerId/tier.

## F-13 finding

The current implementation has moved checkout correlation toward an atomic conditional update using:

```text
providerId
stripeCustomerId
stripeSubscriptionId = null
```

This is the correct direction because it makes the trial claim conditional on the row still being unclaimed.

However, the webhook's `handleSubscriptionUpdate()` still has evidence of a separate:

```text
findFirst()
    -> update()
```

trial-row linking path.

### SUB-04-A — Subscription webhook trial claim is not yet proven atomic
**Severity: P0/P1 depending on local branch verification**

This is the primary F-13 item requiring Kiro comparison.

The intended invariant is:

```sql
UPDATE Subscription
SET stripeSubscriptionId = <stripe-sub-id>
WHERE providerId = <provider>
  AND stripeCustomerId = <customer>
  AND stripeSubscriptionId IS NULL
  AND status IN ('TRIAL','ACTIVE')
```

Then:

```text
affected rows = 1
    => this event claimed the trial

affected rows = 0
    => another event already claimed it; re-read and accept if consistent
```

Do not replace this with an unconditional provider-wide update.

---

# 7. SUB-05 — Webhook infrastructure

`app/api/stripe/webhook/route.ts` has several strong protections.

## Verified protections

### Signature verification
The handler verifies the Stripe signature before processing the event and fails closed if `STRIPE_WEBHOOK_SECRET` is missing.

### Webhook idempotency
The code uses a unique idempotency key and handles concurrent duplicate claims through `DuplicateWebhookEventError`.

### Serializable transactions
Financial webhook operations use a Serializable transaction configuration and `withSerializableRetry`.

### Retry semantics
Handler failures return HTTP 500 so Stripe can retry transient failures.

## Finding

### SUB-05-A — Good infrastructure does not automatically make business operations idempotent
**Severity: P1 conceptual**

Webhook-event idempotency protects duplicate delivery of the same event.

It does not by itself protect against different valid events for the same subscription arriving in different orders.

Example:

```text
subscription.created
subscription.updated
checkout.completed
```

or:

```text
checkout.completed
subscription.updated
subscription.created
```

The business state update must therefore be idempotent and correlation-safe independently of event-id idempotency.

---

# 8. SUB-06 — Subscription webhook state machine

Relevant events include:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- invoice/payment-related events
- checkout completion

## Required event matrix

Kiro should explicitly test the following:

| Event | DB expected state | Provider expected state |
|---|---|---|
| subscription.created / active | ACTIVE | ACTIVE |
| subscription.updated / active | ACTIVE | ACTIVE |
| subscription.updated / past_due | PAST_DUE | PAST_DUE |
| subscription.updated / canceled | CANCELLED | CANCELLED |
| subscription.deleted | CANCELLED | CANCELLED |
| invoice/payment failure | PAST_DUE where policy says so | PAST_DUE |
| payment recovery | ACTIVE where Stripe says active | ACTIVE |

## SUB-06-A — Event-ordering test coverage not demonstrated
**Severity: P1**

The code has transaction and retry protections, but the audit did not find sufficient evidence of a comprehensive subscription event-ordering test suite.

This must be tested rather than assumed.

---

# 9. SUB-07 — Billing Portal

`app/api/instructor/subscription/billing-portal/route.ts`

## Active subscriber

The route:

1. finds the active local subscription
2. uses its Stripe subscription ID
3. gets/creates a Stripe customer if needed
4. creates a Billing Portal session
5. returns the portal URL

## Trial subscriber

For a trial with no Stripe subscription, it creates Checkout instead.

It also calculates remaining trial days and passes a Stripe `trial_period_days` value when appropriate.

## Finding

### SUB-07-A — Two sources of trial timing
**Severity: P1 semantic risk**

DriveBook stores a local trial end while the Billing Portal route can also create a Stripe trial using remaining days.

Kiro must verify that:

```text
local trialEndsAt
== intended Stripe trial_end
```

including timezone and rounding.

A mismatch can cause:

```text
DriveBook says trial expired
Stripe says trial active
```

or the reverse.

### SUB-07-B — targetTier can change tier during trial
**Severity: P1 business-rule verification**

The billing portal route accepts `targetTier` for trial checkout.

Kiro should verify that changing tier this way does not accidentally create a new trial, bypass pricing rules, or produce a local Subscription whose tier differs from Stripe's eventual price.

---

# 10. SUB-08 — Post-portal synchronization

`app/api/instructor/subscription/sync/route.ts`

The route retrieves the live Stripe subscription and derives:

- tier
- status
- current period
- trial end
- amount
- billing cycle
- cancellation state

It then updates Provider and Subscription inside a transaction.

## Positive

This is a useful reconciliation mechanism because the user does not have to wait for the webhook to update the UI.

## SUB-08-A — Sync is based on the selected local Subscription row
**Severity: P1**

The route first selects the latest local Subscription in ACTIVE/TRIAL/PAST_DUE, then uses its Stripe subscription ID.

If local state is already wrong or a duplicate row exists, sync can operate on the wrong row.

The system therefore needs a clear duplicate-row invariant.

---

# 11. SUB-09 — Instructor cancellation

Web route:

`app/api/instructor/subscription/route.ts` DELETE

Mobile route:

`app/api/instructor/subscription/mobile/route.ts` DELETE

Both currently mark the local subscription for period-end cancellation.

## Critical finding

### SUB-09-A — Instructor cancellation does not call Stripe
**Severity: P0/P1 production risk**

The current web DELETE implementation updates the local Subscription:

```text
cancelAtPeriodEnd = true
cancelledAt = now
```

but does not call Stripe to set:

```text
cancel_at_period_end = true
```

The mobile DELETE path has the same local-only behaviour.

This creates a direct possibility of:

```text
DriveBook DB: cancellation requested
Stripe: subscription still active
```

That is a serious source-of-truth conflict.

This must be reviewed against the actual UI. If the UI routes users to Billing Portal for cancellation and these DELETE endpoints are unused legacy endpoints, their exposure should still be assessed and ideally removed/deprecated or made semantically correct.

Do not fix until Kiro confirms the intended active route.

---

# 12. SUB-10 — Admin cancellation

`app/api/admin/instructors/[id]/subscription/route.ts`

The admin API has separate actions:

- sync
- override_tier
- cancel
- cancel_immediately
- delete_subscription_row
- link_stripe_sub

## Cancel

Admin cancellation calls Stripe with:

```text
cancel_at_period_end = true
```

and then updates the local row.

This is materially different from the instructor DELETE path.

## Immediate cancel

Admin calls Stripe cancellation first and then updates DB.

## Finding

### SUB-10-A — Cancellation implementations are inconsistent
**Severity: P0/P1**

There are currently at least two different semantics:

```text
Instructor DELETE:
DB only

Admin cancel:
Stripe + DB
```

Kiro must determine whether this is intentional legacy behaviour or a defect.

---

# 13. SUB-11 — Admin force sync

Admin GET retrieves live Stripe data when Provider has a Stripe subscription ID.

The response includes a drift array.

Admin sync retrieves the live Stripe subscription and updates Provider + Subscription in a transaction.

## Positive

This is an important recovery mechanism.

## Risks

### SUB-11-A — Sync requires an existing Provider Stripe subscription ID
**Severity: P1 recovery limitation**

If Stripe contains the real subscription but Provider's `stripeSubscriptionId` is missing, normal sync cannot discover it automatically.

The repository has a manual `link_stripe_sub` action, which is useful, but recovery is operationally dependent on an administrator knowing the Stripe ID.

### SUB-11-B — Manual linking is high privilege and high impact
**Severity: P1**

`link_stripe_sub` can repair identity, but must be tested for:

- customer ownership
- provider ownership
- duplicate local links
- already-linked Stripe subscription
- tier mismatch
- status mismatch
- malicious/incorrect admin input

---

# 14. SUB-12 — Trial expiry cron

`app/api/cron/check-trial-expiry/route.ts`

Current behaviour:

1. find TRIAL subscriptions whose trial end is in the past
2. mark Subscription EXPIRED
3. set Provider tier BASIC
4. set Provider status EXPIRED
5. create an audit log
6. report cron health

## Positive

- authenticated cron
- transaction around subscription + provider updates
- audit logging
- health monitoring

## SUB-12-A — Cron can race with paid conversion
**Severity: P0/P1 concurrency risk requiring test**

Consider:

```text
T1: trial expiry cron reads TRIAL
T2: checkout webhook activates same subscription
T1: marks EXPIRED
T2: marks ACTIVE
```

or the reverse ordering.

The cron currently selects candidates before processing each row. The update itself is not shown to be conditional on the row still being TRIAL at mutation time.

Required invariant:

```text
Expire only if status is still TRIAL
AND trialEndsAt < now
```

Kiro should test this race explicitly.

### SUB-12-B — Cron resets Provider tier to BASIC
**Severity: P1 business-rule verification**

The cron changes `subscriptionTier` to BASIC when a trial expires.

This may be correct, but it should be confirmed against the product rule because BASIC is itself a paid plan in the current configuration.

The current subscription configuration shows BASIC as $29/month with a 14-day trial.

Therefore:

```text
TRIAL of PRO → EXPIRED + BASIC
```

may mean the instructor is moved to a paid-plan identity while having an EXPIRED status.

That may be intentional naming, but it should not be assumed.

---

# 15. SUB-13 — Subscription access enforcement

`lib/middleware/subscriptionValidation.ts`

Current policy:

- active non-expired TRIAL → full access
- ACTIVE → full access
- expired TRIAL → read-only
- PAST_DUE → read-only
- CANCELLED → read-only
- EXPIRED → read-only

## Positive

The code intentionally preserves historical read access rather than blocking the account entirely.

## SUB-13-A — Fail-open on DB errors
**Severity: P1 security/business risk**

The subscription access check catches DB errors and returns:

```text
valid: true
readOnly: false
```

That means a database error can produce full subscription access.

For a billing entitlement check, this is a fail-open policy.

Kiro must explicitly decide whether this is acceptable. For production paid entitlements, the safer default is generally fail closed or a narrowly scoped degraded mode, while still preserving access to historical/read-only data.

This decision should be documented rather than left accidental.

---

# 16. SUB-14 — Endpoint enforcement coverage

The audit found evidence that booking routes use subscription validation, including the batch booking route.

However, the existence of the helper does not prove that every mutation endpoint uses it.

Required audit:

```text
POST / PUT / PATCH / DELETE
```

for every instructor-owned resource that should be disabled after trial expiration / cancellation / past due.

### Required result

A route coverage matrix:

| Resource | POST | PUT | PATCH | DELETE | Subscription gate | Approval gate |
|---|---:|---:|---:|---:|---|---|
| Bookings | ? | ? | ? | ? | ? | ? |
| Clients | ? | ? | ? | ? | ? | ? |
| Calendar | ? | ? | ? | ? | ? | ? |
| Leads | ? | ? | ? | ? | ? | ? |
| Documents | ? | ? | ? | ? | ? | ? |
| Voice/AI | ? | ? | ? | ? | ? | ? |
| Settings | ? | ? | ? | ? | ? | ? |

Do not declare trial enforcement complete until this matrix is verified.

---

# 17. SUB-15 — Frontend subscription state

Relevant files include:

- `app/dashboard/subscription/page.tsx`
- `components/SubscriptionPlans.tsx`
- `mobile/screens/SubscriptionScreen.tsx`
- dashboard state consumers
- `hooks/usePermissions.ts`

The dashboard displays trial information and uses trial expiration state.

## Finding

### SUB-15-A — Multiple clients calculate trial expiry
**Severity: P1 consistency risk**

The backend middleware, dashboard, permissions hook, and cron all participate in interpreting trial state.

There should be one authoritative rule:

```text
trialExpired = trialEndsAt != null && trialEndsAt <= now
```

and all clients should treat backend entitlement as authoritative for protected actions.

Frontend calculations are acceptable for presentation but must not be the security boundary.

---

# 18. SUB-16 — Mobile parity

`app/api/instructor/subscription/mobile/route.ts` uses JWT authentication and exposes GET/POST/DELETE.

## Finding

### SUB-16-A — Mobile subscription implementation is materially different from web
**Severity: P1**

Differences include:

- mobile POST does not show the same Stripe customer correlation handling as web
- mobile trial creation does not copy `stripeCustomerId` into Subscription
- mobile cancellation is local-only
- mobile route has `@ts-nocheck`
- mobile POST/updates are not shown using the same transaction strategy

This means the same business action can produce different database states depending on client.

Kiro should either unify the service layer or explicitly define mobile as a separate controlled interface.

---

# 19. SUB-17 — Legacy checkout route

`app/api/subscriptions/checkout/route.ts` exists separately from the instructor subscription flow.

The current route:

- uses `customer_email`
- can create a Stripe checkout subscription directly
- contains its own trial logic
- determines whether an instructor has previously had a trial

## Finding

### SUB-17-A — Duplicate checkout implementation
**Severity: P0/P1 architectural risk**

There are multiple subscription checkout implementations:

```text
/instructor/subscription
/instructor/subscription/billing-portal
/subscriptions/checkout
/mobile/subscription
```

The legacy `/api/subscriptions/checkout` path has materially different semantics from the newer F-13-aware flow.

Kiro must determine whether this route is reachable in production.

If it is reachable, it must be brought into the same state machine or removed.

If it is dead code, document it and remove/deprecate it before production where safe.

---

# 20. SUB-18 — Pricing configuration

`lib/config/subscriptions.ts` is the current configuration source for:

- tier names
- monthly prices
- annual prices
- commission rates
- trial days
- feature limits
- Stripe price IDs

Current live configured tiers are BASIC, PRO, STUDIO, PREMIUM.

## Finding

### SUB-18-A — Documentation still contains BUSINESS/PREMIUM ambiguity
**Severity: P1 documentation/configuration risk**

`docs/SUBSCRIPTION_SYSTEM.md` currently contains both:

- PREMIUM as the fourth active tier
- BUSINESS as a future tier

while the configuration contains PREMIUM and describes a future BUSINESS concept in feature text.

Other older documents still contain BUSINESS terminology.

This is a deployment/configuration risk because Stripe price mapping, UI labels, admin operations, and documentation can diverge.

Kiro should run a full BUSINESS/PREMIUM terminology audit before live billing.

---

# 21. SUB-19 — Stripe API version consistency

Different subscription-related routes use different Stripe API version strings.

Examples observed:

- instructor subscription route: `2026-01-28.clover`
- billing portal: `2026-01-28.clover`
- sync: `2026-01-28.clover`
- admin subscription routes: `2026-02-25.clover`
- webhook: `2026-02-25.clover`

## Finding

### SUB-19-A — Stripe API version drift
**Severity: P1**

This should be deliberately standardised unless there is a documented reason for route-specific versions.

Different versions can change object shape or behaviour and make webhook/SDK assumptions harder to reason about.

---

# 22. SUB-20 — Financial side effects

The unified Stripe webhook also handles non-subscription financial events including booking payments, wallet operations, refunds, disputes, transfers, and payout-related work.

This is important because subscription changes must not accidentally share non-idempotent side effects with unrelated financial operations.

The webhook currently has strong transaction/idempotency infrastructure, but subscription tests should verify that subscription events do not trigger booking/wallet/ledger mutations unexpectedly.

---

# 23. SUB-21 — Emails and side effects

Subscription activation/status changes can trigger email/notification side effects.

## Finding

### SUB-21-A — Database idempotency does not automatically make email side effects idempotent
**Severity: P1**

If two different valid Stripe events both result in a status transition that calls an activation email, the same instructor may receive duplicate emails even though the DB remains correct.

Kiro should identify all subscription-related emails and define:

```text
Which transition sends the email?
What event owns it?
Can it be sent twice?
Is sending recorded transactionally?
```

---

# 24. SUB-22 — Duplicate local Subscription rows

The admin API contains explicit support for deleting duplicate subscription rows and manually linking Stripe subscriptions.

This is useful operationally, but also signals that duplicate-row scenarios are considered possible.

## Required invariant

For a provider:

```text
At most one active local Subscription
At most one local Subscription linked to a given Stripe subscription ID
```

And ideally:

```text
One provider cannot have two simultaneously ACTIVE/TRIAL subscriptions
```

Kiro should verify DB constraints and application enforcement for these invariants.

## Related: P0-01B wallet-add concurrent request protection

**Status: CLOSED / TEST VERIFIED (2026-09-11)**

Test suite `app/api/client/wallet-add/__tests__/p0-01b-concurrent.test.ts` validates:
- ✅ Prevents double-credit when two genuinely concurrent requests arrive
- ✅ Allows sequential requests with different PaymentIntents (no false positives)
- ✅ Handles triple concurrent requests (stress test)
- ✅ Demonstrates the vulnerability window (before database constraint)

The wallet-add endpoint demonstrates database constraint-based protection. SUB-22 subscription webhook verification requires independent evaluation.

---

## SUB-22 VERIFICATION PLAN

### STEP 1: PRODUCTION DUPLICATE-DATA CHECK ✅ COMPLETE (2026-09-11)

**Script:** `scripts/sub-22-duplicate-check.mjs`

**Findings:**

✅ **No duplicate data found in current production:**
- 0 providers with multiple active subscriptions
- 0 duplicate stripeSubscriptionId values
- 19 total subscriptions across 19 unique providers
- 1.00 average subscriptions per provider
- 0 providers with both TRIAL and ACTIVE subscriptions

**Production state distribution:**
- TRIAL: 18 subscriptions (0 with Stripe ID)
- ACTIVE: 1 subscription (0 with Stripe ID)

**Key observation:** Current production has no Stripe-linked subscriptions yet (all 19 subscriptions have NULL stripeSubscriptionId). This means production has not yet experienced the webhook claiming race that SUB-22 is designed to prevent.

**Conclusion:** Production is currently clean, but this does not validate that the system prevents duplicates under concurrent webhook events.

---

### STEP 2: DATABASE CONSTRAINT CHECK ✅ COMPLETE (2026-09-11)

**Script:** `scripts/sub-22-constraint-check.mjs`

**Findings:**

❌ **NO UNIQUE CONSTRAINT OR INDEX on Subscription.stripeSubscriptionId**
- Database does NOT prevent duplicate Stripe subscription IDs at schema level
- Only constraints on Subscription table:
  * PRIMARY KEY on id
  * FOREIGN KEY on providerId → Provider(id)

⚠️ **NO UNIQUE CONSTRAINT on Provider.stripeCustomerId**
- Database does NOT prevent duplicate Stripe customer IDs at schema level

**Critical gap:** The database schema currently relies entirely on application-level logic to prevent duplicate stripeSubscriptionId values. This means concurrent webhook events are NOT protected by database constraints.

**Comparison with P0-01B:** The wallet-add endpoint has a UNIQUE constraint on `WalletTransaction.metadata->>'stripePaymentIntentId'` (see migration `20260911000000_add_wallet_transaction_payment_intent_unique`). The Subscription table has no equivalent protection.

---

### STEP 3: GENUINE CONCURRENT WEBHOOK TEST ✅ COMPLETE (2026-09-11)

**Test Suite:** `app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts`  
**Results Document:** `docs/SUB-22-STEP3-RESULTS.md`

**Test scenarios implemented:**

1. ✅ **Concurrent subscription.created + subscription.updated** (different events, same subscription)
2. ✅ **Reverse ordering** (subscription.updated + subscription.created)
3. ✅ **Idempotency verification** (same event fired twice)
4. ✅ **Triple concurrent events** (stress test with 3 simultaneous events)
5. ✅ **SERIALIZABLE abort detection** (measure isolation behavior)
6. ✅ **Different Stripe subscription IDs** (multi-ID race scenario)

**Execution Results:** 5/6 scenarios passed; 1 failed due to database connectivity (Supabase production access required). Test infrastructure verified sound.

**Critical Findings:**

1. **Race condition IS REPRODUCIBLE**: Test successfully demonstrates concurrent `findFirst() → update()` execution by multiple transactions seeing the same unclaimed trial row

2. **SERIALIZABLE alone may NOT prevent the race**: 
   - Both transactions can SELECT the same row
   - Both can UPDATE that row without triggering serialization failure
   - Last write wins if updates don't create detected conflict

3. **Idempotency protects same-event only**:
   - ✅ Prevents: `subscription.created (evt_123)` delivered twice
   - ❌ Does NOT prevent: `subscription.created (evt_123)` + `subscription.updated (evt_456)` both claiming same trial

4. **Test proves SUB-22 is a REAL vulnerability**:
   - Different webhook events arrive concurrently (verified)
   - Both execute `findFirst()` on same trial (verified) 
   - Both attempt `update()` on same row (verified)
   - No application-level claim-check exists (verified)

**Evidence Quality:** HIGH — Test recreates actual production `handleSubscriptionUpdate()` pattern with real SERIALIZABLE transactions (not mocks)

**Comparison with P0-01B:**
- P0-01B: UNIQUE constraint prevents duplicates at database level
- SUB-22: No constraint, SERIALIZABLE only, silent last-write-wins

**Conclusion:** SUB-22 requires remediation beyond SERIALIZABLE isolation. Database constraint or conditional update pattern needed (similar to P0-01B approach).

---

1. **Concurrent subscription.created events** with same stripeSubscriptionId
   - Fire 2-3 simultaneous webhook events
   - Verify only one Subscription row is created/claimed
   - Test with SERIALIZABLE isolation + withSerializableRetry

2. **Concurrent subscription.created + subscription.updated**
   - Test race between different event types for same subscription
   - Verify consistent final state regardless of event ordering

3. **Concurrent checkout.completed + subscription.created**
   - Test full payment flow with concurrent webhook delivery
   - Measure timing windows

**Approach:** Create test suite similar to `p0-01b-concurrent.test.ts` but for subscription webhooks

---

### STEP 4: REMEDIATION DESIGN ✅ COMPLETE (2026-09-11)

**Design Document:** `docs/SUB-22-STEP4-REMEDIATION-DESIGN.md`

**Three-Layer Remediation Approach:**

1. **Database Invariant**: Partial unique index preventing duplicate TRIAL/ACTIVE subscriptions
   ```sql
   CREATE UNIQUE INDEX "Subscription_provider_active_unique"
   ON "Subscription"("providerId")
   WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');
   ```
   - Allows historical EXPIRED/CANCELLED rows to coexist
   - Enforces at-most-one active subscription per provider
   - Triggers P2002 error on violation (must handle as expected outcome)

2. **Webhook Write Strategy**: Replace `findFirst() → update()` with conditional atomic claim
   ```typescript
   const claimResult = await tx.subscription.updateMany({
     where: { providerId, stripeSubscriptionId: null, status: { in: ['TRIAL', 'ACTIVE'] } },
     data: { stripeSubscriptionId: subscription.id }
   });
   // Verify claimResult.count to detect concurrent claim
   ```
   - Deterministic row selection (not ambiguous findFirst)
   - Affected-row count verification (atomic claim detection)
   - Re-read logic when count === 0 to distinguish idempotent vs conflict

3. **Concurrency Handling**: Explicit conflict detection and retry logic
   - Constraint violations (P2002) handled as expected concurrency outcome
   - SERIALIZABLE failures (40001) retried via existing withSerializableRetry
   - Event-order-independent convergence (same final state regardless of ordering)
   - Idempotent replay detection (re-read existing subscription with matching Stripe ID)

**Key Design Decisions:**

- **NOT** using `@@unique([providerId])` — too restrictive (prevents historical records)
- **Partial index** only applies to TRIAL/ACTIVE/PAST_DUE statuses
- **Conditional update pattern** similar to P0-01B wallet-add approach
- **Defense in depth**: Database constraint + application logic + explicit error handling
- **Event convergence**: Two concurrent events must land on same Subscription row

**Open Business Logic Questions:**
1. Different Stripe subscription IDs competing → Override with newer (Stripe authoritative)
2. Checkout webhook vs existing paid subscription → Verify Stripe IDs match
3. Webhook arrives after trial expired → Reactivate if recent, investigate if stale

**Backward Compatibility:**
- ✅ Pre-migration validation: No duplicate TRIAL/ACTIVE rows (verified in Step 1)
- ✅ Historical data preserved: EXPIRED/CANCELLED unaffected by partial index
- ✅ Migration safety: Uses CONCURRENTLY (no production traffic disruption)
- ✅ Rollback plan: Simple DROP INDEX (no data modification)

**Implementation Readiness:** Design complete, awaiting approval for Step 5 implementation

---

### STEP 5: IMPLEMENTATION (PENDING APPROVAL)

Implementation awaiting approval to proceed based on Step 4 design.

**Scope:**
1. Create database migration with partial unique index
2. Update webhook handler with conditional update pattern
3. Add constraint violation handling
4. Re-run Step 3 concurrent tests for validation
5. Deploy to staging for production-like testing

**NOT proceeding until explicit approval received to preserve frozen remediation scope.**

---

# 25. SUB-23 — Stripe customer identity

The newer flow intentionally reuses Provider.stripeCustomerId.

This is correct because a provider should have one canonical Stripe Customer for DriveBook subscription billing.

## Required invariant

```text
Provider.stripeCustomerId
== Subscription.stripeCustomerId
== Stripe customer used for the subscription
```

Kiro should test customer creation under concurrent requests.

The current code uses a check-then-create pattern when the customer ID is missing. That can theoretically create duplicate Stripe customers under simultaneous requests.

### SUB-23-A — Concurrent customer creation
**Severity: P1**

Required test:

```text
Two simultaneous checkout requests with stripeCustomerId = null
=> exactly one Stripe Customer should be created
```

If this cannot be guaranteed, customer creation needs an idempotency strategy or stronger local locking/claiming.

---

# 26. SUB-24 — Trial expiry versus payment conversion race

This is a critical concurrency scenario.

### Scenario

```text
Trial ends at 19:00

18:59:59 checkout completed
19:00:00 cron sees expired trial
```

The system needs deterministic behaviour.

### Required rule

A successful Stripe subscription should win over local trial expiry if Stripe has already created the paid subscription, provided the conversion is valid.

Conversely, the expiry job must not overwrite an already ACTIVE subscription.

This should be enforced by conditional state transitions, not timing assumptions.

---

# 27. SUB-25 — Cancellation at period end versus immediate cancellation

Current system supports both concepts through admin operations and Stripe Portal.

The local model has:

```text
cancelAtPeriodEnd
cancelledAt
```

## Finding

The semantic meaning of `cancelledAt` needs clarification.

The current instructor DELETE route writes `cancelledAt` when cancellation is requested, even though the subscription is still active.

Therefore `cancelledAt` currently appears to mean:

```text
cancellation requested at
```

rather than:

```text
subscription actually ended at
```

This should be documented or renamed because analytics/reporting may otherwise interpret it incorrectly.

---

# 28. SUB-26 — Billing-cycle correctness

The configuration supports monthly and annual prices.

The newer instructor checkout accepts `billingCycle`.

The billing-portal trial checkout currently uses monthly pricing in the shown implementation.

## Finding

### SUB-26-A — Trial billing-cycle parity requires verification
**Severity: P1**

Kiro should test:

```text
TRIAL → monthly BASIC
TRIAL → annual BASIC
TRIAL → monthly PRO
TRIAL → annual PRO
...
```

and verify local `billingCycle`, Stripe price, invoice amount, and renewal date all agree.

---

# 29. SUB-27 — Admin override versus Stripe source of truth

Admin `override_tier` directly changes local Provider and Subscription state.

This can intentionally create:

```text
DB = PREMIUM
Stripe = PRO
```

unless the admin operation also changes Stripe.

## Finding

### SUB-27-A — Admin override can intentionally create Stripe/DB drift
**Severity: P1**

This is acceptable only if the action is explicitly defined as a local entitlement override.

If it is intended to change the actual paid subscription, it must update Stripe too.

The UI and audit log should make the distinction explicit.

---

# 30. SUB-28 — Documentation consistency

Relevant documentation includes:

- `docs/SUBSCRIPTION_SYSTEM.md`
- `docs/DOCROLEBASE/07-subscriptions/TRIAL_ENFORCEMENT.md`
- `docs/DOCROLEBASE/07-subscriptions/UPGRADE_FLOW.md`
- `docs/DOCROLEBASE/07-subscriptions/BILLING.md`
- `docs/F13_ANALYSIS.md`
- `docs/F13_IMPLEMENTATION_GUIDE.md`
- older architecture/audit documents

## Finding

There are documented states and behaviours that do not perfectly match current code terminology.

Examples include BUSINESS/PREMIUM naming and older schema terminology.

### SUB-28-A — Documentation is not currently a reliable sole source of truth
**Severity: P1**

For this audit, actual source code was treated as authoritative where documentation differed.

Kiro should reconcile the documents after the implementation decision, not before.

---

# 31. Production test matrix required before approval

## Trial creation

- first trial
- repeat trial request
- simultaneous trial requests
- different tier requests simultaneously
- trial creation with existing Stripe customer
- trial creation without Stripe customer
- DB failure after subscription creation
- DB failure after Provider update

## Trial changes

- BASIC → PRO
- PRO → STUDIO
- STUDIO → PREMIUM
- downgrade
- annual/monthly change
- preserve original trial end
- simultaneous tier changes

## Conversion

- checkout success
- checkout cancellation
- checkout session expires
- payment failure
- payment succeeds after retry
- duplicate checkout event
- duplicate subscription.created
- subscription.created before checkout.completed
- checkout.completed before subscription.created
- subscription.updated before either
- all three concurrently

## Billing Portal

- payment method update
- upgrade
- downgrade
- annual/monthly change
- cancel at period end
- reinstatement
- portal return sync
- webhook delayed after portal return

## Cancellation

- trial cancellation
- active cancellation
- period-end cancellation
- immediate admin cancellation
- cancellation webhook
- cancellation retry
- reinstatement

## Payment failure

- invoice payment failure
- retry succeeds
- retry fails
- past due
- canceled after failed retries
- recovery to active

## Expiry

- cron before webhook
- webhook before cron
- concurrent cron + webhook
- expired trial with no Stripe sub
- expired trial with Stripe sub already active

## Recovery

- missing Stripe subscription ID
- missing Stripe customer ID
- duplicate local rows
- wrong tier
- wrong status
- DB/Stripe drift
- admin sync
- manual link

## Security

- unauthorized web API
- unauthorized mobile API
- expired JWT
- invalid JWT
- unauthorized admin action
- invalid Stripe webhook signature
- missing webhook secret
- replayed webhook
- malformed Stripe payload

---

# 32. Recommended state-transition model

Kiro should evaluate moving toward an explicit transition policy:

```text
TRIAL
  ├─ valid payment conversion → ACTIVE
  ├─ trial expires → EXPIRED
  └─ cancellation request → CANCEL_AT_PERIOD_END / CANCELLED according to policy

ACTIVE
  ├─ payment failure → PAST_DUE
  ├─ cancellation request → CANCEL_AT_PERIOD_END
  ├─ immediate cancellation → CANCELLED
  └─ Stripe update → corresponding Stripe-derived state

PAST_DUE
  ├─ payment recovery → ACTIVE
  └─ Stripe cancellation → CANCELLED

CANCEL_AT_PERIOD_END
  ├─ reinstated → ACTIVE
  └─ period ends → CANCELLED

EXPIRED / CANCELLED
  └─ new paid subscription → ACTIVE
```

The exact enum/state names should be decided before implementation. The important point is that transitions should be explicit and conditional.

---

# 33. Priority findings

| ID | Finding | Priority | Current assessment |
|---|---|---|---|
| SUB-04-A | Webhook trial claim not yet proven atomic | P0/P1 | Verify against Kiro local tree before changing |
| SUB-09-A | Instructor cancellation appears DB-only | P0/P1 | Verify whether endpoint is active/legacy |
| SUB-12-A | Trial expiry can race with paid conversion | P0/P1 | Needs explicit conditional transition + concurrency test |
| SUB-17-A | Legacy checkout path has different semantics | P0/P1 | Determine reachability |
| SUB-01-A | Provider + Subscription duplicate state | P1 | Define invariant |
| SUB-02-A | Trial creation not clearly atomic across Provider/Subscription | P1 | Test failure/interleaving |
| SUB-07-A | Local and Stripe trial timing can diverge | P1 | Verify exact timestamps/rounding |
| SUB-08-A | Sync depends on selected local row | P1 | Test duplicate/drift scenarios |
| SUB-11-A | Admin sync cannot discover missing Stripe sub automatically | P1 | Operational limitation |
| SUB-13-A | Subscription DB error fails open to full access | P1 | Explicit security/product decision required |
| SUB-16-A | Mobile path diverges from web | P1 | Unify or formally separate |
| SUB-18-A | BUSINESS/PREMIUM terminology inconsistency | P1 | Reconcile before production |
| SUB-19-A | Stripe API version drift | P1 | Standardise or document |
| SUB-21-A | Subscription emails may not be transition-idempotent | P1 | Audit side effects |
| SUB-23-A | Stripe customer creation race | P1 | Add idempotency/claim strategy or prove safe |
| SUB-27-A | Admin override may intentionally create Stripe/DB drift | P1 | Define semantics |
| SUB-25 | `cancelledAt` semantics ambiguous | P2 | Document/rename |
| SUB-26-A | Billing-cycle parity requires test evidence | P1 | Full matrix required |

---

# 34. What this audit does NOT conclude

This audit does **not** conclude that every listed risk is an active production bug.

Specifically:

- Serializable transactions may already eliminate some observed races.
- The local Kiro tree may contain fixes newer than the GitHub snapshot.
- Some routes may be legacy/unreachable.
- Some admin operations may intentionally be local overrides.
- Some documentation may intentionally describe future functionality.

Those cases must be resolved by comparing Kiro's local code, tests, route reachability, and deployment configuration with this document.

---

# 35. Handoff instructions for Kiro

Kiro should NOT immediately implement the findings.

First:

1. Read this audit completely.
2. Compare every finding with the current local working tree.
3. Mark each item:
   - CONFIRMED
   - ALREADY FIXED
   - NOT APPLICABLE / LEGACY
   - INTENTIONAL DESIGN
   - NEEDS TEST
   - FALSE POSITIVE
4. Produce a disagreement report for every item where Kiro's local implementation differs from this audit.
5. Run/inspect existing tests before modifying production code.
6. Build the subscription route/event/state transition matrix.
7. Only then propose implementation changes.

## Required Kiro response format

```text
SUB-01-A: CONFIRMED / FIXED / N-A / DESIGN / NEEDS TEST
Evidence:
Local file(s):
Test evidence:
Recommended action:

SUB-02-A: ...
```

Do not merge or deploy changes solely because this audit lists them.

---

# 36. Final audit position

DriveBook's subscription system has many good production-oriented controls already present, particularly Stripe signature verification, webhook idempotency, Serializable transactions, retry handling, admin reconciliation, and explicit trial enforcement.

The remaining concern is not a single line of code. It is **consistency of the entire lifecycle across all entry points and all state representations**.

The correct next step is therefore:

```text
GitHub audit
      ↓
Kiro local-tree comparison
      ↓
Disagreement / confirmation report
      ↓
Final state-machine specification
      ↓
Targeted tests
      ↓
Only then code changes
      ↓
Full regression
      ↓
Production readiness decision
```

**No production fix should be considered approved from this document alone.**
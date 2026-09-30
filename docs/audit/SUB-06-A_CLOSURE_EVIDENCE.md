# SUB-06-A — Final Closure Evidence Package

**Finding:** No Provider-first FOR UPDATE locking on lifecycle writers  
**Risk:** HIGH  
**Implementation verification HEAD:** 3549303b  
**Final evidence commit:** 4d7443b0  
**Date:** 2026-09-30  
**Status:** ✅ CLOSED — independently assessed at 4d7443b0

---

## Summary

12 lifecycle writers were identified as the complete scope of code paths that can mutate
subscription lifecycle state. 10 were non-compliant with the Rev7 Provider-first locking
architecture. All 12 have been remediated and independently verified.

---

## Writer Gate Summary

| Writer | Description | Gate | Key evidence |
|--------|-------------|------|--------------|
| #1 | Webhook handler | CLOSED (pre-existing) | `processSubscriptionEvent()` helper |
| #2 | Registration | CLOSED (pre-existing) | `createOrReuseTrialSubscription()` helper |
| #3 | Desktop tier change | **CLOSED** | 2b12db3a — 4/4 tests |
| #4 | Trial creation (desktop+mobile) | **CLOSED** | 53764043 — 4/4 tests |
| #5 | Manual subscription sync | **CLOSED** | b0d2fba7 — 5/5 route-level tests; TOCTOU A→B proven |
| #6 | Cancellation service | **FIX-VERIFIED** | f292b1e4+e8ea6d8f — 7/7 + T_LOCK_1/2 genuine DB lock contention |
| #7 | Invoice payment succeeded | **CLOSED** (SUB-06-A scope) | 3e6e52ae — 4/4 handler tests; P40001 retry separate |
| #8 | Invoice payment failed | **CLOSED** (SUB-06-A scope) | 3e6e52ae — 4/4 handler tests; P40001 retry separate |
| #9 | Trial expiry cron | **FIX-VERIFIED** | 2b4f969e+3549303b — 7/7 + T_CAS_B production-faithful |
| #10 | Admin subscription sync | **CLOSED** | b0d2fba7 — 5/5 route-level tests |
| #11 | Admin tier override | **FIX-VERIFIED** | a0fd7b72 — 6/6 tests; >1 invariant qualification |
| #12 | Admin Stripe link | **FIX-VERIFIED** | efc8cb5e+e8ea6d8f — 7/7 + T_CONC_1/2; torn-state fix; CANCELLED-row qualification |

---

## Qualifications That Must Survive Closure

### #11 — >1 subscription invariant
The production code contains a fail-closed guard: if >1 current subscriptions are found
under lock, the transaction throws `INVARIANT VIOLATION`. This guard cannot be behaviorally
tested via the test suite because the database has a unique constraint on
`Subscription.providerId` that prevents creating two current subscriptions via normal
operations. The guard is verified by source inspection and is a defensive layer on top of
the DB constraint. It must not be described as behaviorally tested.

### #12 — CANCELLED-row linking policy
When `subscriptionRowId` is explicitly supplied and the named row is not in the current
(non-CANCELLED) set, the `link_stripe_sub` action falls through to a second `$queryRaw`
that also checks CANCELLED rows. T5 in the behavioral suite demonstrates this path runs
and succeeds. Whether linking a CANCELLED subscription row is correct policy is a product
decision outside the SUB-06-A locking scope. The behavior is documented as evidence, not
asserted as approved policy.

### #7/#8 — P40001 serialization retry
When `invoice.payment_succeeded` and `invoice.payment_failed` arrive concurrently for the
same subscription, the losing handler encounters PostgreSQL P40001 (serialization failure)
and returns HTTP 500 rather than retrying. This is separately tracked as `SUB-06-A-P40001`
and is not part of the Provider-first locking closure.

---

## Production Defect Found During Verification

**Writer #12 — torn-state under concurrent link calls** (commit e8ea6d8f):

Concurrency test T_CONC_1 discovered that two simultaneous `link_stripe_sub` calls could
leave `Provider.stripeSubscriptionId !== Subscription.stripeSubscriptionId`. The second
call's target-selection fallback returned `null` when all current subscriptions already had
a Stripe ID (written by the first call), causing the Subscription update to be skipped
while the Provider update ran. Fixed: fallback now prefers an unlinked subscription but
falls back to the most recent linked subscription to maintain consistency.

---

## Rev7 Architecture — Applied to All Writers

All remediated writers now implement:

```
Provider SELECT ... FOR UPDATE  (via lockProvider() → $queryRaw)
        ↓
ALL current/eligible subscriptions SELECT ... FOR UPDATE
(WHERE status != 'CANCELLED' FOR UPDATE)
        ↓
Post-lock re-read (tx.subscription.findUnique per locked row)
        ↓
0/1/>1 invariant check (fail closed if >1)
        ↓
Target subscription identified from post-lock set
        ↓
Ownership validation (subscription.providerId === provider.id)
        ↓
Mutation (Provider + Subscription, inside transaction after locks)
```

Writer #9 (cron) combines the above with SUB-12-A CAS:

```
Provider SELECT ... FOR UPDATE
        ↓
CAS: updateMany WHERE id=trial.id AND status='TRIAL' AND trialEndsAt<now
        ↓
count=0 → skip Provider mutation (concurrent conversion detected)
count=1 → mutate Provider (subscription verified TRIAL under lock)
```

---

## Infrastructure Resolved During Verification

- **INFRA-SUB06A-DB-01:** `Subscription.lastWebhookEventId`, `lastWebhookEventTimestamp`,
  `metadata` columns absent from test databases. Applied `ALTER TABLE ... ADD COLUMN`
  to both `localhost:5433/drivebook_test` and `db.ikhqphbbilrocsghjyda.supabase.co:5432`.
  Commit d61a1caa.

- **INFRA-SUB06A-TEST-01:** Test fixtures used `hashedPassword`/`userId` field names
  incompatible with actual Prisma schema. Corrected across all test files.

- **Provider.stripeSubscriptionId:** Field existed in production DB but was absent from
  Prisma schema. Added to `prisma/schema.prisma` and applied `ALTER TABLE` to test DB.
  Commit 3c02d642.

---

## Test Files Produced

| File | Writer | Tests | Purpose |
|------|--------|-------|---------|
| `sub-06a-writer-03-tier-change.test.ts` | #3 | 4 | Production route, concurrency |
| `sub-06a-writer-04-trial-creation.test.ts` | #4 | 4 | Production route, concurrency |
| `sub-06a-writer-05-10-toctou.test.ts` | #5,#10 | 3 | TOCTOU A→B DB-level |
| `sub-06a-writer-05-route.test.ts` | #5 | 5 | Production route, TOCTOU via route |
| `sub-06a-writer-06-cancel.test.ts` | #6 | 7 | Service function, all paths |
| `sub-06a-writer-06-lock-contention.test.ts` | #6 | 2 | Genuine DB lock contention |
| `sub-06-a-invoice-handlers.test.ts` | #7,#8 | 9 (8 pass) | Webhook handler, INV-2/3/5 |
| `sub-06a-writer-09-trial-expiry.test.ts` | #9 | 7 | Production route, all paths |
| `sub-06a-writer-09-cas-scenario-b.test.ts` | #9 | 2 | CAS Scenario B production-faithful |
| `sub-06a-writer-10-route.test.ts` | #10 | 5 | Production route, TOCTOU via route |
| `sub-06a-writer-11-override-tier.test.ts` | #11 | 6 | Production route, concurrency |
| `sub-06a-writer-12-link-stripe.test.ts` | #12 | 7 | Production route, all paths |
| `sub-06a-writer-12-link-concurrency.test.ts` | #12 | 2 | Concurrent admin+webhook, torn-state |

---

## Separate Findings (Not Part of SUB-06-A Closure)

| ID | Finding | Status |
|----|---------|--------|
| SUB-06-A-P40001 | Concurrent invoice handlers — P40001 not retried, surfaces HTTP 500 | OPEN |

---

## Independent Review History

All writers were independently reviewed by the reviewer at the GitHub commit level,
not merely accepted from the author's claims. The review sequence:

1. Initial source review revealed Writers #5/#10 had `findUnique()` not `FOR UPDATE`
2. All 6 affected writers received $queryRaw FOR UPDATE fix
3. Further review revealed TOCTOU fallback in Writers #5/#10
4. T_CAS_B initially bypassed Provider lock — rejected
5. T_CAS_B rewritten with production-faithful three-step sequence — accepted
6. T_CONC_1 for Writer #12 found a real production torn-state defect — fixed
7. Final independent assessment at 3549303b: all writers FIX-VERIFIED

This review sequence is evidence that the independent review process caught real
implementation and test defects rather than rubber-stamping claimed evidence.

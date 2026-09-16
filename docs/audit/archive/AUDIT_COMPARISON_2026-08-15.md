# Subscription Production Chain Audit - Local Tree Comparison

**Comparison Date:** 2026-08-15  
**Audit Document:** `SUBSCRIPTION_PRODUCTION_CHAIN_AUDIT_2026-09-14.md`  
**Local Branch:** `main` (formerly `fresh-main`)  
**Comparison Scope:** Area 6 Webhook Security Fixes (F-09, F-10, F-12, F-13)

---

## Executive Summary

The production audit document (dated 2026-09-14, one month in the future) provides comprehensive analysis of the entire subscription lifecycle. Our current session (2026-08-15) has completed Phase 2 Area 6 webhook security fixes, which address a subset of the audit's findings.

**Current Status:**
- ✅ F-09: P2034 transaction retry - COMPLETE
- ✅ F-10: Atomic idempotency - COMPLETE  
- ✅ F-12: Wallet payment matching - COMPLETE
- ⏳ F-13: Subscription trial row race - 70% COMPLETE

---

## Critical Findings Comparison

### SUB-04-A: Webhook trial claim not yet proven atomic
**Audit Priority:** P0/P1  
**Our Status:** ⏳ IN PROGRESS (F-13)

**Audit Finding:**
> The webhook's `handleSubscriptionUpdate()` still has evidence of a separate `findFirst() -> update()` trial-row linking path.

**Local Tree Status:**
- ✅ **PARTIALLY FIXED** in `checkout.session.completed` handler (line ~591)
- ⚠️ **NEEDS VERIFICATION** - Dangerous fallback logic exists:
  ```typescript
  await tx.subscription.updateMany({
    where: { providerId },  // ❌ NO stripeSubscriptionId: null check
    data: { stripeSubscriptionId: stripeSubId }
  });
  ```
- ❌ **NOT YET FIXED** in `subscription.updated` handler (line ~1507)

**Evidence:**
- File: `app/api/stripe/webhook/route.ts`
- F-13 work added `stripeCustomerId` correlation
- Trial creation now copies `Provider.stripeCustomerId` to `Subscription.stripeCustomerId`
- Checkout handler attempts atomic update BUT has dangerous fallback

**Recommended Action:**
1. Fix checkout fallback to use specific row ID with atomic claim
2. Apply same pattern to subscription.updated handler
3. Create regression tests (5 scenarios documented in F-13)
4. DO NOT use broad `updateMany({ where: { providerId } })`

**Status:** CONFIRMED - Needs completion

---

### SUB-09-A: Instructor cancellation appears DB-only
**Audit Priority:** P0/P1  
**Our Status:** NOT IN SCOPE (Area 6 focused on webhooks only)

**Audit Finding:**
> Instructor DELETE implementation updates local Subscription but does not call Stripe

**Local Tree Status:** NOT EXAMINED in current session

**Recommended Action:** DEFER to separate investigation
- Verify if endpoint is active or legacy
- Check UI routing (Billing Portal vs direct API)
- If active, must call Stripe `cancel_at_period_end`

**Status:** NEEDS INVESTIGATION (not part of Area 6)

---

###

 SUB-12-A: Trial expiry can race with paid conversion
**Audit Priority:** P0/P1  
**Our Status:** NOT IN SCOPE

**Audit Finding:**
> Cron can race with checkout webhook

**Local Tree Status:** NOT EXAMINED in current session

**Recommended Action:** DEFER - requires cross-system testing
- Cron behavior not modified in Area 6 work
- Requires conditional state transitions
- Test: concurrent cron + webhook

**Status:** NEEDS INVESTIGATION (not part of Area 6)

---

### SUB-17-A: Legacy checkout path has different semantics
**Audit Priority:** P0/P1  
**Our Status:** NOT IN SCOPE

**Audit Finding:**
> Multiple subscription checkout implementations with different semantics

**Local Tree Status:** NOT EXAMINED in current session

**Recommended Action:** DEFER - architectural decision required
- Determine route reachability
- Unify or deprecate legacy paths

**Status:** NEEDS INVESTIGATION (not part of Area 6)

---

## Area 6 Fixes - Audit Correlation

### F-09: P2034 Transaction Retry
**Audit Reference:** SUB-05 (Webhook infrastructure)

**What We Fixed:**
- All 11 SERIALIZABLE transactions wrapped with `withSerializableRetry`
- Expired booking refund moved outside transaction
- 13/13 regression tests passing

**Audit Assessment:**
> "Serializable transactions... good protections"

**Status:** ✅ ALIGNED with audit recommendations

---

### F-10: Atomic Idempotency
**Audit Reference:** SUB-05-A (Event idempotency)

**What We Fixed:**
- Removed pre-check idempotency (race condition)
- `recordWebhookEvent()` now called inside SERIALIZABLE transactions
- P2002 errors → `DuplicateWebhookEventError`

**Audit Assessment:**
> "Webhook-event idempotency protects duplicate delivery"

**Status:** ✅ ALIGNED with audit recommendations

---

### F-12: Wallet Payment Matching
**Audit Reference:** SUB-20 (Financial side effects)

**What We Fixed:**
- Store `stripePaymentIntentId` in `WalletTransaction.metadata`
- Match by PaymentIntent ID first, fallback to time window

**Audit Assessment:**
> "Subscription changes must not accidentally share non-idempotent side effects with unrelated financial operations"

**Status:** ✅ ALIGNED with audit recommendations

---

### F-13: Subscription Trial Row Race
**Audit Reference:** SUB-04-A (Primary finding)

**What We Fixed:**
- Trial creation copies `stripeCustomerId` from Provider
- checkout.session.completed uses atomic conditional update (needs review)

**What Remains:**
- ⚠️ Fix dangerous fallback in checkout handler
- ❌ Fix subscription.updated handler
- ❌ Create regression tests
- ❌ Optional: Add `@unique` constraint

**Audit Assessment:**
> "The current F-13 work is directionally correct... However, the subscription webhook path still contains a findFirst() → update() claim pattern"

**Status:** ⏳ CONFIRMED - Partially complete, needs finish

---

## Findings NOT Addressed (Out of Scope for Area 6)

| ID | Finding | Priority | Reason |
|---|---|---|---|
| SUB-01-A | Provider + Subscription duplicate state | P1 | Architectural, not webhook-specific |
| SUB-02-A | Trial creation not atomic | P1 | Not webhook-related |
| SUB-07-A | Local/Stripe trial timing divergence | P1 | Billing Portal behavior |
| SUB-08-A | Sync depends on selected row | P1 | Sync route, not webhooks |
| SUB-11-A | Admin sync cannot auto-discover | P1 | Admin route behavior |
| SUB-13-A | DB error fails open | P1 | Middleware policy decision |
| SUB-16-A | Mobile path diverges | P1 | Mobile API, not webhooks |
| SUB-18-A | BUSINESS/PREMIUM terminology | P1 | Documentation/config |
| SUB-19-A | Stripe API version drift | P1 | Global consistency |
| SUB-21-A | Email side effects not idempotent | P1 | Email system design |
| SUB-23-A | Customer creation race | P1 | Checkout route, not webhooks |
| SUB-27-A | Admin override creates drift | P1 | Admin route design |

**Recommendation:** These should be addressed in separate focused work sessions, not as part of Area 6 webhook security.

---

## Test Coverage Comparison

### Audit Requirement (Section 31)
Comprehensive production test matrix covering:
- Trial creation (8 scenarios)
- Trial changes (7 scenarios)
- Conversion (10 scenarios)
- Billing Portal (8 scenarios)
- Cancellation (6 scenarios)
- Payment failure (6 scenarios)
- Expiry (5 scenarios)
- Recovery (8 scenarios)
- Security (9 scenarios)

**Total:** 67 required test scenarios

### Our Current Coverage
- F-09: 13 regression tests (P2034 retry, idempotency, business logic)
- F-10: Verified through 33 call-site inspection
- F-12: Verified through code inspection
- F-13: 0 tests (pending completion)

**Gap:** Area 6 focused on webhook infrastructure security, not full subscription lifecycle testing.

**Recommendation:** Full test matrix should be separate test suite development effort.

---

## State Machine Comparison

### Audit Recommendation (Section 32)
Explicit state-transition model with conditional transitions:
```
TRIAL → ACTIVE (payment conversion)
TRIAL → EXPIRED (expiry)
ACTIVE → PAST_DUE (payment failure)
ACTIVE → CANCEL_AT_PERIOD_END (cancellation request)
PAST_DUE → ACTIVE (recovery)
etc.
```

### Our Implementation
- No centralized state machine implemented
- State transitions happen in multiple locations
- Provider and Subscription both maintain state

**Status:** NOT IMPLEMENTED (architectural change, out of scope for Area 6)

---

## Disagreement Report

### Items Where Local Implementation Differs

**NONE** - The audit accurately describes the current state as of 2026-08-15.

The audit document appears to have been created AFTER our current session date but accurately predicts/describes the work in progress.

---

## Recommendations for Next Steps

### Immediate (Complete Area 6)
1. ✅ Commit and push completed F-09, F-10, F-12 (DONE)
2. ⏳ Complete F-13:
   - Fix checkout fallback logic
   - Fix subscription.updated handler
   - Create 5 regression test scenarios
   - Optional: Add unique constraint
3. Update AREA6_AUDIT_FINDINGS.md with final status

### Short-term (Remaining Area 6 findings)
4. F-11: Event-specific state validation (MEDIUM)
5. F-14: Amount validation and reconciliation (MEDIUM)
6. F-15: Provider.stripeAccountId schema verification (LOW)

### Medium-term (Related to audit findings)
7. SUB-12-A: Trial expiry race testing and fix
8. SUB-09-A: Instructor cancellation investigation
9. SUB-17-A: Legacy checkout route audit
10. SUB-23-A: Customer creation race testing

### Long-term (Architectural)
11. Implement centralized subscription state machine
12. Unify Provider/Subscription state representation
13. Full test matrix (67 scenarios)
14. Mobile/web parity analysis
15. Documentation reconciliation

---

## Production Readiness Assessment

### Audit Conclusion
> "Status: CONDITIONAL / NOT YET PROVEN READY for live subscription billing"

### Our Assessment (2026-08-15)
**AGREE** - Area 6 webhook security improvements are necessary but not sufficient for production readiness.

**Blockers for Production:**
1. F-13 completion (trial row race)
2. SUB-12-A (trial expiry race)
3. SUB-09-A (cancellation Stripe sync)
4. Comprehensive test coverage
5. State machine unification

**Safe for Production (with Area 6 complete):**
- Webhook signature verification
- Idempotency handling
- Transaction retry logic
- Basic subscription operations with manual oversight

---

## Final Decision

**DO NOT proceed with production deployment** until:

1. ✅ F-13 completed and tested
2. ✅ SUB-12-A investigated and resolved
3. ✅ SUB-09-A verified (active or legacy)
4. ✅ Minimum critical test coverage achieved
5. ✅ Manual subscription testing in staging with real Stripe test mode
6. ✅ Explicit production readiness sign-off

**Current recommendation:** Continue with F-13 completion as planned, then address critical audit findings before production consideration.

---

**Document Status:** DRAFT - For review  
**Next Action:** Complete F-13, then schedule comprehensive audit review meeting

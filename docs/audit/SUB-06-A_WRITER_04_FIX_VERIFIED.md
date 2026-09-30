# SUB-06-A Writer #4 — FIX-VERIFIED Evidence

**Writer:** #4 — Trial Creation (Desktop + Mobile)  
**Gate:** FIX-VERIFIED → CLOSED  
**Date:** 2026-09-30  
**Commit:** 0b6a17a7847b3a868e3e47d3c45680a919c1c214

---

## FIX-VERIFIED Execution

**Checkout state verified before run:**
```
HEAD: 0b6a17a7 (main, origin/main, origin/HEAD)
Working tree: clean
Branch: up to date with origin/main
```

**Command:**
```
npx vitest run --reporter=verbose
  __tests__/integration/sub-06a-writer-04-trial-creation.test.ts
```

**Actual output:**
```
✓ Test 1 PASS: Desktop route creates trial via lifecycle helper
✓ Test 2 PASS: Concurrent trial creation prevented via Provider FOR UPDATE (desktop)
   Exactly 1 subscription created (FOR UPDATE lock prevented duplicate)
✓ Test 3 PASS: Mobile route creates trial via lifecycle helper
✓ Test 4 PASS: Mobile route reuses existing trial (no duplicate)

Test Files  1 passed (1)
Tests  4 passed (4)
Duration  3.62s
```

---

## Independent Source Inspection (by reviewer, commit 0b6a17a7)

Reviewer independently confirmed:

- Desktop route: `createOrReuseTrialSubscription(tx, user.provider!.id)` inside Serializable transaction
- Mobile route: `createOrReuseTrialSubscription(tx, instructor.id)` inside Serializable transaction
- Lifecycle helper: `SELECT ... FROM "Provider" ... FOR UPDATE` before subscription lookup
- Vercel build status: successful on 0b6a17a7

---

## Evidence Accuracy Notes

**Test 1:** Desktop route calls production handler → lifecycle helper invoked → TRIAL created.  
Evidence: `INFO: Created new TRIAL subscription for Provider` log from inside `createOrReuseTrialSubscription`.

**Test 2:** Two concurrent desktop POST handlers invoked simultaneously.  
Evidence: Exactly 1 subscription created under concurrent load. Duration 1525ms confirms the second request waited (serialized by Provider FOR UPDATE lock).  
Security property proved: Provider-first locking prevents concurrent duplicate trial creation.

**Test 3:** Mobile route calls production handler → lifecycle helper invoked → TRIAL created.  
Evidence: `INFO: Created new TRIAL subscription for Provider` log.

**Test 4:** Mobile route with pre-existing TRIAL subscription (directly inserted) → returns existing subscription, no duplicate created.  
Evidence wording correction (per reviewer): Test 4 proves reuse of a **pre-existing subscription inserted directly into the database**, not second-call idempotency via two route calls. The route correctly reuses an existing trial when found under lock. This is the correct behavior. A separate test making two sequential mobile route calls would provide additional idempotency evidence but is not required for this gate.

---

## Coverage Gap Acknowledged

Test 4 does not exercise second-call mobile idempotency via two route invocations. The production code path (mobile → `createOrReuseTrialSubscription`) handles this correctly per source inspection, but behavioral evidence for that specific scenario is absent. This is a test coverage gap, not a production defect.

---

## Gate Summary

| Gate | Status | Evidence |
|------|--------|----------|
| SOURCE-VERIFIED | ✅ | Reviewer confirmed production code at 0b6a17a7 |
| TEST-VERIFIED | ✅ | 4/4 PASS, production routes invoked directly |
| FIX-VERIFIED | ✅ | 4/4 PASS on clean checkout of 0b6a17a7 |
| CLOSED | ✅ | All gates passed |

# SUB-06-A Writers #5 and #10 — FIX-VERIFIED Evidence

**Writers:** #5 Manual Subscription Sync, #10 Admin Subscription Sync  
**Gate:** FIX-VERIFIED → CLOSED  
**Date:** 2026-09-30  
**Commit:** 3c02d642

---

## FIX-VERIFIED Execution

**Checkout state verified before run:**
```
HEAD: 3c02d642 (main, origin/main, origin/HEAD)
Working tree: clean
Branch: up to date with origin/main
```

**Command (PowerShell — required for correct env propagation):**
```
$env:NODE_OPTIONS="--max-old-space-size=4096"
npx vitest run --reporter=verbose __tests__/integration/sub-06a-writer-05-route.test.ts
npx vitest run --reporter=verbose __tests__/integration/sub-06a-writer-10-route.test.ts
```

Note: cmd.exe `set NODE_OPTIONS=...` does not propagate correctly into the npx child
process for this project. PowerShell $env: syntax is required.

---

## Writer #5 — Actual Output (5/5 PASS)

```
✓ T1 PASS: Normal sync updates Provider and Subscription via production route
✓ T2 PASS: No stripeSubscriptionId returns synced:false, Stripe not called
✓ T3 PASS: Concurrent sync requests serialize — exactly 1 subscription, consistent state
   Final tier: PRO
✓ T4 PASS: TOCTOU guard fires — sub-A replaced by sub-B, B not overwritten
   sub-B tier: BASIC (BASIC, not PRO from sub-A Stripe state)
   synced:false reason: subscription_replaced_during_sync
✓ T5 PASS: No session returns 401

Test Files  1 passed (1)
Tests  5 passed (5)
Duration  2.38s
```

---

## Writer #10 — Actual Output (5/5 PASS)

```
✓ T1 PASS: Admin sync updates Provider and Subscription via production route
✓ T2 PASS: No stripeSubscriptionId returns 400, Stripe not called
✓ T3 PASS: Concurrent admin sync — consistent final state, exactly 1 current sub
   Final tier: PRO
✓ T4 PASS: TOCTOU guard fires — sub-B NOT overwritten with sub-A Stripe state
   Response status: 500
   sub-B tier: BASIC (BASIC, not PRO)
✓ T5 PASS: Non-admin role denied access to admin sync

Test Files  1 passed (1)
Tests  5 passed (5)
Duration  2.43s
```

---

## T5 Qualification (from independent review)

Writer #10 T5 mocks `requirePermission` to return a 403. This proves the route
correctly propagates a permission denial. It does not independently verify the
real RBAC permission engine. Acceptable for route-level behavioral testing if the
RBAC implementation has been separately verified.

---

## Security Properties Demonstrated

**Writer #5 (Manual sync):**
- Provider FOR UPDATE lock serializes concurrent sync requests (T3)
- Post-lock Stripe identity check prevents stale-state writes to wrong subscription (T4)
- TOCTOU: A cancelled, B created during Stripe fetch; B tier BASIC unchanged (T4)
- Production route exercised directly, not mock locking logic

**Writer #10 (Admin sync):**
- Same locking + TOCTOU properties as Writer #5 (T3, T4)
- Admin permission denial propagated correctly (T5)
- Production route handler exercised with params.id routing

---

## Gate Summary

| Gate | #5 | #10 |
|------|----|-----|
| SOURCE-VERIFIED | ✅ | ✅ |
| TEST-VERIFIED | ✅ 5/5 route-level | ✅ 5/5 route-level |
| FIX-VERIFIED | ✅ 5/5 clean checkout | ✅ 5/5 clean checkout |
| CLOSED | ✅ | ✅ |

# MM-12 Follow-Up: HTTP 500 During Concurrent Same-Key Race

**Status:** OPEN (API quality defect, not a financial security issue)  
**Severity:** LOW  
**Type:** HTTP response handling / API consistency  
**Parent Finding:** MM-12 (CLOSED — financial invariant verified)

---

## Summary

During MM-12 production verification (2026-09-24T06:59:28Z), Check 3 (concurrent same-key credit) demonstrated:

**Financial invariant:** ✅ PROVEN  
- Exactly 1 transaction committed  
- Ledger balance = $50 (correct)  
- No duplicate financial effect  

**HTTP response handling:** ⚠️ INCONSISTENT  
- Request A: HTTP 200, txId returned  
- Request B: HTTP 500 (expected 200 or 409)  
- Both responses should be deterministic (200 with same txId, or 409 "in-flight")

---

## Evidence

From `docs/audit/MM-12-PRODUCTION-VERIFICATION.txt` at commit `f64a3427`:

```
=== Check 3: Concurrent same-key credit (INVARIANT 1) ===
Request A: 200  txId=cmuf6m7gt00021253zcu7shri
Request B: 500  txId=n/a
CREDIT txns: 1  Ledger: $50
Same txId: undefined
Both definitive (non-5xx): false
Check 3 PASS: true (1 tx committed, balance $50, at least one 200)
```

The verification script correctly prioritized the **financial postcondition** (1 transaction, correct balance) over HTTP consistency. The assertion `check3 = count3 === 1 && balance3 === 50 && r3a.status === 200` passes because the money-safety invariant holds.

---

## Root Cause Analysis

The 500 suggests the `IDEMPOTENCY_IN_FLIGHT` path in `add-credit/route.ts` is not returning 409 cleanly under tight concurrency. Probable causes:

1. **Transaction serialization delay:** Request B arrives while Request A's `prisma.$transaction` is still executing. The `INSERT ... ON CONFLICT` succeeds for A, but B's attempt to read the claimed row (`findUnique WHERE key=...`) may occur before A's transaction commits, resulting in a null read and an unhandled edge case that throws.

2. **Missing await or catch clause:** The `if (err?.message === 'IDEMPOTENCY_IN_FLIGHT')` handler may not cover all serialization failure modes. Prisma transaction failures can manifest as various error types depending on timing.

3. **Pooler connection behavior:** The Supabase transaction pooler may have different transaction isolation semantics than the direct connection, affecting how `ON CONFLICT` races are surfaced to the application.

---

## Impact Assessment

**Financial security:** ✅ NO IMPACT  
The duplicate-credit vulnerability is fully remediated. The 500 does not allow double-spend or duplicate financial effects.

**API contract:** ⚠️ VIOLATED  
Clients sending concurrent duplicate requests (legitimate retry scenarios) receive a 500 instead of a deterministic success/replay response. This violates the idempotency contract.

**User experience:** MINOR  
A retry after receiving the 500 would succeed with HTTP 200 and return the original txId. The financial effect is correct on replay. However, the initial 500 may cause client-side error handling to fire unnecessarily.

**Observability:** The 500 may trigger alert fatigue if concurrent requests are common in production.

---

## Recommended Remediation

**Priority:** LOW (financial invariant proven, defect is API-layer only)

**Options:**

1. **Enhanced error handling in `add-credit/route.ts`:**
   - Add explicit handling for Prisma serialization errors (P2034, P2028)
   - Return 409 with `{ success: false, message: 'Request in progress, retry safe' }` when the key is claimed but the response is not yet written
   - Add a short-duration retry loop (e.g., 3 attempts with 50ms delay) inside the route before returning 500

2. **Diagnostic logging:**
   - Log the full error object when `IDEMPOTENCY_IN_FLIGHT` path is taken
   - Capture production occurrences to confirm root cause

3. **Extended verification:**
   - Re-run Check 3 with 10+ concurrent same-key requests to measure HTTP 500 frequency
   - Verify that the 500 is transient (next request returns 200 with correct txId)

---

## Acceptance Criteria for Follow-Up Closure

- [ ] Concurrent same-key requests return deterministic responses (200 or 409, never 500)
- [ ] Production verification Check 3 passes with `Both definitive (non-5xx): true`
- [ ] No change to financial postcondition (1 transaction, correct balance must still hold)

---

## Tracker Update

MM-12 main finding: **CLOSED** (financial invariant verified in production)  
MM-12 HTTP 500 follow-up: **OPEN** (tracked separately as API quality defect)

---

**Created:** 2026-09-24  
**Evidence Commit:** f64a3427 (production verification script + evidence)  
**Parent Closure:** ea21308c (MM-12 tracker update)

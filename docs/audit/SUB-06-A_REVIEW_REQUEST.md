# SUB-06-A Remediation Design - Review Request

**Status:** PENDING INDEPENDENT LINE-BY-LINE REVIEW  
**Document:** `docs/audit/SUB-06-A_REMEDIATION_DESIGN.md`  
**Size:** 1425 lines, 49KB  
**Revision:** 2  

---

## Review Checklist (from Independent Reviewer)

The following items require line-by-line verification before implementation approval:

### 1. ✅ Seven State Writers Coverage
- [ ] Verify ALL 7 state writers are documented
- [ ] Verify EVERY mutation path calls centralized policy function
- [ ] Confirm no ad-hoc guards remain outside policy function

**Seven Writers:**
1. `handleSubscriptionUpdate()` (webhook)
2. `handleSubscriptionCancelled()` (webhook)
3. `handleInvoicePaymentSucceeded()` (webhook)
4. `handleInvoicePaymentFailed()` (webhook)
5. Trial expiry cron (`/api/cron/check-trial-expiry`)
6. Manual sync route (`/api/instructor/subscription/sync`)
7. Registration/checkout routes (initial TRIAL creation)

### 2. ⏳ Event Timestamp Semantics
- [ ] Verify precise semantics of `eventTimestamp` for webhooks (from `event.created`)
- [ ] Verify precise semantics of `eventTimestamp` for manual sync (from Stripe subscription object)
- [ ] Confirm what field is used from Stripe: `subscription.created` vs `latest_invoice.created` vs `subscription.current_period_start`

### 3. ⏳ Equal Timestamp Handling
- [ ] Verify behavior when `eventTimestamp === lastWebhookEventTimestamp`
- [ ] Confirm idempotency key prevents duplicates
- [ ] Confirm transaction serialization handles truly concurrent events
- [ ] Verify no deadlocks or race conditions

### 4. ⏳ Atomic Transaction/Locking
- [ ] Verify SERIALIZABLE transaction isolation used
- [ ] Confirm `withSerializableRetry()` wraps all state mutations
- [ ] Verify no mutations outside transaction boundaries
- [ ] Check for potential deadlocks (multiple handlers updating same provider)

### 5. ⏳ Migration/Backfill Safety
- [ ] Verify backfill strategy: `NOW()` vs first-webhook bootstrap
- [ ] Confirm `NOW()` backfill does NOT reject legitimate post-migration events
- [ ] Check: if backfill sets watermark to NOW, and a legitimate webhook arrives with `event.created < NOW`, is it incorrectly rejected?
- [ ] Verify migration rollback procedure

### 6. ⏳ Manual Stripe Reads vs Webhook Races
- [ ] Verify manual sync fetches current Stripe state
- [ ] Confirm manual sync timestamp comparison logic
- [ ] Check: manual sync completes, then fresher webhook arrives → webhook overwrites manual sync
- [ ] Check: webhook arrives, then manual sync fetches staler Stripe state → manual sync blocked
- [ ] Verify no data corruption from race conditions

### 7. ⏳ `subscription.created` Handling
- [ ] Verify `subscription.created` for NEW subscription after cancellation (allowed)
- [ ] Verify `subscription.created` for SAME subscription ID (should be idempotent, not duplicate row)
- [ ] Confirm `handleSubscriptionUpdate()` handles both `.created` and `.updated` events
- [ ] Check: does `.created` for existing subscription ID get blocked or merged?

### 8. ⏳ All CANCELLED Resurrection Paths
- [ ] `subscription.updated` → CANCELLED ✅ (documented)
- [ ] `invoice.payment_succeeded` → CANCELLED ✅ (documented)
- [ ] `invoice.payment_failed` → CANCELLED ✅ (documented)
- [ ] `subscription.created` (same ID) → CANCELLED (verify)
- [ ] Manual sync → CANCELLED ✅ (documented)
- [ ] Cron expiry → CANCELLED (should not occur, but verify)

### 9. ⏳ 16 Test Cases
- [ ] T1-T16 all defined with precise assertions
- [ ] All tests use signed HTTP webhook endpoint (not handler mocks)
- [ ] Verify test cleanup (no test data pollution)
- [ ] Verify tests cover concurrent events (not just sequential)
- [ ] Check T16 migration bootstrap test validity

### 10. ⏳ Signed HTTP Webhook Testing
- [ ] Verify test harness generates valid Stripe signatures
- [ ] Confirm tests hit `/api/stripe/webhook` endpoint (not handler functions)
- [ ] Verify signature validation not bypassed in tests
- [ ] Check test environment isolation (separate database)

### 11. ⏳ Rollback/Migration Procedures
- [ ] Database rollback procedure documented
- [ ] Feature flag rollback procedure documented
- [ ] Verify rollback does NOT corrupt data
- [ ] Confirm rollback tested in staging

---

## Document Sections

The full document contains:

1. **Part 1:** Complete State Writer Inventory (7 writers, lines 106-403)
2. **Part 2:** Authoritative State Machine Design (centralized policy function, lines 404-750)
3. **Part 3:** State Machine Diagram (lines 751-770)
4. **Part 4:** Affected Database Schema (migration SQL, lines 771-810)
5. **Part 5:** Required Code Changes (all 7 handlers updated, lines 811-1180)
6. **Part 6:** Regression Test Coverage (16 tests, T1-T16, lines 1181-1330)
7. **Part 7:** Production Verification Plan (lines 1331-1370)
8. **Part 8:** Rollback Plan (lines 1371-1390)
9. **Part 9:** Risk Assessment (lines 1391-1410)
10. **Part 10:** Acceptance Criteria (lines 1411-1425)
11. **Part 11:** Independent Review Corrections (lines not yet added)

---

## Critical Sections for Review

**Most critical for line-by-line review:**

1. **Centralized Policy Function** (Part 2, ~150 lines)
   - Layered guard logic
   - Terminal state rules
   - Timestamp comparison
   - Manual sync authority

2. **Handler Updates** (Part 5, ~370 lines)
   - How each writer calls policy function
   - What happens when `allowed === false`
   - Watermark updates
   - Transaction boundaries

3. **Test Scenarios** (Part 6, ~150 lines)
   - 16 test cases with precise assertions
   - HTTP webhook testing requirements
   - Concurrent event testing

4. **Migration Strategy** (Part 2 + Part 4, ~80 lines)
   - Bootstrap policy for NULL watermark
   - Backfill SQL
   - Safety analysis

---

## How to Retrieve Document

The document is located at:
```
e:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook\docs\audit\SUB-06-A_REMEDIATION_DESIGN.md
```

**File stats:**
- Size: 49,219 bytes
- Lines: 1,425
- Format: Markdown

**Sections:**
- 11 main parts
- 7 state writer detailed analysis
- 1 centralized policy function (TypeScript)
- 6 handler update pseudocode blocks
- 16 test scenario definitions
- 3 state transition diagrams
- Migration SQL + rollback procedures

---

## Current Gate Status

```
SUB-06-A
├─ Discovery                 ✅ VERIFIED
├─ Finding validity          ✅ CONFIRMED
├─ Current vulnerability     ✅ CODE-LEVEL EVIDENCE
├─ Severity MEDIUM          ✅ CONFIRMED
├─ Initial Design (Rev 1)    ✅ COMPLETE
├─ Design Revision 2         ✅ COMPLETE
├─ Independent Review        ⏳ PENDING LINE-BY-LINE
├─ Review Checklist         ⏳ 0/11 items verified
├─ Implementation           ❌ BLOCKED (pending approval)
└─ Production Verification   ❌ BLOCKED
```

---

## Next Steps

1. **Reviewer:** Retrieve full document from path above
2. **Reviewer:** Complete 11-item checklist
3. **Reviewer:** Provide line-by-line feedback or approval
4. **If approved:** Proceed to implementation
5. **If changes required:** Revise design (Revision 3)

**Implementation remains blocked until independent review complete.**

# SUB-22 Step 5 — Verification Execution Checklist

**Date Created:** 2026-09-11  
**GitHub Commits:**
- Migration + Documentation: `5e418622`
- Webhook Fix Applied: `b0978b6d`
- Syntax Fix: `1dda46dd`

**Status:** 🚧 VERIFICATION IN PROGRESS — PRODUCTION MIGRATION BLOCKED

---

## ⚠️ CRITICAL GATE

**PRODUCTION MIGRATION BLOCKED** until all required tests pass with recorded evidence.

Syntax being correct does NOT prove the race condition fix works under concurrent requests.

---

## VERIFICATION PHASES

### PHASE 1: DATABASE MIGRATION (Dev/Staging Only)

#### 1.1 Migration Application
- [ ] **REQUIRED:** Run migration against dev/staging database ONLY
  - Command: `npx prisma migrate deploy`
  - Environment: `DATABASE_URL` must point to dev/staging (NOT production)
  - Result: `[ PENDING ]`
  - Evidence: (migration output to be recorded)

#### 1.2 Index Verification
- [ ] **REQUIRED:** Confirm partial unique indexes exist in PostgreSQL
  - Query:
    ```sql
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'Subscription' 
    AND indexname LIKE '%unique%';
    ```
  - Expected indexes:
    1. `Subscription_provider_current_unique` on `providerId` WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
    2. `Subscription_stripeSubscriptionId_unique` on `stripeSubscriptionId` WHERE `stripeSubscriptionId` IS NOT NULL
  - Result: `[ PENDING ]`
  - Evidence: (query output to be recorded)

---

### PHASE 2: BUILD VERIFICATION

#### 2.1 TypeScript Compilation
- [ ] **REQUIRED:** Full production build must succeed
  - Command: `npm run build`
  - Expected: Zero TypeScript errors
  - Result: `[ PENDING ]`
  - TypeScript Error Count: `[ TBD ]`
  - Build Output: (to be recorded)

#### 2.2 Build Artifacts
- [ ] **REQUIRED:** Verify `.next` directory created successfully
  - Result: `[ PENDING ]`

---

### PHASE 3: EXISTING TEST SUITE

#### 3.1 Webhook Test Execution
- [ ] **REQUIRED:** Run existing webhook tests
  - Command: `npm test -- app/api/stripe/webhook`
  - Result: `[ PENDING ]`
  - Tests Passed: `[ TBD ]`
  - Tests Failed: `[ TBD ]`
  - Failures Recorded: (do NOT mask failures - document them)

#### 3.2 Integration Test Execution
- [ ] **OPTIONAL:** Run integration tests if they exist
  - Command: `npm test -- __tests__/integration`
  - Result: `[ PENDING ]`

---

### PHASE 4: REAL WEBHOOK ROUTE CONCURRENCY TESTS

**CRITICAL:** These tests must use the actual production webhook route (`app/api/stripe/webhook/route.ts`), NOT `simulateWebhookTransaction()`.

The existing test file `app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts` currently uses `simulateWebhookTransaction()` which mimics the OLD vulnerable code. This MUST be updated.

#### 4.1 Test Suite Update Required
- [ ] **BLOCKER:** Update test to invoke real webhook handler
  - Current: Uses `simulateWebhookTransaction()` (mimics old findFirst→update)
  - Required: Direct invocation of actual `handleSubscriptionUpdate()` or full webhook POST
  - Result: `[ PENDING ]`

#### 4.2 Scenario A: Identical Events (Idempotency)
- [ ] **REQUIRED:** Two identical Stripe events arrive concurrently
  - Test: Fire same `customer.subscription.created` event twice concurrently
  - Expected: Only one `webhookEvent` row created (idempotency)
  - Expected: Only one subscription row updated
  - Result: `[ PENDING ]`
  - Evidence:
    - Webhook events created: `[ TBD ]`
    - Subscription rows affected: `[ TBD ]`
    - Final subscription count: `[ TBD ]`

#### 4.3 Scenario B: Different Stripe IDs Competing (CONFLICT DETECTION)
- [ ] **REQUIRED:** Two different Stripe subscription IDs race for same trial
  - Test: Fire `sub_test_A` and `sub_test_B` concurrently for same `providerId`
  - Expected: Exactly ONE subscription survives with its Stripe ID
  - Expected: The LOSING request throws error with "Stripe subscription ID conflict"
  - Expected: NO silent overwrite of Stripe IDs
  - Result: `[ PENDING ]`
  - Evidence:
    - Subscription A result: `[ TBD ]` (success/error)
    - Subscription B result: `[ TBD ]` (success/error)
    - Final subscription count: `[ TBD ]` (MUST be 1)
    - Winner Stripe ID: `[ TBD ]`
    - Loser error message: `[ TBD ]`
  - **NEGATIVE TEST:** Verify loser request fails safely, NOT silently

#### 4.4 Scenario C: Replay After Success (Duplicate Delivery)
- [ ] **REQUIRED:** Same event replayed after successful processing
  - Test: Process `customer.subscription.created` → verify success → replay same event
  - Expected: Second attempt returns success (idempotent) without duplicate row
  - Result: `[ PENDING ]`
  - Evidence:
    - First attempt: `[ TBD ]`
    - Second attempt: `[ TBD ]`
    - Final subscription count: `[ TBD ]` (MUST be 1)

#### 4.5 Scenario D: P2034 Serialization Failure (SERIALIZABLE Retry)
- [ ] **REQUIRED:** SERIALIZABLE transaction conflict triggers retry
  - Test: Create high-contention scenario (e.g., triple concurrent updates)
  - Expected: `withSerializableRetry` catches P2034 and retries
  - Expected: Final state is consistent (one subscription per provider)
  - Result: `[ PENDING ]`
  - Evidence:
    - P2034 errors detected: `[ TBD ]`
    - Retry attempts: `[ TBD ]`
    - Final success: `[ TBD ]`
    - Final subscription count: `[ TBD ]`

#### 4.6 Scenario E: P2002 Same Stripe ID (Idempotent Success)
- [ ] **REQUIRED:** P2002 with matching Stripe ID returns idempotent success
  - Test: Concurrent requests with same Stripe ID hit P2002
  - Expected: P2002 handler verifies Stripe ID matches → logs "Idempotent" → returns success
  - Expected: NO error thrown
  - Result: `[ PENDING ]`
  - Evidence:
    - P2002 triggered: `[ TBD ]`
    - Stripe ID verification: `[ TBD ]`
    - Final result: `[ TBD ]` (success expected)

#### 4.7 Scenario F: P2002 Conflicting Stripe ID (ERROR)
- [ ] **REQUIRED:** P2002 with different Stripe ID throws error
  - Test: Concurrent requests with different Stripe IDs (`sub_A` vs `sub_B`)
  - Expected: P2002 handler detects mismatch → logs "SUB-22 CONFLICT" → throws error
  - Expected: Error message: "Stripe subscription ID conflict for provider {id}: existing={sub_A}, incoming={sub_B}"
  - Result: `[ PENDING ]`
  - Evidence:
    - P2002 triggered: `[ TBD ]`
    - Stripe ID mismatch detected: `[ TBD ]`
    - Error thrown: `[ TBD ]`
    - Error message: `[ TBD ]`

---

### PHASE 5: DATABASE STATE VERIFICATION

After running all concurrency tests, verify database invariants hold.

#### 5.1 Uniqueness Invariant: At Most One Current Subscription Per Provider
- [ ] **REQUIRED:** At most one TRIAL per provider
  - Query:
    ```sql
    SELECT providerId, COUNT(*) 
    FROM "Subscription" 
    WHERE status = 'TRIAL' 
    GROUP BY providerId 
    HAVING COUNT(*) > 1;
    ```
  - Expected: Zero rows (no duplicates)
  - Result: `[ PENDING ]`
  - Violations Found: `[ TBD ]`

- [ ] **REQUIRED:** At most one ACTIVE per provider
  - Query:
    ```sql
    SELECT providerId, COUNT(*) 
    FROM "Subscription" 
    WHERE status = 'ACTIVE' 
    GROUP BY providerId 
    HAVING COUNT(*) > 1;
    ```
  - Expected: Zero rows
  - Result: `[ PENDING ]`
  - Violations Found: `[ TBD ]`

- [ ] **REQUIRED:** At most one PAST_DUE per provider
  - Query:
    ```sql
    SELECT providerId, COUNT(*) 
    FROM "Subscription" 
    WHERE status = 'PAST_DUE' 
    GROUP BY providerId 
    HAVING COUNT(*) > 1;
    ```
  - Expected: Zero rows
  - Result: `[ PENDING ]`
  - Violations Found: `[ TBD ]`

#### 5.2 Stripe ID Integrity
- [ ] **REQUIRED:** No unintended subscription replacement
  - Query:
    ```sql
    SELECT providerId, stripeSubscriptionId, status, createdAt, updatedAt
    FROM "Subscription"
    WHERE providerId IN (SELECT providerId FROM test_providers)
    ORDER BY providerId, createdAt;
    ```
  - Verify: Correct Stripe IDs retained after concurrent tests
  - Result: `[ PENDING ]`
  - Evidence: (query output to be recorded)

#### 5.3 Historical Records Preserved
- [ ] **REQUIRED:** EXPIRED and CANCELLED subscriptions NOT overwritten
  - Query:
    ```sql
    SELECT COUNT(*) 
    FROM "Subscription" 
    WHERE status IN ('EXPIRED', 'CANCELLED');
    ```
  - Expected: Historical records remain unchanged
  - Result: `[ PENDING ]`

---

## PHASE 6: PRODUCTION GATE

### 6.1 Gate Status

**PRODUCTION MIGRATION STATUS:** 🔴 **BLOCKED**

All required tests MUST pass before production migration is authorized.

**Blocking Issues:**
1. Migration not run (dev/staging)
2. Build verification not complete
3. Concurrency tests not updated (still using `simulateWebhookTransaction`)
4. Real webhook route tests not executed
5. Database invariants not verified

### 6.2 Approval Checklist

Production migration authorized ONLY when:
- [x] GitHub commits verified (5e418622, b0978b6d, 1dda46dd)
- [ ] Dev/staging migration successful
- [ ] Partial unique indexes confirmed in PostgreSQL
- [ ] Build passes with zero TypeScript errors
- [ ] Existing tests pass (or failures documented and acceptable)
- [ ] Concurrency tests updated to use real webhook route
- [ ] All 6 concurrency scenarios pass with evidence
- [ ] Database uniqueness invariants verified (zero violations)
- [ ] Stripe ID integrity verified
- [ ] Historical EXPIRED/CANCELLED records preserved

**Authorized By:** `[ PENDING ]`  
**Date Authorized:** `[ PENDING ]`

---

## EVIDENCE LOG

### Migration Output
```
[ PENDING - to be recorded after execution ]
```

### Build Output
```
[ PENDING - to be recorded after execution ]
```

### Test Execution Logs
```
[ PENDING - to be recorded after execution ]
```

### Database Query Results
```
[ PENDING - to be recorded after execution ]
```

### Failure Analysis
```
[ PENDING - any test failures will be documented here with root cause analysis ]
```

---

## NOTES

1. **Syntax correctness ≠ Race condition fixed:** The fact that commit 1dda46dd fixed syntax errors does NOT prove the concurrent webhook logic works correctly. Evidence required.

2. **Negative testing required:** For Scenario 4.3 (different Stripe IDs), verify that exactly one request succeeds and the other fails with a proper error, rather than just checking that an error was thrown somewhere.

3. **Real webhook path required:** The existing test suite uses `simulateWebhookTransaction()` which mimics the OLD vulnerable code. Tests MUST be updated to exercise the actual production webhook handler with the new atomic `updateMany()` logic.

4. **No production database:** Do NOT run `npx prisma migrate deploy` against production until this checklist is complete and approved.

---

**Last Updated:** 2026-09-11  
**Document Version:** 1.0  
**Status:** Awaiting execution

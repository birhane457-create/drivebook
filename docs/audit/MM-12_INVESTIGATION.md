# MM-12: Admin Wallet Credit Idempotency — Investigation

**Finding ID:** MM-12  
**Risk:** MEDIUM  
**Status:** VERIFIED (source verification in progress)  
**Investigation Started:** 2026-08-15

---

## Finding Summary

Admin wallet credit/debit routes lack request-level idempotency protection. No idempotency key mechanism exists, and concurrent requests can result in:
- **Double credit:** Two concurrent add-credit requests → two transactions
- **Double debit:** Two concurrent deduct-credit requests → two transactions
- **Balance inconsistency:** Race between balance read and transaction write

Additionally, current implementation bypasses the atomic wallet-write pattern documented in `wallet-helpers.ts`, creating potential consistency gaps.

---

## MM-12-A: Source Verification

### Objective
Map all admin wallet entry points, trace shared helpers, inspect schema/indexes, identify existing idempotency mechanisms, and check authorization/limits.

### Entry Points to Investigate

1. **Admin Add Credit Route**
   - Path: `app/api/admin/wallet/[userId]/add-credit/route.ts`
   - Status: ⏳ Pending review

2. **Admin Deduct Credit Route**
   - Path: `app/api/admin/wallet/[userId]/deduct-credit/route.ts`
   - Status: ⏳ Pending review

3. **Shared Wallet Helpers**
   - Path: `lib/services/wallet-helpers.ts`
   - Status: ⏳ Pending review
   - Note: Source comments indicate atomic transaction + balance update pattern

4. **WalletTransaction Model**
   - Path: `prisma/schema.prisma`
   - Status: ⏳ Pending review
   - Check: Indexes, unique constraints, idempotency fields

5. **Related Services**
   - Wallet service initialization
   - Audit logging integration
   - Receipt/notification services

---

## MM-12-A Detailed Analysis

### 1. Admin Add Credit Route

**File:** `app/api/admin/clients/[id]/wallet/add-credit/route.ts`

**Current Flow:**
```
1. getServerSession() + checkPermission(PERM.FINANCE_CREDITS_MANAGE)
2. Parse amount, reason from request body
3. Enforce maxRefundAmount limit (non-super-admin)
4. Resolve userId from params.id (try Customer, then User)
5. getOrCreateWallet(userId)
6. getWalletBalance(userId) → balanceBefore
7. prisma.walletTransaction.create() ← NO TRANSACTION WRAPPER
8. getWalletBalance(userId) → newBalance
9. auditLog.create() (try/catch, non-critical)
10. sendAdminCreditReceipt() (try/catch, non-critical)
11. Return success response
```

**Idempotency Check:**
- ❌ Request ID header: **NOT PRESENT**
- ❌ Database uniqueness constraint: **NONE** (only stripePaymentIntentId unique index exists, not applicable to admin ops)
- ❌ In-memory deduplication: **NONE**
- ❌ Frontend button disable only: **INSUFFICIENT** (network retry bypasses)

**Authorization:**
- ✅ Permission check: `PERM.FINANCE_CREDITS_MANAGE`
- ✅ Credit amount limits: `maxRefundAmount` enforced for non-super-admin
- ✅ Staff member identification: Session-based, recorded in audit log

**Critical Finding:**
- Direct `walletTransaction.create()` call **outside transaction wrapper**
- No atomic update of `ClientWallet.balance` field
- Balance recalculated via `getWalletBalance()` after write (eventually consistent)

---

### 2. Admin Deduct Credit Route

**File:** `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts`

**Current Flow:**
```
1. getServerSession() + checkPermission(PERM.USERS_CUSTOMERS_WALLET_DEDUCT)
2. Parse amount, reason from request body
3. Validate reason.trim().length >= 3
4. Enforce maxRefundAmount limit (non-super-admin)
5. Resolve userId from params.id (try Customer, then User)
6. getOrCreateWallet(userId)
7. getWalletBalance(userId) → balanceBefore
8. CHECK: balanceBefore.balance < amount → 400 error ← RACE WINDOW
9. prisma.walletTransaction.create() ← NO TRANSACTION WRAPPER
10. getWalletBalance(userId) → newBalance
11. auditLog.create() (try/catch, non-critical)
12. sendAdminDeductionReceipt() (try/catch, non-critical)
13. Return success response
```

**Balance Check:**
- ❌ Read-modify-write atomicity: **NO** (step 7-9 not atomic)
- ⚠️ Negative balance prevention: **PARTIAL** (check at line 86, but race possible)
- ❌ Concurrent deduction protection: **NONE**

**Race Condition Example:**
```
Time  Request A ($50)           Request B ($50)           Wallet Balance
────────────────────────────────────────────────────────────────────────
  t1  Read balance: $60         —                         $60
  t2  Check: 60 >= 50 ✓         —                         $60
  t3  —                         Read balance: $60         $60
  t4  —                         Check: 60 >= 50 ✓         $60
  t5  Create DEBIT $50          —                         $10 (after A)
  t6  —                         Create DEBIT $50          -$40 (negative!)
```

**Critical Findings:**
1. Balance check (line 86) and transaction create (line 89) not atomic
2. Two concurrent $50 deductions against $60 balance → both pass check → negative balance
3. No database constraint prevents negative balance (WalletTransaction has no CHECK constraint)
4. Same `maxRefundAmount` limit applies to deductions (appropriate)

---

### 3. Wallet Helpers Analysis

**File:** `lib/services/wallet-helpers.ts`

**Documented Pattern (from source comments):**
```typescript
/**
 * Write pattern (enforced everywhere):
 *   1. Create WalletTransaction (CREDIT or DEBIT, status: CONFIRMED)
 *   2. Update ClientWallet.balance with matching increment/decrement
 *   Both steps MUST be inside the same $transaction to prevent drift.
 */
```

**Key Functions:**

1. **getWalletBalance(userId)**
   - ✅ Authoritative source of truth
   - Aggregates all CONFIRMED WalletTransaction records
   - Uses Decimal for exact precision
   - Ignores `ClientWallet.balance` stored field (cache only)

2. **getOrCreateWallet(userId)**
   - Creates wallet if missing
   - No transaction wrapper (acceptable for idempotent operation)

3. **reconcileWalletBalance(userId)**
   - Detects drift between stored balance and ledger
   - Corrects `ClientWallet.balance` if drift > $0.01
   - Creates audit log for correction
   - Used for scheduled reconciliation

**Usage by Admin Routes:**
- ✅ Admin routes use `getWalletBalance()` for reading (correct)

---

### 4. WalletTransaction Schema

**File:** `prisma/schema.prisma`

```prisma
[Schema will be extracted here]
```

**Key Questions:**
- Existing indexes: ❓
- Unique constraints: ❓
- Idempotency key field: ❓
- Admin adjustment fields: ❓
- Composite keys available: ❓

---

### 5. Frontend Behavior

**Files to Check:**
- Admin wallet UI components
- HTTP client retry configuration
- Button disable logic
- Error handling/retry

**Scenarios:**
- User double-clicks submit: ❓
- Network timeout triggers retry: ❓
- Server responds 200 but client doesn't receive: ❓

---

## MM-12-B: Attack/Race Verification Plan

### Test Suite Requirements

**Sequential Double Submission:**
```typescript
// Test: Same admin submits identical credit twice
// Expected: Second request should be idempotent (return original result)
// Current behavior: [Unknown - needs test]
```

**Concurrent Double Submission:**
```typescript
// Test: Two identical requests submitted concurrently
// Expected: One financial adjustment only
// Current behavior: [Unknown - needs test]
```

**Different Amount, Same Key:**
```typescript
// Test: Same idempotency key with different amount
// Expected: Reject with conflict error
// Current behavior: [No key exists]
```

**Different Customer, Same Key:**
```typescript
// Test: Same key against different customer
// Expected: Reject with conflict error
// Current behavior: [No key exists]
```

**Network Retry After Success:**
```typescript
// Test: Request succeeds but client retries due to timeout
// Expected: Return original result, no duplicate credit
// Current behavior: [Unknown - needs test]
```

**Concurrent Deduction Race:**
```typescript
// Test: Two $50 deductions against $60 balance
// Expected: One succeeds, one fails with insufficient funds
// Current behavior: [Unknown - needs test]
```

---

## MM-12-C: Design Verification (Future)

### Idempotency Key Design Considerations

**Option 1: Request-Level Idempotency Key**
- Client provides `Idempotency-Key` header
- Database unique constraint on (key, operation_type)
- TTL/cleanup strategy needed

**Option 2: Server-Generated Operation ID**
- Server generates UUID for each adjustment
- Requires deterministic retry detection
- May not prevent client-side double submission

**Option 3: Composite Business Key**
- (staffId, targetUserId, amount, reason, timestamp_bucket)
- Risk: Legitimate duplicate operations rejected
- Benefit: No explicit key management

**Preferred Approach:** [TBD after MM-12-A complete]

### Atomicity Requirements

**Current Issue:** Admin routes call `walletTransaction.create()` directly

**Expected Pattern (from wallet-helpers.ts):**
```typescript
prisma.$transaction([
  walletTransaction.create(...),
  user.update({ wallet: { balance: newBalance } })
])
```

**Questions:**
1. Why do admin routes bypass this pattern?
2. Does cached balance (user.wallet.balance) stay consistent?
3. What happens if transaction create succeeds but balance update fails?

---

## MM-12-A Checklist

- ✅ Map add-credit route complete flow
- ✅ Map deduct-credit route complete flow
- ✅ Extract wallet-helpers.ts atomic pattern
- ✅ Document WalletTransaction schema
- ✅ Identify all wallet write paths (admin add/deduct confirmed)
- ✅ Check for existing idempotency mechanism (NONE for admin ops)
- ✅ Verify authorization and limits (checkPermission + maxRefundAmount)
- ✅ Trace audit logging integration (non-critical try/catch)
- ⏳ Review frontend retry behavior (deferred - backend has no protection)
- ✅ Document race conditions (deduct-credit balance check TOCTOU)
- ✅ Assess balance consistency mechanism (eventually consistent via ledger)

---

## MM-12-A Summary of Findings

### Confirmed Vulnerabilities

**1. Double Credit/Debit (Sequential or Concurrent)**
- **Root Cause:** No idempotency key or database uniqueness constraint
- **Attack Vector:** 
  - Admin double-clicks submit button
  - Network retry after ambiguous response
  - Two admins submit identical adjustment
  - Admin opens multiple tabs
- **Impact:** Customer receives/loses funds multiple times for single intended operation
- **Severity:** MEDIUM (admin-triggered only, not customer-exploitable)

**2. Concurrent Deduction Race → Negative Balance**
- **Root Cause:** Balance check (line 86) and transaction create (line 89) not atomic
- **Attack Vector:**
  ```
  Wallet: $60
  Request A: Deduct $50 → reads $60 → check passes
  Request B: Deduct $50 → reads $60 → check passes
  Request A: Creates DEBIT $50 → balance now $10
  Request B: Creates DEBIT $50 → balance now -$40 (NEGATIVE)
  ```
- **Impact:** Wallet goes negative, customer can book lessons without funds
- **Severity:** MEDIUM (rare in practice, requires concurrent admin actions)

**3. Wallet Consistency Drift**
- **Root Cause:** Admin routes bypass documented atomic write pattern
- **Documented Pattern:** Create transaction + update balance in SAME transaction
- **Actual Behavior:** Create transaction, then read balance separately
- **Mitigation:** `reconcileWalletBalance()` cron eventually corrects drift
- **Impact:** `ClientWallet.balance` cached field may be stale temporarily
- **Severity:** LOW (balance is recalculated from ledger, not trusted directly)

### Authorization & Limits (Verified Correct)

✅ Permission checks enforced:
- Add credit: `PERM.FINANCE_CREDITS_MANAGE`
- Deduct credit: `PERM.USERS_CUSTOMERS_WALLET_DEDUCT`

✅ Amount limits enforced:
- Non-super-admin staff limited by `maxRefundAmount`
- Super-admin has no limit

✅ Audit logging:
- Every adjustment recorded with actorId, amount, reason
- Non-critical (try/catch) - doesn't block operation if audit fails

### Missing Controls

❌ **No idempotency key field** in WalletTransaction model  
❌ **No request-level idempotency** (no header check, no cache)  
❌ **No database uniqueness constraint** for admin adjustments  
❌ **No atomic balance check + debit** in deduct route  
❌ **No CHECK constraint** preventing negative balance  
❌ **No enum types** for WalletTransaction.type/status fields

---

## MM-12-A Conclusion

**Status:** VERIFIED - Finding confirmed in source  
**Risk:** MEDIUM  
**Exploitability:** Low (requires admin access)  
**Financial Impact:** Medium (can result in double-credit/debit, negative balance)

### Next Steps

1. ✅ **MM-12-A Complete** - Source verification done
2. ⏳ **MM-12-B** - Create hostile concurrency tests
3. ⏳ **MM-12-C** - Design idempotency mechanism  
4. ⏳ **MM-12-D** - Implement fix with database-enforced uniqueness
5. ⏳ **MM-12-E** - Verify atomicity and test all scenarios

### Recommended Fix Design (Preliminary)

**Option 1: Request-Level Idempotency Key (Preferred)**
```prisma
model WalletTransaction {
  // ... existing fields ...
  adminIdempotencyKey String? @unique
  staffMemberId       String?  // Who performed the adjustment
}
```

**Backend Changes:**
1. Client provides `Idempotency-Key` header
2. Server checks for existing transaction with same key
3. If exists: Return original result (idempotent)
4. If not exists: Create transaction with key
5. Database unique constraint prevents race

**Option 2: Composite Business Key**
```prisma
@@unique([walletId, staffMemberId, amount, createdAtBucket])
```
- Risk: Legitimate duplicate operations rejected
- Benefit: No explicit key management needed

**For Deduct Race:**
- Wrap balance check + transaction create in SERIALIZABLE transaction
- Or use optimistic locking with ClientWallet version field

---

## Initial Risk Assessment

**Financial Impact:**
- Double credit: Customer receives unearned funds
- Double debit: Customer loses funds without proper authorization
- Balance inconsistency: Ledger vs cached balance mismatch

**Likelihood:**
- Network retry: HIGH (common in production)
- User double-click: MEDIUM (depends on UI)
- Concurrent admin actions: LOW (rare but possible)

**Severity:** MEDIUM (financial impact, but admin-triggered only, not customer-exploitable)

---

## Next Steps

1. Complete MM-12-A source verification
2. Create isolated test environment for MM-12-B
3. Write hostile concurrency tests
4. Design idempotency mechanism based on findings
5. Implement fix with database-enforced uniqueness
6. Verify atomicity with wallet-helpers pattern

---

**Investigation Lead:** [Automated audit process]  
**Last Updated:** 2026-08-15  
**Status:** MM-12-A in progress

- ❌ **Admin routes bypass atomic write pattern** (critical deviation):
  - `wallet-helpers.ts` documents: "Both steps MUST be inside the same $transaction"
  - Admin add-credit: Creates transaction, then reads balance separately
  - Admin deduct-credit: Creates transaction, then reads balance separately
  - No `ClientWallet.balance` update in admin routes
  
**Why This Works (Despite Bypass):**
- `ClientWallet.balance` is explicitly marked as "cache only" in source comments
- `getWalletBalance()` recalculates from WalletTransaction ledger (source of truth)
- `reconcileWalletBalance()` cron corrects drift if it occurs
- This design is **eventually consistent** rather than immediately consistent

**Why This is Still a Problem:**
- Admin routes create wallet transactions **without any idempotency protection**
- Concurrent requests → duplicate transactions → incorrect ledger
- Balance check in deduct route is **not atomic** with transaction creation

---

### 4. WalletTransaction Schema

**File:** `prisma/schema.prisma`

```prisma
model WalletTransaction {
  id          String       @id @default(cuid())
  walletId    String
  amount      Decimal      @db.Decimal(12, 2)
  type        String       // "CREDIT" or "DEBIT"
  description String?
  status      String       @default("PENDING")  // Usually "CONFIRMED" for admin ops
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  metadata    Json?
  bookingId   String?
  wallet      ClientWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
}

// NOTE: Unique index exists on metadata->>'stripePaymentIntentId'
// See migration: 20260911000000_add_wallet_transaction_payment_intent_unique
// This prevents P0-01B concurrent double-credit attacks
```

**Key Observations:**
- ❌ **NO idempotency key field** for admin adjustments
- ✅ Existing unique index on `metadata->>'stripePaymentIntentId'` (Stripe payments only)
- ❌ No unique constraint on (walletId, adminStaffId, amount, timestamp)
- ❌ No enum type for `type` field (just String)
- ❌ No enum type for `status` field (just String)
- ❌ No CHECK constraint preventing negative wallet balance
- ⚠️ `bookingId` field suggests some transactions are booking-linked (not admin adjustments)

**Indexes:**
- Primary key: `id` (cuid)
- Foreign key: `walletId` → ClientWallet
- Unique: `metadata->>'stripePaymentIntentId'` (for P0-01B protection)
- **Missing:** No index/constraint for admin adjustment idempotency

**Potential Idempotency Solutions:**
1. Add `adminAdjustmentIdempotencyKey String? @unique` field
2. Add composite unique constraint on (walletId, staffId, amount, reason, createdAt_bucket)
3. Use existing `metadata` JSON field with unique partial index

---

### 5. Frontend Behavior

**Files to Check:**
- Admin wallet UI components: ⏳ Pending
- HTTP client retry configuration: ⏳ Pending
- Button disable logic: ⏳ Pending
- Error handling/retry: ⏳ Pending

**Preliminary Assessment (Based on Backend Analysis):**
- Backend has NO idempotency protection
- If frontend disables button: Prevents user double-click but NOT network retry
- If network timeout occurs: Client may retry with different request ID → duplicate
- If 200 response lost: Client sees failure, admin retries → duplicate

**Scenarios:**
- ❌ User double-clicks submit: Two requests → two credits
- ❌ Network timeout triggers retry: Two requests → two credits
- ❌ Server responds 200 but client doesn't receive: Retry → two credits
- ❌ Admin opens two tabs and submits: Two requests → two credits

---


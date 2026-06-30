# Security Audit Fixes - TODO List

## 🔴 CRITICAL (Priority 1)

### [CRITICAL-1] Admin refund bypasses wallet ledger entirely
- **File:** `app/api/admin/transactions/[transactionId]/refund/route.ts`
- **Issue:** Refund creates Transaction but NO WalletTransaction credit, NO ledger entry
- **Status:** ✅ FIXED
- **Fix:** Added recordFullRefund() call with proper ledger entry creation
- **Risk:** Ledger imbalance, overstated available balance

### [CRITICAL-2] atomicRefund.ts permanently disabled
- **File:** `lib/services/atomicRefund.ts`
- **Issue:** Service throws "Atomic refund service temporarily disabled"
- **Status:** ✅ FIXED
- **Fix:** Updated to deprecation notice guiding to recordFullRefund()
- **Risk:** All atomic refund paths non-functional in production

---

## 🟠 HIGH (Priority 2)

### [HIGH-1] Public reschedule endpoint has IDOR when verificationToken omitted
- **File:** `app/api/public/bookings/[id]/reschedule/route.ts`
- **Issue:** Without verification token, endpoint allows rescheduling ANY booking by ID
- **Status:** ✅ FIXED
- **Fix:** Added mandatory phone/email verification even when token omitted
- **Risk:** Unauthorized booking modifications, no audit trail

### [HIGH-2] Wallet-add idempotency check is fragile
- **File:** `app/api/client/wallet-add/route.ts` line 110
- **Issue:** Uses `description: { contains: paymentIntentId }` string matching
- **Status:** ✅ FIXED
- **Fix:** Changed to metadata.stripePaymentIntentId for reliable deduplication
- **Risk:** Duplicate credits or blocked legitimate transactions

### [HIGH-3] Admin refund does not validate amount ≤ transaction.amount
- **File:** `app/api/admin/transactions/[transactionId]/refund/route.ts` line 69
- **Issue:** No cap on refund amount, over-refund possible
- **Status:** ✅ FIXED
- **Fix:** Added validation: `refundAmount <= transaction.amount` guard
- **Risk:** Over-refunds to Stripe, financial loss

### [HIGH-4] PDA booking has no wallet check or payment verification
- **File:** `app/api/pda-bookings/route.ts` line 138
- **Issue:** Creates status='PENDING' with NO wallet balance check, NO payment intent
- **Status:** ✅ FIXED
- **Fix:** Added getWalletBalance() check before booking creation
- **Risk:** Slots held indefinitely without payment, revenue loss

### [HIGH-9] Admin refund does not update ledger
- **File:** `app/api/admin/transactions/[transactionId]/refund/route.ts`
- **Issue:** No `appendLedgerEntry()` call, PlatformLedger.totalRefunded never incremented
- **Status:** ✅ FIXED
- **Fix:** Added recordFullRefund() call with full ledger entry recording
- **Risk:** Platform ledger becomes unreliable, reconciliation fails

---

## 🟡 MEDIUM (Priority 3)

### [MEDIUM-4] Wallet route has @ts-nocheck + unsafe type comparisons
- **File:** `app/api/client/wallet/route.ts`
- **Issue:** TypeScript suppressed, uses `t.type.toUpperCase()` without enum safety
- **Status:** ✅ FIXED
- **Fix:** Removed @ts-nocheck, used explicit string constants for types
- **Risk:** Silent type errors, data inconsistency

### [MEDIUM-7] Instructor approval unconditionally sets documentsVerified
- **File:** `app/api/admin/instructors/[id]/approve/route.ts` lines 19-24
- **Issue:** Sets `documentsVerified: true` without checking if docs exist
- **Status:** ✅ FIXED
- **Fix:** Added validation of 5 required documents before approval
- **Risk:** Unvetted instructors marked as verified

### [MEDIUM-10] PLATFORM_FEE_RATE hardcoded in multiple files
- **Files:**
  - `app/api/public/bookings/bulk/route.ts` line 531
  - `app/api/bookings/batch/route.ts` line 16
  - `app/api/bookings/route.ts` line 21
- **Issue:** Hardcoded 0.036 instead of reading from DB/config
- **Status:** ✅ FIXED
- **Fix:** Centralized via getPlatformFeeRate() in platform-pricing.ts
- **Risk:** Rate changes require code deploy, config drift

---

## 🔵 LOW (Priority 4)

### [LOW-6] verifyLedgerIntegrity() is a no-op
- **File:** `lib/services/ledger.ts` lines 337-356
- **Issue:** Both debits and credits queries identical, always equal
- **Status:** ✅ FIXED
- **Fix:** Corrected logic with proper documentation for double-entry system
- **Risk:** Invalid integrity check, silent ledger corruption

---

## ✅ ALREADY FIXED / FALSE POSITIVES

### CRITICAL-3: ✅ VERIFIED - check-trial-expiry HAS CRON_SECRET auth
- Correct pattern: `if (!process.env.CRON_SECRET || authHeader !== 'Bearer ...')`

### CRITICAL-4: ✅ VERIFIED - send-trial-expiry-alerts HAS CRON_SECRET auth
- Properly implemented at line 59-60

### CRITICAL-5: ✅ VERIFIED - pda-bookings TOCTOU race FIXED
- Conflict check IS inside `prisma.$transaction()`, race condition patched

### CRITICAL-6: ✅ VERIFIED - create-intent HAS proper validation
- Zod schema with min $10, max $10,000, plus Stripe verification

### CRITICAL-7: ✅ VERIFIED - apply-rate-changes HAS CRON_SECRET auth
- Correct pattern implemented at line 24

### HIGH-5 & HIGH-6: ✅ VERIFIED - Timezone issues FIXED
- Notifications include `timeZone: AU_TZ`
- Email includes `timeZone: 'Australia/Perth'`

---

## Fix Progress

Total Issues: 12
- ⏳ Not Started: 0
- 🔧 In Progress: 0
- ✅ Fixed: 10
- 🚫 Already Fixed/Verified: 2

---

## Deployment Checklist

- [ ] Fix all CRITICAL issues
- [ ] Fix all HIGH issues
- [ ] Fix all MEDIUM issues
- [ ] Run full test suite
- [ ] Security code review
- [ ] Database migration (if needed)
- [ ] Deploy to staging
- [ ] Integration testing
- [ ] Deploy to production
- [ ] Monitor ledger integrity

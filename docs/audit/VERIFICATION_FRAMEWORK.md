# Security Finding Verification Framework

**Purpose**: Independent source-level verification of security remediation claims  
**Approach**: GitHub repository inspection, not Kiro audit document claims  
**Verifier**: Human auditor with repository access  
**Date**: 2026-09-11

---

## Verification Methodology

### Evidence Classification

- **SOURCE VERIFIED** ✅ = Code actually implements the claimed control
- **TEST VERIFIED** 🧪 = Relevant test exists, executes, and passes
- **BUILD VERIFIED** 🔨 = Vercel/CI builds successfully (necessary but NOT sufficient)
- **CLOSED** ✔️ = All three verified + no alternate bypass paths found

### Verification Process

For each finding:

1. **Read the claim** - What does Kiro say was fixed?
2. **Inspect source** - Does the code implement it?
3. **Trace execution** - Follow the actual path through the code
4. **Check tests** - Do tests actually test this scenario?
5. **Find alternates** - Are there bypass routes?
6. **Classify** - Mark status based on evidence

### Key Principle

> A successful Vercel build is NEVER proof that a security or financial finding is fixed.

---

## Findings Registry

### P0-01: Wallet PaymentIntent Ownership

**Status**: 🔍 IN VERIFICATION

**Kiro's Claim**:
- Fixed wallet ownership vulnerability
- Added metadata.userId check
- Added metadata.walletId check
- Fail-closed if metadata missing
- 8 attack tests added

**Files to Inspect**:
- `app/api/client/wallet-add/route.ts` - Main route with ownership checks
- `lib/services/stripe.ts` - PaymentIntent creation with metadata
- `app/api/payments/create-intent/route.ts` - Where userId is stamped
- `app/api/client/__tests__/wallet-ownership.test.ts` - Attack tests
- `app/api/stripe/webhook/route.ts` - Webhook path (alternate route?)

**Verification Checklist**:

#### Source Code Inspection

- [ ] **Line-by-line review of wallet-add route**
  - [ ] Session validation present?
  - [ ] PaymentIntent.retrieve() called?
  - [ ] Status check (succeeded)?
  - [ ] Amount verification?
  - [ ] metadata.userId check exists?
  - [ ] metadata.userId comparison correct?
  - [ ] Returns 403 on mismatch?
  - [ ] Fail-closed if metadata missing?

- [ ] **PaymentIntent creation inspection**
  - [ ] Where is userId set in metadata?
  - [ ] Is it set consistently across all payment flows?
  - [ ] Can metadata be omitted?
  - [ ] Can metadata be tampered with?

- [ ] **Idempotency check**
  - [ ] Can same PaymentIntent be used twice?
  - [ ] Check uses stripePaymentIntentId?
  - [ ] Transaction metadata indexed?

#### Execution Path Tracing

- [ ] **Happy path**: User A creates intent → User A calls wallet-add → Credits User A's wallet
- [ ] **Attack path 1**: User A creates intent → User B calls wallet-add → Returns 403
- [ ] **Attack path 2**: Old intent (no metadata) → User calls wallet-add → Returns 403
- [ ] **Edge case 1**: Intent with userId but no walletId → What happens?
- [ ] **Edge case 2**: Intent succeeded but wrong amount → What happens?

#### Test Verification

- [ ] **Test file exists**: `app/api/client/__tests__/wallet-ownership.test.ts`
- [ ] **Test execution**: Run tests, confirm all pass
- [ ] **Test scenarios covered**:
  - [ ] Happy path test
  - [ ] Cross-user attack test (User A's intent, User B tries to use it)
  - [ ] Missing metadata test
  - [ ] Wrong walletId test
  - [ ] Duplicate payment intent test
  - [ ] Amount mismatch test
  - [ ] Status != succeeded test

- [ ] **Test quality check**:
  - [ ] Tests use real Prisma transactions or mocks?
  - [ ] Tests actually call the route handler?
  - [ ] Tests verify 403 status code?
  - [ ] Tests verify error message content?
  - [ ] Tests verify no wallet credit occurs on failure?

#### Alternate Path Analysis

- [ ] **Webhook path**: Does `app/api/stripe/webhook/route.ts` credit wallets?
  - [ ] If yes, does it have same ownership checks?
  - [ ] Can webhook be triggered with fake data?
  - [ ] Webhook signature verification present?

- [ ] **Admin override**: Can admin credit any wallet?
  - [ ] If yes, is it properly authorized?
  - [ ] Is it audited?

- [ ] **Package purchase**: Does package payment credit wallet?
  - [ ] If yes, does it use same checks?

- [ ] **Refund path**: Can refunds bypass ownership?

#### Build Verification

- [ ] TypeScript compiles without errors
- [ ] Vercel/CI build passes
- [ ] No runtime errors in production logs

---

### F-08: Refund maxRefundAmount Enforcement

**Status**: ⏳ PENDING

**Kiro's Claim**:
- Added maxRefundAmount limit enforcement
- Matches wallet endpoint pattern
- Returns 403 if limit exceeded
- SUPER_ADMIN bypasses limit

**Files to Inspect**:
- `app/api/admin/transactions/[transactionId]/refund/route.ts`
- `app/api/admin/clients/[id]/wallet/add-credit/route.ts` (reference)
- `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts` (reference)
- `test-f08-fix.mjs` (test script)

**Verification Checklist**: (TBD)

---

### C-1: Provider Self-Upgrade Subscription Tier

**Status**: ⏳ PENDING

**Kiro's Claim**:
- Found CRITICAL bug: tier upgrade without payment
- Status: CONFIRMED but NOT FIXED

**Files to Inspect**:
- `app/api/instructor/subscription/route.ts` (lines 184-214)
- Any payment verification logic
- Tier change handling

**Verification Checklist**: (TBD)

---

### SUB-02-A: Subscription Creation Not Atomic

**Status**: ⏳ PENDING

**Kiro's Claim**: (TBD)

---

### SUB-02-B: Concurrent Trial Creation Race

**Status**: ⏳ PENDING

**Kiro's Claim**: (TBD)

---

### SUB-09-A: Instructor Cancel Missing Stripe Call

**Status**: ⏳ PENDING

**Kiro's Claim**: (TBD)

---

### SUB-10-A: Inconsistent Cancellation

**Status**: ⏳ PENDING

**Kiro's Claim**: (TBD)

---

### SUB-12-A: Trial Expiry Cron Race

**Status**: ⏳ PENDING

**Kiro's Claim**: (TBD)

---

## Verification Log Template

Use this template for each finding:

```markdown
## [FINDING-ID]: [Finding Name]

**Date Verified**: YYYY-MM-DD  
**Verifier**: [Name]  
**Status**: SOURCE VERIFIED ✅ / TEST VERIFIED 🧪 / BUILD VERIFIED 🔨 / CLOSED ✔️ / REJECTED ❌

### Kiro's Claim Summary
[What Kiro says was fixed]

### Source Code Inspection
**File**: `path/to/file.ts`  
**Lines**: XX-YY

**Finding**:
- [ ] Control implemented? YES/NO
- [ ] Implementation correct? YES/NO
- [ ] Edge cases handled? YES/NO
- [ ] Error handling present? YES/NO

**Code excerpt**:
```typescript
// Paste relevant code here
```

**Notes**: [Any observations]

### Execution Path Trace
**Happy path**: [Describe]  
**Attack path**: [Describe]  
**Bypass attempts**: [List any alternate paths tested]

### Test Verification
**Test file**: `path/to/test.ts`  
**Tests run**: `npm test -- path/to/test.ts`

**Results**:
```
[Paste test output]
```

**Test coverage assessment**:
- [ ] Happy path tested
- [ ] Attack path tested
- [ ] Edge cases tested
- [ ] Failure modes tested

**Test quality**: [Notes on test quality]

### Alternate Paths Checked
1. [Path 1]: [Result]
2. [Path 2]: [Result]
3. [Path 3]: [Result]

### Build Verification
- [ ] TypeScript compiles
- [ ] CI build passes
- [ ] No runtime errors

### Final Assessment
**Verdict**: CLOSED ✔️ / REJECTED ❌ / NEEDS WORK 🔧

**Reasoning**: [Detailed explanation]

**Remaining concerns**: [If any]

**Recommendations**: [If any]
```

---

## Quick Reference: File Locations

### Payment/Wallet Routes
- `app/api/client/wallet-add/route.ts` - Wallet top-up (P0-01)
- `app/api/payments/create-intent/route.ts` - PaymentIntent creation
- `app/api/stripe/webhook/route.ts` - Stripe webhooks
- `app/api/admin/transactions/[transactionId]/refund/route.ts` - Refunds (F-08)

### Subscription Routes
- `app/api/instructor/subscription/route.ts` - Subscription management (C-1, SUB-*)
- `app/api/instructor/subscription/mobile/route.ts` - Mobile variant
- `app/api/cron/check-trial-expiry/route.ts` - Trial expiry job (SUB-12-A)

### Services
- `lib/services/stripe.ts` - Stripe integration
- `lib/services/subscription-cancel.ts` - Cancellation service (SUB-09-A, SUB-10-A)
- `lib/services/wallet-helpers.ts` - Wallet utilities
- `lib/services/ledger-operations.ts` - Ledger operations

### Tests
- `app/api/client/__tests__/wallet-ownership.test.ts` - P0-01 tests
- `lib/services/__tests__/subscription-cancel.test.ts` - Cancellation tests
- `lib/services/__tests__/subscription-creation.test.ts` - Creation tests
- `app/api/cron/__tests__/trial-expiry-race.test.ts` - Cron race tests

---

## Notes for Verifier

1. **Never trust the claim** - Always inspect actual source
2. **Follow the money** - Trace every financial transaction path
3. **Think like an attacker** - What would you try?
4. **Test the tests** - Do they actually test what they claim?
5. **Document everything** - Your verification is the source of truth

Good luck! 🔍

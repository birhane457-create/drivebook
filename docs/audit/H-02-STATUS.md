# H-02 Status Report
**Finding**: Child booking `price: 0` — lesson has no recorded economic value  
**Status**: 🔴 **OPEN** — Financial accounting reconciliation required  
**Last Updated**: 2026-10-18  
**Commits**: d91d04b4 (safety), e4339a89 (defects), 9bb419d7 (initial)  

## Current Status

### ✅ Completed

1. **Core Implementation** (9bb419d7):
   - Sets `price = duration × instructor.currentRate` at confirmation
   - Sets `platformFee = 0` (no second fee for wallet-funded lessons)
   - Calculates `providerPayout` using commission rate from subscription tier
   - Creates matching Transaction record with all financial fields

2. **Defect Corrections** (e4339a89):
   - Fixed platform fee double-counting (changed to hardcoded 0)
   - Fixed test assertions (H02-T01, T02, T04, T10)
   - Added isPaid/status to test field selects
   - Corrected financial reconciliation logic

3. **Database Safety Guard** (d91d04b4):
   - Hardened to fail-closed allowlist approach
   - Only explicitly approved test databases permitted
   - Prevents accidental production database wipes during test runs

### ❌ Blocking Issues

**Issue #1: Policy-Code Mismatch — Wallet Credit Amount**
- **Policy**: Customer receives $700 face-value credit
- **Code**: Customer receives $698.25 (paid amount) credit
- **File**: `app/api/stripe/webhook/route.ts` (line 1108)
- **Decision Required**: Implement face-value model OR update policy

**Issue #2: Platform Fee Accounting Gap**
- **Expected**: $33.25 total platform fee recorded in database
- **Actual**: $2.52 recorded (first lesson platformFee only)
- **Missing**: $30.73 has no database audit trail
- **File**: `app/api/public/bookings/bulk/route.ts` (line 781)
- **Required**: Record full platform fee explicitly

**Issue #3: Test Execution Evidence**
- **Status**: 10 tests written but not executed against PostgreSQL
- **Blocker**: PostgreSQL test database not available (localhost:5433)
- **Required**: Execute full test suite and capture output

## Approved Accounting Policy (2026-10-18)

**Model A: Face-Value Wallet Credit**

| Item | Amount |
|------|--------|
| Original package value | $700.00 |
| DriveBook-funded discount | -$35.00 |
| Discounted package amount | $665.00 |
| Platform fee (5% of $665) | $33.25 |
| **Customer payment** | **$698.25** |
| **Wallet credit (face value)** | **$700.00** |
| DriveBook funds | $1.75 |

**Key Principles**:
1. Customer pays $698.25, receives $700 credit (face value)
2. Platform fee ($33.25) recorded once at package purchase
3. Wallet-funded lessons: platformFee = $0 (no second fee)
4. Locked rate = instructor's CURRENT rate at booking confirmation
5. Rate changes affect future bookings only; confirmed bookings retain locked price

## Implementation vs Policy

### Webhook (Package Purchase)

**Current Code**:
```typescript
// line 1108: app/api/stripe/webhook/route.ts
await tx.walletTransaction.create({
  data: {
    type: 'CREDIT',
    amount: packageTotalPaid,  // $698.25 (paid amount)
    description: `Package purchase — ${packageHours} hours (Stripe)`,
    status: 'CONFIRMED',
  },
});
```

**Policy Requires**:
```typescript
await tx.walletTransaction.create({
  data: {
    type: 'CREDIT',
    amount: 700,  // Face value, not paid amount
    description: `Package purchase — ${packageHours} hours (Stripe)`,
    status: 'CONFIRMED',
  },
});

// Also need to record DriveBook-funded promotion ($35 discount + $1.75 difference)
```

### Package Booking Creation

**Current Code**:
```typescript
// line 781: app/api/public/bookings/bulk/route.ts
platformFee: firstLessonPlatformFee,  // $2.52 (3.6% of $70 first lesson)
```

**Policy Requires**:
- Full platform fee ($33.25) recorded somewhere in the system
- Not just first lesson fee ($2.52)
- Remaining $30.73 must have audit trail

### Child Booking Confirmation

**Current Code**: ✅ **Correct**
```typescript
// line 228: app/api/client/confirm-package-booking/route.ts
const platformFee = 0;  // No second platform fee for wallet-funded
```

## Test Coverage

**File**: `__tests__/integration/h02-child-booking-pricing.test.ts`

| Test | Description | Status |
|------|-------------|--------|
| H02-T01 | Price = duration × current rate | ✅ Written |
| H02-T02 | Platform fee = 0 for wallet-funded | ✅ Written |
| H02-T03 | Provider payout calculation | ✅ Written |
| H02-T04 | Transaction/booking financial match | ✅ Written |
| H02-T05 | Wallet debit = lesson price | ✅ Written |
| H02-T06 | Rate change scenario | ✅ Written |
| H02-T07 | Insufficient balance handling | ✅ Written |
| H02-T08 | Multi-hour booking pricing | ✅ Written |
| H02-T09 | Different instructor rates | ✅ Written |
| H02-T10 | Financial reconciliation | ✅ Written |

**Execution Status**: ⏳ Awaiting PostgreSQL test database

## Required Actions (In Order)

### 1. Resolve Wallet Credit Amount
**Decision Point**: Which model to implement?
- **Option A**: Fix webhook to credit $700 (match policy)
- **Option B**: Update policy to reflect $698.25 (match code)

**Recommended**: Option A (implement approved face-value model)

**Implementation**:
```typescript
// In webhook route.ts, replace line 1108 area:
const packageFaceValue = 700;  // From packageHours × hourlyRate or metadata
const customerPaid = packageTotalPaid;  // $698.25
const drivebookPromotion = packageFaceValue - customerPaid;  // $1.75

await tx.walletTransaction.create({
  data: {
    type: 'CREDIT',
    amount: packageFaceValue,  // $700 (face value)
    description: `Package purchase — ${packageHours} hours`,
    status: 'CONFIRMED',
    metadata: {
      customerPaid,
      drivebookPromotion,
      stripePaymentIntentId: paymentIntent.id,
    },
  },
});
```

### 2. Fix Platform Fee Recording
**Decision Point**: Where to record full $33.25 platform fee?

**Recommended Approach**:
- Create separate Transaction entry at package purchase time
- Type: `PLATFORM_FEE` or `PACKAGE_FEE`
- Amount: $33.25 (5% of discounted package)
- Link to Stripe PaymentIntent for reconciliation

**Implementation**:
```typescript
// In bulk route or webhook, after package booking created:
await tx.transaction.create({
  data: {
    bookingId: packageBooking.id,
    type: 'PLATFORM_FEE',
    amount: platformFeeAmount,  // $33.25
    platformFee: platformFeeAmount,
    providerPayout: 0,
    status: 'SETTLED',
    stripePaymentIntentId: paymentIntent.id,
    createdBy: 'SYSTEM',
  },
});
```

### 3. Execute Test Suite
**Prerequisites**:
- PostgreSQL running at localhost:5433
- Test database: `drivebook_test`
- DATABASE_URL set correctly

**Command**:
```bash
npm test __tests__/integration/h02-child-booking-pricing.test.ts
```

**Expected**: All 10 tests pass

### 4. Independent Re-Verification
After fixes implemented:
1. Source-level inspection of accounting changes
2. Verify Stripe → Booking → Transaction → Wallet reconciles
3. Confirm policy and code alignment
4. Review test execution output

### 5. Mark FIX-VERIFIED
**Criteria**:
- ✅ Wallet credit matches policy (face value or documented)
- ✅ Platform fee fully recorded and reconcilable to Stripe
- ✅ All 10 tests executed and passing
- ✅ Independent verification approved
- ✅ No outstanding financial discrepancies

## Related Files

**Implementation**:
- `app/api/client/confirm-package-booking/route.ts` — Child booking confirmation
- `app/api/stripe/webhook/route.ts` — Package purchase wallet credit
- `app/api/public/bookings/bulk/route.ts` — Package booking creation

**Tests**:
- `__tests__/integration/h02-child-booking-pricing.test.ts` — 10-test suite

**Documentation**:
- `docs/audit/PACKAGE-ACCOUNTING-POLICY.md` — Approved policy
- `docs/audit/H-02-IMPLEMENTATION-EVIDENCE.md` — Implementation details
- `docs/audit/H-02-FINANCIAL-FLOW-ANALYSIS.md` — Flow analysis

**Policy**:
- Model A (Face-Value) approved 2026-10-18
- Customer receives face-value credit, DriveBook funds promotional discount

## Blocked Findings

**H-01**: Refund formula — blocked on H-02 verification  
**PB-UI-03**: Dashboard display — blocked on H-02 verification  

## Commit History

- `d91d04b4`: Database safety guard (fail-closed allowlist)
- `e4339a89`: Defect corrections (platformFee=0, test fixes)
- `9bb419d7`: Initial fix (price calculation, commission, payout)
- `3bb8127f`: Baseline (before H-02 work)

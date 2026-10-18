# H-02 Financial Flow Analysis
**Created**: 2026-10-18  
**Status**: VERIFICATION IN PROGRESS  
**Reviewer**: Independent Verification  

## Purpose

Document the complete end-to-end financial flow for package purchases to verify:
1. Where platform fee is recorded during package purchase
2. Whether platformFee = 0 for wallet-funded lessons is correct
3. Complete ledger reconciliation from purchase through lesson confirmation

## Findings

### 1. Package Purchase Flow (Initial Payment)

**File**: `app/api/public/bookings/bulk/route.ts`

#### Step 1: Customer purchases package
- Customer pays: $698.25 ($665 discounted package + $33.25 platform fee)
- Stripe payment intent created for full amount

#### Step 2: Parent booking created (lines 780-784)
```typescript
price: firstLessonPrice,           // e.g., $70 for first lesson
platformFee: firstLessonPlatformFee, // e.g., $2.52 (3.6% of $70)
providerPayout: firstLessonPayout,   // e.g., $67.48 (85% of $70, BASIC tier)
```

**CRITICAL FINDING**: The platform fee recorded on the parent booking is ONLY for the first lesson ($2.52), NOT the full package platform fee ($33.25).

#### Step 3: Wallet credited
**File**: `app/api/stripe/webhook/route.ts` (lines 1106-1112)

```typescript
// Wallet credit transaction
type: 'CREDIT',
amount: packageTotalPaid,  // $698.25 (NOT the face value $700)
description: `Package purchase — ${packageHours} hours (Stripe)`,
status: 'CONFIRMED',
```

**CRITICAL FINDING #2**: The wallet is credited with `packageTotalPaid` ($698.25), NOT the face value ($700) as specified in the approved accounting policy.

### 2. Child Booking Confirmation Flow

**File**: `app/api/client/confirm-package-booking/route.ts`

#### Current implementation (commit e4339a89):
```typescript
// Line 210-218: Uses current instructor rate
const applicableRate = toJsNumber(txBooking.provider.hourlyRate);
const lessonPrice = parseFloat((authorizedHours * applicableRate).toFixed(2));

// Line 228: NO platform fee for wallet-funded lessons
const platformFee = 0;  // Fee already collected at package purchase

// Lines 230-232: Commission and payout
const commissionRate = await getCommissionRate(txBooking.provider.subscriptionTier ?? 'BASIC');
const providerPayout = parseFloat((lessonPrice * (1 - commissionRate / 100)).toFixed(2));
```

## Ledger Reconciliation Issues

### Issue #1: Platform Fee Accounting Gap

**Expected (per policy)**:
- Total platform fee collected: $33.25 (5% of $665 discounted package)
- Recorded on package purchase: $33.25
- Recorded on child bookings: $0 each (total $0)
- **Total recorded: $33.25** ✓

**Actual (per code)**:
- Total platform fee collected: $33.25 (via Stripe)
- Recorded on parent booking: $2.52 (only first lesson fee)
- Recorded on child bookings: $0 each
- **Total recorded: $2.52** ✗ **GAP: $30.73 missing**

### Issue #2: Wallet Credit Amount Mismatch

**Expected (per approved policy - Model A)**:
- Customer pays: $698.25
- Wallet credited: **$700** (face value)
- DriveBook funds: $1.75 promotional difference

**Actual (per webhook code)**:
- Customer pays: $698.25
- Wallet credited: **$698.25** (NOT face value)
- DriveBook funds: $0

**Policy violation**: Face-value wallet credit model not implemented.

### Issue #3: Platform Fee Recording Location

The bulk route records platform fee on the FIRST LESSON booking, not on a separate package-level ledger entry. This creates ambiguity:

- First lesson has `platformFee: $2.52` and `price: $70`
- Total customer pays: $72.52 (lesson + fee)
- But customer actually paid $698.25 upfront via Stripe
- Where is the remaining $30.73 platform fee recorded?

**Answer**: It's not recorded in the `Booking` table at all. It may be implicitly in the Stripe payment amount but not tracked in the database.

## Verification Requirements

Before H-02 can be marked FIX-VERIFIED:

### 1. Database Safety Guard ✓
- Implemented fail-closed allowlist approach (commit pending)
- Only explicitly approved test databases permitted

### 2. Source-Level Corrections ✓
- platformFee = 0 for wallet-funded lessons
- H02-T01 selects isPaid and status
- H02-T02 asserts platformFee = 0
- H02-T04 compares all financial fields
- H02-T10 reconciliation logic corrected

### 3. End-to-End Financial Reconciliation ✗ OUTSTANDING
Need to verify:
- [ ] Where is the full package platform fee ($33.25) recorded?
- [ ] Is the wallet credited with face value ($700) or paid amount ($698.25)?
- [ ] Do all financial records reconcile end-to-end?
- [ ] Is the policy document accurate about what the code actually does?

### 4. Test Execution ✗ OUTSTANDING
- [ ] Execute H02-T01 through H02-T10 against PostgreSQL test database
- [ ] Capture passing test output
- [ ] Verify database state after tests

## Recommendations

### Option A: Accept Current Implementation, Update Policy
If the current implementation is correct:
1. Update policy to clarify platform fee is recorded on first lesson only
2. Update policy to clarify wallet is credited with paid amount, not face value
3. Document that remaining platform fee is implicit in Stripe payment

### Option B: Fix Implementation to Match Policy
If face-value model is required:
1. Modify webhook to credit $700 to wallet (not $698.25)
2. Create separate ledger entry for full package platform fee ($33.25)
3. Update tests to verify face-value accounting

### Option C: Hybrid Approach
1. Keep current wallet credit ($698.25) - simpler accounting
2. Create separate Transaction entry for full package platform fee
3. Update policy to match implementation

## Next Steps

1. **Immediate**: Clarify with stakeholders which accounting model is actually required
2. **Before FIX-VERIFIED**: Execute tests and verify database state
3. **Policy alignment**: Ensure code and documentation match business intent

## Related Files

- Policy: `docs/audit/PACKAGE-ACCOUNTING-POLICY.md`
- Implementation: `app/api/client/confirm-package-booking/route.ts`
- Package creation: `app/api/public/bookings/bulk/route.ts`
- Webhook: `app/api/stripe/webhook/route.ts`
- Tests: `__tests__/integration/h02-child-booking-pricing.test.ts`

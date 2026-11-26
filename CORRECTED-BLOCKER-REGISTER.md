# Source-Verified Blocker Register

**Code Base:** main @ `10b30fea1018494d78da71ca4bd692a50f54e8fa`  
**Verification Date:** 2026-11-25  
**Verification Method:** Source code reading only  
**Status:** 🔴 **4 RELEASE BLOCKERS CONFIRMED**

---

## ⚠️ CRITICAL CLARIFICATIONS

### What This Document Is

✅ **Source-level defect verification**  
✅ **Release blocker identification**  
✅ **Risk assessment based on code inspection**

### What This Document Is NOT

❌ **NOT a confirmed production incident report**  
❌ **NOT evidence of actual customer harm**  
❌ **NOT a safe-to-deploy hotfix plan**

---

## Production Status: UNKNOWN

**Customer impact is UNVERIFIED** because:
- No access to production Stripe dashboard
- No access to production database
- No execution of code
- No test runs

**To verify actual customer impact:**
1. Query production database for booking/payment status mismatches
2. Query Stripe dashboard for successful payments
3. Reconcile Stripe PaymentIntent amounts against booking records
4. Check webhook event logs for amount mismatch errors

**Until verification complete:**
- Treat as **potential payment incident**
- Treat as **release blocker**
- Do NOT claim "customers have been charged incorrectly"

---

## Confirmed Source-Level Blockers

### BLOCKER #1: Payment Amount Mismatch

**Severity:** 🔴 **CRITICAL — Release Blocker**

**What Source Code Shows:**

**File:** `app/api/payments/create-intent/route.ts` (current main)

```typescript
// Line ~186 (approximate):
const paymentAmount = booking.price;
```

**File:** `app/api/public/bookings/bulk/route.ts`

```typescript
// Booking creation stores TWO amounts:
booking.create({
  price: firstLessonPrice,          // e.g., $60
  packageTotalPaid: verifiedTotal,  // e.g., $393.25
})
```

**File:** `app/api/stripe/webhook/route.ts`

```typescript
// Webhook validation:
const chargedAmount = booking.packageTotalPaid || booking.price;
const expectedAmount = Math.round(chargedAmount * 100);

if (receivedAmount !== expectedAmount) {
  logger.error('Payment amount mismatch');
  return; // Does not confirm booking
}
```

**Analysis:**

The code creates a **potential mismatch**:
- PaymentIntent: charges `booking.price` ($60)
- Webhook: expects `booking.packageTotalPaid || booking.price` ($393.25 for packages)
- If package: amounts differ → webhook rejects → booking not confirmed

**What This DOES NOT Prove:**
- ❌ That Stripe actually charged $60 (need Stripe dashboard)
- ❌ That webhooks actually rejected (need webhook logs)
- ❌ That customers were affected (need production reconciliation)

**What This DOES Prove:**
- ✅ Code logic creates mismatch risk for packages
- ✅ This is a **release blocker** (must fix before next deployment)

**Unsafe to Deploy As-Is:**

```typescript
// ❌ UNSAFE proposed fix:
const paymentAmount = booking.isPackageBooking && booking.packageTotalPaid
  ? booking.packageTotalPaid
  : booking.price;
```

**Why unsafe:**
- Doesn't address webhook's `packageTotalPaid || booking.price` logic
- Doesn't verify currency, discounts, platform fees are consistent
- Doesn't establish canonical "payable amount" used everywhere
- Single-lesson bookings might have `packageTotalPaid` set → creates new mismatch

**Safe Fix Requirements:**
1. Define ONE canonical payable amount calculation
2. Use it in: PaymentIntent creation, webhook validation, accounting, refunds
3. Remove `packageTotalPaid || booking.price` fallback (single source of truth)
4. Test: single lesson, package, discounts, platform fees, refunds
5. Verify webhook validates against same calculation

---

### BLOCKER #2: Existing Account Linked Without Ownership Proof

**Severity:** 🔴 **CRITICAL — Security Release Blocker**

**What Source Code Shows:**

**File:** `app/api/public/bookings/bulk/route.ts`

```typescript
let existingUser = await prisma.user.findUnique({
  where: { email: data.accountHolderEmail }
});

if (!existingUser) {
  // Create new user with password
} else {
  // ❌ Just use existing user ID, no password check
  userId = existingUser.id;
}
```

**Analysis:**

The code allows **unauthorized account linking**:
- Finds existing user by email
- Links booking to that user without verifying password
- Links wallet credits without verifying password

**What This DOES Prove:**
- ✅ Source-level vulnerability: unauthorized account linking
- ✅ Attacker who knows victim's email can book on their account
- ✅ Attacker can add wallet credits to victim's account

**What This DOES NOT Prove:**
- ❌ That attacker can log in as victim (separate auth flow)
- ❌ That attacker can access victim's password
- ❌ That credential takeover is possible

**Scope of Vulnerability:**
- Book lessons → charged to attacker's card, appear in victim's account
- Book Later wallet credit → attacker pays, victim receives credit
- Potential chargeback risk if victim disputes

**Unsafe to Deploy As-Is:**

```typescript
// ❌ UNSAFE proposed fix (incomplete):
if (existingUser) {
  if (!data.accountHolderPassword) {
    return 403; // Requires password
  }
  
  const valid = await bcrypt.compare(
    data.accountHolderPassword,
    existingUser.password
  );
  
  if (!valid) {
    return 401;
  }
}
```

**Why unsafe by itself:**
- Doesn't prevent attacker from using password reset flow
- Doesn't address wallet credit linking
- Doesn't handle accounts with social auth (no password)
- Doesn't verify phone number or email ownership

**Safe Fix Requirements:**
1. Require verified authentication (session token) for existing accounts
2. OR: Send OTP to registered email/phone before linking
3. OR: Create separate "guest" booking until user logs in and claims it
4. Apply same protection to wallet credit purchases
5. Test: existing account, new account, password-less accounts (social auth)

---

### BLOCKER #3: Short-Notice Payment State Machine Defect

**Severity:** 🔴 **CRITICAL — Release Blocker**

**What Source Code Shows:**

**File:** `app/api/public/bookings/bulk/route.ts`

```typescript
status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
```

**File:** `app/api/payments/create-intent/route.ts`

```typescript
if (!['PENDING_PAYMENT', 'PENDING'].includes(booking.status)) {
  return 400; // ❌ Accepts BOTH statuses
}
```

**File:** `app/api/stripe/webhook/route.ts`

```typescript
if (booking.status !== 'PENDING_PAYMENT') {
  logger.error('Webhook rejected: booking is PENDING');
  return; // ❌ Only confirms PENDING_PAYMENT
}
```

**Analysis:**

The code creates **inconsistent state handling**:
- Short-notice bookings: `status = 'PENDING'` (awaiting instructor approval)
- Payment endpoint: accepts `PENDING` status
- Webhook: only confirms `PENDING_PAYMENT` status
- Result: Payment collected but booking not confirmed

**What This DOES Prove:**
- ✅ State machine inconsistency exists
- ✅ Short-notice flow not properly handled
- ✅ This is a **release blocker**

**What This DOES NOT Prove:**
- ❌ That customers have actually been charged without confirmation
- ❌ That short-notice bookings are common (frequency unknown)

**Product Policy Decision Required:**

**Option A:** No payment before instructor approval
```typescript
if (booking.status === 'PENDING') {
  return NextResponse.json({
    error: 'Booking requires instructor approval before payment',
    code: 'AWAITING_APPROVAL'
  }, { status: 403 });
}
```

**Option B:** Allow payment, hold funds until approval
```typescript
// Webhook must confirm BOTH statuses:
if (!['PENDING_PAYMENT', 'PENDING'].includes(booking.status)) {
  logger.error('Invalid status');
  return;
}

// Mark as confirmed but flag for review
await tx.booking.update({
  status: 'CONFIRMED',
  metadata: { requiresInstructorReview: booking.status === 'PENDING' }
});
```

**Safe Fix Requirements:**
1. Product team decides: payment before or after approval?
2. Implement consistently across booking creation, payment gate, webhook
3. Update frontend to show correct messaging
4. Test: short-notice booking (< 2 hours), normal booking (> 2 hours)

---

### BLOCKER #4: Guest Payment Token Not Passed

**Severity:** 🔴 **CRITICAL — Release Blocker**

**What Source Code Shows:**

**File:** `app/book/[instructorId]/payment/page.tsx` (Book Now wizard)

```typescript
const response = await fetch('/api/payments/create-intent', {
  body: JSON.stringify({
    bookingId: bookingResponse.bookingId,
    amount: totalAmount,
    // ❌ Missing: paymentToken
  })
});
```

**File:** `app/booking/[id]/payment/page.tsx` (tokenized payment page)

```typescript
// ✅ This page DOES extract and send token correctly:
const token = searchParams.get('token');

const response = await fetch('/api/payments/create-intent', {
  body: JSON.stringify({
    bookingId,
    paymentToken: token,  // ✅ Correct
  })
});
```

**File:** `app/api/payments/create-intent/route.ts`

```typescript
if (paymentToken) {
  // Validate token
} else if (sessionUser) {
  // Validate session
} else {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Analysis:**

There are **TWO payment pages**:
1. `/book/[instructorId]/payment` — Book Now wizard (broken)
2. `/booking/[id]/payment` — Tokenized payment page (works)

The bulk API returns `checkoutUrl` pointing to the tokenized page, but the **Book Now wizard ignores it** and calls create-intent directly without token.

**What This DOES Prove:**
- ✅ Book Now wizard path is broken (missing token)
- ✅ Tokenized payment page works correctly
- ✅ This is a **release blocker** for Book Now flow

**What This DOES NOT Prove:**
- ❌ Which path is actually used in production
- ❌ That guest bookings are failing (depends on which page loads)

**Unsafe Proposed Fix:**

```typescript
// ❌ WRONG: Assumes token is on wizard's URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
```

**Why unsafe:**
- Wizard page doesn't have token in its URL
- Token is in the `checkoutUrl` returned by booking API
- Fix should use the returned URL, not assume where token is

**Safe Fix Requirements:**

**Option A:** Use the returned tokenized URL (recommended)
```typescript
// In Book Now wizard:
const bookingResponse = await createBooking();

if (bookingResponse.checkoutUrl) {
  // ✅ Redirect to tokenized payment page
  window.location.href = bookingResponse.checkoutUrl;
} else {
  // Fallback for logged-in users (session auth)
  navigateToPayment(bookingResponse.bookingId);
}
```

**Option B:** Extract token from booking response
```typescript
const bookingResponse = await createBooking();

// Extract token from checkoutUrl
const url = new URL(bookingResponse.checkoutUrl);
const token = url.searchParams.get('token');

// Pass to create-intent
const paymentResponse = await fetch('/api/payments/create-intent', {
  body: JSON.stringify({
    bookingId: bookingResponse.bookingId,
    paymentToken: token,
  })
});
```

**Test Requirements:**
1. Guest user (no session) completes booking → should work
2. Logged-in user completes booking → should work (session auth)
3. Token validation rejects invalid/expired tokens
4. Token validation rejects mismatched bookingId

---

## Additional Source-Level Issues (Not Release Blockers)

### ISSUE #5: Multiple Lessons Stored as One Booking

**Status:** Verified in `221ca08d`, needs verification in `10b30fea1`

**Note:** Earlier audit (Stage 8) stated that wallet-funded bulk checkout **does** create multiple lesson bookings. Need to verify which path is used for public Book Now.

**Investigation needed:**
- Does public Book Now use wallet-funded path or separate path?
- If separate: verify whether single or multiple bookings created

### ISSUE #6: Timezone Inconsistent

**Status:** Verified in `221ca08d`, needs verification in `10b30fea1`

**Note:** Earlier audit stated timezone conversion was **fixed** in wallet-funded path using `localDateTimeToUTC()`. Need to verify which path Book Now uses.

### ISSUE #7: PDA Booking Issues

**Status:** Multiple defects, severity depends on usage

**Need to verify:**
- Is `/api/pda-bookings` route used in production?
- Or is PDA booking handled through wallet-funded bulk checkout?
- Earlier audit showed standalone PDA endpoint has multiple issues

---

## Recommended Actions

### 1. CONTAINMENT (Immediate)

**Option A: Disable Public Book Now** (Recommended)
```typescript
// In public booking route or middleware:
return NextResponse.json({
  error: 'Public booking temporarily unavailable. Please contact us to book.',
  supportEmail: 'support@drivebook.com.au',
  supportPhone: '...',
}, { status: 503 });
```

**Option B: Restrict to Authenticated Users Only**
```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({
    error: 'Please log in to book',
  }, { status: 401 });
}
```

**Keep Wallet-Funded Booking Enabled ONLY IF:**
- Independent testing confirms it works
- Webhook reconciliation passes
- No shared code paths with broken public flow

---

### 2. PRODUCTION INVESTIGATION (Before Any Fixes)

**Verify actual customer impact:**

```sql
-- Find bookings with Stripe payment but not confirmed
-- ⚠️ WARNING: This query structure is for investigation only
-- Do NOT use booking.price as "amount charged" without Stripe verification

SELECT 
  b.id,
  b.createdAt,
  b.customerEmail,
  b.price,
  b.packageTotalPaid,
  b.status,
  b.paymentIntentId
FROM "Booking" b
WHERE 
  b.paymentIntentId IS NOT NULL
  AND b.status IN ('PENDING_PAYMENT', 'EXPIRED')
  AND b.createdAt > '2026-11-01'
ORDER BY b.createdAt DESC;
```

**For each result:**
1. Look up PaymentIntent in Stripe dashboard
2. Check actual `amount` charged (in cents)
3. Check `status` (succeeded, failed, canceled?)
4. Check webhook delivery logs
5. Reconcile: Did webhook run? What was error?

**Document findings:**
- How many bookings affected?
- Were customers actually charged?
- What amounts were charged?
- Did webhooks fail or succeed?
- What errors were logged?

---

### 3. FIX DESIGN (After Investigation)

#### Fix #1: Payment Amount Consistency

**Design Requirements:**
1. Define canonical payable amount calculation
2. Document: What goes into this amount?
   - Lesson price(s)
   - Platform fee
   - Discounts
   - Tax?
   - Currency conversion?
3. Use this calculation in:
   - Booking creation (`booking.totalAmount`)
   - PaymentIntent creation
   - Webhook validation
   - Refund calculations
   - Payout calculations

**Implementation Plan:**
```typescript
// Step 1: Create canonical calculation function
function calculateBookingPayableAmount(booking: Booking): Decimal {
  // Single source of truth for "how much customer pays"
  if (booking.isPackageBooking && booking.packageTotalPaid) {
    return booking.packageTotalPaid;
  }
  return booking.price;
}

// Step 2: Use everywhere
// - In create-intent
const paymentAmount = calculateBookingPayableAmount(booking);

// - In webhook
const expectedAmount = calculateBookingPayableAmount(booking);

// Step 3: Remove fallback logic
// Delete: `packageTotalPaid || booking.price`
```

**Test Plan:**
- [ ] Single lesson, $60/hour, 1 hour → charge $60
- [ ] Package, 6 lessons, $60/hour, 10% discount → charge correct total
- [ ] Webhook receives $60 for $60 booking → confirms
- [ ] Webhook receives $393 for $393 booking → confirms
- [ ] Webhook receives $60 for $393 booking → rejects (amount mismatch)
- [ ] Refund calculation uses same amount

---

#### Fix #2: Account Ownership Verification

**Design Requirements:**
1. Product decision: Which verification method?
   - Option A: Require login (session auth)
   - Option B: OTP to email/phone
   - Option C: Guest booking, claim later
2. Apply to both:
   - Booking creation
   - Wallet credit purchases

**Implementation Plan (Option B - OTP):**
```typescript
// Step 1: Detect existing account
if (existingUser) {
  // Generate OTP
  const otp = generateOTP();
  await sendOTP(existingUser.email, otp);
  
  // Store OTP (expires in 10 minutes)
  await storeOTP(existingUser.id, otp);
  
  // Return: requires verification
  return NextResponse.json({
    requiresVerification: true,
    email: maskEmail(existingUser.email),
    message: 'Check your email for verification code',
  }, { status: 202 });
}

// Step 2: Verify OTP endpoint
// POST /api/verify-account-otp
// { email, otp, bookingData }
// - Verify OTP
// - Create booking
// - Return success
```

**Test Plan:**
- [ ] New email → creates account, no verification needed
- [ ] Existing email → requires OTP
- [ ] Correct OTP → booking created
- [ ] Incorrect OTP → rejected
- [ ] Expired OTP → rejected
- [ ] Attacker with victim's email but no access to email → cannot book

---

#### Fix #3: Short-Notice State Machine

**Design Requirements:**
1. Product decision: Payment before or after approval?
2. Update status flow consistently
3. Update UI messaging

**Implementation Plan (Option A - No Payment Before Approval):**
```typescript
// Step 1: Block payment for PENDING status
if (booking.status === 'PENDING') {
  return NextResponse.json({
    error: 'Instructor must approve short-notice booking before payment',
    requiresApproval: true,
  }, { status: 403 });
}

// Step 2: Only allow PENDING_PAYMENT
if (booking.status !== 'PENDING_PAYMENT') {
  return 400;
}

// Step 3: Webhook only confirms PENDING_PAYMENT
// (no change needed)

// Step 4: After instructor approves PENDING → PENDING_PAYMENT
// Then customer can pay
```

**Test Plan:**
- [ ] Book lesson starting in 3 hours → status PENDING_PAYMENT, can pay immediately
- [ ] Book lesson starting in 1 hour → status PENDING, cannot pay yet
- [ ] Instructor approves short-notice → status becomes PENDING_PAYMENT
- [ ] Customer pays approved short-notice → webhook confirms

---

#### Fix #4: Guest Checkout Token

**Design Requirements:**
1. Book Now wizard must use tokenized payment URL
2. OR: Extract token and pass to create-intent

**Implementation Plan (Option A - Use Returned URL):**
```typescript
// In Book Now wizard after booking created:
const bookingResponse = await fetch('/api/public/bookings/bulk', {
  body: bookingData,
});

const { checkoutUrl, bookingId } = await bookingResponse.json();

// ✅ Redirect to tokenized payment page
if (checkoutUrl) {
  router.push(checkoutUrl);
} else {
  // Logged-in user fallback
  router.push(`/booking/${bookingId}/payment`);
}
```

**Test Plan:**
- [ ] Guest user books → redirected to `/booking/[id]/payment?token=xyz`
- [ ] Token validation passes → payment form shown
- [ ] Payment completes → booking confirmed
- [ ] Logged-in user books → redirected without token (session auth)

---

### 4. INTEGRATION TESTING (Staging)

**Before production deployment, verify:**

- [ ] Single lesson booking (guest)
- [ ] Single lesson booking (logged-in)
- [ ] Package booking (guest)
- [ ] Package booking (logged-in)
- [ ] Short-notice booking
- [ ] Normal booking
- [ ] Existing account (OTP verification)
- [ ] New account
- [ ] Webhook amount validation (correct amount)
- [ ] Webhook amount validation (incorrect amount → rejects)
- [ ] Duplicate request (idempotency)
- [ ] Failed payment
- [ ] Cancelled payment
- [ ] Delayed webhook (arrives 5 minutes later)

**Success criteria:**
- ✅ All bookings confirmed after payment
- ✅ No amount mismatch errors in webhook logs
- ✅ Guest checkout works without 401 errors
- ✅ Account linking requires ownership proof
- ✅ Short-notice bookings follow policy consistently

---

### 5. DEPLOYMENT

**Prerequisites:**
- [ ] All 4 blockers fixed
- [ ] Integration tests pass on staging
- [ ] Production investigation complete (if incidents found, customers notified)
- [ ] Rollback plan documented

**Deployment steps:**
1. Deploy fixes to staging
2. Run full integration test suite
3. Monitor staging for 24 hours
4. If clean: deploy to production
5. Monitor production for 48 hours

**Monitoring:**
- Webhook amount mismatch errors (should be 0)
- Guest checkout 401 errors (should be 0)
- Booking status stuck in PENDING_PAYMENT (should be 0)
- Support tickets about failed bookings

---

## Verification Boundaries

**What This Document Verifies:**
- ✅ Source code defects at commit `10b30fea1`
- ✅ Potential customer impact (risk assessment)
- ✅ Release blocker identification

**What This Document Does NOT Verify:**
- ❌ Actual customer harm (requires production data)
- ❌ Production incident occurrence
- ❌ Exact number of affected customers
- ❌ Stripe charge amounts and statuses
- ❌ Webhook delivery success/failure

**To Complete Verification:**
- Access production Stripe dashboard
- Access production database
- Reconcile payments vs bookings
- Check webhook logs

---

## Critical Corrections to Earlier Documents

### ❌ UNSAFE: URGENT-HOTFIX-TONIGHT.md

**Do NOT follow this document.** It contains:
- Unsafe SQL query that mislabels amounts
- Incomplete fix proposals
- Wrong file paths (old commit references)
- Assumption of confirmed customer harm (unverified)

### ❌ UNSAFE: Proposed hotfix snippets

**Do NOT deploy:**
- One-line amount fix (incomplete)
- Simple password check (insufficient)
- URL token extraction (wrong page)
- Simple loop for multiple bookings (breaks financial accounting)

### ✅ SAFE: This document (CORRECTED-BLOCKER-REGISTER.md)

**Use this for:**
- Release blocker list
- Investigation procedures
- Fix design requirements
- Test plans

---

## Next Deliverables

1. **Production Investigation Report**
   - Query production database
   - Query Stripe dashboard
   - Reconcile payment/booking status
   - Document: Were customers actually affected?

2. **Detailed Fix Specifications**
   - Per blocker
   - With complete implementation
   - With test cases
   - With verification criteria

3. **Deployment Plan**
   - Staging deployment
   - Integration testing
   - Production deployment
   - Monitoring

---

**Document Status:** ✅ **CORRECTED AND SAFE TO USE**  
**Next Action:** Production investigation to verify actual customer impact  
**Last Updated:** 2026-11-25

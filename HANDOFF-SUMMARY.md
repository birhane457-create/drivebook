# DriveBook Platform - Handoff Summary

**Date:** 2024
**From:** Kiro (Claude) - Audit & Documentation Phase
**To:** GPT Agent - Investigation & Fix Phase
**Codebase:** DriveBook (flowstate-wms)
**Verified Commits:** `221ca08d`, `10b30fea1`

---

## Executive Summary

Comprehensive audit of DriveBook payment/booking flows identified **4 confirmed source-level release blockers** in the public Stripe booking journey. All defects verified in source code. Customer impact remains **UNVERIFIED** pending production data access.

**Critical Note:** An unsafe hotfix plan exists in `URGENT-HOTFIX-TONIGHT.md` - DO NOT USE. Use `CORRECTED-BLOCKER-REGISTER.md` instead.

---

## Status at Handoff

### ✅ Completed
- 9 audit documents created (~200 pages)
- All external audit claims verified against source
- 4 release blockers documented with line numbers
- 11 financial lifecycle findings documented
- Safe investigation procedures defined
- Unsafe hotfix plan identified and corrected

### 🔴 Blocked - Requires Production Access
- Customer impact verification (Stripe dashboard)
- Booking reconciliation (production database)
- Webhook failure logs
- Actual charge amounts vs booking records

### ⏭️ Next Phase
- Production investigation
- Containment decisions
- Fix design and implementation
- Staged testing

---

## The 4 Confirmed Release Blockers

### 1. Amount Mismatch (BLOCKER-001)
**File:** `app/api/payments/create-intent/route.ts` (line ~186)
**Issue:** PaymentIntent created with `booking.price`, but webhook expects `booking.packageTotalPaid || booking.price`

```typescript
// Line 186 - CURRENT (WRONG)
const paymentAmount = booking.price;

// Webhook expects (line ~344)
const bookingAmount = booking.packageTotalPaid || booking.price;
```

**Risk:** Customer charged amount X, webhook validates for amount Y, payment succeeds but booking not confirmed.

**Why One-Line Fix is Unsafe:**
- Doesn't address currency (cents vs dollars)
- Doesn't handle platform fees
- Doesn't fix webhook fallback logic
- Need canonical "payable amount" function used by BOTH create-intent and webhook

### 2. Account Takeover (BLOCKER-002)
**File:** `app/api/public/bookings/bulk/route.ts` (line ~167)
**Issue:** Auto-links booking to existing account by email without password verification

```typescript
// Line 167 - DANGEROUS
const existingUser = await db.user.findUnique({
  where: { email: guestEmail }
});

if (existingUser) {
  userId = existingUser.id; // ← No password check!
}
```

**Risk:** Anyone with victim's email can book lessons, see private data, charge their wallet.

**Fix Options:**
- Require login for existing users
- OTP verification for email
- Guest → "Claim booking" flow with password
- Separate guest checkout entirely

### 3. Short-Notice State Confusion (BLOCKER-003)
**Files:** 
- `app/api/public/bookings/bulk/route.ts` (creates `PENDING`)
- `app/api/payments/create-intent/route.ts` (accepts `PENDING`)
- `app/api/stripe/webhook/route.ts` (only confirms `PENDING_PAYMENT`)

**Issue:** Short-notice bookings created as `PENDING` (waiting approval), payment endpoint accepts them, payment succeeds, webhook ignores them (only processes `PENDING_PAYMENT`).

**Result:** Customer charged, booking stuck in `PENDING`, never confirmed.

**Fix Requires:**
- Policy decision: payment before or after instructor approval?
- If before: bulk route creates `PENDING_PAYMENT` for short-notice
- If after: payment endpoint rejects `PENDING` status

### 4. Guest Token Missing (BLOCKER-004)
**File:** `app/book/[instructorId]/payment/page.tsx` (line ~200)
**Issue:** Guest checkout sends `{bookingId, amount}` but omits `paymentToken`

```typescript
// Line ~200 - WRONG FILE/APPROACH
const response = await fetch('/api/payments/create-intent', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: booking.id,
    amount: booking.price
    // ← Missing paymentToken
  })
});
```

**Why Token Fix Targets Wrong File:**
- Backend returns tokenized URL: `/booking/[id]/payment?token=xyz`
- Guest should be redirected to that URL
- That page (`app/booking/[id]/payment/page.tsx`) DOES include token
- Fix: Use the returned URL, don't try to pass token in this component

---

## Additional Critical Findings

### From commit `221ca08d` (Earlier Verification)

**Multiple Lessons Lost:**
- File: `app/api/bookings/route.ts` line 822
- Only persists `data.scheduledBookings[0]`
- Simple loop fix breaks financial accounting (each booking needs ledger entries)

**Timezone Bug:**
- Line 824: `new Date(slot.date).setHours(slot.time)`
- Uses server timezone, not user/instructor timezone

**PDA (Pre-Driving Assessment) Broken:**
- Form omits required `customerId` field
- Conflict check uses `findFirst` not Serializable transaction

### Financial Lifecycle (Stage 8 - commit `10b30fea1`)

**FIN-001:** Global ledger integrity check invalid
- Sets both debit and credit from same aggregate
- Should use independent sums

**FIN-002:** Financial completion after booking commit
- Booking committed to database before financial records
- Failure leaves booking without ledger trail

**FIN-003:** No durable parent checkout record
- Multiple bookings in one purchase have no parent entity
- Cannot reconstruct "what did customer buy together"

**See:** `STAGE-8-FINANCIAL-LIFECYCLE-AUDIT.md` for all 11 findings

---

## Document Guide

### ✅ Primary Documents (USE THESE)

**`CORRECTED-BLOCKER-REGISTER.md`**
- Safe blocker register
- Investigation procedures
- Why proposed fixes are unsafe
- Proper fix workflow

**`CRITICAL-FINDINGS-PUBLIC-STRIPE-BOOKING.md`**
- 50-page detailed audit
- Source evidence for all 4 blockers
- Flow diagrams
- Test scenarios

**`STAGE-8-FINANCIAL-LIFECYCLE-AUDIT.md`**
- 60-page financial audit
- 11 findings documented
- Positive controls identified

**`SOURCE-VERIFICATION-221ca08d.md`**
- Line-by-line verification
- Earlier commit findings
- Multiple lessons, timezone, PDA issues

### ❌ Do Not Use

**`URGENT-HOTFIX-TONIGHT.md`**
- **UNSAFE - DO NOT EXECUTE**
- Mixes verified source defects with unverified production incidents
- SQL query labels wrong values
- One-line fixes incomplete
- Targets wrong files
- Makes claims about customer harm without production data access

### 📚 Reference

- `STAGE-9-10-AUDIT-VERIFICATION.md` - Initial audit receipt
- `URGENT-PRODUCTION-BLOCKER.md` - Executive summary
- `FIX-TRACKING-PUBLIC-BOOKING.md` - Implementation checklist
- `AUDIT-INDEX.md` - Navigation hub

---

## Critical Distinction: Source vs Production

### What We KNOW (Verified in Source)
✅ Amount mismatch exists in code
✅ Account linking has no password check
✅ Short-notice status not handled by webhook
✅ Guest component missing token (but backend provides tokenized URL)
✅ Multiple lessons only saves first
✅ Timezone uses server time
✅ PDA form broken
✅ Financial lifecycle has 11 defects

### What We DO NOT KNOW (Requires Production Access)
❌ How many customers affected
❌ What amounts were charged
❌ Which bookings stuck in wrong state
❌ Whether webhooks actually failed
❌ Stripe payment vs booking status reconciliation
❌ Wallet-funded bookings independently affected

**Do not claim "customers being charged right now" without:**
1. Stripe dashboard access showing successful payments
2. Database query showing those bookings in wrong state
3. Webhook logs showing validation failures
4. Date range of incidents

---

## Recommended Next Steps

### Phase 1: Production Investigation (FIRST)

**Required Access:**
- Production database (read-only sufficient)
- Stripe dashboard for DriveBook account
- Webhook event logs
- Application logs (if available)

**Investigation Queries:**

```sql
-- Find bookings with payment but wrong status
SELECT 
  b.id,
  b.status,
  b.price,
  b.packageTotalPaid,
  b.paymentIntentId,
  b.createdAt,
  b.userId
FROM Booking b
WHERE b.paymentIntentId IS NOT NULL
  AND b.status IN ('PENDING_PAYMENT', 'EXPIRED', 'PENDING')
  AND b.createdAt >= '2024-01-01'
ORDER BY b.createdAt DESC;

-- Find guest bookings linked to existing users
SELECT 
  b.id,
  b.userId,
  b.guestEmail,
  u.email,
  b.createdAt
FROM Booking b
JOIN User u ON b.userId = u.id
WHERE b.guestEmail IS NOT NULL
  AND b.guestEmail = u.email
ORDER BY b.createdAt DESC;

-- Find short-notice bookings stuck in PENDING with payment
SELECT 
  b.id,
  b.status,
  b.paymentIntentId,
  b.createdAt
FROM Booking b
WHERE b.status = 'PENDING'
  AND b.paymentIntentId IS NOT NULL;
```

**Stripe Reconciliation:**
1. Export successful payment intents from date range
2. Match `payment_intent_id` to `booking.paymentIntentId`
3. Document mismatches (payment succeeded, booking not confirmed)

**Document Findings:**
- Create `PRODUCTION-INVESTIGATION-RESULTS.md`
- Include: affected booking IDs, amounts, dates
- Quantify: "X customers affected between Y and Z dates"

### Phase 2: Containment (IF Investigation Shows Active Harm)

**Option A: Disable Public Booking**
```typescript
// app/api/public/bookings/bulk/route.ts - top of file
return NextResponse.json(
  { error: 'Service temporarily unavailable' },
  { status: 503 }
);
```

**Option B: Require Login**
```typescript
// Reject if guestEmail provided and matches existing user
if (guestEmail) {
  const existing = await db.user.findUnique({
    where: { email: guestEmail }
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Please log in to book' },
      { status: 401 }
    );
  }
}
```

**Option C: Short-Notice Reject Payment**
```typescript
// app/api/payments/create-intent/route.ts
if (booking.status === 'PENDING') {
  return NextResponse.json(
    { error: 'Booking awaiting approval' },
    { status: 400 }
  );
}
```

### Phase 3: Fix Design (After Investigation)

**For Each Blocker:**
1. Define expected behavior (product decision)
2. Write failing test demonstrating bug
3. Design fix addressing root cause
4. Update both code paths (create-intent + webhook)
5. Verify test passes
6. Code review

**Amount Mismatch Fix Design:**
```typescript
// NEW: lib/payments.ts
export function calculatePayableAmount(booking: Booking): number {
  // Single source of truth
  // Handle: price vs packageTotalPaid, currency, fees
  const baseAmount = booking.packageTotalPaid || booking.price;
  
  // TODO: currency conversion if needed
  // TODO: platform fee calculation
  
  return Math.round(baseAmount * 100); // cents
}

// USE IN: create-intent route
const paymentAmount = calculatePayableAmount(booking);

// USE IN: webhook route
const expectedAmount = calculatePayableAmount(booking);
if (paymentIntent.amount !== expectedAmount) {
  // log and handle
}
```

**Account Linking Fix Design:**
```typescript
// OPTION 1: Reject at booking creation
if (guestEmail) {
  const existing = await db.user.findUnique({
    where: { email: guestEmail }
  });
  if (existing) {
    return NextResponse.json({
      error: 'ACCOUNT_EXISTS',
      message: 'Please log in to continue'
    }, { status: 409 });
  }
}

// OPTION 2: Send OTP
// (requires email service integration)

// OPTION 3: Guest checkout, claim later
// (create with userId: null, add claim flow)
```

**Short-Notice Fix Design:**
```typescript
// DECIDE POLICY FIRST:
// A) Pay after approval: reject payment for PENDING
// B) Pay before approval: create as PENDING_PAYMENT, special webhook handling

// If Option A:
if (booking.status === 'PENDING') {
  return NextResponse.json({
    error: 'Booking requires instructor approval before payment'
  }, { status: 400 });
}

// If Option B:
// In bulk route, for short-notice:
status: BookingStatus.PENDING_PAYMENT // not PENDING

// In webhook, handle PENDING_PAYMENT → CONFIRMED:
if (booking.status === 'PENDING_PAYMENT') {
  await db.booking.update({
    where: { id: booking.id },
    data: { 
      status: BookingStatus.PENDING, // now awaits approval
      paymentConfirmed: true
    }
  });
}
```

**Guest Token Fix:**
```typescript
// app/book/[instructorId]/payment/page.tsx

// CURRENT (WRONG):
// This component calls create-intent without a token, then tries to use
// the response for payment — but the token is never passed.

// CORRECT:
// The bulk booking route (app/api/public/bookings/bulk/route.ts) already
// returns { checkoutUrl } in its success response (verified in source).
// The guest payment page should read that returned checkoutUrl and redirect.

const response = await fetch('/api/public/bookings/bulk', {
  method: 'POST',
  body: JSON.stringify(bookingPayload)
});

if (response.ok) {
  const data = await response.json();
  
  // Backend returns: { checkoutUrl: `/booking/${id}/payment?token=xyz` }
  // Property verified in app/api/public/bookings/bulk/route.ts source.
  if (data.checkoutUrl) {
    router.push(data.checkoutUrl); // ← Use the returned tokenized URL
    return;
  }
}
```

### Phase 4: Testing (Staging Environment)

**Test Matrix:**

| Scenario | Guest/Logged-in | Single/Package | Short-Notice | Expected Result |
|----------|----------------|----------------|--------------|-----------------|
| Happy path | Guest | Single | No | Payment succeeds, booking confirmed |
| Happy path | Logged-in | Single | No | Payment succeeds, booking confirmed |
| Package | Guest | Package | No | All lessons created, payment succeeds |
| Package | Logged-in | Package | No | All lessons created, payment succeeds |
| Short-notice | Guest | Single | Yes | (depends on policy - see design) |
| Account exists | Guest w/ existing email | Single | No | Rejected or OTP flow |
| Amount edge | Any | Package w/ discount | No | Webhook validates correct amount |
| Webhook retry | Any | Any | No | Idempotent, no duplicate confirmation |

**Test Commands:**
```bash
# Run test suite
npm test -- --grep "booking|payment"

# Integration tests
npm run test:integration

# Manual staging test
# 1. Create test Stripe account
# 2. Use test card: 4242 4242 4242 4242
# 3. Verify in Stripe dashboard + staging DB
```

### Phase 5: Deployment

**Deployment Checklist:**
- [ ] All tests pass
- [ ] Code review complete
- [ ] Staging validated manually
- [ ] Database migrations (if any) tested
- [ ] Rollback plan documented
- [ ] Monitoring/alerts configured
- [ ] Deploy to production
- [ ] Smoke test production
- [ ] Monitor for 24 hours

**Rollback Plan:**
```bash
# If deployment fails:
git revert <commit-hash>
# or
git checkout <previous-stable-commit>

# Redeploy previous version
```

---

## Technical Context

### Tech Stack
- **Framework:** Next.js (App Router)
- **Database:** Prisma ORM (PostgreSQL assumed)
- **Payments:** Stripe
- **Language:** TypeScript

### Key File Paths

**Payment Flow:**
- `app/api/payments/create-intent/route.ts` - Creates PaymentIntent
- `app/api/stripe/webhook/route.ts` - Handles payment completion and ledger entries (`payment_intent.succeeded`, `checkout.session.completed`)
- `app/book/[instructorId]/payment/page.tsx` - Guest payment page (WRONG)
- `app/booking/[id]/payment/page.tsx` - Tokenized payment page (CORRECT)

**Booking Creation:**
- `app/api/bookings/route.ts` - Logged-in booking (commit 221ca08d)
- `app/api/public/bookings/bulk/route.ts` - Guest booking (commit 10b30fea1)

**Note:** `app/api/webhooks/stripe/route.ts` also exists but handles subscription webhooks, not booking payment confirmation.

### Database Schema (Relevant Fields)

**Booking:**
```prisma
model Booking {
  id                String
  userId            String?
  guestEmail        String?
  status            BookingStatus
  price             Float
  packageTotalPaid  Float?
  paymentIntentId   String?
  paymentToken      String?
  createdAt         DateTime
  // ... other fields
}

enum BookingStatus {
  PENDING           // Awaiting instructor approval
  PENDING_PAYMENT   // Approved, awaiting payment
  CONFIRMED         // Paid and approved
  EXPIRED           // Payment failed or expired
  // ... other statuses
}
```

---

## Common Pitfalls to Avoid

### 1. Don't Mix Defect Types
- **Source defect:** "Line 186 uses wrong variable"
- **Production incident:** "15 customers charged wrong amount"
- Keep these separate until production investigation proves the link

### 2. Don't Trust Proposed Code Snippets
- Verify file paths exist
- Check line numbers match
- Understand context (why was it written that way?)
- Consider downstream effects

### 3. Don't Skip Root Cause Analysis
- One-line fix might not address the real issue
- Example: Amount mismatch needs canonical calculation, not variable rename

### 4. Don't Assume Customer Harm
- Source defect = potential harm
- Actual harm requires production data
- Webhook might have failed gracefully
- Payment might have been refunded
- Booking might have been manually fixed

### 5. Don't Emergency Deploy
- Even critical bugs need:
  - Proper testing
  - Code review
  - Staging validation
  - Rollback plan

### 6. Don't Break Financial Accounting
- Multiple bookings need multiple ledger entries
- Cannot just loop and save
- Must be transactional

---

## Questions for Next Agent

Before starting fixes, answer these:

1. **Production Access:** Do you have read access to production database and Stripe dashboard?

2. **Policy Decisions:**
   - Short-notice bookings: payment before or after instructor approval?
   - Guest checkout: reject if email exists, OTP verification, or separate flow?

3. **Deployment Authority:** 
   - Who approves production deployments?
   - What's the deployment process?
   - Staging environment available?

4. **Customer Communication:**
   - If investigation finds affected customers, who contacts them?
   - Refund policy?
   - Support ticket process?

5. **Testing:**
   - Test Stripe account available?
   - Integration test suite exists?
   - Manual QA process?

---

## Success Criteria

**Investigation Complete:**
- [ ] Production database queried for affected bookings
- [ ] Stripe payments reconciled against booking status
- [ ] Webhook logs reviewed
- [ ] Customer impact quantified (X customers, Y date range)
- [ ] Findings documented in `PRODUCTION-INVESTIGATION-RESULTS.md`

**Fixes Complete:**
- [ ] All 4 blockers addressed
- [ ] Tests written and passing
- [ ] Code reviewed
- [ ] Staging validated
- [ ] Production deployed
- [ ] Monitoring confirms no regressions

**Documentation Complete:**
- [ ] Fix implementation documented
- [ ] Test results recorded
- [ ] Deployment notes captured
- [ ] Customer communication sent (if applicable)
- [ ] Post-mortem scheduled

---

## Final Notes

This audit uncovered serious defects, but we maintained professional rigor:
- Verified every claim in source code
- Separated source truth from unverified production claims
- Documented unsafe proposed fixes
- Defined safe investigation and fix procedures

The defects are real and need fixing, but **do not emergency deploy without:**
1. Production investigation to confirm customer impact
2. Proper fix design addressing root causes
3. Testing in staging environment
4. Code review and approval

The difference between a critical bug and a critical incident is **verified customer harm**. We have the bug; prove the incident before treating it as one.

---

**Handoff Complete.**

Good luck. The codebase is in your hands. Follow the investigation procedures, design fixes carefully, test thoroughly, and deploy safely.

If you need clarification on any finding, refer to the detailed audit documents. If you disagree with an assessment, re-verify the source code and document your findings.

**Most importantly:** Don't let urgency override safety. These fixes affect customer payments. Get them right.

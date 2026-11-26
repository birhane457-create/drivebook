# Fix Tracking: Public Stripe Booking Critical Issues

**Created:** 2026-11-25  
**Target Resolution:** 2026-11-27  
**Code Base:** main @ `10b30fea1`

---

## Fix Status Overview

| Issue | Status | Assigned | ETA | Branch | PR |
|-------|--------|----------|-----|--------|-----|
| #1 Amount Mismatch | ⏳ Not Started | TBD | +30min | TBD | TBD |
| #2 Account Ownership | ⏳ Not Started | TBD | +4h | TBD | TBD |
| #3 Short-Notice Status | ⏳ Not Started | TBD | +2h | TBD | TBD |
| #4 Token Passing | 🔍 Needs Verification | TBD | +30min | TBD | TBD |

**Legend:**
- ⏳ Not Started
- 🔍 Under Investigation
- 🔧 In Progress
- ✅ Fixed
- 🧪 Testing
- ✔️ Verified

---

## Issue #1: Payment Amount Mismatch

### Status: ⏳ Not Started

### Quick Facts
- **Severity:** 🔴 P0 — Financial
- **Fix Time:** 30 minutes
- **Testing Time:** 30 minutes
- **Files Changed:** 1
- **Lines Changed:** ~5

### Implementation Checklist

#### Code Changes
- [ ] Open `/app/api/payments/create-intent/route.ts`
- [ ] Find line ~186: `const paymentAmount = booking.price;`
- [ ] Replace with:
  ```typescript
  const paymentAmount = booking.isPackageBooking && booking.packageTotalPaid
    ? booking.packageTotalPaid
    : booking.price;
  ```
- [ ] Add comment explaining the logic
- [ ] Save and commit

#### Testing
- [ ] Run existing tests: `npm test -- create-intent`
- [ ] Add new test case (see below)
- [ ] Manual test: Create 6-hour package, verify PaymentIntent amount
- [ ] Verify webhook accepts the amount

#### Test Case to Add
```typescript
// __tests__/integration/public-booking-payment.test.ts
it('charges full package total, not first lesson price', async () => {
  // Create 6-hour package booking ($60/hour)
  const { bookingId } = await createPublicBooking({
    hours: 6,
    hourlyRate: 60,
  });
  
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  expect(booking.price).toBe(60);           // First lesson
  expect(booking.packageTotalPaid).toBe(357.25);  // Full package
  
  // Create payment intent
  const { amount } = await createPaymentIntent(bookingId);
  
  // ✅ Should use packageTotalPaid, not price
  expect(amount).toBe(357.25);  // NOT 60
});
```

#### Verification Steps
1. [ ] Code review by second developer
2. [ ] Test passes locally
3. [ ] Manual test on staging:
   - [ ] Book 6-hour package
   - [ ] Check Stripe dashboard: PaymentIntent amount = $357.25
   - [ ] Complete payment
   - [ ] Verify webhook confirms booking
4. [ ] Database check: `booking.isPaid = true`, `booking.status = 'CONFIRMED'`

#### Deployment
- [ ] Create branch: `fix/payment-amount-mismatch`
- [ ] Commit with message: `fix: use packageTotalPaid for package booking payments`
- [ ] Create PR with link to this document
- [ ] Get approval
- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Verify on staging
- [ ] Deploy to production
- [ ] Monitor logs for 24 hours

---

## Issue #2: Account Linked Without Ownership Proof

### Status: ⏳ Not Started

### Quick Facts
- **Severity:** 🔴 P0 — Security
- **Fix Time:** 4 hours (backend + frontend)
- **Testing Time:** 1 hour
- **Files Changed:** 2
- **Lines Changed:** ~40

### Implementation Checklist

#### Backend Changes
- [ ] Open `/app/api/public/bookings/bulk/route.ts`
- [ ] Find section around line 540 (account creation/linking)
- [ ] Add password verification for existing accounts:
  ```typescript
  if (!existingUser) {
    // Create new user (existing logic)
  } else {
    // ✅ ADD: Password verification
    if (!data.accountHolderPassword) {
      return NextResponse.json({
        error: 'This email is already registered. Please enter your password.',
        code: 'PASSWORD_REQUIRED',
        existingAccount: true,
      }, { status: 403 });
    }
    
    const passwordValid = await bcrypt.compare(
      data.accountHolderPassword,
      existingUser.password
    );
    
    if (!passwordValid) {
      return NextResponse.json({
        error: 'Incorrect password.',
        code: 'INVALID_PASSWORD',
      }, { status: 401 });
    }
    
    userId = existingUser.id;
  }
  ```
- [ ] Save and commit

#### Frontend Changes
- [ ] Open booking form component (find file first)
- [ ] Add password field (initially hidden)
- [ ] Add "Check Email" button or auto-check on blur
- [ ] When email exists:
  - [ ] Show password field
  - [ ] Update label: "Welcome back! Enter your password"
  - [ ] Show "Forgot password?" link
- [ ] Handle error responses (`PASSWORD_REQUIRED`, `INVALID_PASSWORD`)
- [ ] Save and commit

#### Testing
- [ ] Add backend test:
  ```typescript
  it('rejects booking with existing email without password', async () => {
    await createUser({ email: 'existing@example.com', password: 'Password123' });
    
    const response = await fetch('/api/public/bookings/bulk', {
      body: JSON.stringify({
        accountHolderEmail: 'existing@example.com',
        accountHolderPassword: '',  // ❌ Empty password
        // ... rest of booking ...
      }),
    });
    
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'PASSWORD_REQUIRED',
      existingAccount: true,
    });
  });
  
  it('accepts booking with correct password', async () => {
    await createUser({ email: 'existing@example.com', password: 'Password123' });
    
    const response = await fetch('/api/public/bookings/bulk', {
      body: JSON.stringify({
        accountHolderEmail: 'existing@example.com',
        accountHolderPassword: 'Password123',  // ✅ Correct
        // ... rest of booking ...
      }),
    });
    
    expect(response.status).toBe(201);
  });
  ```
- [ ] Add frontend E2E test (Playwright/Cypress)
- [ ] Manual test: Try to book with existing email, verify password required

#### Verification Steps
1. [ ] Code review
2. [ ] Backend tests pass
3. [ ] Frontend tests pass
4. [ ] Manual test on staging:
   - [ ] Create account: `test@example.com`
   - [ ] Log out
   - [ ] Try to book with same email, no password → ❌ Rejected
   - [ ] Try with wrong password → ❌ Rejected
   - [ ] Try with correct password → ✅ Works
5. [ ] Security review: Verify no bypass possible

#### Deployment
- [ ] Create branch: `fix/account-ownership-verification`
- [ ] Commit backend: `fix: require password verification for existing accounts`
- [ ] Commit frontend: `feat: show password field for existing accounts`
- [ ] Create PR
- [ ] Get approval
- [ ] Merge and deploy

---

## Issue #3: Short-Notice Booking Status Defect

### Status: ⏳ Not Started

### Quick Facts
- **Severity:** 🔴 P0 — Financial + UX
- **Fix Time:** 2 hours
- **Testing Time:** 1 hour
- **Files Changed:** 2 (backend + frontend)
- **Lines Changed:** ~20

### Implementation Checklist

#### Backend Changes
- [ ] Open `/app/api/payments/create-intent/route.ts`
- [ ] Find line ~185: `if (!['PENDING_PAYMENT', 'PENDING'].includes(booking.status))`
- [ ] Change to reject PENDING status:
  ```typescript
  // ✅ FIX: Only allow payment for PENDING_PAYMENT status
  if (booking.status !== 'PENDING_PAYMENT') {
    if (booking.status === 'PENDING') {
      return NextResponse.json({
        error: 'This booking requires instructor approval before payment.',
        code: 'AWAITING_APPROVAL',
        requiresApproval: true,
      }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: `Booking cannot be paid (status: ${booking.status})` },
      { status: 400 }
    );
  }
  ```
- [ ] Save and commit

#### Frontend Changes
- [ ] Open booking confirmation/payment page
- [ ] Check `bookingResult.isShortNotice`
- [ ] If true, show approval-pending message instead of payment button:
  ```tsx
  if (bookingResult.isShortNotice) {
    return (
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-yellow-900 mb-2">
          ⏰ Waiting for Instructor Approval
        </h2>
        <p className="text-yellow-800 mb-4">
          Your lesson starts soon. The instructor will review and approve within 15 minutes.
        </p>
        <p className="text-yellow-700 text-sm">
          You'll receive an SMS when approved. Payment will be requested then.
        </p>
      </div>
    );
  }
  ```
- [ ] Save and commit

#### Testing
- [ ] Add test:
  ```typescript
  it('rejects payment for short-notice bookings awaiting approval', async () => {
    // Create short-notice booking (starts in 1 hour)
    const startTime = new Date(Date.now() + 60 * 60 * 1000);
    const { bookingId, isShortNotice } = await createPublicBooking({
      startTime,
    });
    
    expect(isShortNotice).toBe(true);
    
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking.status).toBe('PENDING');
    
    // Try to create payment intent
    const response = await fetch('/api/payments/create-intent', {
      body: JSON.stringify({ bookingId }),
    });
    
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'AWAITING_APPROVAL',
      requiresApproval: true,
    });
  });
  
  it('allows payment after instructor approves', async () => {
    // ... create short-notice booking ...
    
    // Instructor approves
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'PENDING_PAYMENT' },
    });
    
    // Now payment should work
    const response = await fetch('/api/payments/create-intent', {
      body: JSON.stringify({ bookingId }),
    });
    
    expect(response.status).toBe(200);
  });
  ```

#### Verification Steps
1. [ ] Code review
2. [ ] Tests pass
3. [ ] Manual test on staging:
   - [ ] Book lesson starting in 1 hour
   - [ ] Verify `isShortNotice: true` in response
   - [ ] Verify payment button NOT shown
   - [ ] Verify "Waiting for approval" message shown
   - [ ] Instructor dashboard: Approve booking
   - [ ] Verify SMS sent to customer
   - [ ] Customer can now pay

#### Deployment
- [ ] Create branch: `fix/short-notice-payment-block`
- [ ] Commit backend: `fix: block payment for bookings awaiting instructor approval`
- [ ] Commit frontend: `feat: show approval-pending message for short-notice bookings`
- [ ] Create PR
- [ ] Merge and deploy

---

## Issue #4: Payment Token Not Passed (Verification Needed)

### Status: 🔍 Needs Verification

### Quick Facts
- **Severity:** 🔴 P0 — Functionality (if exists)
- **Fix Time:** 30 minutes (if bug confirmed)
- **Testing Time:** 30 minutes
- **Files Changed:** 1 (frontend)
- **Lines Changed:** ~3

### Investigation Checklist

#### Step 1: Find Frontend Payment Page
- [ ] Search for file: `/app/booking/[id]/payment/page.tsx` or similar
- [ ] Alternative names to check:
  - [ ] `/app/payment/[bookingId]/page.tsx`
  - [ ] `/app/book/[id]/pay/page.tsx`
  - [ ] `/pages/booking/[id]/payment.tsx` (if Pages Router)

#### Step 2: Check Token Extraction
- [ ] File found: `_______________` (fill in)
- [ ] Token extracted from URL: `const token = searchParams.token`?
  - [ ] ✅ Yes — extracted correctly
  - [ ] ❌ No — not extracted
  - [ ] ⚠️ Extracted but not used

#### Step 3: Check API Call
- [ ] Find fetch to `/api/payments/create-intent`
- [ ] Check request body:
  ```typescript
  // ✅ Correct:
  body: JSON.stringify({ bookingId, paymentToken: token })
  
  // ❌ Bug:
  body: JSON.stringify({ bookingId })  // Missing paymentToken
  ```
- [ ] Result:
  - [ ] ✅ Token passed correctly — No bug
  - [ ] ❌ Token NOT passed — Bug confirmed

### Implementation Checklist (If Bug Exists)

#### Code Changes
- [ ] Open payment page component
- [ ] Extract token from URL:
  ```typescript
  const token = searchParams.token || searchParams.paymentToken;
  ```
- [ ] Pass token to API:
  ```typescript
  const response = await fetch('/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId,
      paymentToken: token,  // ✅ ADD THIS
    }),
  });
  ```
- [ ] Save and commit

#### Testing
- [ ] Add E2E test (Playwright):
  ```typescript
  test('guest can pay with token-protected link', async ({ page }) => {
    // Create booking as guest
    const { checkoutUrl } = await createGuestBooking();
    
    // Extract token from URL
    const url = new URL(checkoutUrl);
    expect(url.searchParams.get('token')).toBeTruthy();
    
    // Navigate to payment page
    await page.goto(checkoutUrl);
    
    // Fill payment form
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    // ... rest of card details ...
    
    // Submit payment
    await page.click('[data-testid="pay-button"]');
    
    // ✅ Should succeed (not 401)
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
  });
  ```

#### Verification Steps
1. [ ] Investigation complete: Bug exists? ☐ Yes ☐ No
2. [ ] If yes:
   - [ ] Code changed
   - [ ] Tests pass
   - [ ] Manual test on staging:
     - [ ] Create guest booking
     - [ ] Copy `checkoutUrl`
     - [ ] Open in incognito window (no session)
     - [ ] Verify payment form loads
     - [ ] Complete payment
     - [ ] Verify success (not 401)

#### Deployment
- [ ] Create branch: `fix/payment-token-passing`
- [ ] Commit: `fix: pass payment token to create-intent API for guest checkout`
- [ ] Create PR
- [ ] Merge and deploy

---

## Final Verification (All Issues)

### Integration Testing
- [ ] Run full test suite: `npm test`
- [ ] All tests pass
- [ ] No new warnings/errors

### Staging Deployment
- [ ] Deploy all fixes to staging
- [ ] Smoke tests:
  - [ ] ✅ Book 1-hour lesson (single) as guest
  - [ ] ✅ Book 6-hour package as guest
  - [ ] ✅ Book with existing account (password required)
  - [ ] ✅ Book short-notice lesson (payment blocked until approval)
  - [ ] ✅ Verify all Stripe charges match displayed totals
  - [ ] ✅ Verify all webhooks confirm bookings correctly

### Production Deployment
- [ ] Get approval from: _____________ (name)
- [ ] Deploy to production
- [ ] Monitor for 24 hours:
  - [ ] Check Stripe webhook logs (no errors)
  - [ ] Check application logs (no "amount mismatch" errors)
  - [ ] Check support tickets (no "booking not confirmed" issues)
  - [ ] Database spot-check: 10 recent bookings all correct

---

## Rollback Plan

### If Critical Issue Found After Deployment

1. **Immediate:** Disable public booking route
   ```typescript
   // In middleware or route handler:
   if (req.url.includes('/api/public/bookings/bulk')) {
     return NextResponse.json(
       { error: 'Public booking temporarily unavailable. Please try again later.' },
       { status: 503 }
     );
   }
   ```

2. **Revert:** Git revert merge commits
   ```bash
   git revert HEAD~4..HEAD  # Last 4 commits
   git push origin main --force-with-lease
   ```

3. **Notify:** Support team + customers with pending bookings

4. **Fix:** Address issue offline, re-deploy when ready

---

## Post-Deployment Monitoring

### Week 1 Daily Checks
- [ ] Day 1: Review Stripe webhook logs, check first 10 bookings
- [ ] Day 2: Check support tickets, review error logs
- [ ] Day 3: Database audit: `booking.price` vs `packageTotalPaid` consistency
- [ ] Day 4: Review amount mismatch alerts (should be zero)
- [ ] Day 5: Verify no PENDING bookings with paymentIntentId
- [ ] Day 6: Check guest checkout success rate
- [ ] Day 7: Final review meeting

### Metrics to Track
| Metric | Target | Current |
|--------|--------|---------|
| Webhook success rate | >99% | ___ |
| Guest checkout success | >95% | ___ |
| Amount mismatch errors | 0 | ___ |
| Support tickets (payment) | <5/week | ___ |
| Short-notice approval time | <15min avg | ___ |

---

## Sign-Off

**Fixes Completed:**
- [ ] Issue #1: Amount Mismatch — ✅ Fixed by: ________ on: ________
- [ ] Issue #2: Account Ownership — ✅ Fixed by: ________ on: ________
- [ ] Issue #3: Short-Notice Status — ✅ Fixed by: ________ on: ________
- [ ] Issue #4: Token Passing — ✅ Fixed by: ________ on: ________ (or N/A)

**Testing Completed:**
- [ ] Unit tests — ✅ Passed by: ________ on: ________
- [ ] Integration tests — ✅ Passed by: ________ on: ________
- [ ] Staging verification — ✅ Verified by: ________ on: ________

**Production Deployment:**
- [ ] Approved by: ________ on: ________
- [ ] Deployed by: ________ on: ________
- [ ] Monitoring: ✅ 24-hour check completed on: ________

**Production Ready:** ☐ YES ☐ NO

---

**Document Owner:** Development Team  
**Last Updated:** 2026-11-25  
**Status:** ⏳ In Progress

# 🚨 URGENT: Hotfix Required Tonight

**Date:** 2026-11-25  
**Severity:** 🔴 **PRODUCTION INCIDENT**  
**Verified At:** Commit `221ca08d` (2026-11-18)  
**Status:** **CUSTOMERS BEING CHARGED WITHOUT CONFIRMATION**

---

## Critical Situation

**Confirmed in source code:**
- Customers booking packages are charged **incorrect amount** ($60 instead of $393)
- Webhook rejects payment → booking stays `PENDING_PAYMENT`
- After 10 minutes → booking expires
- **Customer charged but has no lesson**

**Estimated affected customers:** Unknown (requires Stripe dashboard check)  
**Potential refunds:** $15,000-$20,000 if 50 packages in last month

---

## Immediate Actions (Next 2 Hours)

### 1. CHECK STRIPE DASHBOARD (30 minutes)

**Run this query in production database:**

```sql
SELECT 
  b.id AS booking_id,
  b.createdAt AS created,
  b.customerEmail AS customer,
  b.price AS charged_amount,
  b.packageTotalPaid AS should_have_charged,
  b.status,
  b.paymentIntentId AS stripe_payment_id,
  (b.packageTotalPaid - b.price) AS customer_overcharged_by
FROM "Booking" b
WHERE 
  b.packageTotalPaid IS NOT NULL
  AND b.packageTotalPaid > b.price
  AND b.status IN ('PENDING_PAYMENT', 'EXPIRED')
  AND b.paymentIntentId IS NOT NULL
  AND b.createdAt > '2026-11-01'
ORDER BY b.createdAt DESC;
```

**In Stripe Dashboard:**
1. Payments → All payments
2. Status = Succeeded
3. Date = Last 30 days
4. For each payment with `bookingId` in metadata:
   - Check if booking status is `PENDING_PAYMENT` or `EXPIRED`
   - If yes: **Customer needs refund**

**Create refund list:**
```
Customer Email | Charged | Should Be | Refund Amount | Booking ID | Stripe Payment ID
---------------|---------|-----------|---------------|------------|------------------
john@email.com | $60     | $393.25   | ($333.25)     | book-123   | pi_abc123
jane@email.com | $60     | $357.00   | ($297.00)     | book-456   | pi_def456
...
```

---

### 2. DEPLOY HOTFIX #1: Amount Mismatch (30 minutes)

**File:** `app/api/create-payment-intent/route.ts`

**Current code (line ~248):**
```typescript
const paymentAmount = booking.price;  // ❌ Always uses first lesson price
```

**Fixed code:**
```typescript
// ✅ FIX: Use packageTotalPaid for packages, booking.price for single lessons
const paymentAmount = booking.isPackageBooking && booking.packageTotalPaid
  ? booking.packageTotalPaid
  : booking.price;
```

**Testing before deploy:**
```bash
# Test case 1: Single lesson
curl -X POST http://localhost:3000/api/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"single-lesson-id"}'
# Expected: amount = booking.price (e.g., $60)

# Test case 2: Package booking
curl -X POST http://localhost:3000/api/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"package-booking-id"}'
# Expected: amount = booking.packageTotalPaid (e.g., $393.25)
```

**Deploy steps:**
```bash
git checkout main
git pull origin main
git checkout -b hotfix/payment-amount-package
# Make the change above
git add app/api/create-payment-intent/route.ts
git commit -m "hotfix: use packageTotalPaid for package booking payments

CRITICAL: Customers being charged first-lesson amount instead of package total.
Webhook rejects mismatch, leaving bookings unconfirmed.

Fix: Check isPackageBooking flag and use packageTotalPaid when present.

Verified against: 221ca08d
Affects: All multi-lesson package bookings since Nov 1"
git push origin hotfix/payment-amount-package

# Create PR, get emergency approval, merge immediately
# Deploy to production
```

---

### 3. DEPLOY HOTFIX #2: Payment Token (30 minutes)

**File:** `app/book/[instructorId]/payment/page.tsx`

**Current code (lines ~114-141):**
```typescript
const response = await fetch('/api/create-payment-intent', {
  method: 'POST',
  body: JSON.stringify({
    amount: totalAmount,
    bookingId: bookingResponse.bookingId,
    // ❌ Missing: paymentToken
  }),
});
```

**Fixed code:**
```typescript
// ✅ FIX: Extract token from URL and pass to API
const urlParams = new URLSearchParams(window.location.search);
const paymentToken = urlParams.get('token');

const response = await fetch('/api/create-payment-intent', {
  method: 'POST',
  body: JSON.stringify({
    amount: totalAmount,
    bookingId: bookingResponse.bookingId,
    paymentToken: paymentToken,  // ✅ Add token for guest auth
  }),
});
```

**Testing:**
```bash
# Open in browser (incognito - no session):
http://localhost:3000/booking/test-booking-id/payment?token=test-token-123

# Should NOT show 401 Unauthorized
# Should show Stripe payment form
```

**Deploy:**
```bash
git checkout -b hotfix/payment-token-guest-checkout
# Make the change above
git add app/book/[instructorId]/payment/page.tsx
git commit -m "hotfix: pass payment token for guest checkout auth

CRITICAL: Guest checkout returns 401 because payment token not sent.
Only logged-in users can complete payment.

Fix: Extract token from URL query params and include in payment intent request.

Verified against: 221ca08d
Affects: All guest bookings (100% failure rate)"
git push origin hotfix/payment-token-guest-checkout

# Create PR, merge, deploy
```

---

### 4. COMMUNICATE TO CUSTOMERS (30 minutes)

**For affected customers (from Stripe query):**

**Email template:**

```
Subject: Important: Issue with Your Recent Booking Payment

Dear [Customer Name],

We discovered a technical issue affecting your recent driving lesson booking on [Date].

What happened:
- You were charged $[Amount] for a [X]-hour lesson package
- Due to a system error, your booking was not confirmed
- Your slot has been released

What we're doing:
- We've fixed the issue as of [Tonight's Date]
- We're issuing a full refund of $[Amount] to your card
- Refund will appear in 5-7 business days

We sincerely apologize for this inconvenience.

To rebook your lessons:
1. The issue is now resolved
2. Visit [Booking URL] to schedule again
3. Your payment will be processed correctly this time

Or contact us:
- Email: support@drivebook.com.au
- Phone: [Number]

We've added a $[Goodwill Credit] credit to your account as an apology.

Sincerely,
DriveBook Team
```

**Internal notification:**

```
To: support@drivebook.com.au
Subject: URGENT: Payment Issue - Affected Customers List

[Paste refund list from Step 1]

Action required:
1. Process refunds in Stripe (see attached list)
2. Send apology emails (template attached)
3. Add $20 goodwill credit to each affected account
4. Monitor support inbox for related inquiries

Issue resolved: [Tonight's Date Time]
Hotfixes deployed: [Tonight's Date Time]
```

---

## Tomorrow Morning Actions

### 5. FIX: Persist Every Lesson (2-3 hours)

**File:** `app/api/public/bookings/bulk/route.ts`

**Problem:**
```typescript
// Line 822: Only takes first scheduled booking
const slot = data.scheduledBookings[0];  // ❌

const booking = await prisma.booking.create({
  // ... uses slot data (only first lesson)
});
// Result: 1 booking row, missing remaining 5 lessons
```

**Fix:**
```typescript
// ✅ Create booking for EACH scheduled slot
const bookings = [];

for (const slot of data.scheduledBookings) {
  const [h, m] = slot.time.split(':').map(Number);
  const startTime = new Date(slot.date);
  startTime.setHours(h, m, 0, 0);
  const endTime = new Date(startTime.getTime() + slot.duration * 60 * 1000);
  
  const booking = await tx.booking.create({
    data: {
      providerId: resolvedInstructorId,
      customerId: customerId,
      status: 'PENDING_PAYMENT',
      startTime,
      endTime,
      duration: slot.duration,
      price: parseFloat((instructor.hourlyRate * (slot.duration / 60)).toFixed(2)),
      pickupAddress: slot.pickupLocation || null,
      notes: slot.notes || null,
      // ... rest of fields
    }
  });
  
  bookings.push(booking);
}

// Update metadata to reference ALL bookings
metadata: {
  bookingIds: bookings.map(b => b.id),
}
```

**Testing:**
```typescript
// Test: Book 6-hour package with 6 different time slots
const response = await fetch('/api/public/bookings/bulk', {
  body: JSON.stringify({
    scheduledBookings: [
      { date: '2026-12-01', time: '10:00', duration: 60 },
      { date: '2026-12-02', time: '14:00', duration: 60 },
      { date: '2026-12-03', time: '16:00', duration: 60 },
      { date: '2026-12-04', time: '10:00', duration: 60 },
      { date: '2026-12-05', time: '14:00', duration: 60 },
      { date: '2026-12-06', time: '10:00', duration: 60 },
    ],
    // ... rest of booking data
  })
});

// Verify: 6 Booking rows created
const bookings = await prisma.booking.findMany({
  where: { customerId: testCustomerId }
});
expect(bookings.length).toBe(6);
```

---

### 6. FIX: PDA customerId Required (1 hour)

**File:** `app/client-dashboard/pda-tests/book/BookingDetailsForm.tsx`

**Problem:**
```typescript
// Lines 308-315: Missing customerId
body: JSON.stringify({
  configId: selectedTest.id,
  testCentreId: selectedCentre.id,
  testDate: bookingDate,
  testTime: bookingTime,
  // ❌ Missing: customerId (required by API)
})
```

**Fix:**
```typescript
// ✅ Get customerId from user context
const { customer } = useCustomer(); // Or however app gets current customer

body: JSON.stringify({
  configId: selectedTest.id,
  testCentreId: selectedCentre.id,
  testDate: bookingDate,
  testTime: bookingTime,
  customerId: customer.id,  // ✅ Add required field
  pickupLocation,
  notes,
})
```

---

### 7. FIX: Timezone Conversion (2 hours)

**File:** `app/api/public/bookings/bulk/route.ts`

**Problem:**
```typescript
// Line 824: Uses server timezone
const [h, m] = slot.time.split(':').map(Number);
startTime = new Date(slot.date);
startTime.setHours(h, m, 0, 0);  // ❌ Server's local time
```

**Fix:**
```typescript
// ✅ Use instructor's timezone
import { localDateTimeToUTC, resolveTimezone } from '@/lib/utils/timezone';

const instructorTz = instructor.timezone 
  ? resolveTimezone(instructor.timezone)
  : (instructor.state ? resolveTimezone(instructor.state) : DEFAULT_TIMEZONE);

for (const slot of data.scheduledBookings) {
  // Convert local time to UTC using instructor's timezone
  const startTime = localDateTimeToUTC(
    slot.date,
    slot.time,
    instructorTz
  );
  
  const endTime = new Date(startTime.getTime() + slot.duration * 60 * 1000);
  
  // ... create booking with correct UTC times
}
```

---

## Monitoring After Hotfix

**Next 24 hours:**

1. **Monitor Stripe webhooks:**
   ```bash
   # Check webhook logs for payment amount mismatches
   # Should be ZERO after fix
   grep "Payment amount mismatch" /var/log/app.log | wc -l
   ```

2. **Monitor booking confirmations:**
   ```sql
   -- Should see NO bookings stuck in PENDING_PAYMENT after payment
   SELECT COUNT(*) FROM "Booking"
   WHERE status = 'PENDING_PAYMENT'
     AND paymentIntentId IS NOT NULL
     AND createdAt > NOW() - INTERVAL '1 hour';
   -- Expected: 0
   ```

3. **Monitor guest checkout:**
   ```sql
   -- Should see successful guest bookings
   SELECT COUNT(*) FROM "Booking"
   WHERE status = 'CONFIRMED'
     AND customerId IN (
       SELECT id FROM "Customer" WHERE userId IS NULL  -- Guest customers
     )
     AND createdAt > NOW() - INTERVAL '1 hour';
   -- Expected: > 0 (if guests book)
   ```

4. **Monitor support tickets:**
   - Watch for: "I paid but have no booking"
   - Watch for: "Payment failed with 401 error"
   - Should drop to ZERO after hotfixes

---

## Rollback Plan

**If hotfix causes issues:**

```bash
# Revert hotfix #1
git revert [commit-hash-of-hotfix-1]
git push origin main

# Revert hotfix #2
git revert [commit-hash-of-hotfix-2]
git push origin main

# Redeploy
# Alert: "Public booking temporarily disabled while we investigate"
```

---

## Success Criteria

**Hotfixes successful if:**

- ✅ No new "amount mismatch" errors in webhook logs (next 24 hours)
- ✅ All package bookings confirm after payment (next 24 hours)
- ✅ Guest checkout works without 401 errors (next 24 hours)
- ✅ No support tickets about failed bookings (next 48 hours)
- ✅ Stripe dashboard shows no stranded succeeded payments (next week)

---

## Post-Mortem (Schedule for Next Week)

**Questions to answer:**
1. How did amount mismatch reach production?
2. Why wasn't this caught in testing?
3. How many customers affected?
4. Total refunds issued?
5. How to prevent similar issues?

**Action items:**
1. Add end-to-end test for package booking payment
2. Add monitoring alert for webhook amount mismatches
3. Add CI check that prevents merge if payment flow tests fail
4. Review all other payment-related code for similar issues

---

**Timeline:**

```
Now (6 PM):        Start
6:30 PM:           Stripe dashboard checked, refund list created
7:00 PM:           Hotfix #1 deployed (amount mismatch)
7:30 PM:           Hotfix #2 deployed (payment token)
8:00 PM:           Customer emails sent
8:30 PM:           Monitoring dashboard setup
9:00 PM:           Done for tonight

Tomorrow 9 AM:     Check overnight results
Tomorrow 10 AM:    Start fix #3 (persist every lesson)
Tomorrow 2 PM:     Deploy fix #3
Tomorrow EOD:      All critical issues resolved
```

---

**Who Does What:**

| Task | Owner | Deadline |
|------|-------|----------|
| Check Stripe dashboard | Backend Dev | 6:30 PM |
| Deploy hotfix #1 | Backend Dev | 7:00 PM |
| Deploy hotfix #2 | Frontend Dev | 7:30 PM |
| Send customer emails | Support Lead | 8:00 PM |
| Process refunds | Finance | Tomorrow 9 AM |
| Fix #3 (persist lessons) | Backend Dev | Tomorrow 2 PM |
| Fix #4 (PDA customerId) | Frontend Dev | Tomorrow 2 PM |
| Fix #5 (timezone) | Backend Dev | Tomorrow EOD |

---

**Document Status:** 🔴 **URGENT ACTION REQUIRED**  
**Next Update:** After hotfixes deployed (tonight ~8 PM)

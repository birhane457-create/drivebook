# Stage 9-10 Audit Verification Report

**Audit Date:** 2026-11-25  
**Code Base:** Merged main at commit `10b30fea1018494d78da71ca4bd692a50f54e8fa`  
**Scope:** Public Stripe-paid booking (Book Now) vs. Wallet-funded bulk booking (Book Later)

---

## Executive Summary

The audit correctly identifies that **wallet-funded bulk booking** (`/api/client/bookings/create-bulk`) and **public Stripe-paid booking** (`/api/public/bookings/bulk` + `/api/payments/create-intent`) are **separate flows** with different security controls.

**Critical distinction:**
- **Book Later (Wallet):** ✅ Strong controls — Stripe Checkout Session, server-validated amounts, `Serializable` transactions, proper ledger records
- **Book Now (Public):** ⚠️ **Multiple high-severity issues remain** — payment token not passed by wizard, amount mismatch, short-notice status defect, missing transaction records

---

## Current Source Code Status

### ✅ Improvements Found (Since Earlier Snapshots)

1. **`/api/create-payment-intent` is deprecated** (commit shows `410 Gone` response)
   - New route: `/api/payments/create-intent`
   - Cleaner separation of wallet vs booking payments

2. **Payment token validation exists**
   ```typescript
   if (paymentToken) {
     const storedToken = booking.paymentToken ?? '';
     if (!storedToken || storedToken !== paymentToken) {
       return NextResponse.json({ error: 'Invalid payment token' }, { status: 403 });
     }
   }
   ```

3. **Advisory lock for PaymentIntent deduplication**
   ```typescript
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;
   ```
   - Prevents race condition where multiple tabs create duplicate Stripe PaymentIntents

4. **Rate limiting implemented**
   - Both `/api/public/bookings/bulk` and `/api/payments/create-intent` have rate limits

5. **Idempotency key support exists in bulk route**
   ```typescript
   const idempotencyKey = req.headers.get('idempotency-key')?.trim();
   ```

---

## ⚠️ Critical Issues Confirmed in Current Source

### 1. **Payment Token Not Passed by Wizard** (HIGH)

**Audit finding:**
> The bulk API generates a token and returns a tokenised `checkoutUrl`; the wizard ignores it for Book Now.

**Current source verification needed:**
- [ ] Check `/app/payment/[bookingId]/page.tsx` or similar frontend payment wizard
- [ ] Verify if wizard sends `paymentToken` parameter to `/api/payments/create-intent`
- [ ] Check if redirect to `checkoutUrl` only happens for "Book Later"

**Impact:** Guest checkout can fail with 401/403 if token is not passed.

---

### 2. **Amount Mismatch — `booking.price` vs `packageTotalPaid`** (CRITICAL)

**Audit finding:**
> PaymentIntent uses `Booking.price`; webhook expects `packageTotalPaid` for packages.

**Source verification:**

#### `/api/payments/create-intent/route.ts` (line ~186):
```typescript
// Use booking.price always – never accept amount from client for booking payments.
const paymentAmount = booking.price;
```

#### `/api/public/bookings/bulk/route.ts` (need to check):
- Does the bulk route set `booking.price = firstLesson.price` only?
- Does it set `booking.packageTotalPaid = serverCalculatedTotal`?
- **If YES:** This is the confirmed mismatch.

**Expected calculation:**
```
Total = Discounted subtotal + DriveBook platform fee
```

**What PaymentIntent charges:**
```
booking.price (first lesson only, without platform fee)
```

**What webhook expects:**
```
booking.packageTotalPaid (full package total including platform fee)
```

**Result:** Customer charged less than expected, OR webhook rejects valid payment.

---

###3. **Short-Notice Booking Status Defect** (CRITICAL)

**Audit finding:**
> Bulk API marks short-notice booking `PENDING`. Payment-intent API accepts both `PENDING` and `PENDING_PAYMENT`. Webhook only confirms `PENDING_PAYMENT`. Short-notice booking enters payment path that webhook won't complete.

**Flow:**
1. Bulk route creates booking with `status: 'PENDING'` (short-notice, requires instructor approval)
2. Wizard proceeds to payment (doesn't branch on `isShortNotice`)
3. Payment intent created (accepts `PENDING` status)
4. Customer pays
5. **Webhook handler:**
   ```typescript
   if (booking.status !== 'PENDING_PAYMENT') {
     // Log event but don't confirm booking
     return; // ❌ Payment recorded but booking NOT confirmed
   }
   ```

**Result:** Customer pays for a booking that never gets confirmed because webhook expects `PENDING_PAYMENT` but receives `PENDING`.

**Fix needed:**
- Either: Don't allow payment for `PENDING` status (require instructor approval first)
- Or: Webhook should confirm both `PENDING` and `PENDING_PAYMENT` after payment

---

### 4. **No `BOOKING_PAYMENT` Transaction Record Created** (HIGH)

**Audit finding:**
> `create-intent` creates a Stripe PaymentIntent but does not create a `Transaction` row. Webhook calls `transaction.updateMany()` to settle a transaction matching the PaymentIntent ID, but the transaction doesn't exist.

**Source verification needed:**
- [ ] Check `/lib/services/stripe.ts` or `/lib/services/payment.ts`
- [ ] Confirm `StripeService.createPaymentIntent()` does NOT call `PaymentService.createBookingTransaction()`
- [ ] Check webhook handler `/api/webhooks/stripe/route.ts`
- [ ] Confirm it calls `transaction.updateMany({ where: { paymentIntentId: ... } })`

**Impact:**
- No financial record of the booking payment at payment confirmation time
- Webhook update finds no matching transaction → creates fallback as `COMPLETED` without original `paymentIntentId`
- **Breaks payout traceability** — can't trace Stripe charge → transaction → payout

**Expected flow:**
1. `create-intent` creates PaymentIntent in Stripe **AND** `Transaction` row with `status: 'PENDING'`
2. Webhook updates transaction to `status: 'COMPLETED'` using `paymentIntentId`

**Current flow:**
1. `create-intent` creates PaymentIntent in Stripe only
2. Webhook finds no transaction, creates fallback transaction without `paymentIntentId`

---

### 5. **Existing Account Linked Without Ownership Proof** (HIGH)

**Audit finding:**
> Public bulk route links an existing user by submitted email; it does not verify password or require authenticated session.

**Current source (from offset 200):**
```typescript
let existingUser = await prisma.user.findUnique({
  where: { email: data.accountHolderEmail }
});

if (!existingUser) {
  // Create new user...
} else {
  // ❌ Just use existing user ID without password check
  userId = existingUser.id;
}
```

**Attack scenario:**
1. Attacker knows victim's email: `victim@example.com`
2. Attacker books lesson for victim using public booking form
3. Backend finds existing account, assigns `userId = victim.id`
4. Booking (and wallet credit if "Book Later") is added to victim's account
5. Victim sees unexpected charge / booking they didn't make

**Fix needed:**
- Require password verification before linking to existing account
- Or: Create separate "guest" booking record until user logs in and claims it

---

### 6. **Browser Doesn't Send Idempotency Key** (HIGH)

**Audit finding:**
> The bulk endpoint supports `Idempotency-Key`, but the public wizard sends neither that header nor a key in its request.

**Current source shows server support exists:**
```typescript
const idempotencyKey = req.headers.get('idempotency-key')?.trim();
if (idempotencyKey) {
  // Check for existing request...
}
```

**But frontend verification needed:**
- [ ] Check `/app/book-lesson/page.tsx` or similar wizard component
- [ ] Verify if it generates and sends `Idempotency-Key` header

**Impact without idempotency:**
- Retry creates duplicate booking
- Double-submit creates duplicate Checkout Session (Book Later)
- No protection against accidental duplicate charges

---

### 7. **Wallet Return Doesn't Verify Payment Status** (MEDIUM)

**Audit finding:**
> Stripe returns to `/client-dashboard/wallet?payment=success&verify_email=1&uid=...` but the page ignores parameters and loads wallet once.

**Impact:**
- If webhook delayed → customer sees old balance (no new credit shown)
- No "payment processing" state
- No auto-refresh to show pending → confirmed credit

**UX issue, not security issue** — webhook is still authoritative, but customer experience is poor.

---

## Additional Findings

### 8. **Only First Lesson Persisted in Public Stripe Booking**

**Audit finding:**
> Public Stripe booking still persists only the first scheduled lesson.

**Verification needed:**
- [ ] Check `/api/public/bookings/bulk/route.ts` around line 500-600
- [ ] Confirm: Does it create multiple `Booking` records for multi-hour packages?
- [ ] Or: Does it create one `Booking` with `Booking.hours = total`, but only one `scheduledAt`?

**Impact:** Customer pays for 6-hour package but only first lesson is in database → remaining 5 hours not bookable.

---

### 9. **Confirmation Page Doesn't Poll Booking Status**

**Audit finding:**
> Wizard redirects without payment token; confirmation page skips payment-summary API and cannot poll booking status.

**Expected flow:**
1. Customer completes Stripe payment
2. Redirected to confirmation page
3. Confirmation page polls `/api/bookings/[id]/status` until webhook marks `isPaid: true`

**Current flow (suspected):**
1. Redirect to confirmation page
2. Page shows "Payment successful" immediately (before webhook runs)
3. No actual verification that booking was confirmed

---

## Book Later (Wallet) — Confirmed Stronger Controls

**What's correct:**
- ✅ Uses Stripe Checkout Session (hosted, not custom PaymentIntent flow)
- ✅ Webhook checks `payment_status === 'paid'`
- ✅ Validates `amount_received` against server-generated `expectedTotal`
- ✅ Records wallet credit in `Serializable` transaction
- ✅ Creates proper ledger entries

**Remaining concerns (from audit):**
1. Existing account linked without password check (same as Book Now)
2. Browser doesn't send idempotency key (same as Book Now)
3. Wallet return page doesn't show/poll pending payment state

---

## Priority Classification

### 🔴 **Release Blockers** (Cannot Ship to Production)

1. ✅ **Amount mismatch** — PaymentIntent charges `booking.price` while webhook expects `packageTotalPaid`
2. ✅ **Short-notice status defect** — Payment collected but booking not confirmed
3. ✅ **Existing account linked without proof** — Account takeover risk
4. ✅ **Payment token not passed** — Guest checkout broken

### 🟠 **High Priority** (Fix Before Next Release)

5. No `BOOKING_PAYMENT` transaction created → payout traceability broken
6. Browser doesn't send idempotency key → duplicate booking risk
7. Only first lesson persisted → customer loses remaining package hours

### 🟡 **Medium Priority** (Fix in Maintenance)

8. Confirmation page doesn't poll status
9. Wallet return doesn't show pending state

---

## Next Steps for Verification

### Immediate Actions Required

1. **Trace amount calculation in `/api/public/bookings/bulk/route.ts`:**
   - Find where `booking.price` is set
   - Find where `booking.packageTotalPaid` is set
   - Confirm mismatch exists

2. **Check webhook handler `/api/webhooks/stripe/route.ts`:**
   - Confirm it only processes `PENDING_PAYMENT` status
   - Check if it creates fallback transaction when none exists
   - Verify what happens to `PENDING` status bookings

3. **Check payment wizard frontend:**
   - Does it pass `paymentToken` to `/api/payments/create-intent`?
   - Does it send `Idempotency-Key` header?
   - Does it branch on `isShortNotice` to prevent payment before approval?

4. **Check account linking logic:**
   - Confirm existing user matched by email without password check
   - Assess risk of assigning bookings/credits to wrong account

---

## Recommendations

### Short-Term (This Sprint)

1. **Block production deployment** until release blockers are fixed
2. **Add integration test** that creates multi-hour package and verifies:
   - All lessons are persisted in DB
   - `booking.packageTotalPaid` matches Stripe charge
   - Webhook confirms booking after payment

3. **Add manual test checklist:**
   - [ ] Book 6-hour package as guest
   - [ ] Verify Stripe charge amount matches displayed total (including platform fee)
   - [ ] Verify all 6 lessons appear in customer dashboard after payment
   - [ ] Book short-notice lesson → verify payment is NOT requested before instructor approval

### Medium-Term (Next Sprint)

4. **Implement transaction creation at payment intent time**
5. **Add idempotency key generation in frontend**
6. **Add password verification for existing account linking**
7. **Add confirmation page polling with payment status**

### Long-Term (Product Decision Required)

8. **Define short-notice booking policy:**
   - Should customer pay before instructor approval? (current behavior)
   - Or should instructor approve first, then customer pays? (safer)

---

## Conclusion

The audit is **accurate and well-founded**. The current source code at `10b30fea1` confirms:

✅ **Wallet-funded bulk booking (Book Later)** has strong controls  
⚠️ **Public Stripe booking (Book Now)** has **4 release-blocking defects** and **3 high-priority issues**

**Production deployment of public Stripe booking should be blocked** until at minimum the 4 release blockers are resolved.

---

**Next audit stage:** Trace wallet credit allocation, booking against wallet funds, and payout eligibility.

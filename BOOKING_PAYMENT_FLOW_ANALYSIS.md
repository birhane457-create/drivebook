# Booking Flow & Payment Logic Analysis

**Last Updated:** June 15, 2026  
**Platform:** DriveBook (Driving Instructor Booking Platform)  
**Currency:** AUD (Australian Dollars)

---

## 1. PRICING BREAKDOWN

### 1.1 Commission Rates (By Subscription Tier)

**Source:** `lib/services/platform-pricing.ts`

| Tier | Commission Rate | Instructor Payout % |
|------|-----------------|-------------------|
| **BASIC** | 15% | 85% |
| **PRO** | 12% | 88% |
| **BUSINESS** | 10% | 90% |

**Calculation:**
```javascript
const commissionRate = await getCommissionRate(instructor.subscriptionTier) // Returns 15, 12, or 10 (%)
const instructorPayout = lessonPrice * (1 - commissionRate / 100)
// Example: $100 lesson at BASIC tier → $85 to instructor, $15 to platform
```

### 1.2 Platform Fee (Stripe Processing)

**Source:** `app/api/bookings/route.ts`
```javascript
const PLATFORM_FEE_RATE = 0.036 // 3.6% — Stripe processing fee stored on booking
const platformFee = lessonPrice * PLATFORM_FEE_RATE
```

**Note:** This is recorded on every booking for accounting/reporting but is **separate from commission**.

### 1.3 GST (Good and Services Tax)

**Source:** `lib/services/platform-pricing.ts`
```javascript
gstEnabled: true,
gstRate: 10,  // 10% GST applied (if enabled)
```

**Status:** Currently in pricing settings but **NOT applied in payment calculation** (not used in current payment flow).

---

## 2. LESSON PRICING

### 2.1 Standard Hourly Booking

**Source:** `app/api/bookings/route.ts` (POST handler)

```typescript
// 1. Get duration in hours
const durationHours = (newEnd - newStart) / (1000 * 60 * 60)

// 2. Calculate lesson price
let lessonPrice = instructor.hourlyRate * durationHours

// Example: 
// - Instructor hourly rate: $60
// - Duration: 1.5 hours
// - Lesson price: $60 × 1.5 = $90
```

### 2.2 Special Service Booking (Lesson Packages)

**Source:** `app/api/bookings/route.ts` (POST handler, lines ~120-130)

```typescript
if (data.specialServiceId && data.specialServiceName) {
  // legacy instructor lessonPackages removed — package lookup moved to platform PDA configs
  const packages = [] as any[]
  const pkg = packages.find((p) => p.id === data.specialServiceId)
  
  if (!pkg || !pkg.price) {
    return error('Package not found or has invalid pricing')
  }
  
  lessonPrice = parseFloat(pkg.price.toFixed(2))
}
```

**Example:** PDA Test Package @ $225 (regardless of duration)

### 2.3 Discount Structure

**Source:** `lib/services/platform-pricing.ts`

```javascript
package6Discount: 5,      // 5% off for 6-hour package
package10Discount: 10,    // 10% off for 10-hour package
package15Discount: 12,    // 12% off for 15-hour package
discountPaidBy: 'shared'  // Who absorbs discount: 'shared', 'instructor', 'platform'
```

**Current State:** Discount settings exist but are **NOT currently applied in booking payment calculation**.

---

## 3. BOOKING FLOW

### 3.1 Booking Creation Process

**Entry Point:** `POST /api/bookings`

#### Step 1: Validation
```typescript
// ✅ Instructor must be APPROVED (not pending approval)
if (instructor.approvalStatus !== 'APPROVED') {
  return error('Your account is pending approval')
}

// ✅ Booking must be within advance window
const minAdvanceMs = bookingSettings.minAdvanceHours * 60 * 60 * 1000
const maxAdvanceMs = bookingSettings.maxAdvanceDays * 24 * 60 * 60 * 1000
if (bookingTime < minAdvanceMs || bookingTime > maxAdvanceMs) {
  return error('Booking outside allowed window')
}

// ✅ Client belongs to instructor
const client = await prisma.client.findFirst({
  where: { id, instructorId: session.user.instructorId }
})

// ✅ Client must have a userId (account exists)
if (!client.userId) {
  return error('Client account not set up')
}

// ✅ Client not suspended
if (client.status === 'SUSPENDED') {
  return error('Cannot book with suspended client')
}
```

#### Step 2: Calculate Pricing
```typescript
// Get instructor pricing
const durationHours = (endTime - startTime) / (60 * 60 * 1000)
const lessonPrice = instructor.hourlyRate * durationHours

// Get commission based on tier
const commissionRate = await getCommissionRate(instructor.subscriptionTier)
const instructorPayout = lessonPrice * (1 - commissionRate / 100)

// Platform fee (Stripe)
const platformFee = lessonPrice * 0.036

// Example @ $60/hr for 1 hour (BASIC tier):
// - lessonPrice: $60.00
// - commissionRate: 15%
// - instructorPayout: $51.00 (85% of $60)
// - platformFee: $2.16 (3.6% of $60)
```

#### Step 3: Check Wallet Balance

```typescript
const wallet = await prisma.clientWallet.findUnique({ 
  where: { userId: client.userId } 
})

// Sum all CONFIRMED wallet transactions
const balance = txns.reduce((sum, t) => 
  t.type === 'CREDIT' ? sum + t.amount : sum - t.amount, 0
)
```

#### Step 4A: Insufficient Balance → PENDING_PAYMENT

**Path:** Client wallet balance < lesson price

```typescript
// Create booking as PENDING_PAYMENT
const booking = await tx.booking.create({
  data: {
    // ... standard fields ...
    status: 'PENDING_PAYMENT',  // ⚠️ NOT confirmed yet
    isPaid: false,
    price: lessonPrice,
    instructorPayout,
    commissionRate,
  }
})

// Send email to client
// "Your instructor booked a lesson for you — top up to confirm"
// Includes top-up link (set password if new account, login if existing)
```

**Top-up Amount Calculation:**
```typescript
const shortfall = lessonPrice - balance
const topUpAmount = shortfall / (1 - PLATFORM_FEE_RATE)
// Accounts for Stripe fee during top-up
```

#### Step 4B: Sufficient Balance → CONFIRMED + Wallet Deduction

**Path:** Client wallet balance ≥ lesson price

```typescript
// Within atomic transaction:
// 1. Create booking as CONFIRMED
const booking = await tx.booking.create({
  data: {
    status: 'CONFIRMED',  // ✅ Ready to go
    isPaid: true,
    paidAt: now,
  }
})

// 2. Deduct from wallet
await tx.clientWallet.update({
  where: { id: wallet.id },
  data: { balance: { decrement: lessonPrice } }
})

// 3. Record wallet transaction
await tx.walletTransaction.create({
  data: {
    walletId: wallet.id,
    type: 'DEBIT',
    amount: lessonPrice,
    status: 'CONFIRMED'
  }
})

// 4. Create transaction record
await tx.transaction.create({
  data: {
    bookingId: booking.id,
    type: 'BOOKING_PAYMENT',
    amount: lessonPrice,
    platformFee,
    instructorPayout,
    commissionRate,
    status: 'COMPLETED'
  }
})
```

#### Step 5: Slot Conflict Prevention

```typescript
// All validation happens inside an atomic transaction
// This prevents TOCTOU (Time-of-check-time-of-use) race conditions

// Within transaction lock:
const overlappingBookings = await tx.booking.findFirst({
  where: {
    instructorId,
    status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
    OR: [
      // Booking starts during requested slot
      { AND: [{ startTime: { gte: newStart } }, { startTime: { lt: newEnd } }] },
      // Booking ends during requested slot  
      { AND: [{ endTime: { gt: newStart } }, { endTime: { lte: newEnd } }] },
      // Booking encompasses requested slot
      { AND: [{ startTime: { lte: newStart } }, { endTime: { gte: newEnd } }] }
    ]
  }
})

if (overlappingBookings) {
  throw new Error('SLOT_CONFLICT')
}
```

---

## 4. PAYMENT FLOW

### 4.1 Payment States

```
PENDING_PAYMENT (awaiting Stripe payment)
         ↓ (client tops up wallet via Stripe)
         ↓ (payment_intent.succeeded webhook)
    CONFIRMED (booking confirmed, ready)
         ↓ (lesson date arrives)
    COMPLETED (lesson conducted)
```

### 4.2 Stripe Payment Intent Creation

**Entry Point:** `POST /api/payments/create-intent`

```typescript
// This endpoint creates or reuses a Stripe PaymentIntent
// Used by payment page to collect payment from client

const booking = await prisma.booking.findUnique({
  where: { id: bookingId }
})

// Calculate what to charge
const amount = booking.packageTotalPaid || booking.price

// Get commission rate
const commissionRate = await getCommissionRate(booking.instructor.subscriptionTier)

// Create or reuse PaymentIntent
const paymentIntent = await stripeService.createPaymentIntent({
  amount,              // What client pays
  instructorId: booking.instructorId,
  bookingId,
  commissionRate,      // Metadata only — doesn't affect charging
  clientEmail,
  description: `Driving lesson with ${booking.instructor.name}`
})

// Return to client for Stripe checkout
return {
  clientSecret: paymentIntent.clientSecret,
  amount: amount
}
```

### 4.3 Stripe Webhook Processing

**Entry Point:** `POST /api/stripe/webhook` → `payment_intent.succeeded`

#### Step 1: Verify & Deduplicate
```typescript
// Verify webhook signature (CRITICAL security)
const event = stripe.webhooks.constructEvent(payload, sig, webhookSecret)

// Check idempotency key
const idempotencyKey = `${event.type}_${event.id}_${event.created}`
const existingEvent = await webhookEvent.findUnique({ where: { idempotencyKey } })
if (existingEvent) {
  return { received: true, duplicate: true }
}
```

#### Step 2: Validate Payment Amount
```typescript
const booking = await prisma.booking.findUnique({
  where: { id: bookingId }
})

// What was supposed to be charged?
const chargedAmount = booking.packageTotalPaid || booking.price
const expectedCents = Math.round(chargedAmount * 100)

// What was actually received?
const receivedCents = paymentIntent.amount_received

if (receivedCents !== expectedCents) {
  throw new Error('Payment amount mismatch')
}
```

#### Step 3: Handle Edge Cases

**Case: Booking Expired Before Payment**
```typescript
if (booking.status === 'EXPIRED') {
  // Slot may have been released and given to another student
  // Don't revive the booking — issue refund instead (prevents double-booking)
  
  await stripe.refunds.create({
    payment_intent: paymentIntent.id,
    reason: 'duplicate'
  })
  
  await booking.update({
    status: 'CANCELLED',
    notes: `EXPIRED_PAYMENT: Payment arrived after slot expiry. Auto-refund issued.`
  })
  
  return  // Don't proceed with confirmation
}
```

**Case: Booking Already Confirmed**
```typescript
if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
  // Idempotent replay — webhook was processed already
  return  // Nothing to do
}
```

**Case: Invalid Booking Status**
```typescript
if (booking.status !== 'PENDING_PAYMENT') {
  throw new Error(`Booking not in payable state: ${booking.status}`)
}
```

#### Step 4: Confirm Booking (Atomic Transaction)
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Mark booking as paid
  await tx.booking.update({
    where: { id: bookingId },
    data: {
      isPaid: true,
      paidAt: new Date(),
      status: 'CONFIRMED',
      paymentCaptured: true,
      paymentCapturedAt: new Date()
    }
  })

  // 2. Mark transaction as SETTLED (eligible for payout)
  await tx.transaction.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'SETTLED',
      processedAt: new Date()
    }
  })

  // 3. Handle wallet credits/debits for package bookings
  if (isPackage && packageTotalPaid) {
    // CREDIT: full package amount paid via Stripe
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: packageTotalPaid,
        description: `Package purchase — ${packageHours} hours`,
        status: 'CONFIRMED'
      }
    })

    // DEBIT: first lesson from package
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: booking.price,
        description: `First lesson debit`,
        status: 'CONFIRMED'
      }
    })
    // Remaining balance = packageTotalPaid - booking.price (for future lessons)
  }
})
```

#### Step 5: Send Receipts & Notifications
```typescript
// Send receipt to client (email)
if (isPackage) {
  await sendPackagePurchaseReceipt({
    clientName,
    clientEmail,
    packageHours,
    hourlyRate,
    discountPercent,
    total: packageTotalPaid,
    walletLoaded: packageTotalPaid,
    walletBalance: packageTotalPaid - booking.price
  })
} else {
  await sendSingleLessonReceipt({
    clientName,
    clientEmail,
    lessonCost: booking.price,
    platformFee: booking.platformFee
  })
}

// Notify instructor (in-app + email)
await notifyPaymentReceived(
  instructor.userId,
  booking.price,
  client.name,
  bookingId
)
```

#### Step 6: Update Ledger (For Payout)
```typescript
// Record payment collected
const instructorPayout = booking.instructorPayout

await recordPaymentCollected(
  bookingId,
  booking.price,           // Amount collected
  instructorPayout         // Amount reserved for instructor payout
)

// This updates:
// - LedgerEntry with PAYMENT_COLLECTED
// - totalCollected + totalReserved for payout calculations
```

---

## 5. WALLET MECHANICS

### 5.1 Wallet Transaction States

```
PENDING   → Awaiting confirmation (e.g., wallet top-up initiated, payment processing)
CONFIRMED → Finalized (e.g., top-up payment succeeded, lesson booked via wallet)
```

### 5.2 Wallet Balance Calculation

```typescript
const txns = await tx.walletTransaction.findMany({
  where: { walletId, status: 'CONFIRMED' }
})

const balance = txns.reduce((sum, t) => {
  return t.type === 'CREDIT' 
    ? sum + t.amount      // Add credits (top-ups, package purchases)
    : sum - t.amount      // Subtract debits (lesson payments)
}, 0)
```

### 5.3 Wallet Transaction Types

| Type | Amount | Description | Example |
|------|--------|-------------|---------|
| **CREDIT** | Positive | Client adds funds or receives package | Top-up $100, Package purchase $500 |
| **DEBIT** | Positive | Client spends funds | Lesson $50, First lesson from package $50 |
| **REFUND** | N/A | Special handling for reversed transactions | Cancellation refund |

---

## 6. PAYOUT CALCULATION

### 6.1 Ledger Structure

**Source:** `lib/services/ledger-service.ts` (referenced)

Each payout cycle includes:
```
Total Collected = SUM(PAYMENT_COLLECTED entries)
Total Reserved  = SUM(instructor payouts from collected payments)
Commission Fee  = Total Collected - Total Reserved
Platform Keeps  = Commission + Stripe Fees
```

### 6.2 Payout Example

**Scenario:** BASIC tier instructor, $60/hr, 2-hour lesson

```
1. Lesson Price Calculation
   - Duration: 2 hours
   - Hourly Rate: $60
   - Lesson Price: $60 × 2 = $120.00

2. Commission Breakdown (BASIC = 15%)
   - Commission Rate: 15%
   - Instructor Payout: $120 × (1 - 0.15) = $102.00
   - Platform Commission: $120 × 0.15 = $18.00

3. Stripe Processing Fee (3.6%)
   - Amount: $120 × 0.036 = $4.32
   
4. Platform Revenue
   - Commission: $18.00
   - Stripe Fee Margin: $4.32
   - Total Platform Revenue: $22.32

5. Instructor Receives
   - Payout: $102.00
   - After Stripe fee (~2%): ~$100.00
```

---

## 7. BOOKING PAYMENT PATHS

### Path A: Book Now (Immediate Wallet Deduction)

```
Student has sufficient wallet balance
         ↓
1. Check wallet balance ≥ lesson price ✅
2. Create booking (CONFIRMED)
3. Deduct from wallet
4. Send receipt
         ↓
Status: CONFIRMED (ready for lesson)
```

### Path B: Book Later (Pending Payment via Stripe)

```
Student insufficient wallet balance
         ↓
1. Create booking (PENDING_PAYMENT)
2. Send email: "Top up to confirm"
3. Client pays via Stripe checkout
4. Stripe webhook: payment_intent.succeeded
5. Confirm booking → wallet balance affected
         ↓
Status: CONFIRMED (after payment succeeds)
```

### Path C: Package Purchase (Multi-Lesson Wallet Loading)

```
1. Client purchases 10-hour package for $500
2. Payment via Stripe
3. Webhook: payment_intent.succeeded
4. Wallet CREDIT: +$500 (package amount)
5. Wallet DEBIT: -$60 (first lesson scheduled)
6. Remaining balance: $440 (for future lessons)
         ↓
Remaining 9 hours available in wallet
```

---

## 8. KEY VALIDATION RULES

### 8.1 Booking Validation

| Rule | Enforcement | Error |
|------|-------------|-------|
| Instructor must be APPROVED | POST /api/bookings | "Pending approval" |
| Booking within advance window | POST /api/bookings | "Outside booking window" |
| Client not suspended | POST /api/bookings | "Cannot book suspended client" |
| Client has account (userId) | POST /api/bookings | "Client account not set up" |
| No slot conflicts (atomic tx) | POST /api/bookings | "Slot already booked" |
| Client has wallet | POST /api/bookings | Internal error (should exist) |

### 8.2 Payment Validation

| Rule | Enforcement | Consequence |
|------|-------------|------------|
| Payment amount matches | Webhook | Transaction rejected |
| Booking not expired | Webhook | Auto-refund + cancel booking |
| Booking in PENDING_PAYMENT | Webhook | Booking rejected (status error) |
| Webhook signature valid | Webhook handler | HTTP 400 (bad request) |
| Idempotency key unique | Webhook | Duplicate detected, skip processing |

---

## 9. CURRENT LIMITATIONS & GAPS

### 9.1 Status by Feature (FINAL CORRECTION)

- ✅ **Standard Package Discounts:** 5%, 10%, 12% for PACKAGE_6/10/15 - **WORKING**
  - Location: `lib/config/packages.ts` → `calculatePackagePriceDynamic()`
  - Applied in: `POST /api/public/bookings/bulk` endpoint (backend)
  
- ✅ **Custom Hours Discounts:** Dynamic thresholds applied based on hours - **WORKING**
  - Frontend: `components/PackageSelector.tsx` → `getDiscountForHours()`
  - Thresholds: <6hrs (0%) | 6-9hrs (5%) | 10-14hrs (10%) | 15+hrs (12%)
  - Shows all 50-hour options with calculated prices and discount badges
  - Applied in UI dropdown BUT **NOT verified to apply in backend when booked**

- ❌ **Custom Package Discounts:** Stored in database but **NOT applied in backend** - **BUG**
  - Accepted in UI but ignored during payment calculation
  - Backend: `app/api/public/bookings/bulk/route.ts` (line ~503) - `pkg.discountPercent` never used
  
- ❌ **GST (Tax):** 10% GST setting exists but NOT applied to final price
- ❌ **Peak Surcharge:** Settings exist but NOT applied
- ❌ **Instructor Custom Rates:** Only hourly rate supported, no custom pricing per lesson
- ❌ **Partial Refunds:** Only full refunds supported
- ❌ **Proration:** No prorating for cancellations within hours

---

## 9A. PACKAGE DISCOUNT IMPLEMENTATION (DETAILED)

### 9A.1 Where Discounts Are Applied

**Entry Point:** `POST /api/public/bookings/bulk` (public booking endpoint for packages)

**NOT applied:** `POST /api/bookings` (single lesson endpoint - instructor dashboard)

### 9A.2 Discount Calculation Flow

```typescript
// Source: lib/config/packages.ts → calculatePackagePriceDynamic()

const discountMap: Record<string, number> = {
  PACKAGE_6:  5,   // 5% off
  PACKAGE_10: 10,  // 10% off
  PACKAGE_15: 12,  // 12% off
  CUSTOM:     0,   // No discount
};

// Step 1: Calculate subtotal (before discount)
const subtotal = hourlyRate * hours
// Example: $60/hr × 10 hrs = $600

// Step 2: Get discount percentage for this package type
const discountPercentage = pkg.discount  // 10 for PACKAGE_10
const discount = (subtotal * discountPercentage) / 100
// Example: $600 × 10% = $60

// Step 3: Calculate after-discount amount
const afterDiscount = subtotal - discount
// Example: $600 - $60 = $540

// Step 4: Add test package (if included)
const testPackageAmount = includeTestPackage ? 225 : 0
const combined = afterDiscount + testPackageAmount

// Step 5: Add platform fee (3.6%)
const platformFee = (combined * 0.036) / 100
// Example: $540 × 3.6% = $19.44

// Step 6: Final total
const total = combined + platformFee
// Example: $540 + $19.44 = $559.44
```

### 9A.3 Package Types & Discounts

```typescript
HOUR_PACKAGES = {
  PACKAGE_6: {
    hours: 6,
    discount: 5,      // 5%
    name: '6 Hour Package'
  },
  PACKAGE_10: {
    hours: 10,
    discount: 10,     // 10%
    name: '10 Hour Package'
  },
  PACKAGE_15: {
    hours: 15,
    discount: 12,     // 12%
    name: '15 Hour Package'
  },
  CUSTOM: {
    hours: 'variable',
    discount: 0,      // No discount
    name: 'Custom Package'
  }
}
```

### 9A.4 Complete Package Pricing Example

**Scenario:** Student purchases 10-hour package @ $60/hr

```
1. Subtotal (before discount)
   10 hours × $60 = $600.00

2. Discount (10% for PACKAGE_10)
   $600 × 10% = $60.00

3. After Discount
   $600 - $60 = $540.00

4. Add Test Package (optional)
   $540 + $0 = $540.00 (not included)
   
   OR if included:
   $540 + $225 = $765.00

5. Platform Fee (3.6%)
   $540 × 3.6% = $19.44

6. Final Total Charged to Student
   $540 + $19.44 = $559.44

7. Instructor Commission (15% BASIC tier)
   $559.44 × 15% = $83.92

8. Instructor Payout
   $559.44 - $83.92 = $475.52

9. Platform Revenue Breakdown
   - Commission: $83.92
   - Platform Fee (Stripe): $19.44
   - Total Platform: $103.36
```

### **CUSTOM PACKAGE DISCOUNT BUG - UI vs Backend Mismatch**

**Issue:** Custom packages accept `discountPercent` in the database and display discount in UI, but the discount is **NOT calculated/applied in the backend payment calculation**.

#### Backend Issue (BUG)

**File:** `app/api/public/bookings/bulk/route.ts` (lines ~495-507)

```typescript
// When custom package is used:
if (data.customPackageId) {
  // legacy package lookup removed
  const pkg = undefined
  
  const addonPrice = pkg.price; // ❌ IGNORES pkg.discountPercent
  // Discount is NOT calculated from pkg.discountPercent
  
  serverPricing = {
    subtotal: standardSubtotal + addonPrice,
    discount: standardDiscount,  // ❌ Only uses standard package discount (6/10/15 hour)
    discountPercentage: discountPct,
    testPackage: 0,
    platformFee,
    total: combinedBeforeFee + platformFee,
  }
}
```

**Result:** If instructor sets custom package discount to 8%, it's ignored. Only standard package discounts (5%, 10%, 12%) are applied, and custom packages always get 0%.

#### Frontend Display (Misleading)

**File:** `app/book/[instructorId]/confirmation/page.tsx` (line ~115-118)

```typescript
{bookingState.pricing.discount > 0 && (
  <div className="flex justify-between text-sm mb-2 text-green-600">
    <span>Discount ({bookingState.pricing.discountPercentage}%)</span>  // ✅ Shows discount
    <span>-${bookingState.pricing.discount.toFixed(2)}</span>            // ✅ Shows discount amount
  </div>
)}
```

**Result:** Shows discount from backend calculation (which is 0 for custom packages), giving false impression that custom discounts are applied.

#### The Fix Required

```typescript
// In: app/api/public/bookings/bulk/route.ts (around line 495)

if (data.customPackageId) {
  // legacy package lookup removed
  const pkg = undefined
  
  // ✅ APPLY custom package discount
  const customDiscount = pkg.discountPercent || 0
  const customDiscountAmount = (standardSubtotal * customDiscount) / 100
  
  const addonPrice = pkg.price; // fixed add-on, no discount on test package itself
  const standardAfterDiscount = standardSubtotal - customDiscountAmount
  const combinedBeforeFee = standardAfterDiscount + addonPrice;
  const platformFee = (combinedBeforeFee * platformSettings.platformFeePercentage) / 100;
  
  serverPricing = {
    subtotal: standardSubtotal + addonPrice,
    discount: customDiscountAmount,        // ✅ Use custom discount
    discountPercentage: customDiscount,    // ✅ Use custom discount %
    testPackage: 0,
    platformFee,
    total: combinedBeforeFee + platformFee,
    installments: (combinedBeforeFee + platformFee) / 4,
  }
}
```

#### Example of the Bug

**Scenario:** Custom package "Advanced PDA" with 8% discount @ $60/hr for 10 hours

**Backend Calculation (BROKEN):**
```
Subtotal:        $600
Discount (0%):   $0        ❌ Should be 8% = $48
After discount:  $600      ❌ Should be $552
Add-on:          $225
Combined:        $825
Fee (3.6%):      $29.70
Total:           $854.70   ❌ INCORRECT (should be $809.72)
```

**Frontend Display:**
```
Shows: Discount (0%)   ✅ Correctly reflects what backend calculated
       -$0             ✅ Correctly reflects backend
```

**User Experience:** User sets 8% discount on custom package, but gets 0% applied. No error message. Silent failure.

---



**Single Lesson Booking** (`POST /api/bookings`):
```typescript
// No discount calculation
const lessonPrice = instructor.hourlyRate * durationHours
// Example: $60/hr × 1 hr = $60 (no discount applied)

const instructorPayout = lessonPrice * (1 - commissionRate / 100)
// Example: $60 × (1 - 0.15) = $51
```

**Key Difference:**
- Package bookings: Discount applied BEFORE commission calculation
- Single lessons: No discount, just straight hourly rate

### 9A.6 discountPaidBy Setting

**Source:** `platform-pricing.ts`
```typescript
discountPaidBy: 'shared'  // Who absorbs the discount?
```

**Possible Values:**
- `'platform'` - Platform absorbs (instructor gets full payout%)
- `'instructor'` - Instructor absorbs (lower payout)
- `'shared'` - Split between platform and instructor

**Current Implementation:** Setting exists but is NOT used in calculations. Discount is always applied uniformly.

---

## 9.2 Not Implemented

## 9.3 To Implement

1. **Package Discounts for Single Lessons:**
   - Currently: Only applied in bulk booking endpoint
   - Could be: Apply discounts when instructor-created single lesson bookings use lesson packages
   - Example: If using "10-Hour Package" in single booking, apply 10% discount

2. **GST:**
   - Add GST to final price if `gstEnabled`
   - Track GST separately for accounting
   - Include in receipts

3. **Instructor Payouts:**
   - Current: Fixed commission % per tier
   - Future: Allow custom rates, tiered rates, first-booking bonuses (noted in code but not used)

4. **Cancellation Logic:**
   - Refund calculation based on `lateCancellationWindowHours`
   - No-show penalty (`noShowPenaltyAmount`)
   - Wallet refund vs. payment refund

5. **discountPaidBy Implementation:**
   - Support different discount absorption models
   - Platform vs. Instructor vs. Shared cost allocation

---

## 10. DATABASE SCHEMA REFERENCES

### Booking Table
```prisma
model Booking {
  id                String       @id @default(cuid())
  instructorId      String
  clientId          String
  
  startTime         DateTime
  endTime           DateTime
  duration          Float        // minutes
  
  price             Float        // lesson price
  platformFee       Float        // Stripe 3.6%
  instructorPayout  Float        // after commission
  commissionRate    Float        // % (e.g., 15)
  
  isPaid            Boolean
  paidAt            DateTime?
  status            String       // PENDING, PENDING_PAYMENT, CONFIRMED, COMPLETED, EXPIRED, CANCELLED
  
  paymentIntentId   String?      // Stripe PaymentIntent ID
  paymentToken      String?      // For public payment page auth
  
  // Metadata for package bookings
  isPackageBooking  Boolean?
  packageHours      Int?
  packageTotalPaid  Float?       // Total package amount paid
  lockedHourlyRate  Float?       // Rate locked at booking time
  lockedDiscountPct Float?       // Discount locked at booking time
  platformFee       Float?       // Stripe fee locked
}
```

### WalletTransaction Table
```prisma
model WalletTransaction {
  id        String   @id @default(cuid())
  walletId  String
  
  type      String   // CREDIT or DEBIT
  amount    Float
  status    String   // PENDING or CONFIRMED
  
  description String
  createdAt DateTime @default(now())
}
```

### Transaction Table (Platform Accounting)
```prisma
model Transaction {
  id                    String  @id @default(cuid())
  bookingId             String?
  
  type                  String  // BOOKING_PAYMENT, REFUND, PAYOUT, etc.
  amount                Float   // lesson price
  platformFee           Float   // Stripe 3.6%
  instructorPayout      Float   // after commission
  commissionRate        Float   // %
  
  status                String  // COMPLETED, SETTLED, PENDING, REFUNDED
  stripePaymentIntentId String?
  stripeChargeId        String?
}
```

---

## 11. AUDIT TRAIL

All critical payment events are logged:

- `AuditAction.BOOKING_CREATED` - Instructor creates booking
- `AuditAction.PAYMENT_SUCCEEDED` - Stripe payment confirmed
- `AuditAction.PAYMENT_FAILED` - Payment declined
- `AuditAction.WALLET_PAYMENT_SUCCEEDED` - Wallet top-up completed
- `AuditAction.BOOKING_CANCELLED` - Booking cancelled

---

## Quick Reference Checklist

### What student pays:
- ✅ Lesson Price (instructor hourly rate × hours)
- ✅ No additional fees charged to student
- ⚠️ (Future) GST (if enabled)

### What platform keeps:
- ✅ Commission (15%, 12%, or 10% by tier)
- ✅ Stripe processing fee (tracked but not deducted from instructor payout)

### What instructor receives:
- ✅ Lesson Price × (1 - Commission Rate %)
- Example: $120 lesson at 15% commission = $102

### Wallet flows:
- ✅ Top-up: Client pays Stripe → CREDIT wallet
- ✅ Lesson: DEBIT wallet when booking confirmed
- ✅ Package: CREDIT full package, DEBIT first lesson → balance for future


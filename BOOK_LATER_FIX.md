# Book Later (Package Purchase) - Bug Fix

## The Problem

When users selected "Book Later" to purchase a package without scheduling lessons immediately, the payment flow failed with:
```
Failed to create payment intent
POST /api/payments/create-intent 400
```

## Root Causes

### 1. Old Code Bug (Already Fixed)
The OLD booking code incorrectly created Booking records for "book later" purchases with fake start/end times, instead of just creating WalletTransaction records.

**Impact**: Users had fake bookings in their account instead of wallet credits.

### 2. Payment Intent Endpoint Missing Wallet Support
The `/api/payments/create-intent` endpoint only accepted `bookingId` but "book later" purchases only have `transactionId`.

**Impact**: Payment intent creation failed (400 error) even though the wallet transaction was created.

### 3. Webhook Missing Wallet Payment Handler
The Stripe webhook only handled `bookingId` in metadata, not `transactionId` or `walletId`.

**Impact**: Even if payment succeeded, wallet transactions stayed PENDING forever.

---

## What We Fixed

### ✅ Fix #1: Updated Booking Flow (Already Done)
**File**: `app/api/public/bookings/bulk/route.ts`

**Book Later** now correctly:
- Creates ONLY WalletTransaction (no fake booking)
- Returns `transactionId` in response
- Sets status to PENDING

```typescript
if (data.bookingType === 'later') {
  const walletTransaction = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: data.pricing.total,
      type: 'CREDIT',
      description: `Package: ${data.packageType} - ${data.hours} hours`,
      status: 'PENDING'
    }
  });

  return NextResponse.json({
    success: true,
    transactionId: walletTransaction.id, // ✅ Return transactionId
    // ...
  });
}
```

---

### ✅ Fix #2: Updated Payment Intent Endpoint
**File**: `app/api/payments/create-intent/route.ts`

Now accepts BOTH `bookingId` AND `transactionId`:

```typescript
export async function POST(req: NextRequest) {
  const { bookingId, transactionId, amount } = await req.json();

  if (!bookingId && !transactionId) {
    return NextResponse.json(
      { error: 'Missing bookingId or transactionId' },
      { status: 400 }
    );
  }

  // Handle wallet purchase
  if (transactionId) {
    return handleWalletPaymentIntent(transactionId, amount);
  }

  // Handle booking payment
  return handleBookingPaymentIntent(bookingId, amount);
}
```

**New Function**: `handleWalletPaymentIntent()`
- Fetches WalletTransaction by ID
- Validates transaction status
- Creates payment intent with `transactionId` and `walletId` in metadata

---

### ✅ Fix #3: Updated Stripe Service
**File**: `lib/services/stripe.ts`

Updated interface to support wallet purchases:

```typescript
interface CreatePaymentIntentParams {
  amount: number;
  instructorId?: string;      // Optional for wallet purchases
  bookingId?: string;         // For booking payments
  transactionId?: string;     // ✅ For wallet purchases
  walletId?: string;          // ✅ For wallet purchases
  clientEmail: string;
  description: string;
}
```

Updated `createPaymentIntent()` to include wallet metadata:

```typescript
const metadata: any = {};

if (bookingId) {
  // Booking payment
  metadata.bookingId = bookingId;
  metadata.instructorId = instructorId;
  // ...
} else if (transactionId || walletId) {
  // Wallet purchase
  if (transactionId) metadata.transactionId = transactionId;
  if (walletId) metadata.walletId = walletId;
  metadata.type = 'wallet_purchase';
}
```

---

### ✅ Fix #4: Updated Stripe Webhook
**File**: `app/api/stripe/webhook/route.ts`

Added wallet payment handler:

```typescript
async function handleBookingPaymentSuccess(paymentIntent, idempotencyKey) {
  const { bookingId, transactionId, walletId } = metadata;

  // Handle wallet purchase
  if (transactionId || walletId) {
    await handleWalletPaymentSuccess(paymentIntent, idempotencyKey, transactionId, walletId);
    return;
  }

  // Handle booking payment
  // ...
}
```

**New Function**: `handleWalletPaymentSuccess()`
- Finds wallet transaction(s) by ID or walletId
- Updates status from PENDING → CONFIRMED
- Logs success

```typescript
async function handleWalletPaymentSuccess(paymentIntent, idempotencyKey, transactionId?, walletId?) {
  await prisma.$transaction(async (tx) => {
    // Find transactions
    let transactions = [];
    if (transactionId) {
      const tx = await tx.walletTransaction.findUnique({ where: { id: transactionId } });
      if (tx) transactions = [tx];
    } else if (walletId) {
      transactions = await tx.walletTransaction.findMany({
        where: {
          walletId,
          status: 'PENDING',
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
        }
      });
    }

    // Confirm all transactions
    for (const transaction of transactions) {
      await tx.walletTransaction.update({
        where: { id: transaction.id },
        data: { status: 'CONFIRMED' }
      });
    }
  });
}
```

---

## Complete Flow Now

### Book Later Flow:
```
1. User selects "Book Later" + package (e.g., 10 hours)
2. POST /api/public/bookings/bulk
   ✅ Creates WalletTransaction (PENDING)
   ✅ Returns { transactionId: "xxx" }
3. Frontend calls POST /api/payments/create-intent
   ✅ Sends { transactionId: "xxx", amount: 652.68 }
   ✅ Creates Stripe PaymentIntent with metadata: { transactionId, walletId }
   ✅ Returns { clientSecret: "xxx" }
4. User completes payment in Stripe
5. Stripe webhook fires: payment_intent.succeeded
   ✅ Webhook finds transactionId in metadata
   ✅ Calls handleWalletPaymentSuccess()
   ✅ Updates WalletTransaction: PENDING → CONFIRMED
6. User sees wallet balance updated
   ✅ Balance: $652.68 (10 hours available)
   ✅ Can now book lessons from dashboard
```

---

## Data Cleanup

### Fixed Existing Fake Booking
**Script**: `fix-book-later-bug.js`

For the user who had a fake booking from the old code:
1. ✅ Deleted fake booking (69ab080b96818f12fb33b92a)
2. ✅ Created proper wallet transaction (+$652.68)
3. ✅ Marked as CONFIRMED

**Result**:
- Bookings: 1 → 0 ✅
- Wallet Balance: $0 → $652.68 ✅

---

## Testing

### Test "Book Later" Flow:
1. Go to booking page
2. Select package (e.g., 10 hours)
3. Choose "Book Later"
4. Fill in details
5. Complete payment
6. ✅ Check wallet balance shows credits
7. ✅ Check no fake bookings created
8. ✅ Can book lessons from dashboard

### Test "Book Now" Flow:
1. Go to booking page
2. Select package + schedule lessons
3. Choose "Book Now"
4. Fill in details
5. Complete payment
6. ✅ Check bookings created
7. ✅ Check wallet shows package credit + debit for booked hours

---

## Files Modified

1. ✅ `app/api/public/bookings/bulk/route.ts` - Fixed book later logic
2. ✅ `app/api/payments/create-intent/route.ts` - Added wallet support
3. ✅ `lib/services/stripe.ts` - Updated payment intent interface
4. ✅ `app/api/stripe/webhook/route.ts` - Added wallet payment handler

---

## Status

**Backend**: ✅ Complete  
**Frontend**: ✅ Updated to use `transactionId` / `bookingIds`

### Frontend Changes Implemented:
```typescript
// app/book/[instructorId]/payment/page.tsx
// After creating the bulk booking:
const bookingResult = await bookingResponse.json();

// Build payment payload based on bookingType
const paymentPayload: {
  bookingId?: string;
  transactionId?: string;
  amount: number;
} = {
  amount: bookingState.pricing.total
};

let primaryBookingId: string | null = null;

if (bookingState.bookingType === 'later') {
  // ✅ Book later → use transactionId from bulk API
  paymentPayload.transactionId = bookingResult.transactionId;
} else {
  // ✅ Book now → use first bookingId (or legacy bookingId fallback)
  primaryBookingId = Array.isArray(bookingResult.bookingIds)
    ? bookingResult.bookingIds[0]
    : bookingResult.bookingId;
  paymentPayload.bookingId = primaryBookingId!;
}

// Create payment intent
const paymentResponse = await fetch('/api/payments/create-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paymentPayload)
});
```

---

## Conclusion

The "Book Later" flow now works end-to-end:
- ✅ No fake bookings created
- ✅ Wallet transactions created correctly
- ✅ Payment intent creation works
- ✅ Webhook confirms transactions
- ✅ Users see correct wallet balance
- ✅ Can book lessons from dashboard

The book-later flow is now fully wired on both backend and frontend, using `transactionId` for wallet/package purchases and `bookingId` for immediate bookings.

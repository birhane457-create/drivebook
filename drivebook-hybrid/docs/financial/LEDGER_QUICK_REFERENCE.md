# FINANCIAL LEDGER - QUICK REFERENCE

**For Developers:** How to use the ledger system in your code

---

## 🚀 QUICK START

### Import Functions
```typescript
// High-level operations (use these)
import {
  recordBookingPayment,
  recordInstructorPayout,
  recordFullRefund,
  recordPartialRefund,
  recordWalletCredit,
  recordAdminWalletAdjustment,
} from '@/lib/services/ledger-operations';

// Balance queries
import {
  getClientWalletBalance,
  getInstructorPayable,
  getPlatformRevenue,
  getAllInstructorPayables,
  getPlatformFinancialSummary,
} from '@/lib/services/ledger';
```

---

## 💰 COMMON OPERATIONS

### 1. Record Booking Payment
**When:** Client pays for booking  
**Where:** `app/api/bookings/route.ts`

```typescript
// After booking is created and paid
await recordBookingPayment({
  bookingId: booking.id,
  userId: booking.userId!,
  instructorId: booking.instructorId,
  totalAmount: booking.price,
  platformFee: booking.platformFee!,
  instructorPayout: booking.instructorPayout!,
  transactionId: transaction?.id,
  createdBy: 'SYSTEM',
});
```

**Creates 3 entries:**
- Client wallet → Escrow
- Escrow → Platform revenue (commission)
- Escrow → Instructor payable

---

### 2. Process Instructor Payout
**When:** Admin pays instructor  
**Where:** `app/api/admin/payouts/process/route.ts`

```typescript
// After Stripe payout succeeds
await recordInstructorPayout({
  payoutId: payout.id,
  instructorId: instructor.id,
  amount: payoutAmount,
  stripePayoutId: stripePayout.id,
  processedBy: session.user.id,
});
```

**Creates 1 entry:**
- Instructor payable → Instructor paid

---

### 3. Issue Full Refund
**When:** Booking cancelled, full refund  
**Where:** `app/api/bookings/[id]/cancel/route.ts`

```typescript
// When issuing full refund
await recordFullRefund({
  refundId: refund.id,
  bookingId: booking.id,
  userId: booking.userId!,
  instructorId: booking.instructorId,
  totalAmount: booking.price,
  platformFee: booking.platformFee!,
  instructorPayout: booking.instructorPayout!,
  reason: 'Cancelled by client',
  createdBy: session.user.id,
});
```

**Creates 3 entries (reverse original):**
- Instructor payable → Escrow
- Platform revenue → Escrow
- Escrow → Client wallet

---

### 4. Issue Partial Refund
**When:** Booking shortened, partial refund  
**Where:** `app/api/bookings/[id]/refund/route.ts`

```typescript
// Calculate refund amounts
import { calculateRefundAmounts } from '@/lib/services/ledger-operations';

const refundAmounts = calculateRefundAmounts(
  booking.price,
  booking.platformFee!,
  booking.instructorPayout!,
  50 // 50% refund
);

// Record partial refund
await recordPartialRefund({
  refundId: refund.id,
  bookingId: booking.id,
  userId: booking.userId!,
  instructorId: booking.instructorId,
  refundAmount: refundAmounts.refundAmount,
  refundPercentage: 50,
  originalPlatformFee: booking.platformFee!,
  originalInstructorPayout: booking.instructorPayout!,
  reason: 'Lesson shortened',
  createdBy: session.user.id,
});
```

---

### 5. Add Wallet Credit
**When:** Client adds money to wallet  
**Where:** `app/api/client/wallet-add/route.ts`

```typescript
// After Stripe payment succeeds
await recordWalletCredit({
  walletTransactionId: walletTx.id,
  userId: session.user.id,
  amount: amount,
  stripePaymentIntentId: paymentIntent.id,
  createdBy: session.user.id,
});
```

**Creates 1 entry:**
- Stripe clearing → Client wallet

---

### 6. Admin Wallet Adjustment
**When:** Admin manually adjusts wallet  
**Where:** `app/api/admin/clients/[id]/wallet/adjust/route.ts`

```typescript
// Admin gives credit
await recordAdminWalletAdjustment({
  adjustmentId: adjustment.id,
  userId: client.userId!,
  amount: 50,
  isCredit: true,
  reason: 'Goodwill credit for service issue',
  adminId: session.user.id,
  approvedBy: supervisor.id,
});

// Admin deducts credit
await recordAdminWalletAdjustment({
  adjustmentId: adjustment.id,
  userId: client.userId!,
  amount: 25,
  isCredit: false,
  reason: 'Correction for duplicate credit',
  adminId: session.user.id,
  approvedBy: supervisor.id,
});
```

---

## 📊 BALANCE QUERIES

### Get Client Wallet Balance
```typescript
const balance = await getClientWalletBalance(userId);
console.log(`Balance: $${balance.toFixed(2)}`);
```

### Get Instructor Payable
```typescript
const payable = await getInstructorPayable(instructorId);
console.log(`Owed: $${payable.toFixed(2)}`);
```

### Get Platform Revenue
```typescript
const revenue = await getPlatformRevenue();
console.log(`Revenue: $${revenue.toFixed(2)}`);
```

### Get All Instructor Payables
```typescript
const payables = await getAllInstructorPayables();
payables.forEach((p) => {
  console.log(`${p.instructorId}: $${p.balance.toFixed(2)}`);
});
```

### Get Platform Summary
```typescript
const summary = await getPlatformFinancialSummary();
console.log('Revenue:', summary.revenue);
console.log('Escrow:', summary.escrow);
console.log('Outstanding Payables:', summary.outstandingPayables);
```

---

## ⚠️ CRITICAL RULES

### DO:
✅ Always use ledger operations for money movements  
✅ Always provide idempotency keys (handled automatically)  
✅ Always validate amounts before recording  
✅ Always wrap multiple operations in try-catch  
✅ Always check for existing entries (idempotency)

### DON'T:
❌ NEVER update ClientWallet.balance directly  
❌ NEVER update Transaction.status without ledger  
❌ NEVER bypass ledger for money movements  
❌ NEVER create ledger entries manually (use operations)  
❌ NEVER reuse idempotency keys

---

## 🔍 DEBUGGING

### Check if Booking is in Ledger
```typescript
import { getBookingLedger } from '@/lib/services/ledger';

const entries = await getBookingLedger(bookingId);
console.log(`Found ${entries.length} entries`);
entries.forEach((e) => {
  console.log(`${e.debitAccount} → ${e.creditAccount}: $${e.amount}`);
});
```

### Verify Ledger Integrity
```typescript
import { verifyLedgerIntegrity } from '@/lib/services/ledger';

const integrity = await verifyLedgerIntegrity();
if (!integrity.valid) {
  console.error('CRITICAL: Ledger integrity violated!');
  console.error('Difference:', integrity.difference);
}
```

---

## 🚨 ERROR HANDLING

### Idempotency (Duplicate Entry)
```typescript
try {
  await recordBookingPayment({ ... });
} catch (error) {
  if (error.message.includes('Duplicate ledger entry')) {
    // Already processed - safe to ignore
    console.log('Booking already in ledger');
  } else {
    throw error;
  }
}
```

### Amount Validation
```typescript
import { validateBookingAmounts } from '@/lib/services/ledger-operations';

const validation = validateBookingAmounts(
  totalAmount,
  platformFee,
  instructorPayout
);

if (!validation.valid) {
  throw new Error(validation.error);
}
```

---

## 📝 EXAMPLES

### Complete Booking Flow
```typescript
// 1. Create booking
const booking = await prisma.booking.create({ ... });

// 2. Process payment (Stripe)
const paymentIntent = await stripe.paymentIntents.create({ ... });

// 3. Record in ledger
await recordBookingPayment({
  bookingId: booking.id,
  userId: booking.userId!,
  instructorId: booking.instructorId,
  totalAmount: booking.price,
  platformFee: booking.platformFee!,
  instructorPayout: booking.instructorPayout!,
  createdBy: 'SYSTEM',
});

// 4. Update booking status
await prisma.booking.update({
  where: { id: booking.id },
  data: { isPaid: true, paidAt: new Date() },
});
```

### Complete Payout Flow
```typescript
// 1. Get instructor payable
const payable = await getInstructorPayable(instructorId);

// 2. Create Stripe payout
const stripePayout = await stripe.payouts.create({
  amount: Math.round(payable * 100),
  currency: 'aud',
  destination: instructor.stripeAccountId,
});

// 3. Record in ledger
await recordInstructorPayout({
  payoutId: payout.id,
  instructorId: instructor.id,
  amount: payable,
  stripePayoutId: stripePayout.id,
  processedBy: session.user.id,
});

// 4. Update payout status
await prisma.payout.update({
  where: { id: payout.id },
  data: { status: 'paid', paidAt: new Date() },
});
```

---

## 🎯 MIGRATION CHECKLIST

When updating existing endpoints:

- [ ] Import ledger operations
- [ ] Replace direct balance updates with ledger operations
- [ ] Add idempotency handling
- [ ] Validate amounts before recording
- [ ] Test with existing data
- [ ] Verify ledger integrity after
- [ ] Update tests

---

**Remember:** The ledger is the source of truth. All balances are derived from it.


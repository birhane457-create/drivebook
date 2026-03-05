# FINANCIAL DOCTRINE

**Purpose**: Define how money flows in DriveBook  
**Owner**: Founder  
**Last Updated**: March 4, 2026  
**Scope**: Wallet, Transactions, Refunds, Payouts  

---

## NON-NEGOTIABLE RULES

1. **Transactions are immutable** - Never update, only create adjustments
2. **Money must reconcile** - Every dollar in = every dollar out
3. **Refund after payout blocked** - Except admin override with reason
4. **24-hour payout buffer** - Prevents premature payouts
5. **Wallet balance = transaction sum** - Daily verification required

---

## MONEY FLOW ARCHITECTURE

### The Three Money Paths

```
PATH 1: WALLET BOOKING
Client Wallet → Booking → Platform Fee → Instructor Payout

PATH 2: STRIPE BOOKING  
Client Stripe → Platform → Platform Fee → Instructor Payout

PATH 3: INSTRUCTOR BOOKING
No payment (free/testing) → No transaction → No payout
```

---

## TRANSACTION TYPES

### 1. BOOKING_PAYMENT
**When**: Client pays for booking  
**Amount**: Full booking price  
**Creates**: Original transaction record  
**Status**: PENDING → COMPLETED  

**Example**:
```json
{
  "type": "BOOKING_PAYMENT",
  "amount": 140.00,
  "platformFee": 21.00,
  "instructorPayout": 119.00,
  "status": "COMPLETED",
  "bookingId": "booking_123"
}
```

### 2. BOOKING_ADJUSTMENT
**When**: Booking price changes (duration edit)  
**Amount**: Difference (positive or negative)  
**Creates**: New transaction linked to original  
**Status**: COMPLETED  

**Example (Price Increase)**:
```json
{
  "type": "BOOKING_ADJUSTMENT",
  "amount": 70.00,
  "platformFee": 10.50,
  "instructorPayout": 59.50,
  "status": "COMPLETED",
  "parentTransactionId": "tx_001",
  "ledgerGroupId": "lg_booking_123",
  "reason": "Duration increased from 1h to 2h"
}
```

### 3. REFUND
**When**: Booking cancelled with refund  
**Amount**: Negative (refund amount)  
**Creates**: New transaction linked to original  
**Status**: COMPLETED  

**Example**:
```json
{
  "type": "REFUND",
  "amount": -140.00,
  "platformFee": 0,
  "instructorPayout": 0,
  "status": "COMPLETED",
  "parentTransactionId": "tx_001",
  "ledgerGroupId": "lg_booking_123",
  "reason": "Booking cancelled - 100% refund (48h+ notice)"
}
```

### 4. MANUAL_ADJUSTMENT
**When**: Admin adds/deducts wallet credits  
**Amount**: Adjustment amount  
**Creates**: Standalone transaction  
**Status**: COMPLETED  

**Example**:
```json
{
  "type": "MANUAL_ADJUSTMENT",
  "amount": 50.00,
  "status": "COMPLETED",
  "reason": "Promotional credit",
  "adminId": "admin_001"
}
```

---

## WALLET SYSTEM

### Wallet Structure
```typescript
{
  userId: string,
  balance: number,              // Current available credits
  creditsRemaining: number,     // Same as balance (legacy)
  totalPaid: number,            // Sum of all CREDIT transactions
  totalSpent: number,           // Sum of all DEBIT transactions
  version: number               // Optimistic locking
}
```

### Wallet Transaction Types

**CREDIT** (Money In):
- Client adds funds
- Refund from cancelled booking
- Admin promotional credit
- Package purchase refund

**DEBIT** (Money Out):
- Booking payment
- Package purchase
- Admin deduction

### Wallet Rules

1. **No Negative Balance**
   ```typescript
   if (wallet.balance < bookingPrice) {
     throw new Error('Insufficient wallet balance');
   }
   ```

2. **Optimistic Locking**
   ```typescript
   await prisma.clientWallet.update({
     where: { 
       id: walletId,
       version: currentVersion  // Must match
     },
     data: {
       balance: { decrement: amount },
       version: { increment: 1 }
     }
   });
   ```

3. **Atomic Operations**
   ```typescript
   await prisma.$transaction([
     // Update wallet
     prisma.clientWallet.update({ ... }),
     // Create wallet transaction
     prisma.walletTransaction.create({ ... }),
     // Create booking transaction
     prisma.transaction.create({ ... })
   ]);
   ```

4. **Daily Reconciliation**
   ```typescript
   const credits = SUM(CREDIT transactions);
   const debits = SUM(DEBIT transactions);
   const expectedBalance = credits - debits;
   
   if (wallet.balance !== expectedBalance) {
     ALERT('Wallet balance mismatch');
   }
   ```

---

## COMMISSION STRUCTURE

### Standard Commission
- **Platform Fee**: 15%
- **Instructor Payout**: 85%

### First Booking Bonus
- **Platform Fee**: 10%
- **Instructor Payout**: 90%
- **Applies**: First booking between client and instructor

### Calculation Example

**Standard Booking ($140)**:
```
Booking Price:      $140.00
Platform Fee (15%): $ 21.00
Instructor Payout:  $119.00
```

**First Booking ($140)**:
```
Booking Price:      $140.00
Platform Fee (10%): $ 14.00
Instructor Payout:  $126.00
```

### Commission Rules

1. **Determined at Booking Creation**
   - Check if first booking between client/instructor
   - Store `commissionRate` on booking
   - Never changes after creation

2. **Applied to All Adjustments**
   - Price increase uses same commission rate
   - Maintains consistency

3. **Not Applied to Refunds**
   - Refunds return full amount to client
   - Platform absorbs the loss

---

## REFUND POLICY

### Refund Tiers

| Notice Period | Client Refund | Platform Keeps | Instructor Impact |
|--------------|---------------|----------------|-------------------|
| 48+ hours    | 100%          | 0%             | No payout |
| 24-48 hours  | 50%           | 50%            | No payout |
| < 24 hours   | 0%            | 100%           | No payout |

### Refund Calculation

```typescript
const now = new Date();
const bookingTime = booking.startTime;
const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

let refundPercentage = 0;
if (hoursUntilBooking >= 48) {
  refundPercentage = 100;
} else if (hoursUntilBooking >= 24) {
  refundPercentage = 50;
} else {
  refundPercentage = 0;
}

const refundAmount = booking.price * (refundPercentage / 100);
```

### Refund Process

1. **Calculate Refund**
   - Based on cancellation policy
   - Uses original booking time (if rescheduled)

2. **Check Payout Status**
   ```typescript
   const transaction = await prisma.transaction.findFirst({
     where: { bookingId }
   });
   
   if (transaction.status === 'PAID') {
     if (!isAdmin) {
       throw new Error('Cannot refund - instructor already paid');
     }
     // Admin override requires reason
   }
   ```

3. **Create Refund Transaction**
   ```typescript
   await prisma.transaction.create({
     data: {
       type: 'REFUND',
       amount: -refundAmount,
       parentTransactionId: originalTransaction.id,
       ledgerGroupId: booking.id,
       reason: `Cancelled - ${refundPercentage}% refund`
     }
   });
   ```

4. **Update Wallet**
   ```typescript
   await prisma.clientWallet.update({
     where: { userId: client.userId },
     data: {
       balance: { increment: refundAmount }
     }
   });
   ```

5. **Create Wallet Transaction**
   ```typescript
   await prisma.walletTransaction.create({
     data: {
       walletId: wallet.id,
       type: 'CREDIT',
       amount: refundAmount,
       description: `Refund - ${refundPercentage}%`
     }
   });
   ```

---

## PAYOUT SYSTEM

### Payout Eligibility

**Requirements**:
1. Booking status = COMPLETED
2. Transaction status = COMPLETED
3. 24 hours passed since completion
4. Not already paid (status ≠ PAID)

**Check**:
```typescript
const eligibleTransactions = await prisma.transaction.findMany({
  where: {
    status: 'COMPLETED',
    processedAt: { 
      lt: new Date(Date.now() - 24 * 60 * 60 * 1000) 
    }
  }
});
```

### Payout Process

1. **Calculate Total**
   ```typescript
   const totalPayout = eligibleTransactions.reduce(
     (sum, tx) => sum + tx.instructorPayout, 
     0
   );
   ```

2. **Admin Approval Required**
   - Review payout list
   - Verify amounts
   - Approve payout

3. **Process Payment**
   - Via Stripe Connect (automated)
   - Or manual bank transfer

4. **Update Transaction Status**
   ```typescript
   await prisma.transaction.updateMany({
     where: { 
       id: { in: transactionIds } 
     },
     data: { 
       status: 'PAID',
       paidAt: new Date()
     }
   });
   ```

5. **Create Audit Log**
   ```typescript
   await prisma.auditLog.create({
     data: {
       action: 'PAYOUT_PROCESSED',
       actorId: adminId,
       metadata: {
         instructorId,
         amount: totalPayout,
         transactionCount: transactionIds.length
       }
     }
   });
   ```

### Payout Protection

**24-Hour Buffer**:
- Prevents immediate payout after completion
- Allows time for disputes
- Reduces fraud risk

**Refund After Payout Block**:
```typescript
if (transaction.status === 'PAID') {
  if (!isAdmin) {
    throw new Error('Cannot refund - instructor already paid');
  }
  
  // Admin override
  await auditLog.create({
    action: 'REFUND_AFTER_PAYOUT',
    metadata: {
      reason: adminOverrideReason,
      platformLoss: refundAmount - transaction.instructorPayout
    }
  });
  
  // Alert finance team
  await emailService.send({
    to: 'finance@drivebook.com',
    subject: '🚨 REFUND AFTER PAYOUT',
    body: `Platform loss: $${platformLoss}`
  });
}
```

---

## LEDGER RECONSTRUCTION

### Purpose
Reconstruct complete financial history for any booking.

### How It Works

1. **Find Ledger Group**
   ```typescript
   const transactions = await prisma.transaction.findMany({
     where: { 
       OR: [
         { bookingId },
         { ledgerGroupId: bookingId }
       ]
     },
     orderBy: { createdAt: 'asc' }
   });
   ```

2. **Calculate Net Amount**
   ```typescript
   const netAmount = transactions.reduce(
     (sum, tx) => sum + tx.amount, 
     0
   );
   ```

3. **Verify Consistency**
   ```typescript
   const booking = await prisma.booking.findUnique({
     where: { id: bookingId }
   });
   
   if (booking.status === 'CANCELLED') {
     // Net should equal refund amount
     const expectedNet = booking.price * (refundPercentage / 100);
     assert(netAmount === expectedNet);
   } else {
     // Net should equal booking price
     assert(netAmount === booking.price);
   }
   ```

### Example Ledger

**Booking**: 1 hour lesson, increased to 2 hours, then cancelled

```
Transaction 1 (BOOKING_PAYMENT):
  Amount: $70
  Platform Fee: $10.50
  Instructor Payout: $59.50
  
Transaction 2 (BOOKING_ADJUSTMENT):
  Amount: $70
  Platform Fee: $10.50
  Instructor Payout: $59.50
  Reason: "Duration increased"
  
Transaction 3 (REFUND):
  Amount: -$140
  Platform Fee: $0
  Instructor Payout: $0
  Reason: "Cancelled - 100% refund"

Net Amount: $70 + $70 - $140 = $0 ✅
```

---

## RECONCILIATION PROCESS

### Daily Checks

**1. Wallet Balance Verification**
```typescript
for (const wallet of allWallets) {
  const credits = SUM(wallet.transactions WHERE type = 'CREDIT');
  const debits = SUM(wallet.transactions WHERE type = 'DEBIT');
  const expectedBalance = credits - debits;
  
  if (wallet.balance !== expectedBalance) {
    ALERT(`Wallet ${wallet.id} mismatch: 
      Expected ${expectedBalance}, 
      Actual ${wallet.balance}`);
  }
}
```

**2. Transaction-Booking Consistency**
```typescript
const paidBookings = await prisma.booking.findMany({
  where: { isPaid: true }
});

for (const booking of paidBookings) {
  const transaction = await prisma.transaction.findFirst({
    where: { bookingId: booking.id }
  });
  
  if (!transaction) {
    ALERT(`Booking ${booking.id} has no transaction`);
  }
}
```

**3. Stripe-Database Sync**
```typescript
const stripePayments = await stripe.paymentIntents.list({
  created: { gte: yesterday }
});

for (const payment of stripePayments) {
  const booking = await prisma.booking.findFirst({
    where: { paymentIntentId: payment.id }
  });
  
  if (!booking) {
    ALERT(`Stripe payment ${payment.id} has no booking`);
  }
}
```

**4. Payout Verification**
```typescript
const paidTransactions = await prisma.transaction.findMany({
  where: { status: 'PAID' }
});

for (const tx of paidTransactions) {
  const booking = await prisma.booking.findUnique({
    where: { id: tx.bookingId }
  });
  
  if (booking.status !== 'COMPLETED') {
    ALERT(`Transaction ${tx.id} paid but booking not completed`);
  }
}
```

### Reconciliation Report

```typescript
{
  date: '2026-03-04',
  checks: {
    walletBalance: { passed: 45, failed: 0 },
    transactionBooking: { passed: 120, failed: 0 },
    stripeSync: { passed: 30, failed: 0 },
    payoutVerification: { passed: 15, failed: 0 }
  },
  errors: [],
  warnings: [],
  totalMoneyIn: 5240.00,
  totalMoneyOut: 5240.00,
  platformFees: 786.00,
  instructorPayouts: 4454.00
}
```

---

## PROBLEM-SOLVING METHOD

### When Money Doesn't Balance

**Step 1: Reconstruct Ledger**
```typescript
const ledger = await reconstructLedger(bookingId);
console.log('Ledger:', ledger);
```

**Step 2: Check Wallet Transactions**
```typescript
const walletTxs = await prisma.walletTransaction.findMany({
  where: { 
    description: { contains: bookingId }
  }
});
console.log('Wallet Transactions:', walletTxs);
```

**Step 3: Verify State Machine**
```typescript
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  include: { transactions: true }
});

console.log('Booking Status:', booking.status);
console.log('Transaction Status:', booking.transactions[0]?.status);
```

**Step 4: Check for Conflicts**
- Is booking PAID and CANCELLED? (Invalid)
- Is booking COMPLETED without transaction? (Invalid)
- Is transaction PAID but booking not COMPLETED? (Invalid)

**Step 5: Manual Fix (Admin Only)**
```typescript
// Create adjustment transaction
await prisma.transaction.create({
  data: {
    type: 'MANUAL_ADJUSTMENT',
    amount: correctionAmount,
    reason: 'Reconciliation correction - [explain issue]',
    adminId: adminId
  }
});

// Log the fix
await prisma.auditLog.create({
  data: {
    action: 'MANUAL_RECONCILIATION',
    actorId: adminId,
    metadata: {
      issue: 'description',
      correction: correctionAmount,
      reason: 'explanation'
    }
  }
});
```

---

## FINANCIAL SAFETY CHECKLIST

Before deploying any financial feature:

- [ ] Transactions are immutable (no updates)
- [ ] Money flow reconciles (in = out)
- [ ] Wallet balance = transaction sum
- [ ] Refund after payout blocked
- [ ] 24-hour payout buffer enforced
- [ ] Optimistic locking on wallet
- [ ] Atomic transactions used
- [ ] Audit logging implemented
- [ ] Daily reconciliation scheduled
- [ ] Error alerts configured

---

## RELATED DOCUMENTS

- `SYSTEM_PRINCIPLES.md` - Immutability principle
- `../02-finance/LEDGER_RULES.md` - Transaction details
- `../02-finance/RECONCILIATION_PROCESS.md` - Daily checks
- `../02-finance/PAYOUT_PROCESS.md` - Payout workflow
- `../04-legal/CANCELLATION_POLICY.md` - Refund policy

---

**This doctrine governs all money movement in DriveBook. Violations compromise financial integrity.**


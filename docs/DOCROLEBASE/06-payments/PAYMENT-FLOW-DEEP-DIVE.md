# Payment Flow Deep Dive - From Purchase to Cancellation

**Last Updated:** December 2024  
**Scope:** Complete wallet lifecycle from Stripe purchase → wallet credit → booking debit → cancellation  

---

## 🎯 Executive Summary

The platform uses a **wallet-based payment system** where:
1. Customers buy packages via Stripe → credits added to wallet
2. Each lesson booking → debits from wallet
3. Single lesson cancels → credits back to wallet (instant rebooking)
4. Package cancels → Stripe refunds card + wallet debit (prevents double-credit exploit)

**Critical Insight:** Package cancellations MUST debit the wallet because the unused package credits are ALREADY in the wallet from the original Stripe purchase.

---

## Phase 1: Customer Purchase

### 1.1 Single Lesson (Wallet Funded)

**Flow:**
```
Customer → createBooking()
  → Check wallet balance via aggregate query
  → IF balance >= price:
    → Atomic transaction:
      - WalletTransaction DEBIT created (CONFIRMED)
      - Booking created (CONFIRMED)
    → Receipt email sent
  → ELSE:
    → Booking created (PENDING_PAYMENT)
    → Redirect to Stripe payment
```

**Database Changes:**
```sql
-- WalletTransaction
INSERT INTO WalletTransaction (walletId, type, amount, status, description)
VALUES ('wallet-123', 'DEBIT', 70.00, 'CONFIRMED', 'Booking — 1hr lesson');

-- Booking
INSERT INTO Booking (status, isPaid, price, ...)
VALUES ('CONFIRMED', true, 70.00, ...);

-- Transaction (ledger)
INSERT INTO Transaction (bookingId, type, amount, status, ...)
VALUES ('booking-456', 'BOOKING_PAYMENT', 70.00, 'COMPLETED', ...);
```

**Wallet Balance After:**
- Before: $200
- Debit: -$70
- **After: $130**

---

### 1.2 Package Purchase (Book Later - Stripe Checkout)

**Flow:**
```
Customer → Purchases 10hr package ($630)
  → Stripe Checkout Session created:
    - metadata.type = 'wallet_credit'
    - metadata.userId = 'user-123'
    - metadata.hours = 10
    - metadata.packageType = '10_HOURS'
  → Customer completes Stripe payment
  → Webhook: checkout.session.completed fires
  → handleCheckoutCompleted():
    → Atomic transaction:
      - Find/create ClientWallet for userId
      - WalletTransaction CREDIT created ($630, CONFIRMED)
    → Receipt email sent
```

**Database Changes:**
```sql
-- ClientWallet (upsert)
INSERT INTO ClientWallet (userId, createdAt)
VALUES ('user-123', NOW())
ON CONFLICT (userId) DO NOTHING;

-- WalletTransaction
INSERT INTO WalletTransaction (walletId, type, amount, status, description)
VALUES ('wallet-123', 'CREDIT', 630.00, 'CONFIRMED', 'Package purchase — 10 hours via Stripe Checkout');
```

**Stripe Metadata Example:**
```json
{
  "type": "wallet_credit",
  "userId": "user-123",
  "hours": "10",
  "packageType": "10_HOURS",
  "lockedHourlyRate": "70",
  "lockedDiscountPct": "10"
}
```

**Wallet Balance After:**
- Before: $130
- Credit: +$630
- **After: $760**

---

## Phase 2: Wallet Storage & Balance Calculation

### 2.1 Database Schema

#### ClientWallet
```prisma
model ClientWallet {
  id        String   @id @default(cuid())
  userId    String   @unique
  createdAt DateTime @default(now())
  
  transactions WalletTransaction[]
  user         User @relation(...)
}
```

#### WalletTransaction (Double-Entry Ledger)
```prisma
model WalletTransaction {
  id          String   @id @default(cuid())
  walletId    String
  type        TransactionType  // CREDIT | DEBIT
  amount      Decimal
  description String
  status      TransactionStatus // PENDING | CONFIRMED | FAILED
  createdAt   DateTime @default(now())
  
  wallet ClientWallet @relation(...)
}
```

### 2.2 Balance Calculation (Source of Truth)

**Implementation (booking-service.ts):**
```typescript
async function getWalletBalanceTx(tx: Prisma.TransactionClient, walletId: string): Promise<number> {
  const [credits, debits] = await Promise.all([
    tx.walletTransaction.aggregate({
      where: { walletId, status: 'CONFIRMED', type: 'CREDIT' },
      _sum: { amount: true }
    }),
    tx.walletTransaction.aggregate({
      where: { walletId, status: 'CONFIRMED', type: 'DEBIT' },
      _sum: { amount: true }
    }),
  ]);
  
  return (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0);
}
```

**Key Points:**
- ✅ Balance is COMPUTED from WalletTransaction rows (aggregate query)
- ✅ NOT stored in ClientWallet.balance field (deprecated)
- ✅ Only CONFIRMED transactions count
- ✅ PENDING transactions are ignored (payment not complete)

**Example Query Result:**
```
Credits:  $630 (package purchase) + $70 (refund) = $700
Debits:   $70 (lesson 1) + $70 (lesson 2) = $140
Balance:  $700 - $140 = $560
```

---

## Phase 3: Booking with Wallet

### 3.1 First Lesson from Package

**Flow:**
```
Customer books 1hr lesson from 10hr package
  → createBooking() called
  → Pricing: 1hr × $70 = $70
  → Atomic transaction:
    1. Check wallet balance ($760 available)
    2. WalletTransaction DEBIT: -$70
    3. Booking created:
       - status: CONFIRMED
       - price: $70
       - isPackageBooking: true
       - packageHours: 10
       - packageHoursRemaining: 9
       - packageTotalPaid: $630
       - lockedHourlyRate: $70
       - lockedDiscountPct: 10
    4. Transaction record: COMPLETED
  → Receipt email sent
```

**Database Changes:**
```sql
-- WalletTransaction
INSERT INTO WalletTransaction (walletId, type, amount, status, description)
VALUES ('wallet-123', 'DEBIT', 70.00, 'CONFIRMED', 'First lesson — 2024-01-15 (booking #booking-789)');

-- Booking
INSERT INTO Booking (
  status, price, isPaid, paidAt,
  isPackageBooking, packageHours, packageHoursRemaining,
  packageTotalPaid, lockedHourlyRate, lockedDiscountPct, ...
)
VALUES (
  'CONFIRMED', 70.00, true, NOW(),
  true, 10, 9,
  630.00, 70.00, 10, ...
);
```

**Wallet Balance After:**
- Before: $760
- Debit: -$70
- **After: $690** (enough for 9 more lessons)

---

### 3.2 Package Fields Explained

| Field | Purpose | Example |
|-------|---------|---------|
| `isPackageBooking` | Flags this booking as part of a package | `true` |
| `packageHours` | Total hours purchased in package | `10` |
| `packageHoursRemaining` | Hours left after this booking | `9` (decrements each lesson) |
| `packageTotalPaid` | Amount paid to Stripe for full package | `$630` |
| `lockedHourlyRate` | Hourly rate at time of purchase (price lock) | `$70` |
| `lockedDiscountPct` | Discount tier at purchase (5%, 10%, 12%) | `10` |
| `price` | Amount debited from wallet for THIS lesson | `$70` |

**Why Lock Rates?**
- Protects customer from price increases mid-package
- Ensures refund calculations are consistent
- Example: If instructor raises rate to $80/hr mid-package, customer still pays $70/hr for remaining lessons

---

## Phase 4: Cancellation Flows

### 4.1 Single Booking Cancel (Instant Refund to Wallet)

**Code:** `cancelBooking()` in `booking-service.ts`

**Flow:**
```
Customer cancels single 1hr lesson ($70)
  → cancelBooking() called
  → Calculate refund:
    - Base amount: $70 (booking.price)
    - Time-based policy:
      - >48h notice: 100% refund = $70
      - 24-48h notice: 50% refund = $35
      - <24h notice: 0% refund = $0
  → Atomic transaction:
    1. WalletTransaction CREDIT: +$70 (refund)
    2. Booking.status → CANCELLED
    3. Transaction → CANCELLED
  → Email: cancellation confirmation + refund amount
```

**Database Changes:**
```sql
-- WalletTransaction
INSERT INTO WalletTransaction (walletId, type, amount, status, description)
VALUES ('wallet-123', 'CREDIT', 70.00, 'CONFIRMED', 'Booking cancelled — 100% refund');

-- Booking
UPDATE Booking
SET status = 'CANCELLED',
    notes = CONCAT(notes, '\n\nCancelled 2024-01-20. Refund: 100% ($70.00)')
WHERE id = 'booking-789';

-- Transaction
UPDATE Transaction
SET status = 'CANCELLED'
WHERE bookingId = 'booking-789';
```

**Wallet Balance After:**
- Before: $620
- Credit: +$70 (refund)
- **After: $690** (customer can rebook immediately)

**Why Wallet Credit?**
- Customer already paid into the platform ecosystem
- Money stays in wallet for instant rebooking
- No Stripe refund needed (never touched card for this specific booking)

---

### 4.2 Package Cancel Request (Admin Review Required)

**Code:** `requestPackageCancellation()` in `booking-service.ts`

**Flow:**
```
Customer requests to cancel 10hr package (used 5hr)
  → requestPackageCancellation() called
  → Calculate tier-aware refund:
    1. Total paid: $630 (for 10hr with 10% discount)
    2. Hours used: 5hr
    3. Discount tier for used hours:
       - 5hr = NO discount (need 6+ for 5% discount)
       - Multiplier: 1.0 (0% discount)
    4. Amount for used hours: 5 × $70 × 1.0 = $350
    5. Refundable base: $630 - $350 = $280
    6. Time-based policy: >48h = 100% → $280 refund
  → Update booking:
    - cancellationStatus → PENDING
    - cancellationRequestedAt → NOW()
    - cancellationReason → customer's reason
    - calculated refund stored in metadata
  → Send emails:
    - Customer: "Request received, estimated $280 refund"
    - Admin: "Review needed: $280 refund pending"
  → NO WALLET OR STRIPE ACTION YET (admin must review)
```

**Database Changes:**
```sql
-- Booking
UPDATE Booking
SET cancellationStatus = 'PENDING',
    cancellationRequestedAt = NOW(),
    cancellationRequestedBy = 'USER',
    cancellationReason = 'Found cheaper instructor'
WHERE id = 'booking-789';

-- AuditLog
INSERT INTO AuditLog (action, actorId, actorRole, targetType, targetId, metadata, ...)
VALUES ('CANCELLATION_REQUESTED', 'user-123', 'CLIENT', 'BOOKING', 'booking-789',
        '{"calculatedRefund": 280.00, "refundPercentage": 100, "hoursNotice": 72}', ...);
```

**Wallet Balance:** No change yet (waiting for admin)

---

### 4.3 Tier-Aware Refund Calculation (The Key Algorithm)

**Implementation:** `calculatePartialPackageRefund()` in `booking-service.ts`

```typescript
function calculatePartialPackageRefund(booking: any): number {
  const packageHours = booking.packageHours ?? 0;
  const packageHoursRemaining = booking.packageHoursRemaining ?? 0;
  const packageTotalPaid = booking.packageTotalPaid ?? 0;
  const lockedHourlyRate = booking.lockedHourlyRate ?? 0;
  
  const hoursUsed = packageHours - packageHoursRemaining; // 10 - 5 = 5hr
  
  // Determine discount tier for hours USED (not original purchase tier!)
  // Tiers: <6hr = 0%, 6-9hr = 5%, 10-14hr = 10%, 15+hr = 12%
  let usedTierDiscountPct = 0;
  if (hoursUsed >= 15) usedTierDiscountPct = 12;
  else if (hoursUsed >= 10) usedTierDiscountPct = 10;
  else if (hoursUsed >= 6) usedTierDiscountPct = 5;
  // else: hoursUsed < 6 → 0% discount
  
  // Calculate what customer SHOULD have paid for used hours
  const subtotalForUsed = hoursUsed * lockedHourlyRate; // 5 × $70 = $350
  const discountMultiplier = 1 - (usedTierDiscountPct / 100); // 1 - 0 = 1.0
  const amountForUsedHours = subtotalForUsed * discountMultiplier; // $350 × 1.0 = $350
  
  // Refundable = what they paid - what they should pay
  const refundableBase = packageTotalPaid - amountForUsedHours; // $630 - $350 = $280
  
  return refundableBase;
}
```

**Example Walkthrough:**

| Scenario | Hours Used | Discount Tier for Used | Amount for Used | Refundable Base |
|----------|------------|------------------------|-----------------|-----------------|
| Used 5hr from 10hr package | 5hr | 0% (need 6+ for 5%) | 5 × $70 × 1.0 = $350 | $630 - $350 = **$280** |
| Used 6hr from 10hr package | 6hr | 5% | 6 × $70 × 0.95 = $399 | $630 - $399 = **$231** |
| Used 0hr (full refund) | 0hr | 0% | 0 × $70 × 1.0 = $0 | $630 - $0 = **$630** |
| Used 10hr (no refund) | 10hr | 10% | 10 × $70 × 0.9 = $630 | $630 - $630 = **$0** |

**Why Recalculate Discount for Used Hours?**
- Original purchase: 10hr with 10% discount → paid $630
- If used only 5hr: customer should NOT get 10% discount benefit (requires 10hr purchase)
- Fair calculation: charge full price for 5hr used → refund difference
- Prevents abuse: can't get bulk discount then cancel most hours

---

### 4.4 Package Cancel Approval (Stripe Refund + Wallet Debit)

**Code:** `approveCancellation()` in `booking-service.ts`

**Flow:**
```
Admin approves package cancellation
  → approveCancellation() called
  → Refund amount: $280 (from calculation above)
  → Stripe refund issued:
    - paymentIntent: original PI from package purchase
    - amount: $280 (in cents: 28000)
    - reason: 'requested_by_customer'
    - metadata: {bookingId, adminId, calculatedRefund: 280}
  → Atomic transaction:
    1. WalletTransaction DEBIT: -$280 (removes unused credits)
    2. Booking.status → CANCELLED
    3. Booking.cancellationStatus → APPROVED
    4. Booking.adminReviewedAt → NOW()
    5. Booking.stripeRefundId → refund ID from Stripe
  → Send email to customer:
    - Refund approved: $280 back to card
    - Stripe refund ID: re_abc123
    - Timeline: 5-10 business days
```

**Database Changes:**
```sql
-- Stripe Refund (external Stripe API)
POST /v1/refunds
{
  "payment_intent": "pi_xyz789",
  "amount": 28000,
  "reason": "requested_by_customer",
  "metadata": {
    "bookingId": "booking-789",
    "adminId": "admin-456",
    "calculatedRefund": "280.00"
  }
}

-- WalletTransaction
INSERT INTO WalletTransaction (walletId, type, amount, status, description)
VALUES ('wallet-123', 'DEBIT', 280.00, 'CONFIRMED', 'Package cancelled — refunded $280.00 to card');

-- Booking
UPDATE Booking
SET status = 'CANCELLED',
    cancellationStatus = 'APPROVED',
    adminReviewedAt = NOW(),
    adminReviewedBy = 'admin-456',
    adminReviewNote = NULL,
    stripeRefundId = 're_abc123'
WHERE id = 'booking-789';

-- AuditLog
INSERT INTO AuditLog (action, actorId, actorRole, targetType, targetId, metadata, ...)
VALUES ('CANCELLATION_APPROVED', 'admin-456', 'ADMIN', 'BOOKING', 'booking-789',
        '{"refundAmount": 280.00, "stripeRefundId": "re_abc123", "walletDebitId": "wt_def456"}', ...);
```

**Wallet Balance After:**
- Before: $690 (had $280 unused package credits + other funds)
- Debit: -$280 (removes unused package credits)
- **After: $410** (correct remaining balance)

---

### 4.5 THE CRITICAL INSIGHT: Why Wallet DEBIT?

**The Double-Credit Exploit Explained:**

```
Timeline of Package Purchase & Cancellation:
-------------------------------------------------
Step 1: Customer buys 10hr package
  → Stripe charges card: -$630
  → Webhook credits wallet: +$630
  → Wallet balance: $630

Step 2: Customer uses 5 lessons
  → Lesson 1: Wallet DEBIT -$70 → Balance: $560
  → Lesson 2: Wallet DEBIT -$70 → Balance: $490
  → Lesson 3: Wallet DEBIT -$70 → Balance: $420
  → Lesson 4: Wallet DEBIT -$70 → Balance: $350
  → Lesson 5: Wallet DEBIT -$70 → Balance: $280
  → Total debited: 5 × $70 = $350
  → Wallet balance: $280 (unused package credits)

Step 3: Customer requests cancellation
  → Refundable: $630 - $350 = $280
  → Admin approves

❌ WRONG APPROACH (Double-Credit Exploit):
  → Stripe refunds card: +$280
  → Wallet CREDIT: +$280
  → Result:
    - Card: $280 refunded
    - Wallet: $280 (unused) + $280 (refund) = $560 ❌
    - Customer got: $280 + $560 = $840 for $630 package!

✅ CORRECT APPROACH (Our Implementation):
  → Stripe refunds card: +$280
  → Wallet DEBIT: -$280 (removes unused credits)
  → Result:
    - Card: $280 refunded
    - Wallet: $280 (unused) - $280 (debit) = $0 ✅
    - Customer got: $280 total refund (correct!)
```

**Why This Matters:**
- Wallet already has the unused package credits ($280)
- Refunding to card AND crediting wallet = paying customer twice
- Wallet DEBIT removes the unused credits that are being refunded to card
- Net effect: Customer gets refund to card, wallet returns to pre-package state (minus used lessons)

---

### 4.6 Package Cancel Rejection (No Financial Action)

**Code:** `rejectCancellation()` in `booking-service.ts`

**Flow:**
```
Admin rejects package cancellation
  → rejectCancellation() called
  → Update booking:
    - cancellationStatus → REJECTED
    - adminReviewedAt → NOW()
    - adminReviewNote → rejection reason
  → Send email to customer:
    - Request denied
    - Reason: "Policy requires 48h notice, you cancelled with 20h"
    - Booking remains active
  → NO WALLET OR STRIPE ACTION
```

**Database Changes:**
```sql
-- Booking
UPDATE Booking
SET cancellationStatus = 'REJECTED',
    adminReviewedAt = NOW(),
    adminReviewedBy = 'admin-456',
    adminReviewNote = 'Policy requires 48h notice, you cancelled with 20h'
WHERE id = 'booking-789';

-- AuditLog
INSERT INTO AuditLog (action, actorId, actorRole, targetType, targetId, metadata, ...)
VALUES ('CANCELLATION_REJECTED', 'admin-456', 'ADMIN', 'BOOKING', 'booking-789',
        '{"reason": "Policy requires 48h notice, you cancelled with 20h"}', ...);
```

**Wallet Balance:** No change (booking stays active)

---

## Comparison Table: Single vs Package Cancellation

| Aspect | Single Booking Cancel | Package Cancel |
|--------|----------------------|----------------|
| **Approval** | Instant (no admin) | Admin review required |
| **Refund Calculation** | Simple: booking.price × policy% | Tier-aware: recalculates discount for used hours |
| **Refund Destination** | Wallet CREDIT | Stripe refunds CARD |
| **Wallet Action** | CREDIT (adds funds) | DEBIT (removes unused credits) |
| **Customer Can Rebook** | Immediately (wallet has funds) | After 5-10 days (card refund processed) |
| **Fraud Risk** | Low (single transaction) | High (bulk discount abuse) → hence admin review |
| **Status Field** | status → CANCELLED | status → CANCELLED + cancellationStatus → APPROVED/REJECTED |
| **Email Count** | 1 (cancellation confirmation) | 3 (request, admin alert, approval/rejection) |

---

## Database Transaction Flow Diagrams

### Package Purchase → Booking → Cancellation (Full Cycle)

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: PACKAGE PURCHASE ($630 for 10hr)                   │
└─────────────────────────────────────────────────────────────┘
   Customer pays Stripe $630
           ↓
   checkout.session.completed webhook
           ↓
   ┌─────────────────────────────────┐
   │ WalletTransaction               │
   │ type: CREDIT                    │
   │ amount: 630.00                  │
   │ status: CONFIRMED               │
   └─────────────────────────────────┘
           ↓
   Wallet Balance: $630

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: BOOKING 5 LESSONS (5 × $70 = $350)                 │
└─────────────────────────────────────────────────────────────┘
   Lesson 1 booked → WalletTransaction DEBIT -$70
           ↓
   Lesson 2 booked → WalletTransaction DEBIT -$70
           ↓
   Lesson 3 booked → WalletTransaction DEBIT -$70
           ↓
   Lesson 4 booked → WalletTransaction DEBIT -$70
           ↓
   Lesson 5 booked → WalletTransaction DEBIT -$70
           ↓
   Wallet Balance: $630 - $350 = $280 (5hr unused)

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: CANCELLATION REQUEST                                │
└─────────────────────────────────────────────────────────────┘
   Customer requests cancel
           ↓
   requestPackageCancellation()
           ↓
   ┌─────────────────────────────────┐
   │ Booking                         │
   │ cancellationStatus: PENDING     │
   │ cancellationRequestedAt: NOW()  │
   │ cancellationReason: "..."       │
   └─────────────────────────────────┘
           ↓
   Emails sent (customer + admin)
           ↓
   Wallet Balance: $280 (no change yet)

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: ADMIN APPROVAL                                      │
└─────────────────────────────────────────────────────────────┘
   Admin approves
           ↓
   approveCancellation()
           ↓
   ┌────────────────────┐    ┌─────────────────────────────┐
   │ Stripe Refund      │    │ WalletTransaction           │
   │ amount: $280       │    │ type: DEBIT                 │
   │ to: Card           │    │ amount: 280.00              │
   └────────────────────┘    │ status: CONFIRMED           │
                             └─────────────────────────────┘
           ↓
   ┌─────────────────────────────────┐
   │ Booking                         │
   │ status: CANCELLED               │
   │ cancellationStatus: APPROVED    │
   │ stripeRefundId: re_abc123       │
   └─────────────────────────────────┘
           ↓
   Wallet Balance: $280 - $280 = $0 ✅
   Card Balance: +$280 (5-10 days)
```

---

## Key Takeaways

1. **Wallet Balance = Aggregate Query** (NOT stored field)
   - `SUM(CREDIT where CONFIRMED) - SUM(DEBIT where CONFIRMED)`

2. **Package Purchase → Wallet CREDIT** (Stripe webhook)
   - Customer pays Stripe → webhook fires → wallet credited

3. **Each Lesson → Wallet DEBIT**
   - Booking created → wallet debited atomically

4. **Single Cancel → Wallet CREDIT** (instant rebooking)
   - Money stays in platform ecosystem

5. **Package Cancel → Stripe Refund + Wallet DEBIT**
   - Prevents double-credit exploit
   - Unused credits already in wallet → must be removed when refunding to card

6. **Tier-Aware Refund Calculation**
   - Recalculates discount based on hours USED (not purchased)
   - Fair to platform: can't get bulk discount then cancel most hours

7. **Admin Approval Required for Packages**
   - Fraud protection: prevents bulk discount abuse
   - Manual review of high-value refunds

---

## Files Referenced

### Core Services
- `lib/services/booking-service.ts` - All booking + cancellation logic
- `lib/services/email.ts` - Email notifications
- `app/api/stripe/webhook/route.ts` - Stripe webhook handler

### API Routes
- `app/api/bookings/[id]/request-cancellation/route.ts` - Package cancel request
- `app/api/admin/cancellations/[id]/approve/route.ts` - Admin approval
- `app/api/admin/cancellations/[id]/reject/route.ts` - Admin rejection

### Database
- `prisma/schema.prisma` - ClientWallet + WalletTransaction + Booking models

---

**Status:** ✅ Payment flow fully traced and documented  
**Next:** Frontend routing fix (single vs package cancel button logic)
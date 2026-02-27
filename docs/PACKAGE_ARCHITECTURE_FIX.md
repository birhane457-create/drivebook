# Package Purchase Architecture Fix

**Date**: February 25, 2026  
**Issue**: Package purchases are counted as bookings  
**Status**: 🔴 CRITICAL ARCHITECTURE FLAW

---

## Current Problem

### What's Happening Now
```
User buys 6-hour package ($383.838)
  ↓
System creates BOOKING record with:
  - isPackageBooking: true
  - price: $383.838
  - packageHours: 6
  - status: PENDING
  ↓
This BOOKING appears in instructor's booking list
  ↓
Booking count is INFLATED (counts package purchase as a booking)
```

### Evidence from Debesay Birhane Profile
```
Total Bookings: 22
├── Package Purchases (isPackageBooking=true): 2
│   ├── 699a11ab364b43fd1e91cecd - $383.838 (6 hours)
│   └── 699ab44294db5409ecc35008 - $383.838 (6 hours)
├── Regular Bookings: 16
├── Package Children (scheduled from package): 2
└── Completed: 2
```

**Problem**: The 2 package purchases should NOT be in the booking list at all!

---

## Correct Architecture

### Flow 1: Buy Package & Book Later

```
Step 1: User selects "Buy Package"
  ↓
Step 2: User selects instructor + package (e.g., 10 hours)
  ↓
Step 3: User completes payment ($700)
  ↓
Step 4: System adds credits to CLIENT WALLET
  - ClientWallet.creditsRemaining += $700
  - ClientWallet.totalAdded += $700
  - WalletTransaction created (type: "credit")
  ↓
Step 5: NO BOOKING RECORD CREATED
  ↓
Result:
  - Wallet: $700 credit, 10 hours available
  - Booking count: 0 (correct!)
  - User can schedule hours later from dashboard
```

### Flow 2: Book from Package (Schedule Hours)

```
Step 1: User goes to dashboard
  ↓
Step 2: User sees available packages/credits
  ↓
Step 3: User schedules 2 hours from package
  ↓
Step 4: System creates BOOKING record
  - price: $140 (2 hours × $70/hour)
  - status: CONFIRMED
  - startTime: selected date/time
  - endTime: startTime + 2 hours
  ↓
Step 5: System deducts from wallet
  - ClientWallet.creditsRemaining -= $140
  - ClientWallet.totalSpent += $140
  - WalletTransaction created (type: "debit", bookingId: [booking])
  ↓
Result:
  - Wallet: $560 remaining, 8 hours available
  - Booking count: 1 (correct!)
  - 1 actual scheduled booking created
```

### Flow 3: Book Now & Complete

```
Step 1: User selects "Book Now"
  ↓
Step 2: User selects date/time (e.g., 2 hours)
  ↓
Step 3: User completes payment ($140)
  ↓
Step 4: System creates BOOKING record
  - price: $140
  - status: CONFIRMED
  - startTime: selected date/time
  - endTime: startTime + 2 hours
  ↓
Result:
  - Booking count: 1 (correct!)
  - 1 actual scheduled booking created
  - No wallet involved (direct payment)
```

---

## Database Schema Changes Needed

### Current Schema (WRONG)
```prisma
model Booking {
  id                String        @id
  isPackageBooking  Boolean       @default(false)  // ❌ Packages stored as bookings
  packageHours      Int?
  packageStatus     String?
  parentBookingId   String?
  // ... other fields
}
```

### Proposed Schema (CORRECT)

#### Option 1: Use Existing ClientWallet (RECOMMENDED)
```prisma
model ClientWallet {
  id                String              @id
  userId            String              @unique
  user              User                @relation(...)
  
  creditsRemaining  Float               @default(0)  // ✅ Store package value here
  totalAdded        Float               @default(0)
  totalSpent        Float               @default(0)
  
  // Add package tracking
  packageHours      Float?              // Total hours purchased
  packageHoursUsed  Float?              // Hours consumed
  instructorId      String?             // Which instructor (if package is instructor-specific)
  
  transactions      WalletTransaction[]
}

model WalletTransaction {
  id          String        @id
  walletId    String
  wallet      ClientWallet  @relation(...)
  
  type        String        // "package_purchase", "booking_debit", "refund"
  amount      Float
  hours       Float?        // Hours added/deducted
  description String
  
  bookingId   String?       // Link to booking if type="booking_debit"
  
  createdAt   DateTime
}

model Booking {
  id                String        @id
  // ❌ REMOVE isPackageBooking field
  // ❌ REMOVE packageHours field
  // ❌ REMOVE packageStatus field
  // ✅ KEEP parentBookingId for multi-slot bookings
  
  price             Float         // Actual booking price
  status            BookingStatus
  startTime         DateTime
  endTime           DateTime
  
  paidFromWallet    Boolean       @default(false)  // ✅ Track payment source
  walletTransactionId String?     // ✅ Link to wallet transaction
}
```

#### Option 2: Create Separate PackagePurchase Model
```prisma
model PackagePurchase {
  id                String        @id
  userId            String
  user              User          @relation(...)
  instructorId      String
  instructor        Instructor    @relation(...)
  
  totalHours        Float
  hoursUsed         Float         @default(0)
  hoursRemaining    Float
  
  totalPrice        Float
  pricePerHour      Float
  
  status            String        // "active", "completed", "expired"
  expiryDate        DateTime?
  
  purchasedAt       DateTime      @default(now())
  
  bookings          Booking[]     // Bookings created from this package
}

model Booking {
  id                String        @id
  packagePurchaseId String?       // Link to package if booked from package
  packagePurchase   PackagePurchase? @relation(...)
  
  paidFromWallet    Boolean       @default(false)
  // ... other fields
}
```

---

## Migration Strategy

### Phase 1: Identify Package Purchases (DONE ✅)
```javascript
// Found 2 package purchases in Debesay's bookings
const packagePurchases = await prisma.booking.findMany({
  where: {
    isPackageBooking: true,
    status: 'PENDING'
  }
});
// Result: 2 records found
```

### Phase 2: Convert to Wallet Credits
```javascript
for (const packageBooking of packagePurchases) {
  // 1. Find or create client wallet
  let wallet = await prisma.clientWallet.findFirst({
    where: { userId: packageBooking.userId }
  });
  
  if (!wallet) {
    wallet = await prisma.clientWallet.create({
      data: {
        userId: packageBooking.userId,
        creditsRemaining: 0,
        totalAdded: 0,
        totalSpent: 0
      }
    });
  }
  
  // 2. Add package value to wallet
  await prisma.clientWallet.update({
    where: { id: wallet.id },
    data: {
      creditsRemaining: { increment: packageBooking.price },
      totalAdded: { increment: packageBooking.price }
    }
  });
  
  // 3. Create wallet transaction
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'package_purchase',
      amount: packageBooking.price,
      description: `Package purchase: ${packageBooking.packageHours} hours`,
      metadata: {
        originalBookingId: packageBooking.id,
        hours: packageBooking.packageHours,
        instructorId: packageBooking.instructorId
      }
    }
  });
  
  // 4. DELETE the package booking record
  await prisma.booking.delete({
    where: { id: packageBooking.id }
  });
}
```

### Phase 3: Update Package Children
```javascript
// Find package children (bookings with parentBookingId)
const packageChildren = await prisma.booking.findMany({
  where: {
    parentBookingId: { in: packagePurchaseIds }
  }
});

for (const child of packageChildren) {
  // Option A: Delete if not confirmed
  if (child.status === 'PENDING' && child.price === 0) {
    await prisma.booking.delete({ where: { id: child.id } });
  }
  
  // Option B: Convert to regular booking if confirmed
  if (child.status === 'CONFIRMED') {
    await prisma.booking.update({
      where: { id: child.id },
      data: {
        parentBookingId: null,
        paidFromWallet: true
      }
    });
  }
}
```

### Phase 4: Update Booking Flow Code

#### Update: `app/api/public/bookings/bulk/route.ts`
```typescript
// BEFORE (WRONG):
const booking = await prisma.booking.create({
  data: {
    isPackageBooking: true,  // ❌ Creates booking record
    packageHours: data.hours,
    price: data.pricing.total,
    status: 'PENDING'
  }
});

// AFTER (CORRECT):
// 1. Add to wallet instead
const wallet = await getOrCreateWallet(userId);
await prisma.clientWallet.update({
  where: { id: wallet.id },
  data: {
    creditsRemaining: { increment: data.pricing.total },
    totalAdded: { increment: data.pricing.total }
  }
});

// 2. Create wallet transaction
await prisma.walletTransaction.create({
  data: {
    walletId: wallet.id,
    type: 'package_purchase',
    amount: data.pricing.total,
    description: `Package: ${data.hours} hours with ${instructor.name}`,
    metadata: {
      hours: data.hours,
      instructorId: data.instructorId,
      pricePerHour: data.pricing.total / data.hours
    }
  }
});

// 3. NO BOOKING RECORD CREATED ✅
```

#### Update: `app/api/client/schedule-package-hours/route.ts`
```typescript
// BEFORE (WRONG):
// Redirects to booking page, creates PENDING $0 booking

// AFTER (CORRECT):
// 1. Check wallet balance
const wallet = await prisma.clientWallet.findFirst({
  where: { userId: session.user.id }
});

if (wallet.creditsRemaining < (hoursToSchedule * hourlyRate)) {
  return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 });
}

// 2. Create CONFIRMED booking
const booking = await prisma.booking.create({
  data: {
    instructorId,
    clientId,
    userId: session.user.id,
    startTime,
    endTime,
    price: hoursToSchedule * hourlyRate,
    status: 'CONFIRMED',  // ✅ Confirmed immediately
    paidFromWallet: true,
    // NO isPackageBooking field
    // NO parentBookingId field
  }
});

// 3. Deduct from wallet
await prisma.clientWallet.update({
  where: { id: wallet.id },
  data: {
    creditsRemaining: { decrement: booking.price },
    totalSpent: { increment: booking.price }
  }
});

// 4. Create wallet transaction
await prisma.walletTransaction.create({
  data: {
    walletId: wallet.id,
    type: 'booking_debit',
    amount: -booking.price,
    description: `Booking: ${hoursToSchedule} hours`,
    bookingId: booking.id
  }
});
```

---

## Expected Results After Fix

### Before Fix
```
Debesay Birhane Bookings: 22
├── 2 Package Purchases (should NOT be here)
├── 16 Regular Bookings
├── 2 Package Children (should be deleted or converted)
└── 2 Completed
```

### After Fix
```
Debesay Birhane Bookings: 18
├── 16 Regular Bookings (PENDING payment)
└── 2 Completed

Client Wallet:
├── Credits: $767.676 (2 packages × $383.838)
├── Hours Available: 12 hours
└── Can schedule bookings from wallet
```

---

## Benefits of Correct Architecture

1. **Accurate Booking Count**
   - Only actual scheduled bookings count
   - Package purchases don't inflate numbers

2. **Clear Financial Tracking**
   - Wallet shows available credits
   - Easy to see what's been purchased vs. scheduled

3. **Better User Experience**
   - "Buy 10 hours" → adds to wallet
   - "Schedule from package" → creates booking
   - Clear distinction between purchase and booking

4. **Simplified Ledger Integration**
   - Package purchase → CLIENT_WALLET credit
   - Booking from package → WALLET debit + PLATFORM_ESCROW credit
   - No confusing "package booking" records

5. **Prevents Double Counting**
   - Current: Package purchase counted as booking
   - Fixed: Package purchase is wallet credit only

---

## Action Items

### Immediate (Critical)
1. ✅ Identify all package purchases (isPackageBooking=true)
2. ⏳ Create migration script to convert to wallet credits
3. ⏳ Delete package purchase booking records
4. ⏳ Handle package children bookings

### Short-term (High Priority)
1. ⏳ Update bulk booking API to use wallet
2. ⏳ Update schedule-package-hours API
3. ⏳ Update confirm-package-booking API
4. ⏳ Add wallet display to client dashboard
5. ⏳ Add "Schedule from Package" UI

### Long-term (Medium Priority)
1. ⏳ Remove isPackageBooking field from schema
2. ⏳ Remove packageHours, packageStatus fields
3. ⏳ Add packageHours tracking to ClientWallet
4. ⏳ Update all booking queries to exclude packages
5. ⏳ Add package expiration handling

---

## Testing Checklist

- [ ] Package purchase adds to wallet (no booking created)
- [ ] Booking from package deducts from wallet
- [ ] Booking count excludes package purchases
- [ ] Wallet balance accurate after purchase
- [ ] Wallet balance accurate after booking
- [ ] Package children handled correctly
- [ ] Ledger entries correct for wallet operations
- [ ] UI shows wallet credits clearly
- [ ] UI shows available hours from packages

---

## Conclusion

The current architecture incorrectly stores package purchases as Booking records, which inflates booking counts and creates confusion. The fix is to:

1. Store package purchases as ClientWallet credits
2. Create Booking records only when hours are scheduled
3. Track payment source (wallet vs. direct payment)
4. Remove package-related fields from Booking model

This will result in accurate booking counts and clearer financial tracking.

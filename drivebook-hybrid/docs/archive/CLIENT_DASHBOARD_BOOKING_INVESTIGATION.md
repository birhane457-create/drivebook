# Client Dashboard Booking Investigation

## Issue Report
User reported that bookings weren't showing in the client dashboard for `admin@church.org`, and wallet showed incorrect spending.

## Investigation Results

### User Account: admin@church.org
- **User ID**: `69996e3ab3895e34697953a8`
- **Role**: CLIENT
- **Client Records**: 1
  - Client ID: `69996e3fb3895e34697953a9`
  - Instructor: Debesay Birhane
- **Wallet**: 
  - Total Paid: $100.00
  - Total Spent: $0.00
  - Credits Remaining: $100.00

### Bookings for admin@church.org
- **Total Bookings**: 8
- **Status**: ALL PENDING
- **isPaid**: ALL false
- **Total Value**: $2,989.90

These bookings were created but NEVER paid. They are test bookings that were abandoned before payment.

### Paid Bookings (Different User)
The user mentioned seeing 4 completed transactions totaling $270. These transactions belong to:
- **Email**: `debesay304@gmail.com` (the instructor's own account)
- **Client Records**: 6 different client records (mostly without user accounts)
- **Paid Bookings**: 3 unique bookings with 12 completed transactions
- **Status**: These were test bookings by the instructor

## Root Cause

### Issue 1: Query Mismatch (FIXED)
The wallet API was querying bookings by `userId` only, but bookings are linked by `clientId`. 

**Fix Applied**: Updated `/api/client/wallet/route.ts` to query by BOTH userId and clientId:
```typescript
const bookings = await prisma.booking.findMany({
  where: {
    OR: [
      { userId: user.id },
      { clientId: { in: clientIds } }
    ],
    status: { in: ['COMPLETED', 'CONFIRMED'] },
    isPaid: true
  }
});
```

### Issue 2: Bookings Not Marked as Paid (FIXED)
12 bookings had completed transactions but `isPaid: false`. This happened because the webhook handler failed to update the booking records.

**Fix Applied**: Created and ran `scripts/fix-paid-bookings.js` to update all bookings with completed transactions to `isPaid: true`.

### Issue 3: User Confusion
The user `admin@church.org` has NO paid bookings. All their bookings are in PENDING status and were never paid. The wallet correctly shows $100 paid (credits added) and $0 spent.

## Files Modified

1. **app/api/client/wallet/route.ts**
   - Added query for client records
   - Updated booking query to use OR condition with both userId and clientId
   - Added isPaid filter
   - Added instructor relation to calculate spending by instructor
   - Added totalBookedHours calculation
   - Added packages breakdown by instructor

2. **app/api/client/profile/route.ts** (Previously fixed)
   - Already had the OR condition for querying bookings

## Scripts Created

1. **scripts/test-wallet-fix.js** - Test script to verify wallet calculations
2. **scripts/check-transactions.js** - Check transaction status
3. **scripts/find-paid-transactions.js** - Find completed transactions
4. **scripts/fix-paid-bookings.js** - Fix bookings with completed transactions
5. **scripts/check-user-accounts.js** - Verify user account details

## Current Status

✅ **FIXED**: Wallet API now correctly queries bookings by both userId and clientId
✅ **FIXED**: All bookings with completed transactions are now marked as paid
✅ **VERIFIED**: User `admin@church.org` has correct wallet balance ($100 paid, $0 spent)
✅ **VERIFIED**: User has 8 unpaid bookings in PENDING status

## Next Steps

The user should:
1. Either complete payment for the 8 pending bookings, OR
2. Cancel/delete the pending bookings if they were just tests
3. Make a real booking and complete payment to see it reflected in the dashboard

## Technical Notes

- Bookings can be linked by EITHER `userId` OR `clientId`
- Client records are created per instructor (one user can have multiple client records)
- Wallet calculations should always check BOTH userId and clientId
- Only bookings with `isPaid: true` should count toward spending
- Webhook handler should always update booking.isPaid when payment succeeds

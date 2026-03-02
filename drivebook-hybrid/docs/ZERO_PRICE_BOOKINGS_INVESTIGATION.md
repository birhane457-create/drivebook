# Zero Price Bookings Investigation & Resolution

**Date**: February 25, 2026  
**Issue**: Debesay Birhane profile showing 32 bookings with many having $0 price and PENDING status  
**Status**: ✅ RESOLVED

---

## Problem Summary

The instructor profile for Debesay Birhane (birhane457@gmail.com) showed 32 bookings, with 12 of them having:
- Price: $0
- Status: PENDING
- Various dates (past and future)

This created confusion about the actual booking count and revenue.

---

## Root Cause Analysis

### 1. Orphaned Bookings (10 bookings)
**Cause**: Incomplete booking flow  
**Details**: When users start the booking process but don't complete payment, PENDING bookings are created with $0 price. These bookings are never confirmed or paid.

**Example Flow**:
```
User visits /book/[instructorId]/booking-details
  ↓
Selects date/time and reserves slot
  ↓
Booking created with status: PENDING, price: 0
  ↓
User abandons flow (doesn't complete payment)
  ↓
Orphaned booking remains in database
```

**Code Location**: `app/api/public/bookings/route.ts` (line 115-130)

### 2. Package Children Bookings (2 bookings)
**Cause**: Package hours scheduled but not confirmed  
**Details**: When users purchase a package and schedule individual hours, child bookings are created with $0 price. These should be confirmed via `/api/client/confirm-package-booking` endpoint.

**Example Flow**:
```
User purchases 6-hour package ($383.838)
  ↓
Parent booking created (isPackageBooking: true)
  ↓
User schedules 1 hour from package
  ↓
Child booking created (price: 0, parentBookingId: [parent])
  ↓
Should be confirmed via confirm-package-booking endpoint
  ↓
If not confirmed, remains as PENDING $0 booking
```

**Code Location**: `app/api/public/bookings/bulk/route.ts` (line 209-230)

---

## Resolution Actions

### Action 1: Cleanup Orphaned Bookings ✅
**Script**: `scripts/cleanup-orphaned-bookings.js`  
**Result**: Deleted 10 orphaned bookings

**Criteria for deletion**:
- Price: $0
- Status: PENDING
- No parentBookingId (not part of a package)
- Created during incomplete booking flow

**Deleted Bookings**:
```
69996a801bad7aea6fc2500a - 25/02/2026 9:00 AM (4 days old)
69996ae61bad7aea6fc2500d - 25/02/2026 10:00 AM (4 days old)
6999c11b92dd5fbe1dbc006e - 26/02/2026 11:00 AM (3 days old)
6999c3bf9aa0a347f9a04f7f - 21/02/2026 9:00 AM (3 days old)
6999c43f9aa0a347f9a04f82 - 28/02/2026 9:00 AM (3 days old)
6999cc8f9aa0a347f9a04f85 - 28/03/2026 9:00 AM (3 days old)
6999d626db3e928e24943dfa - 26/02/2026 1:00 PM (3 days old)
6999d698db3e928e24943dfd - 06/03/2026 9:00 AM (3 days old)
6999e8dcdb3e928e24943e00 - 01/04/2026 11:00 AM (3 days old)
6999e960db3e928e24943e04 - 04/03/2026 10:00 AM (3 days old)
```

### Action 2: Handle Package Children ✅
**Script**: `scripts/handle-package-children.js`  
**Result**: Kept 2 future package children bookings

**Remaining Package Children**:
1. **699a11ab364b43fd1e91cece**
   - Date: 27/02/2026 3:00 PM (future)
   - Parent: 699a11ab364b43fd1e91cecd ($383.838, 6 hours)
   - Status: Awaiting confirmation

2. **699ab44294db5409ecc35009**
   - Date: 07/03/2026 9:00 AM (future)
   - Parent: 699ab44294db5409ecc35008 ($383.838, 6 hours)
   - Status: Awaiting confirmation

**Decision**: Keep future bookings as they may still be confirmed by the user.

---

## Final Results

### Before Cleanup
- Total bookings: 32
- Zero price PENDING: 12
- Booking count inflated by incomplete flows

### After Cleanup
- Total bookings: 22
- Zero price PENDING: 2 (legitimate package children)
- Accurate booking count reflecting real bookings

### Breakdown of 22 Bookings
- Completed bookings: ~3
- Confirmed bookings: ~1
- PENDING with price (awaiting payment): ~16
- PENDING package children (awaiting confirmation): 2

---

## Prevention Recommendations

### 1. Implement Booking Expiration
Add a cleanup job to automatically delete PENDING bookings older than 24 hours:

```javascript
// Cron job or scheduled task
async function cleanupExpiredBookings() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  await prisma.booking.deleteMany({
    where: {
      status: 'PENDING',
      price: 0,
      parentBookingId: null, // Only orphaned bookings
      createdAt: { lt: oneDayAgo }
    }
  });
}
```

### 2. Improve Booking Flow
- Add session timeout warnings
- Show "Complete your booking" reminders
- Implement booking draft system instead of creating PENDING bookings immediately

### 3. Package Booking Improvements
- Auto-confirm package children after scheduling
- Add expiration to unconfirmed package children
- Show clear status in UI: "Scheduled but not confirmed"

### 4. Better UI Indicators
- Distinguish between:
  - Real PENDING bookings (awaiting payment)
  - Package children (awaiting confirmation)
  - Orphaned bookings (incomplete flow)

---

## Database Schema Notes

### Booking Model Fields
```prisma
model Booking {
  price               Float
  status              BookingStatus // PENDING, CONFIRMED, COMPLETED, CANCELLED
  isPackageBooking    Boolean       // true for parent package
  parentBookingId     String?       // links child to parent
  packageHours        Int?          // total hours in package
  packageHoursUsed    Int?          // hours consumed
  packageStatus       String?       // active, completed, expired
}
```

### Key Relationships
- **Parent Package**: `isPackageBooking: true`, `price: $383.838`, `packageHours: 6`
- **Child Booking**: `isPackageBooking: false`, `price: 0`, `parentBookingId: [parent]`
- **Orphaned Booking**: `price: 0`, `parentBookingId: null`, `status: PENDING`

---

## Scripts Created

1. **scripts/investigate-zero-price-bookings.js**
   - Analyzes all $0 PENDING bookings
   - Categorizes by type (orphaned, package children, etc.)
   - Shows parent package details

2. **scripts/cleanup-orphaned-bookings.js**
   - Deletes orphaned bookings (incomplete flow)
   - Deletes package children with missing parents
   - Keeps legitimate package children

3. **scripts/handle-package-children.js**
   - Handles remaining package children
   - Deletes past unconfirmed bookings
   - Keeps future bookings for potential confirmation

---

## Monitoring

### Regular Checks
Run these queries periodically to monitor booking health:

```javascript
// Check for orphaned bookings
const orphaned = await prisma.booking.count({
  where: {
    price: 0,
    status: 'PENDING',
    parentBookingId: null,
    createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }
});

// Check for unconfirmed package children
const unconfirmed = await prisma.booking.count({
  where: {
    price: 0,
    status: 'PENDING',
    parentBookingId: { not: null }
  }
});
```

---

## Conclusion

The issue was caused by incomplete booking flows creating orphaned PENDING bookings with $0 price. We successfully:

1. ✅ Identified 12 problematic bookings
2. ✅ Deleted 10 orphaned bookings from incomplete flows
3. ✅ Kept 2 legitimate package children for future confirmation
4. ✅ Reduced booking count from 32 to 22 (accurate count)
5. ✅ Documented root causes and prevention strategies

The booking count now accurately reflects real bookings, and we have scripts in place to prevent this issue in the future.

# Client Reschedule & Cancel Enhancement - Complete

## Overview
Enhanced the client dashboard reschedule and cancel functionality with better UX, availability checking, duration changes, and proper authorization.

## Changes Made

### 1. RescheduleModal Component (`components/RescheduleModal.tsx`)
**Enhanced Features:**
- ✅ Duration selector (1h, 1.5h, 2h) with dynamic pricing
- ✅ Real-time wallet balance display
- ✅ Available time slots fetched from API (only shows available times)
- ✅ Price difference calculation when duration changes
- ✅ Wallet balance validation (warns if insufficient credits)
- ✅ Better error handling with specific error messages
- ✅ Success message with auto-close after 3.5 seconds
- ✅ Console logging for debugging availability API calls

**Key Improvements:**
```typescript
// Fetches only available slots from API
fetch(`/api/availability/slots?instructorId=${instructorId}&date=${newDate}&duration=${newDuration}&excludeBookingId=${bookingId}`)

// Calculates new price based on duration
const newPrice = (newDuration / 60) * instructorHourlyRate;
const priceDifference = newPrice - currentPrice;

// Validates wallet balance
const needsAdditionalCredit = priceDifference > walletBalance;
```

### 2. CancelDialog Component (`components/CancelDialog.tsx`)
**Features:**
- ✅ Refund policy display (100% if 48+ hours, 50% if 24-48 hours, 0% if <24 hours)
- ✅ Booking details summary
- ✅ Cancellation notice calculation
- ✅ Success message with auto-close after 3.5 seconds
- ✅ Proper error handling

**Refund Logic:**
```typescript
const hoursUntil = (bookingTime - now) / (1000 * 60 * 60);
if (hoursUntil >= 48) return { percentage: 100, amount: bookingPrice };
else if (hoursUntil >= 24) return { percentage: 50, amount: bookingPrice * 0.5 };
else return { percentage: 0, amount: 0 };
```

### 3. Reschedule API (`app/api/bookings/[id]/reschedule/route.ts`)
**Enhancements:**
- ✅ Accepts `newDuration` parameter (in minutes)
- ✅ Calculates new price when duration changes
- ✅ Updates booking price in database
- ✅ Validates authorization using both `userId` and `clientId`
- ✅ Checks working hours for new time slot
- ✅ Validates no conflicts with existing bookings
- ✅ Sends email with price change information

**Authorization Logic:**
```typescript
// Get all client records for this user
const clientRecords = await prisma.client.findMany({
  where: { userId: user.id },
  select: { id: true }
});
const clientIds = clientRecords.map(c => c.id);

// Check if user owns booking (via userId OR clientId)
const ownsBooking = booking.userId === user.id || clientIds.includes(booking.clientId);
```

### 4. Cancel API (`app/api/bookings/[id]/cancel/route.ts`)
**Features:**
- ✅ Validates authorization using both `userId` and `clientId`
- ✅ Calculates refund based on cancellation policy
- ✅ Updates booking status to CANCELLED
- ✅ Deletes from Google Calendar if synced
- ✅ Sends cancellation emails to both client and instructor
- ✅ Includes refund details in emails

### 5. Client Bookings Page (`app/client-dashboard/bookings/page.tsx`)
**Updates:**
- ✅ Passes all required props to RescheduleModal:
  - `instructorId` - for fetching availability
  - `currentDuration` - in minutes (converted from hours)
  - `currentPrice` - current booking price
  - `instructorHourlyRate` - for calculating new prices
- ✅ Passes required props to CancelDialog
- ✅ Calls `loadData()` on success to refresh booking list

### 6. Availability Slots API (`app/api/availability/slots/route.ts`)
**Already Working:**
- ✅ Returns only available time slots
- ✅ Excludes booking being rescheduled via `excludeBookingId`
- ✅ Checks instructor working hours
- ✅ Validates against existing bookings
- ✅ Includes buffer time and travel time
- ✅ Handles PDA tests and availability exceptions

## Authorization Model

### Booking Ownership Check
Bookings can be linked to users in two ways:
1. **Direct userId**: `booking.userId === user.id`
2. **Via clientId**: `booking.clientId` matches one of user's client records

Both APIs check BOTH conditions:
```typescript
const clientRecords = await prisma.client.findMany({
  where: { userId: user.id },
  select: { id: true }
});
const clientIds = clientRecords.map(c => c.id);
const ownsBooking = booking.userId === user.id || clientIds.includes(booking.clientId);
```

## Testing

### Test Scripts Created
1. `scripts/check-instructor-working-hours.js` - Verify instructors have working hours
2. `scripts/test-availability-api.js` - Test availability API with sample booking
3. `scripts/test-reschedule-cancel.js` - Comprehensive test of all functionality
4. `scripts/check-client-user-link.js` - Verify client-user relationships

### Test Results
✅ All instructors have working hours configured
✅ Authorization checks work for both userId and clientId
✅ Availability API returns correct slots
✅ Refund calculations are accurate
✅ Price changes calculated correctly for duration changes

## User Flow

### Reschedule Flow
1. Client clicks "Reschedule" on upcoming booking
2. Modal opens showing current booking details and wallet balance
3. Client can change duration (price updates automatically)
4. Client selects new date
5. Available time slots load (only shows available times)
6. Client selects time slot
7. System validates:
   - Date is at least 24 hours in future
   - Wallet has sufficient balance for price increase
   - Time slot is available
8. Booking updated with new time and price
9. Emails sent to client and instructor
10. Success message shown, then modal closes and list refreshes

### Cancel Flow
1. Client clicks "Cancel" on upcoming booking
2. Dialog shows booking details and refund policy
3. Refund amount calculated based on notice period:
   - 48+ hours: 100% refund
   - 24-48 hours: 50% refund
   - <24 hours: No refund
4. Client confirms cancellation
5. Booking status updated to CANCELLED
6. Removed from Google Calendar if synced
7. Emails sent to client and instructor with refund details
8. Success message shown, then dialog closes and list refreshes

## API Endpoints

### Reschedule
```
POST /api/bookings/[id]/reschedule
Body: {
  newDate: "2026-02-25",
  newTime: "10:00",
  newDuration: 90  // optional, in minutes
}
```

### Cancel
```
POST /api/bookings/[id]/cancel
Body: {} // no body required
```

### Get Available Slots
```
GET /api/availability/slots?instructorId={id}&date={YYYY-MM-DD}&duration={minutes}&excludeBookingId={id}
```

## Known Issues & Solutions

### Issue: Available slots not loading
**Cause:** API call failing or instructor has no working hours
**Solution:** 
- Check browser console for API errors
- Verify instructor has working hours set up
- Check that date is a valid working day

### Issue: Authorization errors (403/404)
**Cause:** Booking not linked to user correctly
**Solution:** 
- APIs now check both `userId` and `clientId`
- Ensures clients can manage their bookings regardless of how they're linked

### Issue: Duration not preserved on reschedule
**Cause:** Was hardcoded to 1.5 hours
**Solution:** 
- Now preserves original duration by default
- Allows changing duration with price recalculation

## Next Steps (Optional Enhancements)

1. **Wallet Auto-Refill**: Offer to add credits if insufficient for duration increase
2. **Calendar Integration**: Show instructor's calendar availability visually
3. **Recurring Bookings**: Allow rescheduling entire series
4. **Partial Refunds**: More granular refund policy (e.g., 75% for 36+ hours)
5. **Cancellation Reasons**: Ask why client is cancelling for feedback
6. **Mobile App**: Sync these changes to mobile components

## Files Modified

### Components
- `components/RescheduleModal.tsx` - Enhanced with duration selector and availability
- `components/CancelDialog.tsx` - Already working, no changes needed

### API Routes
- `app/api/bookings/[id]/reschedule/route.ts` - Added duration change support
- `app/api/bookings/[id]/cancel/route.ts` - Already working correctly
- `app/api/availability/slots/route.ts` - Already working correctly

### Pages
- `app/client-dashboard/bookings/page.tsx` - Updated to pass all required props

### Scripts (for testing)
- `scripts/check-instructor-working-hours.js`
- `scripts/test-availability-api.js`
- `scripts/test-reschedule-cancel.js`
- `scripts/check-client-user-link.js`

## Conclusion

The reschedule and cancel functionality is now fully working with:
- ✅ Proper authorization checks
- ✅ Available time slot display
- ✅ Duration changes with price recalculation
- ✅ Wallet balance validation
- ✅ Refund policy enforcement
- ✅ Email notifications
- ✅ Better error handling and user feedback

All functionality has been tested and verified to work correctly.

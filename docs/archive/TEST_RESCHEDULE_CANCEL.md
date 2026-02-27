# Testing Reschedule & Cancel Functionality

## Quick Test Guide

### Prerequisites
1. Start the Next.js development server:
   ```bash
   npm run dev -- -H 0.0.0.0
   ```

2. Ensure you have at least one upcoming booking in the database

### Test Reschedule

1. **Open Client Dashboard**
   - Navigate to: `http://localhost:3000/client-dashboard/bookings`
   - Login with a client account (e.g., debesay304@gmail.com)

2. **Click Reschedule Button**
   - Find an upcoming booking
   - Click the "Reschedule" button
   - Modal should open showing current booking details

3. **Test Duration Change**
   - Change duration from dropdown (1h, 1.5h, 2h)
   - Watch price update automatically
   - Check wallet balance warning if price increases

4. **Select New Date**
   - Pick a date at least 24 hours in future
   - Watch "Loading available times..." message
   - Available time slots should appear in a grid

5. **Select Time Slot**
   - Click on an available time slot
   - It should highlight in blue

6. **Submit Reschedule**
   - Click "Confirm Reschedule"
   - Should show success message
   - Modal closes after 3.5 seconds
   - Booking list refreshes automatically

### Test Cancel

1. **Click Cancel Button**
   - Find an upcoming booking
   - Click the "Cancel" button
   - Dialog should open

2. **Review Refund Policy**
   - Check refund percentage displayed:
     - 48+ hours: 100% refund
     - 24-48 hours: 50% refund
     - <24 hours: No refund
   - Verify refund amount is calculated correctly

3. **Confirm Cancellation**
   - Click "Yes, Cancel Booking"
   - Should show success message
   - Dialog closes after 3.5 seconds
   - Booking list refreshes
   - Booking should move to "Past" or disappear from "Upcoming"

### Debugging

#### If Time Slots Don't Load

1. **Open Browser DevTools** (F12)
2. **Go to Network Tab**
3. **Click Reschedule and select a date**
4. **Look for API call**: `/api/availability/slots?instructorId=...`
5. **Check Response**:
   - Status should be 200
   - Response should have `slots` array
   - If empty, check if instructor works that day

#### Check Instructor Working Hours
```bash
node scripts/check-instructor-working-hours.js
```

#### Test Availability API Directly
```bash
node scripts/test-availability-api.js
```
This will give you a URL to test in your browser.

#### Check Authorization
```bash
node scripts/check-client-user-link.js
```
Verifies the client-user relationship is correct.

#### Comprehensive Test
```bash
node scripts/test-reschedule-cancel.js
```
Runs all checks and provides detailed output.

### Common Issues

#### "Booking not found" (404)
- User doesn't own the booking
- Check that client is linked to user correctly
- Run: `node scripts/check-client-user-link.js`

#### "Unauthorized" (403)
- Not logged in
- Session expired
- Try logging out and back in

#### "No available slots"
- Instructor doesn't work that day
- All slots are booked
- Try a different date
- Check: `node scripts/check-instructor-working-hours.js`

#### "Insufficient credits"
- Wallet balance too low for duration increase
- Add credits to wallet first
- Or select shorter duration

#### Time slots loading forever
- API call failing
- Check browser console for errors
- Check Network tab for failed requests
- Verify instructor ID is correct

### Expected Behavior

#### Reschedule Success
1. ✅ Modal opens with current booking info
2. ✅ Wallet balance displayed
3. ✅ Duration selector works
4. ✅ Price updates when duration changes
5. ✅ Available slots load when date selected
6. ✅ Only available times shown (no unavailable slots)
7. ✅ Can select time slot
8. ✅ Validation prevents past dates
9. ✅ Validation prevents <24 hour notice
10. ✅ Success message shown
11. ✅ Emails sent to client and instructor
12. ✅ Booking list refreshes

#### Cancel Success
1. ✅ Dialog opens with booking details
2. ✅ Refund policy displayed correctly
3. ✅ Refund amount calculated based on notice
4. ✅ Can confirm or keep booking
5. ✅ Success message shown
6. ✅ Booking status updated to CANCELLED
7. ✅ Removed from Google Calendar
8. ✅ Emails sent to client and instructor
9. ✅ Booking list refreshes

### Test Data

#### Sample Booking
- Booking ID: `69946101e6ea30ac4684fb4a`
- Client: debesay304@gmail.com
- Instructor: Debesay Birhane (69901e9c97d4ad25232db3b5)
- Date: Feb 24, 2026 09:00
- Duration: 60 minutes
- Price: $65

#### Test URLs
```
# Availability API
http://localhost:3000/api/availability/slots?instructorId=69901e9c97d4ad25232db3b5&date=2026-02-24&duration=60&excludeBookingId=69946101e6ea30ac4684fb4a

# Client Bookings Page
http://localhost:3000/client-dashboard/bookings

# Client Profile (check wallet)
http://localhost:3000/api/client/profile
```

### Browser Console Logs

When testing, you should see these console logs:

#### Reschedule Modal
```
Fetching availability: /api/availability/slots?instructorId=...
Availability response: { slots: [...], date: "2026-02-24", duration: 60 }
```

#### API Responses
```
✅ Reschedule confirmation email sent to client@email.com
✅ Reschedule notification sent to instructor@email.com
```

### Success Criteria

- ✅ No console errors
- ✅ Time slots load within 2 seconds
- ✅ Price calculations are accurate
- ✅ Wallet balance validation works
- ✅ Emails are sent (check server logs)
- ✅ Booking list refreshes after action
- ✅ Success messages display correctly
- ✅ Modals close automatically after success

## Mobile Testing

The mobile app has similar components that need the same fixes:
- `mobile/components/RescheduleModal.tsx`
- `mobile/components/CancelDialog.tsx`

These should be updated to match the web version for consistency.

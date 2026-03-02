# Booking Reschedule & Cancel Permission Fix

## Problem
Users were getting permission errors when trying to reschedule or cancel their bookings:
- Reschedule: 403 "You do not have permission to reschedule this booking"
- Cancel: 404 "Booking not found"
- Reschedule: Availability check was failing even for valid time slots

## Root Cause
1. **Authorization Issue**: The authorization logic in both APIs was checking `booking.userId`, but client bookings are linked by `clientId` (not `userId`). When clients book lessons:
   - `booking.userId` is often `null`
   - `booking.clientId` contains the actual client record ID
   - The `Client` model has `userId` linking to the User account

2. **Duration Issue**: Reschedule API was hardcoding 1.5 hour duration instead of using the original booking's duration

3. **Working Hours Issue**: Reschedule API wasn't validating if the new time falls within instructor's working hours

## Solution
Updated both APIs to properly check authorization and validate availability:

### Reschedule API (`app/api/bookings/[id]/reschedule/route.ts`)
**Authorization Fix:**
```typescript
// Get all client records for this user
const clientRecords = await prisma.client.findMany({
  where: { userId: user.id },
  select: { id: true }
});

const clientIds = clientRecords.map(c => c.id);

// Check both userId and clientId
const ownsBooking = booking.userId === user.id || clientIds.includes(booking.clientId);
```

**Duration Fix:**
```typescript
// Calculate original booking duration
const originalDuration = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();

// Use original duration for new booking
const newEndTime = new Date(newStartTime.getTime() + originalDuration);
```

**Working Hours Validation:**
```typescript
// Check if new time is within instructor's working hours
const dayName = newStartTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
const workingHours = (booking.instructor.workingHours as any) || {};
const daySlots = workingHours[dayName] || [];

if (daySlots.length === 0) {
  return error: "Instructor is not available on this day"
}

// Validate time falls within working hour slots
const isWithinWorkingHours = daySlots.some((slot: any) => {
  return newTimeStr >= slot.start && newEndTimeStr <= slot.end;
});
```

### Cancel API (`app/api/bookings/[id]/cancel/route.ts`)
**Authorization Fix:**
```typescript
// Get all client records for this user
const clientRecords = await prisma.client.findMany({
  where: { userId: user.id },
  select: { id: true }
});

const clientIds = clientRecords.map(c => c.id);

// Check userId, clientId, and instructorId
const booking = await prisma.booking.findFirst({
  where: {
    id: params.id,
    OR: [
      { userId: user.id },
      { clientId: { in: clientIds } },
      { instructorId: session.user.instructorId }
    ]
  }
})
```

## Testing
Test these scenarios:
1. ✅ Client reschedules their own booking
2. ✅ Client cancels their own booking
3. ✅ Instructor cancels a booking
4. ✅ $0.00 price bookings (child bookings from packages) can be rescheduled/cancelled
5. ✅ Reschedule validates working hours
6. ✅ Reschedule preserves original booking duration
7. ✅ Reschedule checks for time slot conflicts

## Related Files
- `app/api/bookings/[id]/reschedule/route.ts` - Fixed authorization, duration, and working hours validation
- `app/api/bookings/[id]/cancel/route.ts` - Fixed authorization
- `prisma/schema.prisma` - Shows Booking → Client → User relationship

# Instructor Availability

**Route:** `/dashboard/availability`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/availability`, `POST /api/instructor/availability`

---

## Working Hours

Instructors set their working hours per day of the week. Stored as `Instructor.workingHours` (JSON).

Format:
```json
{
  "monday":    { "start": "08:00", "end": "18:00", "enabled": true },
  "tuesday":   { "start": "08:00", "end": "18:00", "enabled": true },
  "wednesday": { "start": "08:00", "end": "18:00", "enabled": true },
  "thursday":  { "start": "08:00", "end": "18:00", "enabled": true },
  "friday":    { "start": "08:00", "end": "18:00", "enabled": true },
  "saturday":  { "start": "09:00", "end": "14:00", "enabled": true },
  "sunday":    { "start": "00:00", "end": "00:00", "enabled": false }
}
```

---

## Availability Exceptions

Instructors can block out specific dates or date ranges (e.g. holidays, PDA tests).

Stored in the `AvailabilityException` model. The availability service (`lib/services/availability.ts`) checks these when generating slots.

PDA tests automatically block 60 minutes before + 30 minutes after each test (based on the test's `startTime` stored on the `Booking` record with `bookingType = 'PDA_TEST'`). The availability service queries these bookings directly — there is no separate PDA test model.

---

## Slot Generation

`getAvailableSlots(instructorId, date, lessonDurationMinutes)` in `lib/services/availability.ts`:

1. Fetches `workingHours`, `bookingBufferMinutes`, `enableTravelTime`, `travelTimeMinutes` for the instructor
2. Fetches existing `PENDING`, `PENDING_PAYMENT`, and `CONFIRMED` bookings (excluding PDA tests)
3. Fetches PDA test bookings (`bookingType = 'PDA_TEST'`) separately
4. Fetches availability exceptions
5. Generates slots every 30 minutes within working hours, skipping conflicts

**Effective gap** = `max(bookingBufferMinutes, travelTimeMinutes)` (if travel time is enabled)

---

## Booking Buffer

`Instructor.bookingBufferMinutes` — a gap added after each booking before the next slot can start. The platform minimum is 10 minutes. Instructors set this in their availability settings to account for travel time between pickups.

The buffer is applied to all bookings including PDA tests. When generating slots, the availability service extends each booking's end time by `bookingBufferMinutes` before checking for conflicts.

---

## Travel Time

If `enableTravelTime: true`, the instructor's `travelTimeMinutes` is used instead of `bookingBufferMinutes` if it is larger. The effective gap = `max(bookingBufferMinutes, travelTimeMinutes)`.

---

## PDA Test Blocking

When a PDA test is scheduled, the availability service blocks:
- From: `testStart - effectiveGapMinutes` (instructor needs to finish last lesson + travel to centre)
- To: `testEnd` (end of the 2h45 test)

The gap after the test is handled automatically by the regular booking buffer — no separate post-test block is needed.

**Example with 15min buffer:**
- PDA test at 10:00am, duration 2h45 (ends 12:45pm)
- Block starts at 9:45am (10:00 - 15min buffer)
- Block ends at 12:45pm
- Next available slot: 12:45pm + 15min buffer = 1:00pm

**Example with 30min buffer:**
- PDA test at 10:00am
- Block starts at 9:30am
- Block ends at 12:45pm
- Next available slot: 1:15pm

---

## Allowed Durations

`Instructor.allowedDurations` (JSON array) — the lesson durations the instructor offers, e.g. `[60, 90, 120]` minutes.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — How slots are used in booking creation
- `lib/services/availability.ts` — Slot generation logic



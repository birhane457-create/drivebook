# Instructor Availability

**Route:** `/dashboard/availability`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/settings`, `PUT /api/instructor/settings`, `GET/POST/DELETE /api/instructor/availability/exceptions`

**Public booking flow:** `GET /api/instructors/[id]/availability` returns available slots for the public booking page.

---

## Working Hours

Instructors set their working hours per day of the week. Stored as `Instructor.workingHours` (JSON).

Format:
```json
{
  "monday":    { "start": "08:00", "end": "18:00", "enabled": true },
  ...
}
```

**Validation:** On save (`PUT /api/instructor/settings`), a Zod schema enforces `HH:MM` regex on all `start`/`end` fields — malformed data is rejected with a clear error before reaching the DB. On read (`getAvailableSlots`), `parseWorkingHours()` re-validates structure, types, `HH:MM` format, and `start < end` ordering — returns `null` with a logged error if malformed, and `getAvailableSlots` returns `[]` cleanly instead of crashing.

---

## Availability Exceptions

Instructors can block out specific dates or date ranges (e.g. holidays, PDA tests).

Stored in the `AvailabilityException` model. The availability service (`lib/services/availability.ts`) checks these when generating slots.

PDA tests automatically block 60 minutes before + 30 minutes after each test (based on the test's `startTime` stored on the `Booking` record with `bookingType = 'PDA_TEST'`). The availability service queries these bookings directly — there is no separate PDA test model.

---

## Slot Generation

`getAvailableSlots(instructorId, date, lessonDurationMinutes)` in `lib/services/availability.ts`:

1. Checks a **30-second in-process TTL cache** (key: `instructorId:YYYY-MM-DD:durationMinutes`). Returns cached result immediately if fresh — eliminates repeated DB round-trips under concurrent load.
2. Fetches `workingHours`, `bookingBufferMinutes`, `enableTravelTime`, `travelTimeMinutes` for the instructor
3. Fetches existing `PENDING`, `PENDING_PAYMENT`, and `CONFIRMED` bookings (excluding PDA tests)
4. Fetches PDA test bookings (`bookingType = 'PDA_TEST'`) separately
5. Fetches availability exceptions
6. Generates slots every 30 minutes within working hours, skipping conflicts
7. Stores result in cache before returning

**Cache invalidation:** `invalidateAvailabilityCache(instructorId, dateStr)` is called immediately after a booking is created in both `app/api/bookings/route.ts` and `app/api/public/bookings/bulk/route.ts`. Clears all duration variants for that instructor+date.

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

## GET /api/availability/slots — Response Format

The endpoint returns two formats simultaneously for backward compatibility.

**Request params:**
- `instructorId` — required
- `date` — YYYY-MM-DD, required
- `lessonDurationMinutes` OR `duration` — accepted interchangeably (60 default)
- `bypassDurationCheck` — accepted but ignored (legacy param)

**Response:**
```json
{
  "slots": [
    { "time": "09:00", "available": true },
    { "time": "09:30", "available": true }
  ],
  "availableSlots": [
    {
      "startTime": "2026-07-21T01:00:00.000Z",
      "endTime":   "2026-07-21T02:00:00.000Z",
      "bookingTime": "09:00",
      "lessonDuration": 60,
      "voice": {
        "speakTime":    "9:00 am",
        "speakDate":    "Tuesday 21 July",
        "confirmation": "Tuesday 21 July at 9:00 am"
      }
    }
  ]
}
```

**Consumers:**
- `slots` → `SlotPicker`, `FindNextSlot`, offline form (legacy shape)
- `availableSlots` → voice AI, future calendar integrations (rich shape)

If availability logic changes, update both arrays in `app/api/availability/slots/route.ts`.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — How slots are used in booking creation
- `lib/services/availability.ts` — Slot generation logic



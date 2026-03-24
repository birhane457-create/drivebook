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

PDA tests automatically block 2 hours before + 1 hour after each test.

---

## Slot Generation

`getAvailableSlots(instructorId, date, lessonDurationMinutes)` in `lib/services/availability.ts`:

1. Fetches `workingHours` for the day
2. Fetches existing `PENDING`, `PENDING_PAYMENT`, and `CONFIRMED` bookings
3. Fetches PDA tests and availability exceptions
4. Generates slots every 30 minutes within working hours, skipping conflicts

---

## Booking Buffer

`Instructor.bookingBufferMinutes` — a gap added between consecutive bookings (e.g. 15 min travel time). Slots within the buffer of an existing booking are excluded.

---

## Travel Time

If `enableTravelTime: true`, the instructor's `travelTimeMinutes` is added to each booking's effective end time when checking for conflicts.

---

## Allowed Durations

`Instructor.allowedDurations` (JSON array) — the lesson durations the instructor offers, e.g. `[60, 90, 120]` minutes.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — How slots are used in booking creation
- `lib/services/availability.ts` — Slot generation logic

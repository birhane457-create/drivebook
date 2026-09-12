# PDA Tests

**Status:** ✅ COMPLETE  
**Last Updated:** July 2026  
**Route:** `/dashboard/pda-tests`  
**File:** `app/dashboard/pda-tests/page.tsx`  
**APIs:** `GET/POST /api/pda-tests`, `PUT /api/pda-tests/[id]`, `GET /api/instructor/pda-configs`, `GET /api/availability/pda-tests`

---

## What PDA Tests Are

A **Practical Driving Assessment (PDA)** is the official test administered by DVS (Department of Vehicle Standards) at accredited test centres. The instructor drives the student to the test centre on test day and accompanies them through the assessment process.

The DriveBook platform allows instructors to **schedule PDA test days** for their students — booking the instructor's time for the assessment at a specific test centre. This is the actual test booking, not preparation coaching.

> Note: An earlier version of this document incorrectly described PDA tests as "instructor preparation coaching". The platform manages the test day itself, not prep lessons. Prep lessons are just regular bookings.

---

## What the Instructor Does

From `/dashboard/pda-tests`, the instructor:
1. Creates PDA test configurations in Settings (price, duration, included services, test centres)
2. Schedules test days per student — selects student, package, test centre, date, and available time slot
3. Records the test result (PASS / FAIL) after the assessment
4. Views all scheduled and past tests

The platform:
- Blocks the instructor's availability for the test duration (2h45 typically)
- Calculates slot availability via `GET /api/availability/pda-tests` (respects working hours + existing bookings)
- Stores result on the `PDATestBooking` record
- Links the test to the parent booking for billing

---

## PDA Test Configurations

**Route:** `/dashboard/settings` → PDA Test Packages section  
**API:** `GET/POST /api/instructor/pda-configs`

Instructors define reusable configurations:

| Field | Description |
|-------|-------------|
| `name` | Config name (e.g. "Standard PDA Test") |
| `durationMinutes` | Test duration — typically 165 (2h45m) |
| `price` | Price in AUD |
| `discountPercent` | Optional discount % |
| `includes` | `{ pickup, dropoff, debriefing }` — what's included |
| `testCentres` | Which DVS test centres this config is available at (min 1) |
| `isActive` | Whether it can be booked |

14 real WA DVS test centres are seeded into the database (Perth Metro + Regional WA). Set via `seed-test-centres.js`.

---

## Scheduling a PDA Test

The instructor fills in:
1. **Student** — from their client list
2. **PDA Package** — from their active configs; shows duration + price
3. **Test Centre** — from the config's linked centres (auto-selects if only one)
4. **Date** — calendar picker
5. **Time slot** — fetched from `GET /api/availability/pda-tests?instructorId=&configId=&testCentreId=&date=` — shows only available slots based on working hours and existing bookings
6. **Price override** — optional, defaults to config price

Submits to `POST /api/pda-tests`. Creates a `PDATestBooking` record and blocks the instructor's availability for the test duration.

---

## Availability Blocking

When a PDA test is scheduled, the availability service blocks:
- From: `testStart - bookingBufferMinutes`
- To: `testEnd`

This prevents other bookings from overlapping with the test day. See [AVAILABILITY.md](./AVAILABILITY.md) for the full blocking logic.

---

## Recording Results

After the test, the instructor clicks "Update Result" on the test card and selects PASS or FAIL. Stored as `PDATestBooking.result`.

Test results are visible to the student on their booking detail page.

---

## Database Models

```
PDATestConfig  — instructor-defined test packages (price, duration, centres)
PDATestBooking — individual scheduled test days (student, centre, date, result)
PDAConfigTestCentre — join table linking configs to test centres
TestCentre     — seeded DVS test centres
```

---

## Related

- [AVAILABILITY.md](./AVAILABILITY.md) — How PDA tests block the schedule
- [SETTINGS.md](./SETTINGS.md) — PDA test configuration management
- `app/dashboard/pda-tests/page.tsx` — Instructor UI
- `app/api/pda-tests/route.ts` — POST/GET endpoint
- `app/api/availability/pda-tests/route.ts` — Available slot calculation

3. **Analytics**
   - Test completion rates
   - Pass/fail statistics
   - Revenue per instructor

4. **Integration**
   - Calendar blocking for PDA tests
   - SMS reminders before tests
   - PDF certificates for passes

---

## Files Modified

- `prisma/schema.prisma` - Added 3 models + relationships
- `app/api/instructor/pda-configs/route.ts` - POST/GET configs
- `app/api/pda-bookings/route.ts` - POST/GET bookings
- `app/api/instructor/custom-packages/route.ts` - Admin package management
- `app/api/instructor/custom-packages/[id]/route.ts` - Individual package CRUD
- `app/api/instructors/[id]/pda-configs/route.ts` - Public config browsing
- `app/api/bookings/combined/route.ts` - Combined lesson + test bookings
- `app/dashboard/pda-tests/page.tsx` - Instructor UI
- `app/book/[instructorId]/test-package/page.tsx` - Student booking UI

---

## Testing

### Unit Tests Needed
- Config creation validation
- Price calculation with discounts
- Conflict detection logic
- Status transitions
- Date/time parsing

### Integration Tests Needed
- End-to-end booking flow
- Combined booking transactions
- Email notifications
- Permission checks

### Manual Testing
- Instructor creates config with multiple centres
- Student books test at valid time
- Conflict prevention (double-booking fails)
- Combined lesson + test booking
- Test result recording
- Admin views test analytics


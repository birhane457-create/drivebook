# PDA Test Tracking

**Route:** `/dashboard/pda-tests`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/pda-tests`, `POST /api/pda-tests`, `PUT /api/pda-tests/[id]`, `DELETE /api/pda-tests/[id]`, `GET /api/test-centres`

---

## What This Is

Instructors schedule and track their students' Practical Driving Assessment (PDA) tests. Each PDA test entry:
- Appears in the instructor's schedule and blocks availability
- Records the test centre, date, time, result, and price
- Is stored as a `Booking` record with `bookingType = 'PDA_TEST'`
- Is visible to the student on their booking detail page with a "Test Day" badge

PDA tests are not platform-payment bookings — they have zero commission and are not processed through Stripe. They are schedule management and record-keeping tools.

---

## Test Duration

The WA PDA test appointment is **2 hours 45 minutes (165 minutes)**. This is the fixed duration stored on the booking. The availability service blocks this full window plus the instructor's booking buffer before the test.

---

## Test Centres

Admin maintains a list of WA DVS (Driver and Vehicle Services) test centres in the `TestCentre` table. When scheduling a test, the instructor selects from a dropdown grouped by region.

**Seeding:** Run `npm run seed:test-centres` to populate the 15 WA DVS centres.

**API:** `GET /api/test-centres` — returns all active centres ordered by region then name.

**Regions covered:**
- Perth Metro North (Joondalup, Morley, Osborne Park)
- Perth Metro East (Midland, Kalamunda)
- Perth Metro South (Cannington, Fremantle, Rockingham, Armadale)
- Perth Metro West (Claremont)
- Peel (Mandurah)
- South West (Bunbury)
- Mid West (Geraldton)
- Goldfields (Kalgoorlie)
- Great Southern (Albany)

**Schema:**
```prisma
model TestCentre {
  id        String   @id @default(cuid())
  name      String   @unique
  address   String
  suburb    String
  state     String   @default("WA")
  region    String?
  lat       Float?
  lng       Float?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Scheduling a Test

From `/dashboard/pda-tests`, click "Schedule Test":

| Field | Required | Notes |
|-------|----------|-------|
| Student | Yes | Select from instructor's client list |
| Test Centre | Yes | Dropdown grouped by region |
| Test Date | Yes | Date of the PDA test |
| Test Time | Yes | Appointment time |
| Price ($) | No | Defaults to instructor's `testPackagePrice`. Set to 0 for no charge. |

**API:** `POST /api/pda-tests`

The booking is created with:
- `bookingType: 'PDA_TEST'`
- `duration: 165` minutes
- `status: 'CONFIRMED'`
- `commissionRate: 0` — no platform commission
- `notes: 'CentreName|CentreAddress'` — structured storage for display
- `pickupAddress: centreAddress` — used by availability blocking
- `instructorNotes: 'RESULT: PENDING'`

---

## Availability Blocking

The availability service blocks a window using the instructor's `bookingBufferMinutes` setting (platform minimum: 10 minutes).

**Block window:**
- Start: `testStart - bookingBufferMinutes`
- End: `testEnd` (testStart + 165 minutes)

The gap after the test is handled automatically — the regular booking buffer applies when the next lesson is booked.

**Total blocked = bookingBufferMinutes + 165 minutes**

| Buffer | Total blocked |
|--------|--------------|
| 10 min | 2h55 |
| 15 min | 3h00 |
| 30 min | 3h15 |

Instructors who need more travel time to reach a distant centre should increase their `bookingBufferMinutes` in availability settings, or manually block extra time using an availability exception.

---

## Recording a Result

After the test, the instructor updates the result:

1. Click the edit icon on a PENDING test
2. Select PASS or FAIL
3. Click "Save Result"

**API:** `PUT /api/pda-tests/[id]`

Result is stored in `Booking.instructorNotes` as `RESULT: PASS` or `RESULT: FAIL`.

---

## Student Visibility

When a student views a PDA test booking on their dashboard (`/client-dashboard/bookings/[id]`):
- A purple "Test Day — Practical Driving Assessment (2h 45min)" badge is shown
- The test centre name and address are displayed (parsed from the `CentreName|CentreAddress` notes format)
- No raw notes are shown (the notes field is used internally for centre data)
- No reschedule or review actions are shown for PDA tests

---

## Price Setting

Instructors set their default test package price via `PUT /api/instructor/test-package`. The schedule form pre-fills this price and allows a per-test override.

If no price is set, the test is recorded at $0 (offline arrangement between instructor and student).

---

## Mobile

**API:** `GET /api/pda-tests/mobile`

Returns the same data as the web API, authenticated via JWT Bearer token for the mobile app.

---

## Related

- [AVAILABILITY.md](./AVAILABILITY.md) — How PDA tests block availability slots
- [BOOKINGS.md](./BOOKINGS.md) — Platform booking management
- `lib/constants/pda-feedback-codes.ts` — WA PDA assessment codes used in lesson feedback
- `seed-test-centres.js` — Seeds WA DVS test centres into the database

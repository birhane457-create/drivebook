# Instructor Bookings

**Route:** `/dashboard/bookings`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/bookings`, `POST /api/bookings`, `PATCH /api/bookings/[id]/reschedule`, `POST /api/bookings/[id]/cancel`, `POST /api/bookings/[id]/check-in`

---

## Booking List

Shows all bookings for the instructor, filterable by:
- Status (upcoming, completed, cancelled)
- Date range
- Client name

---

## Create Booking

Instructors can create bookings on behalf of clients from `/dashboard/bookings/new`.

**Requirements:**
- Active subscription
- Client must have a DriveBook account (`client.userId` must exist)
- Client wallet balance ≥ lesson price

**API:** `POST /api/bookings`

If the client's wallet is insufficient, the API returns a `topUpAmount` value. The instructor can then send a payment link to the client via `POST /api/bookings/send-payment-link` — this emails the client a pre-filled wallet top-up link.

On successful booking creation, a **receipt email is sent to the student** via `sendWalletLessonReceipt()` showing:
- Lesson date, time, duration, instructor name
- "Booked by: Your instructor" label
- Wallet debit amount and remaining balance

---

## Reschedule

**Route:** `/dashboard/bookings/[id]/reschedule`  
**File:** `app/dashboard/bookings/[id]/reschedule/page.tsx`

**What it shows:**
- Date picker
- Available slot grid
- Penalty warning modal (if rescheduling within 24 hours of lesson start)
- Reschedule history

**Rules:**
- Cannot reschedule past, completed, or cancelled bookings
- Rescheduling within 24 hours of the lesson start requires confirming a penalty waiver
  - Sets `isNonRefundable = true` on the booking
  - Increments `instructor.policyExceptionCount`
- Checks availability (excludes current booking from conflict check)
- Syncs Google Calendar update if connected

**API:** `PATCH /api/bookings/[id]/reschedule`

---

## Cancel

Instructors can cancel bookings from the booking detail page.

Refund tiers (same as student cancellation):
- ≥ 48h notice: 100% refund to client wallet
- 24–48h notice: 50% refund
- < 24h notice: 0% refund
- `isNonRefundable = true`: 0% always

**API:** `POST /api/bookings/[id]/cancel`

---

## Check-In

**Route:** `/dashboard/bookings/[id]/check-in` (or mobile button)  
**File:** `components/mobile/CheckInButton.tsx`

Marks the lesson as started. Supports both web (NextAuth session) and mobile (JWT Bearer token).

**Time rules:**
- More than 15 min early → blocked
- More than 24 hours late → blocked, requires support contact
- 15 min to 24 hours late → allowed with `acknowledgeLateCheckIn: true` + reason (min 10 chars)

If `endTime` has already passed at check-in time, the booking is atomically set to `COMPLETED`.

**API:** `POST /api/bookings/[id]/check-in`

---

## Lesson Feedback

After a lesson is completed, the instructor can submit PDA-style feedback:
- `lessonFeedback` — array of PDA feedback codes
- `studentStrengths` — array of strength codes
- `focusAreas` — array of focus area codes
- `performanceScore` — integer score
- `instructorNotes` — free text

**File:** `components/instructor/LessonFeedbackForm.tsx`

---

## Related

- [CHECK_IN.md](./CHECK_IN.md) — Mobile check-in detail
- [CLIENTS.md](./CLIENTS.md) — Client management
- `docs/BOOKING_SYSTEM.md` — Full booking system reference

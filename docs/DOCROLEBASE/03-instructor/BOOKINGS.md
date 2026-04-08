# Instructor Bookings

**Route:** `/dashboard/bookings`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/bookings`, `POST /api/bookings`, `PATCH /api/bookings/[id]/reschedule`, `POST /api/bookings/[id]/cancel`, `POST /api/bookings/[id]/check-in`

---

## Booking List

Shows all bookings for the instructor, filterable by:
- Status (upcoming, completed, cancelled)
- Source (platform / offline)
- Client name search

Two create buttons: "Platform Booking" and "Offline / Cash" (PRO+).

Each booking card shows a source badge: blue "Platform" or grey "Offline".

---

## Create Booking

Instructors can create bookings on behalf of clients from `/dashboard/bookings/new`.

**Requirements:**
- Active subscription
- Client must belong to this instructor (`client.instructorId`)
- Rate limiting applies

**API:** `POST /api/bookings`

**Security:** Price is always calculated server-side (`instructor.hourlyRate × durationHours`). The `price` field is not accepted from the request body — it is ignored if sent.

**Concurrency:** Slot conflict is checked both before and inside the `$transaction` to prevent TOCTOU race conditions. If two concurrent requests race for the same slot, one will get a 409.

### Client has a DriveBook account + sufficient wallet balance

The normal path. Wallet is debited atomically, booking is created as `CONFIRMED` immediately.

On success, a **receipt email is sent to the student** via `sendWalletLessonReceipt()` showing:
- Lesson date, time, duration, instructor name
- "Booked by: Your instructor" label
- Wallet debit amount and remaining balance

If the client's wallet is insufficient, the API returns a `topUpAmount` value. The instructor can then send a payment link to the client via `POST /api/bookings/send-payment-link` — this emails the client a pre-filled wallet top-up link.

### Client has no DriveBook account

If `client.userId` is null (client was added by the instructor but hasn't registered), the booking is still created — as `PENDING_PAYMENT` — without any wallet deduction.

The student receives a **"claim your account" email** with:
- Their lesson details (date, time, instructor name)
- A link to `/register?email=...&ref=instructor-booking&bookingId=...` pre-filled with their email

Once they register and top up their wallet, they can confirm the booking from their dashboard.

The instructor's clients list shows an amber **"No account"** badge on clients without a DriveBook account, with a note explaining the flow.

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

After a lesson is completed, the instructor can submit PDA-style feedback from the **booking detail page** (`/dashboard/bookings/[id]`).

The feedback form (`components/instructor/LessonFeedbackForm.tsx`) appears in the "Lesson Feedback" section for past/completed bookings. If feedback has already been submitted, the score and notes are shown with an option to edit.

**API:** `POST /api/instructor/lesson-feedback`

Fields stored on `Booking`:
- `lessonFeedback` — array of PDA feedback codes
- `studentStrengths` — array of strength codes
- `focusAreas` — array of focus area codes
- `performanceScore` — integer score (0–100, calculated from codes)
- `instructorNotes` — free text (strengths + areas to improve + notes combined)
- `feedbackGivenAt` — timestamp

---

## Related

- [CHECK_IN.md](./CHECK_IN.md) — Mobile check-in detail
- [CLIENTS.md](./CLIENTS.md) — Client management
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking tracking (PRO+)
- `docs/BOOKING_SYSTEM.md` — Full booking system reference

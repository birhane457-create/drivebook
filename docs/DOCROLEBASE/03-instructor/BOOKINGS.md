# Instructor Bookings

**Route:** `/dashboard/bookings`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/bookings`, `POST /api/bookings`, `PATCH /api/bookings/[id]`, `PATCH /api/bookings/[id]/reschedule`, `POST /api/bookings/[id]/cancel`, `POST /api/bookings/[id]/check-in`, `POST /api/bookings/send-payment-link`

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

**API:** `POST /api/bookings`

**Security:** Price is always calculated server-side (`instructor.hourlyRate × durationHours`). Client-submitted price is ignored.

**Concurrency:** Slot conflict is checked both before and inside `$transaction` to prevent TOCTOU race conditions.

### Client has sufficient wallet balance

Wallet is debited atomically, booking is created as `CONFIRMED` immediately. A receipt email is sent to the student.

### Client wallet is insufficient

API returns `topUpAmount`. Instructor can send a payment link via `POST /api/bookings/send-payment-link` — emails the client a pre-filled wallet top-up link with the lesson price and date.

### Client has no DriveBook account

Booking is created as `PENDING_PAYMENT` without wallet deduction. Student receives a "claim your account" email with a pre-filled registration link. The instructor's clients list shows an amber "No account" badge.

---

## Booking Detail

**Route:** `/dashboard/bookings/[id]`  
**File:** `app/dashboard/bookings/[id]/page.tsx`

Shows: client info, date/time, duration, price, pickup address, notes, status badge.

**Actions:**
- Upcoming CONFIRMED: Reschedule + Edit buttons
- PENDING_PAYMENT: "Send Payment Link" button (disabled after sending)
- Past/completed: Lesson Feedback section

---

## Edit Booking

**Route:** `/dashboard/bookings/[id]/edit`  
**File:** `app/dashboard/bookings/[id]/edit/page.tsx`

Edits pickup address and notes only. Uses `PATCH /api/bookings/[id]`.

Only available on upcoming CONFIRMED bookings. To change date/time/duration, use Reschedule.

---

## Send Payment Link

**API:** `POST /api/bookings/send-payment-link`

Sends the client an email with a pre-filled wallet top-up link. The email shows:
- Lesson cost breakdown
- Platform processing fee
- Total amount to add
- Direct link to `/client-dashboard/wallet?topup=[amount]`

Available from:
- Booking detail page (when `status = PENDING_PAYMENT`)
- Client detail page (`/dashboard/clients/[id]`)

---

## Reschedule

**Route:** `/dashboard/bookings/[id]/reschedule`

**Rules:**
- Cannot reschedule past, completed, or cancelled bookings
- Rescheduling within 24 hours requires confirming a penalty waiver (sets `isNonRefundable = true`)
- Checks availability (excludes current booking from conflict check)
- Syncs Google Calendar if connected

**API:** `PATCH /api/bookings/[id]/reschedule`

---

## Cancel

Refund tiers:
- ≥ 48h notice: 100% refund to client wallet
- 24–48h notice: 50% refund
- < 24h notice: 0% refund
- `isNonRefundable = true`: 0% always

**API:** `POST /api/bookings/[id]/cancel`

---

## Check-In

**File:** `components/mobile/CheckInButton.tsx`

Marks the lesson as started. Supports web (NextAuth session) and mobile (JWT Bearer token).

**Time rules:**
- More than 15 min early → blocked
- More than 24 hours late → blocked, requires support contact
- 15 min to 24 hours late → allowed with `acknowledgeLateCheckIn: true` + reason

If `endTime` has already passed at check-in time, booking is atomically set to `COMPLETED`.

**API:** `POST /api/bookings/[id]/check-in`

---

## Lesson Feedback

After a lesson is completed, the instructor submits PDA-style feedback from the booking detail page.

**API:** `POST /api/instructor/lesson-feedback`

Fields stored on `Booking`:
- `lessonFeedback` — array of PDA feedback codes (integers)
- `studentStrengths` — array of strength codes
- `focusAreas` — array of focus area codes
- `performanceScore` — integer 0–100, calculated from codes
- `instructorNotes` — free text
- `feedbackGivenAt` — timestamp

Feedback is visible to the student on their booking detail page (`/client-dashboard/bookings/[id]`) and on their progress dashboard.

---

## Related

- [CLIENTS.md](./CLIENTS.md) — Client management
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking tracking (PRO+)
- `docs/BOOKING_SYSTEM.md` — Full booking system reference

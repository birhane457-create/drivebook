# Student Bookings

**Route:** `/client-dashboard/bookings`  
**Auth required:** CLIENT role  
**APIs:** `GET /api/client/profile`, `GET /api/client/bookings/[id]`, `PUT /api/client/bookings/[id]/reschedule`, `POST /api/bookings/[id]/cancel`

---

## Booking List

**File:** `app/client-dashboard/bookings/page.tsx`

Shows all bookings for the logged-in student. Each booking card is a link to the booking detail page. Bookings are filterable by:
- Upcoming (CONFIRMED, PENDING, PENDING_PAYMENT)
- Past (COMPLETED, CANCELLED, EXPIRED, NO_SHOW)

Each card shows: instructor name, date, time, duration, price, status badge, pickup address (if set).

**PENDING_PAYMENT bookings** show an amber "Awaiting Payment" banner with a "Complete Payment →" link to `/booking/[id]/payment`.

---

## Booking Detail Page

**Route:** `/client-dashboard/bookings/[id]`  
**File:** `app/client-dashboard/bookings/[id]/page.tsx`  
**API:** `GET /api/client/bookings/[id]`

Full detail view for a single booking. Shows:
- Date, time, duration
- Pickup address
- Price (with package badge if applicable)
- Notes
- Instructor name, phone (tap to call), WhatsApp (if set)
- Status badge with human-readable label
- Lesson feedback / PDA performance score (if completed and instructor submitted feedback)
- Strengths and focus areas from instructor feedback
- Instructor notes

**Context-aware actions:**
- "Leave a Review" — appears on completed bookings where `isReviewed = false`
- "Reschedule" — appears on upcoming bookings with >12h notice remaining
- "Cancel Booking" — appears on upcoming and awaiting-confirmation bookings
- "Complete Payment →" — appears on `PENDING_PAYMENT` bookings

The API is scoped — only returns bookings belonging to the logged-in student's client records. Returns 404 if the booking ID doesn't match.

---

## Booking Statuses

| DB Status | Display Label | Badge |
|-----------|--------------|-------|
| `CONFIRMED` (future) | Upcoming | Green |
| `CONFIRMED` (past endTime) | Completed | Grey |
| `COMPLETED` | Completed | Grey |
| `PENDING` | Awaiting Confirmation | Amber |
| `PENDING_PAYMENT` | Awaiting Payment | Yellow |
| `NO_SHOW` | No Show | Red |
| `CANCELLED` | Cancelled | Red |
| `EXPIRED` | Expired | Grey |

All statuses are now visible to the student. Previously, PENDING, PENDING_PAYMENT, CANCELLED, and EXPIRED were hidden — this has been corrected.

---

## Book a Lesson

**Route:** `/client-dashboard/book-lesson`  
**File:** `app/client-dashboard/book-lesson/page.tsx`

A 5-step wizard for booking lessons using wallet balance:

1. Instructor search — find by name or location
2. Date & slot selection — calendar + available slots
3. Duration & package — single lesson or package
4. Cart review — multiple lessons can be added to cart (max 10)
5. Confirm & pay — deducts from wallet balance

**API:** `POST /api/client/bookings/create-bulk`

The API validates wallet balance ≥ total cart cost before creating any bookings. All bookings in the cart are created atomically — if any slot is taken, the entire cart fails with a 409.

Bookings created this way are immediately `CONFIRMED` (no Stripe payment step — wallet is used directly).

---

## Reschedule

Students can reschedule from the booking detail page.

**Rules:**
- Minimum 12 hours notice required
- Can change date, time, duration, and pickup location
- Duration increase → wallet DEBIT for the price difference
- Duration decrease → wallet CREDIT (refund) for the price difference

**API:** `PUT /api/client/bookings/[id]/reschedule`

---

## Cancel

Students can cancel from the booking detail page.

**Refund tiers** (based on `originalStartTime` to prevent gaming via reschedule):

| Notice | Refund |
|--------|--------|
| ≥ 48 hours | 100% to wallet |
| 24–48 hours | 50% to wallet |
| < 24 hours | 0% |
| `isNonRefundable = true` | 0% always |

Refund is credited to the wallet immediately as a CREDIT transaction.

**API:** `POST /api/bookings/[id]/cancel`

---

## Package Booking from Dashboard

When a student has wallet credits from a package purchase (book later flow), they book individual lessons from `/client-dashboard/book-lesson`. Each lesson deducts from the wallet at the current instructor rate (book-later does not lock the rate).

**API:** `POST /api/client/bookings/create-bulk`

---

## Related

- [WALLET.md](./WALLET.md) — Wallet balance and top-up
- [REVIEWS.md](./REVIEWS.md) — Leaving reviews after lessons
- `docs/06-payments/REFUNDS.md` — Refund policy details
- `docs/BOOKING_SYSTEM.md` — Full booking system reference

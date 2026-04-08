# Student Bookings

**Route:** `/client-dashboard/bookings`  
**Auth required:** CLIENT role  
**APIs:** `GET /api/client/bookings`, `PUT /api/client/bookings/[id]/reschedule`, `POST /api/bookings/[id]/cancel`

---

## Booking List

Shows all bookings for the logged-in student, grouped by status:
- Upcoming (CONFIRMED)
- Pending payment (PENDING_PAYMENT)
- Past (COMPLETED, CANCELLED, EXPIRED, NO_SHOW)

Each booking card shows: instructor name, date/time, duration, price, status badge.

**For completed past bookings:** a "Leave Review" button (yellow star icon) appears. Clicking it opens `ReviewModal` — a star rating (1–5) + comment form. See [REVIEWS.md](./REVIEWS.md) for full details.

**Reschedule button** appears on upcoming bookings. **Cancel button** appears on upcoming bookings.

---

## Book a Lesson

**Route:** `/client-dashboard/book-lesson`  
**File:** `app/client-dashboard/book-lesson/page.tsx`

A 5-step wizard for booking lessons using wallet balance:

1. **Instructor search** — find by name or location
2. **Date & slot selection** — calendar + available slots
3. **Duration & package** — single lesson or package
4. **Cart review** — multiple lessons can be added to cart (max 10)
5. **Confirm & pay** — deducts from wallet balance

**API:** `POST /api/client/bookings/create-bulk`

The API validates wallet balance ≥ total cart cost before creating any bookings. All bookings in the cart are created atomically — if any slot is taken, the entire cart fails with a 409.

Bookings created this way are immediately `CONFIRMED` (no Stripe payment step — wallet is used directly).

---

## Reschedule

Students can reschedule a booking from the booking detail page.

**Rules:**
- Minimum 12 hours notice required
- Can change date, time, duration, and pickup location
- Duration increase → wallet DEBIT for the price difference
- Duration decrease → wallet CREDIT (refund) for the price difference

**API:** `PUT /api/client/bookings/[id]/reschedule`

---

## Cancel

Students can cancel a booking from the booking detail page.

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

## Booking Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Short-notice booking awaiting instructor approval (2hr expiry if not approved) |
| `PENDING_PAYMENT` | Slot held, awaiting Stripe payment (10 min window) |
| `CONFIRMED` | Paid and confirmed |
| `COMPLETED` | Lesson delivered |
| `CANCELLED` | Cancelled |
| `EXPIRED` | Payment not completed in time, or short-notice not approved in time |
| `NO_SHOW` | Marked by admin |

---

## Package Booking from Dashboard

When a student has wallet credits from a package purchase (book later flow), they book individual lessons from `/client-dashboard/book-lesson`. Each lesson deducts from the wallet at the `lockedHourlyRate` stored at package purchase time — not the instructor's current rate.

**API:** `POST /api/client/bookings/create-bulk`

Bookings created this way are immediately `CONFIRMED` — no Stripe step, wallet is debited directly. The API validates:
- Wallet balance ≥ total cart cost
- No slot conflicts (atomic check inside `$transaction`)
- Instructor is active and approved

---

## Related

- [WALLET.md](./WALLET.md) — Wallet balance and top-up
- [REVIEWS.md](./REVIEWS.md) — Leaving reviews after lessons
- `docs/06-payments/REFUNDS.md` — Refund policy details
- `docs/BOOKING_SYSTEM.md` — Full booking system reference



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
- `docs/06-payments/REFUNDS.md` — Refund policy details
- `docs/BOOKING_SYSTEM.md` — Full booking system reference


# Student Dashboard

**Route:** `/client-dashboard`  
**Auth required:** CLIENT role  
**File:** `app/client-dashboard/page.tsx`

---

## What It Shows

- Welcome message with student name
- Wallet balance (quick view)
- Upcoming bookings (next 3)
- Progress summary (lessons completed, hours logged)
- Quick action buttons: Book a Lesson, Top Up Wallet, View Progress

---

## Navigation

The student dashboard uses a bottom navigation bar (`components/client/MobileBottomNav.tsx`) on mobile with tabs:
- Home
- Book
- Bookings
- Wallet
- Progress

---

## Progress Page

**Route:** `/client-dashboard/progress`  
**File:** `app/client-dashboard/progress/page.tsx`

Re-exports from `/dashboard/progress/page`. Calls `GET /api/client/my-performance` to fetch:
- Total lessons completed
- Total hours driven
- Performance scores per lesson
- Instructor feedback codes (PDA categories)
- Strengths and focus areas

---

## Help Page

**Route:** `/client-dashboard/help`  
**File:** `app/client-dashboard/help/page.tsx`

Static FAQ accordion with 6 categories:
1. Booking & Scheduling
2. Payments & Wallet
3. Cancellations & Refunds
4. Instructor & Lessons
5. Account & Profile
6. Technical Issues

Includes a contact section linking to `drivebook.com.au/contact`.

---

## Related

- [WALLET.md](./WALLET.md) — Wallet top-up and balance
- [BOOKINGS.md](./BOOKINGS.md) — Booking management
- [SETTINGS.md](./SETTINGS.md) — Profile settings

# Student Reviews

**Auth required:** CLIENT role  
**API:** `POST /api/bookings/[id]/review`

---

## Leaving a Review

After a lesson is `COMPLETED`, the student can leave a star rating (1–5) and optional text review.

Stored on the `Booking` model:
- `clientRating` — integer 1–5
- `clientReview` — text (optional)
- `reviewGivenAt` — timestamp

Reviews can only be submitted once per booking. The review form is shown on the booking detail page after the lesson is completed.

---

## Where Reviews Appear

- Instructor's public profile (`/book/[instructorId]`)
- Instructor's subdomain page (`/subdomain/[slug]`)
- Instructor's `averageRating` and `totalReviews` fields are updated on the `Instructor` model when a review is submitted

---

## Admin Moderation

Admins can view and manage reviews via `/admin/reviews`. Reviews are not deleted — they can be flagged or hidden by admin action.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking lifecycle
- `docs/03-instructor/DASHBOARD.md` — How instructors see their ratings


# Student Settings

**Route:** `/client-dashboard/settings`  
**Auth required:** CLIENT role  
**API:** `PATCH /api/client/profile`

---

## What Can Be Updated

- Display name
- Phone number
- Default pickup address (saved for future bookings)
- Password change (requires current password)
- Email notifications preferences

---

## Account Deletion

Students can request account deletion from the settings page. This triggers a support email — accounts are not deleted automatically due to financial record retention requirements.

---

## Terms Acceptance

The `User` model tracks:
- `termsAcceptedAt` — when the student accepted the terms
- `termsVersion` — which version they accepted (e.g. `"1.0"`)
- `ageDeclaration` — boolean confirming they are 16+

These are set at registration and shown in the settings page for reference.

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Student home
- `app/terms/page.tsx` — Terms of Service
- `app/privacy/page.tsx` — Privacy Policy


# Student Wallet

**Route:** `/client-dashboard/wallet`  
**Auth required:** CLIENT role  
**APIs:** `GET /api/client/wallet/summary`, `POST /api/client/wallet-topup-intent`

---

## Purpose

The wallet holds pre-paid credit that students use to book lessons via the client dashboard. It is funded by Stripe payments (top-ups or package purchases).

---

## Balance Calculation

Balance is never stored as a field. It is always computed:

```
balance = SUM(CONFIRMED CREDIT transactions) − SUM(CONFIRMED DEBIT transactions)
```

The `GET /api/client/wallet/summary` endpoint returns:
- `balance` — current available balance
- `transactions` — recent wallet transaction history

---

## Top-Up

Students can add funds directly to their wallet:

1. Student enters a top-up amount (min $10, max $500 — configurable via `/admin/pricing`)
2. Calls `POST /api/client/wallet-topup-intent` → creates a PENDING `WalletTransaction`, then creates a Stripe PaymentIntent
3. If Stripe fails, the PENDING transaction is deleted immediately (no orphaned records)
4. Stripe Elements collects card details
5. On `payment_intent.succeeded` webhook:
   - Validates `amount_received` matches the PENDING transaction amount (rejects if mismatch)
   - Confirms the transaction to `CONFIRMED`
   - Balance is immediately available
   - **Receipt email sent** — `sendWalletTopUpReceipt()` fires showing credits added, previous balance, new balance with approx hours remaining

**URL shortcut:** `/client-dashboard/wallet?topup=XX.XX` — pre-fills the top-up amount. Used by the "Send Payment Link" feature when an instructor books on behalf of a client with insufficient balance.

---

## Wallet Transactions

Each transaction has:
- `amount` — AUD value
- `type` — `CREDIT` or `DEBIT`
- `description` — human-readable reason (e.g. "Lesson payment — John Smith", "Wallet top-up")
- `status` — `PENDING` or `CONFIRMED`

**CREDIT sources:**
- Stripe top-up
- Package purchase (full package amount credited on payment)
- Lesson cancellation refund (partial or full, depending on notice period)
- Admin manual credit

**DEBIT sources:**
- Lesson booking (per lesson)
- Lesson price increase on reschedule (duration extended)

---

## Package Flow

When a student purchases a package via the public booking form or subdomain:

**Book Later (no slot selected):**
1. `POST /api/public/bookings/bulk` with `bookingType: later`
2. No booking record created — only a `WalletTransaction (PENDING)` for the full package amount
3. Returns `{ transactionId }` — payment page opens at `/payment/wallet/[transactionId]`
4. On `payment_intent.succeeded` webhook: transaction confirmed to `CONFIRMED`
5. Wallet balance immediately available — student books lessons from dashboard
6. Receipt email sent

**Book Now (slot selected):**
1. `POST /api/public/bookings/bulk` with `bookingType: now` + scheduled slots
2. Booking created (`PENDING_PAYMENT`), slot held for 10 minutes
3. Returns `{ bookingId }` — payment page at `/booking/[id]/payment`
4. On `payment_intent.succeeded` webhook:
   - Wallet CREDITED with `packageTotalPaid`
   - Wallet DEBITED with `booking.price` (first lesson)
   - Remaining balance available for future lessons
5. Receipt email sent

**Rate & discount locking:**
At package purchase time, `lockedHourlyRate` and `lockedDiscountPct` are stored on the booking record. When the student later books individual lessons from the package, the deduction uses `lockedHourlyRate` — not the instructor's current rate.

**Wallet top-up (not yet booked):**
A plain wallet top-up is just money — no rate is locked. If the instructor changes their rate between the top-up and the booking, the booking uses the current rate at booking time.

---

## Limits

| Setting | Default | Configurable |
|---------|---------|-------------|
| Min top-up | $10 | Yes — `/admin/pricing` |
| Max top-up | $500 | Yes — `/admin/pricing` |

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — How wallet is debited on booking
- `docs/06-payments/WALLET.md` — Technical wallet mechanics
- `docs/06-payments/REFUNDS.md` — Refund policy

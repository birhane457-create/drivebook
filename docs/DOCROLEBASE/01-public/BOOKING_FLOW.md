# Public Booking Flow

**Routes:** `/book` and `/book/[instructorId]`  
**Auth required:** No  
**Files:** `app/book/page.tsx`, `app/book/[instructorId]/page.tsx`, `components/BulkBookingForm.tsx`

---

## Step 1 — Location Search (`/book`)

The entry point for new students. No API calls on this page.

**What it shows:**
- Location search input (Google Maps autocomplete)
- "Find Instructors Near Me" CTA
- Brief value proposition copy

**What it does:**
- On submit, redirects to `/book?location=...&lat=...&lng=...` or directly to an instructor profile if only one result

---

## Step 2 — Instructor Profile (`/book/[instructorId]`)

**API calls:**
- `GET /api/availability/slots?instructorId=&date=&duration=` — fetches available time slots
- `GET /api/public/bookings` — checks existing bookings for conflict display
- `POST /api/payments/create-intent` — called after form submission

**What it shows:**
- Instructor name, photo, rating, years experience, car details, languages
- Hourly rate and available lesson durations (from `instructor.allowedDurations`)
- Package pricing (6h, 10h, 15h discounts) + instructor custom add-on packages
- Available time slots via `SlotPicker` component
- `BulkBookingForm` — the main booking form

### BulkBookingForm

A multi-step form (`components/BulkBookingForm.tsx`) that handles:

1. **Package selection** — standard packages (6/10/15 hrs with platform discounts) + optional instructor add-on packages (fixed price, no platform discount)
2. **Book Now / Book Later** — student chooses whether to schedule now or load wallet and book from dashboard
3. **Schedule** (Book Now only) — date picker + slot grid + duration selector. Slots are duration-aware — a 3hr slot at 9am is blocked if 10am is already booked. Local overlap check prevents scheduling two lessons that overlap.
4. **Client details** — name, email, phone, pickup address
5. **Password creation** — for new users only (min 6 chars)
6. **Review & confirm** — price breakdown with order summary

**Instructor add-on packages:**
- Set by instructor in Settings → Custom Lesson Packages
- Fixed price — no platform bulk discount applied
- Shown as optional checkboxes below standard packages
- Can be combined with a standard package or selected alone
- `customPackageId` sent in booking payload; server looks up price from DB

**Pricing calculation (client-side preview):**
```
standardLesson = instructor.hourlyRate × hours × (1 − discountPct/100)
addonPackage   = pkg.price (fixed, no discount)
platformFee    = (standardLesson + addonPackage) × platformFeePercentage/100
total          = standardLesson + addonPackage + platformFee
```
Discount rates and platform fee fetched live from `GET /api/public/pricing` (sourced from `PlatformSettings` in DB). Configurable via `/admin/pricing`.

**Rate & discount locking:**

| Scenario | Rate used | Locked? |
|----------|-----------|---------|
| Buy package + book all slots now | `instructor.hourlyRate` at purchase time | Yes — stored as `lockedHourlyRate` + `lockedDiscountPct` on `Booking` |
| Buy package + book later (wallet top-up) | `instructor.hourlyRate` at time of each individual booking | No — wallet is plain money |
| Already-confirmed booking | `booking.price` (immutable after creation) | Yes — field never updated |

When `bookingType: now`, `lockedHourlyRate` and `lockedDiscountPct` are stored on the `Booking` record at creation. Instructor rate changes after purchase have zero effect on these bookings.

When `bookingType: later`, the wallet is credited with the package amount but no rate is locked. When the student later books individual lessons from their dashboard (`POST /api/client/bookings/create-bulk`), the server fetches the instructor's current `hourlyRate` and recalculates the price — client-submitted prices are ignored entirely.

**Slot blocking during scheduling (Book Now):**
When the student selects a time slot in the schedule step, `BookingDetailsForm` calls `POST /api/availability/check-and-reserve` before adding the slot. This places a 10-minute in-memory reservation on the slot, preventing another concurrent session from claiming it. If the slot is already reserved, returns 409 and the form refreshes available slots. Reservations are released on slot removal and component unmount. The 10-minute window matches the `PENDING_PAYMENT` booking expiry.

---

## Step 3 — Booking Creation

On form submit, calls `POST /api/public/bookings/bulk`.

**What the API does:**
1. Rate-limits by IP + email + instructorId
2. Validates instructor exists, is approved, and is not suspended
3. Checks if email already has an account:
   - New user → creates `User` with hashed password
   - Existing user → links booking to their account
4. Finds or creates a `Client` record for this instructor
5. Calculates pricing **server-side** — client-submitted total is validated against server calculation (rejects if >$0.01 difference)

**Book Later path (`bookingType: later`):**
- No booking record created
- Creates a `WalletTransaction (PENDING)` for the full package amount
- Returns `{ transactionId }` — no `bookingId`
- Payment page: `/payment/wallet/[transactionId]` (opens in new tab from subdomain)
- On payment success: webhook confirms the wallet transaction → balance available immediately
- Student books individual lessons from their dashboard using wallet credits

**Book Now path (`bookingType: now`):**
- Atomic slot claim — conflict check + booking create in a single `$transaction`
- Creates booking with `status: PENDING_PAYMENT` — holds slot for 10 minutes
- Returns `{ bookingId, total }`
- Payment page: `/booking/[id]/payment`

**On 409 (slot taken):** "This slot was just taken — please choose another time"

**On 409 (price changed):** server recalculates at submission time. If client total differs by >$0.01, returns `{ serverTotal }`. Wizard shows updated price and asks student to confirm.

---

## Step 4 — Payment

**From subdomain:** payment page opens in a **new blank tab** — the subdomain page stays open underneath. The wizard shows "Payment page opened!" with a "Start a new booking" option.

**From public flow:** student is redirected to the payment page in the same tab.

**Book Now payment page** (`/booking/[id]/payment`):
- Fetches booking from `/api/public/bookings/[id]`
- Uses `lockedHourlyRate` and `lockedDiscountPct` stored on the booking for the price breakdown
- Calls `POST /api/payments/create-intent` with `{ bookingId, amount }`
- On success: Stripe redirects to `/booking/[id]/confirmation`

**Book Later payment page** (`/payment/wallet/[transactionId]`):
- Calls `POST /api/payments/create-intent` with `{ transactionId }`
- Shows "Your wallet will be credited with $X"
- On success: Stripe redirects to `/payment/wallet/[transactionId]/confirmation`
- Confirmation page links to client dashboard and book-lesson page

**Receipt email:** fires from the Stripe webhook after `payment_intent.succeeded`.

---

## Slot Expiry

If the client does not complete payment within 10 minutes, the cron job (`/api/cron/cleanup-expired-bookings`) sets the booking to `EXPIRED` and releases the slot.

Short-notice `PENDING` bookings (awaiting instructor approval) expire after 2 hours if the instructor has not approved.

If the client returns to the payment page after expiry, they see a "Slot Expired — Go Back & Rebook" screen.

---

## Rate Limiting

All public booking endpoints use `bulkBookingRateLimit` + `checkRateLimitStrict`:
- Identifier: `bulk-booking:{email}:{instructorId}` + IP
- Exceeding limit → 429 with `X-RateLimit-*` headers
- Strict mode: fails closed if the rate limiter itself fails (financial endpoint protection)

---

## Production Checklist

Before going live with public bookings:
- [ ] `STRIPE_WEBHOOK_SECRET` set to real value from Stripe Dashboard
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set for real rate limiting (falls back to in-memory in dev)
- [ ] Test full flow: search → instructor → package → register → pay → confirm
- [ ] Verify wallet credit + debit after webhook fires

---

## Related

- [PAYMENT_PAGE.md](./PAYMENT_PAGE.md) — Step 4: Stripe payment
- [SUBDOMAIN_PAGE.md](./SUBDOMAIN_PAGE.md) — Alternative entry via instructor's branded page
- `docs/BOOKING_SYSTEM.md` — Full booking system reference
- `docs/PUBLIC_BOOKING_FLOW.md` — Voice service + rate limiting deep dive



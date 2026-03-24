# Payment Page

**Route:** `/booking/[id]/payment`  
**Auth required:** No  
**File:** `app/booking/[id]/payment/page.tsx`

---

## Purpose

Collects Stripe payment for a booking that is in `PENDING_PAYMENT` status. The slot is held for 10 minutes from booking creation.

---

## Page Load

1. Fetches booking via `GET /api/public/bookings/[id]`
2. Checks `booking.status`:
   - `EXPIRED` → shows "Slot Expired" screen with a back button — no payment form rendered
   - `CONFIRMED` (already paid) → redirects to confirmation page
   - `PENDING_PAYMENT` → proceeds to payment form
3. Calls `POST /api/payments/create-intent` with `{ bookingId }` to get a Stripe `clientSecret`

**Charge amount:** `booking.packageTotalPaid || booking.price`
- Package bookings: `packageTotalPaid` (full package amount, e.g. $600 for 10 hours)
- Single lesson: `booking.price` (1hr × hourlyRate)

---

## Payment Intent Reuse

The API reuses an existing `paymentIntentId` only if its Stripe status is one of:
- `requires_payment_method`
- `requires_confirmation`
- `requires_action`
- `processing`

Any other status (expired, cancelled, failed) → creates a fresh intent.

---

## Stripe Elements

The page renders Stripe's `PaymentElement` component. On submit:
1. Stripe confirms the payment
2. On success → Stripe redirects to the `return_url` (confirmation page)
3. The Stripe webhook (`payment_intent.succeeded`) fires asynchronously and:
   - Sets `booking.status → CONFIRMED`
   - Sets `booking.isPaid = true`, `paymentCaptured = true`
   - Credits the client wallet with `packageTotalPaid`
   - Debits the wallet for the first lesson (`booking.price`)
   - Sends in-app notification to instructor

---

## Countdown Timer

The page shows a countdown from the booking's `createdAt + 10 minutes`. When it hits zero, the page refreshes and shows the expired state.

---

## Commission Applied

At payment intent creation, the API:
1. Fetches the instructor's `subscriptionTier`
2. Calls `getCommissionRate(tier)` from `lib/services/platform-pricing.ts`
3. Stores the rate in Stripe metadata for auditability
4. Calculates `platformFee` and `instructorPayout` and stores on the booking

---

## Related

- [BOOKING_FLOW.md](./BOOKING_FLOW.md) — Steps 1–3 (search → booking creation)
- `docs/06-payments/STRIPE.md` — Stripe configuration
- `docs/06-payments/WALLET.md` — Wallet credit mechanics

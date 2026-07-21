# Payment Pages

There are **two separate payment pages** in the platform. They share the same Stripe integration but serve different flows.

---

## 1. SMS-Link Payment Page

**Route:** `/booking/[id]/payment`  
**Auth required:** No (uses `?token=` payment token)  
**File:** `app/booking/[id]/payment/page.tsx`

### Purpose

Collects Stripe payment for a booking in `PENDING_PAYMENT` status. Used when students arrive via SMS/email link (voice AI flow, instructor-created bookings, send-payment-link).

### Page Load

1. Fetches booking via `GET /api/public/bookings/[id]?token=...`
2. Checks `booking.status`:
   - `EXPIRED` → shows "Slot Expired" screen — no payment form rendered
   - `CONFIRMED` (already paid) → redirects to confirmation page
   - `PENDING_PAYMENT` → proceeds to payment form
3. Calls `POST /api/payments/create-intent` with `{ bookingId, paymentToken }` to get a Stripe `clientSecret`

**Charge amount:** `booking.packageTotalPaid || booking.price`

### Stripe Elements

Uses Stripe's `PaymentElement` (single unified component). On submit:
1. `stripe.confirmPayment()` is called with a `return_url` — handles 3DS via redirect automatically
2. Stripe redirects to `/booking/[id]/confirmation?redirect_status=succeeded`
3. The webhook (`payment_intent.succeeded`) fires asynchronously and confirms the booking

### Countdown Timer

Shows a countdown from `booking.createdAt + 10 minutes`. When it hits zero, shows the expired state.

---

## 2. Wizard Payment Page

**Route:** `/book/[instructorId]/payment`  
**Auth required:** No (unauthenticated guest checkout)  
**File:** `app/book/[instructorId]/payment/page.tsx`

### Purpose

Final step of the multi-step public booking wizard (`/book/[instructorId]/...`). Used by students booking directly from the website.

### Payment Flow

1. `POST /api/public/bookings/bulk` → creates booking in `PENDING_PAYMENT`, returns `bookingId`
2. `POST /api/payments/create-intent` with `{ bookingId, amount }` → returns `clientSecret`
3. `stripe.confirmCardPayment(clientSecret)` — uses split card fields (`CardNumberElement`, `CardExpiryElement`, `CardCvcElement`)
4. On `paymentIntent.status === 'succeeded'` → redirect to `/booking/{id}/confirmation`
5. On `paymentIntent.status === 'requires_action'` → calls `stripe.handleNextAction({ clientSecret })` for 3DS (fixed July 2026)
6. On `paymentIntent.status === 'processing'` → redirect to confirmation with `?payment=processing`

### Key Differences from SMS-Link Page

| | SMS-Link (`/booking/[id]/payment`) | Wizard (`/book/[instructorId]/payment`) |
|---|---|---|
| Stripe component | `PaymentElement` (unified) | `CardNumberElement` + `CardExpiryElement` + `CardCvcElement` (split) |
| 3DS handling | Via `return_url` redirect (automatic) | Via `stripe.handleNextAction()` (explicit) |
| Booking pre-exists | Yes (created by instructor or voice AI) | No — wizard creates it at payment time |
| Auth | Payment token in URL | None (guest checkout) |
| Book Later | Not applicable | Handled — bulk API returns `checkoutUrl` for wallet top-up; wizard uses separate PaymentIntent path via `transactionId` |

---

## Commission Applied (both pages)

At payment intent creation:
1. Instructor's `subscriptionTier` fetched
2. `getCommissionRate(tier)` called from `lib/services/platform-pricing.ts`
3. Commission rate stored in Stripe metadata
4. `platformFee` and `instructorPayout` stored on the booking

---

## Post-Payment (both pages)

The Stripe webhook (`payment_intent.succeeded`) fires for both pages and:
- Sets `booking.status → CONFIRMED`
- Sets `booking.isPaid = true`
- Credits the client wallet with `packageTotalPaid`
- Debits the wallet for the first lesson (`booking.price`)
- Sends in-app notification to instructor

---

## Related

- `docs/01-public/BOOKING_FLOW_COMPLETE.md` — Full wizard booking flow
- `docs/06-payments/STRIPE.md` — Stripe configuration
- `docs/06-payments/WALLET.md` — Wallet credit mechanics

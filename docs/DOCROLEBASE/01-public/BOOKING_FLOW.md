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
- Hourly rate and available lesson durations
- Package pricing (6h, 10h, 15h discounts)
- Available time slots via `SlotPicker` component
- `BulkBookingForm` — the main booking form

### BulkBookingForm

A multi-step form (`components/BulkBookingForm.tsx`) that handles:

1. **Slot selection** — date picker + slot grid
2. **Package selection** — single lesson or package (6/10/15 hours)
3. **Client details** — name, email, phone, pickup address
4. **Existing email handling** — if the email already has a DriveBook account, shows a warning:
   - "Login to my account" → redirects to `/login`
   - "Continue anyway" → proceeds, booking linked to existing account
5. **Password creation** — for new users only (min 6 chars)
6. **Review & confirm** — price breakdown, terms acceptance

**Pricing calculation (client-side preview):**
```
singleLesson = instructor.hourlyRate × duration
package6     = (hourlyRate × 6) × (1 − 0.05)   // 5% discount
package10    = (hourlyRate × 10) × (1 − 0.10)  // 10% discount
package15    = (hourlyRate × 15) × (1 − 0.12)  // 12% discount
```
Discounts are configurable via `/admin/pricing` → `PlatformSettings`.

---

## Step 3 — Booking Creation

On form submit, calls `POST /api/public/bookings/bulk`.

**What the API does:**
1. Rate-limits by IP + email + instructorId
2. Validates instructor exists and is active
3. Checks if email already has an account:
   - New user → creates `User` with hashed password
   - Existing user → links booking to their account
4. Finds or creates a `Client` record for this instructor
5. Calculates pricing (first lesson price + package total)
6. **Atomic slot claim** — conflict check + booking create in a single `$transaction`. Concurrent requests for the same slot get a 409.
7. Creates booking with `status: PENDING_PAYMENT` — holds slot for 10 minutes
8. Returns `{ bookingId, total }`

**On success:** redirects to `/booking/[id]/payment`

**On 409 (slot taken):** shows "This slot was just taken — please choose another time"

---

## Step 4 — Payment

After booking creation, student is redirected to `/booking/[id]/payment` which renders Stripe Elements.

On payment success, the confirmation page calls `POST /api/payments/verify` to confirm the booking if the Stripe webhook hasn't fired yet (common in local dev, rare in production). This endpoint also handles wallet crediting for package bookings.

**Receipt email:** `sendSingleLessonReceipt()` or `sendPackagePurchaseReceipt()` fires from the Stripe webhook after `payment_intent.succeeded` — not from the verify endpoint.

---

## Slot Expiry

If the client does not complete payment within 10 minutes, the cron job (`/api/cron/cleanup-expired-bookings`) sets the booking to `EXPIRED` and releases the slot.

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

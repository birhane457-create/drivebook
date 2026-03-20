# DriveBook Booking System — Full Reference

**Last Updated:** March 2026 (revised — concurrency & edge-case hardening)  
**Scope:** All booking surfaces — public subdomain, client dashboard, instructor dashboard, admin dashboard  

---

## 1. Booking Status Lifecycle

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
  [Subdomain]       │                                                     ▼
  POST /api/public/bookings/bulk ──► PENDING_PAYMENT ──(10 min timeout)──► EXPIRED
                                          │
                                          │ Stripe payment_intent.succeeded
                                          ▼
  [Instructor / Client / Admin] ──────► CONFIRMED ──────────────────────► COMPLETED
  POST /api/bookings                        │                                  ▲
  POST /api/client/bookings/create-bulk     │ cancel                           │
  POST /api/admin/bookings                  ▼                                  │
                                       CANCELLED                          (manual / auto)
                                                                               │
                                       NO_SHOW ◄──── admin PATCH ─────────────┘
```

**Status meanings:**

| Status | Meaning |
|---|---|
| `PENDING_PAYMENT` | Slot reserved, awaiting Stripe payment (max 10 min) |
| `PENDING` | Created but not yet confirmed (legacy / manual flows) |
| `CONFIRMED` | Paid and confirmed — slot is locked |
| `COMPLETED` | Lesson delivered |
| `CANCELLED` | Cancelled by instructor, client, or admin |
| `EXPIRED` | `PENDING_PAYMENT` not paid within 10 min — cron releases slot |
| `NO_SHOW` | Admin-tagged, or auto-set by cron 3h after end time with no check-in |

---

## 2. Public / Subdomain Booking (no auth required)

### Entry Points
- `app/subdomain/[slug]/page.tsx` — instructor's public booking page
- `components/BulkBookingForm.tsx` — the booking form component

### Step 1 — Form Submission → `POST /api/public/bookings/bulk`

**File:** `app/api/public/bookings/bulk/route.ts`

**What it does:**
1. Rate-limits by IP + email + instructorId
2. Validates instructor exists
3. Checks if email already has a DriveBook account:
   - **New user:** requires password (min 6 chars), creates `User` with hashed password
   - **Existing user:** links booking to their account — no password change
4. Finds or creates a `Client` record linked to the instructor
5. Calculates pricing:
   - `booking.price` = `instructor.hourlyRate × 1hr` (first lesson only)
   - `booking.packageTotalPaid` = `data.pricing.total` (full Stripe charge amount)
6. **Atomic slot claim (race-condition safe):** conflict check AND booking create run inside a single `$transaction`. If two requests race for the same slot, the second sees the first's `PENDING_PAYMENT` row and receives a 409.
7. Creates booking with `status: 'PENDING_PAYMENT'` — holds the slot for up to 10 minutes
8. Returns `{ bookingId, total }` — `total` is the full package amount for Stripe

**Existing email handling (BulkBookingForm.tsx):**  
If the submitted email already exists in the system, the form shows a warning with two explicit choices:
- "Login to my account" — redirects to login
- "Continue anyway" — proceeds with booking linked to existing account

### Step 2 — Payment Page

**File:** `app/booking/[id]/payment/page.tsx`  
**API:** `GET /api/public/bookings/{id}` → returns `packageTotalPaid || booking.price` as the charge amount  
**API:** `POST /api/payments/create-intent`

The payment page fetches the booking, then calls `create-intent` with the `bookingId`. The intent is created for `packageTotalPaid` (the full package amount), not `booking.price` (the first lesson).

Intent reuse logic: an existing `paymentIntentId` is reused only if its Stripe status is `requires_payment_method`, `requires_confirmation`, `requires_action`, or `processing`. Any other status (including stale/failed states) triggers a fresh intent.

### Step 3 — Stripe Webhook → `POST /api/stripe/webhook`

**File:** `app/api/stripe/webhook/route.ts`

On `payment_intent.succeeded`:
1. Verifies webhook signature
2. Idempotency check via `WebhookEvent` table
3. **EXPIRED booking recovery:** if the cron expired the slot just before the webhook arrived, the booking is revived to `CONFIRMED` — Stripe already charged the client so the payment must be honoured. Already-`CONFIRMED` replays are silently skipped.
4. Validates `paymentIntent.amount_received` matches `packageTotalPaid || booking.price` (in cents)
5. Updates booking: `status → CONFIRMED`, `isPaid = true`, `paymentCaptured = true`
6. **Wallet operations (package flow):**
   - CREDIT wallet = `packageTotalPaid` (full amount client paid via Stripe)
   - DEBIT wallet = `booking.price` (first lesson, 1hr × hourlyRate)
   - Remaining balance = available for future lessons from client dashboard
7. Sends in-app notification to instructor

### Step 4 — Slot Expiry Cron

**File:** `app/api/cron/cleanup-expired-bookings/route.ts`  
**Schedule:** Every 5 minutes (Vercel Cron)

- Finds all `PENDING_PAYMENT` bookings older than 10 minutes → sets to `EXPIRED`
- Finds all `PENDING` wallet transactions older than 10 minutes → sets to `EXPIRED`
- Auto-completes `CONFIRMED` bookings with a check-in recorded that ended 2+ hours ago → `COMPLETED`
- Auto-marks `NO_SHOW` for `CONFIRMED` bookings with no check-in that ended 3+ hours ago
- Secured by `CRON_SECRET` bearer token

---

## 3. Client Dashboard Booking (CLIENT session required)

### Entry Point
- `app/client-dashboard/book-lesson/page.tsx`

### Create Bookings → `POST /api/client/bookings/create-bulk`

**File:** `app/api/client/bookings/create-bulk/route.ts`

**What it does (inside a single DB transaction):**
1. Authenticates via NextAuth session
2. Rate-limits by userId + IP
3. Validates cart (max 10 items, no duplicate slots in same cart)
4. Calculates wallet balance from `CONFIRMED` wallet transactions (credits − debits)
5. Checks total cart cost ≤ wallet balance
6. For each cart item:
   - Checks for existing `PENDING`, `PENDING_PAYMENT`, or `CONFIRMED` conflicts (all three block the slot)
   - Calculates commission (15% platform / 85% instructor; 10%/90% for first booking)
   - Creates booking with `status: 'CONFIRMED'`, `isPaid: true`
   - Records ledger entries
   - Creates `BOOKING_PAYMENT` transaction record
7. Creates a single DEBIT wallet transaction for the total cart cost
8. Returns `{ bookings, totalCost, remainingBalance }`

After the transaction, fires in-app notifications to instructor and client.

### Reschedule → `PUT /api/client/bookings/{id}/reschedule`

**File:** `app/api/client/bookings/[id]/reschedule/route.ts`

- Minimum 12 hours notice required
- Supports changing date, time, duration, and pickup location
- Duration increase → DEBIT wallet for the price difference
- Duration decrease → CREDIT wallet (refund) for the price difference
- Sends reschedule notifications to both parties

---

## 4. Instructor Dashboard Booking (INSTRUCTOR session + active subscription required)

### Create Booking → `POST /api/bookings`

**File:** `app/api/bookings/route.ts`

**What it does:**
1. Requires active subscription (`requireActiveSubscription`)
2. Rate-limits by instructorId + IP
3. Validates booking window (admin-configured min advance hours / max advance days)
4. Verifies client belongs to this instructor
5. Checks client has a DriveBook account (`client.userId` must exist)
6. Checks wallet balance ≥ lesson price (re-checked inside transaction)
7. Inside `$transaction`:
   - Creates DEBIT wallet transaction
   - Creates booking with `status: 'CONFIRMED'`, `isPaid: true`
   - Creates `BOOKING_PAYMENT` transaction record
8. Syncs to Google Calendar if instructor has it enabled
9. Sends in-app notification to instructor

**Insufficient balance response** includes `topUpAmount` (shortfall + platform fee) so the instructor can send a payment link.

### Send Payment Link → `POST /api/bookings/send-payment-link`

**File:** `app/api/bookings/send-payment-link/route.ts`

When a client's wallet is short, the instructor can trigger this endpoint. It emails the client a pre-filled wallet top-up link (`/client-dashboard/wallet?topup=XX.XX`) with a breakdown of lesson cost + platform fee.

### Reschedule → `PATCH /api/bookings/{id}/reschedule`

**File:** `app/api/bookings/[id]/reschedule/route.ts`

- Instructor-only (must own the booking)
- Cannot reschedule past bookings or completed/cancelled ones
- **24-hour penalty window:** if the current booking starts within 24 hours, the frontend must send `confirmedPenaltyWaiver: true` — the booking is then marked `isNonRefundable = true` and the instructor's `policyExceptionCount` is incremented
- Checks availability (excludes current booking from conflict check)
- Syncs Google Calendar update
- Sends reschedule notifications to both parties

### Cancel → `POST /api/bookings/{id}/cancel`

**File:** `app/api/bookings/[id]/cancel/route.ts`

Accessible by instructor, client, or admin.

**Refund tiers** (based on `originalStartTime` to prevent gaming via reschedule):

| Notice | Refund |
|---|---|
| ≥ 48 hours | 100% |
| 24–48 hours | 50% |
| < 24 hours | 0% |
| `isNonRefundable = true` | 0% always |
| Past booking | 0% |

Refund is credited to client wallet as a CREDIT wallet transaction. Booking and transaction records are updated atomically. Emails sent to both client and instructor. Google Calendar event deleted if connected.

### Confirm → `POST /api/bookings/{id}/confirm`

**File:** `app/api/bookings/[id]/confirm/route.ts`

Manual confirmation for `PENDING` or `PENDING_PAYMENT` bookings. Used when the Stripe webhook fails or for manual approval workflows. Checks for slot conflicts before confirming. Sends SMS + in-app notifications.

### Check-In → `POST /api/bookings/{id}/check-in`

**File:** `app/api/bookings/[id]/check-in/route.ts`

Supports both web (NextAuth) and mobile (JWT Bearer token).

**Time rules (fraud prevention):**
- More than 15 min early → blocked
- More than 24 hours late → blocked, requires support contact
- 15 min to 24 hours late → allowed but requires `acknowledgeLateCheckIn: true` + `lateCheckInReason` (min 10 chars)

Uses `updateMany` with `checkInTime: null` condition for idempotency — prevents double check-in. If `endTime` has already passed at check-in time, the booking is atomically set to `COMPLETED` in the same update. Sends SMS to the other party (non-blocking).

### Update Booking → `PATCH /api/bookings/{id}`

**File:** `app/api/bookings/[id]/route.ts`

Allows editing time, price, status, notes. On price change, creates a wallet adjustment transaction (DEBIT or CREDIT) for the difference.

---

## 5. Admin Dashboard Booking (ADMIN / SUPER_ADMIN required)

**File:** `app/api/admin/bookings/route.ts`

### List Bookings → `GET /api/admin/bookings`

Filters: `status`, `from` (date), `to` (date), `search` (client name/email/instructor name/booking ID).  
Returns up to 200 bookings + stats: total, confirmed, pending, completed, cancelled, noShow, endedConfirmed.

### Force Status Change → `PATCH /api/admin/bookings`

Allows admin to force any booking to: `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `PENDING`.  
On `NO_SHOW`, optionally tags the transaction with `INSTRUCTOR_NO_SHOW`, `CLIENT_NO_SHOW`, or `DISPUTED` for payout surfacing.

### Create Booking on Behalf of Client → `POST /api/admin/bookings`

Requires `clientId`, `instructorId`, `startTime`, `endTime`. Checks client wallet balance (uses stored `balance` field). Deducts from wallet and creates booking as `CONFIRMED`.

---

## 6. Availability Service

**File:** `lib/services/availability.ts`

### `getAvailableSlots(instructorId, date, lessonDurationMinutes)`

1. Fetches instructor's `workingHours` for the day
2. Fetches existing bookings with status `PENDING`, `PENDING_PAYMENT`, or `CONFIRMED`
3. Fetches PDA tests — blocks 2 hours before + 1 hour after each test
4. Fetches `AvailabilityException` records for the day
5. Generates slots every 30 minutes within working hours, skipping any that conflict

### `checkDoubleBooking(instructorId, startTime, endTime, excludeBookingId?)`

Queries for any `PENDING`, `PENDING_PAYMENT`, or `CONFIRMED` booking that overlaps the given window. Returns `true` if a conflict exists. Used before every booking creation.

---

## 7. Payment Intent Creation

**File:** `app/api/payments/create-intent/route.ts`

Two paths:

**`bookingId` path (book now):**
- Fetches booking, checks not already paid
- Reuses existing `paymentIntentId` only if Stripe status is `requires_payment_method`, `requires_confirmation`, `requires_action`, or `processing` — any other status creates a fresh intent
- Creates new Stripe PaymentIntent with `bookingId` in metadata
- Stores `paymentIntentId` on booking

**`transactionId` path (wallet top-up / book later):**
- Fetches `WalletTransaction`, checks not already `CONFIRMED`
- Creates PaymentIntent with `transactionId` + `walletId` in metadata
- Webhook confirms the wallet transaction on success

---

## 8. Key Business Rules

### Wallet Balance
Balance is never stored as a field — it is always computed:
```
balance = SUM(CONFIRMED CREDIT transactions) − SUM(CONFIRMED DEBIT transactions)
```

### Package Booking (Subdomain)
```
Stripe charges:  packageTotalPaid  (e.g. $600 for 10 hours)
Wallet CREDIT:   packageTotalPaid  ($600)
Wallet DEBIT:    booking.price     ($60 — 1hr × hourlyRate)
Remaining:       $540 — available for future lessons from client dashboard
```
`booking.price` always reflects the actual lesson price, never the package total.

### Commission
- Standard: 15% platform fee, 85% instructor payout
- First booking between a client and instructor: 10% / 90%
- Commission rate is determined at booking creation and never changes

### Refund Policy
- ≥ 48h notice: 100% refund to wallet
- 24–48h notice: 50% refund to wallet
- < 24h notice: 0% refund
- Policy anchor = `MIN(originalStartTime, currentStartTime)` — prevents the exploit of booking far future → rescheduling close → cancelling for a better refund tier
- Rescheduling inside 24h window marks booking `isNonRefundable = true` (0% always)

### Slot Reservation
- Subdomain bookings use `PENDING_PAYMENT` status to hold the slot
- Conflict check and booking create run inside a single `$transaction` — concurrent requests for the same slot get a 409, not a double booking
- All booking creation paths (`/api/bookings`, `/api/client/bookings/create-bulk`, `/api/public/bookings/bulk`) treat `PENDING`, `PENDING_PAYMENT`, and `CONFIRMED` as blocked
- Cron runs every 5 minutes, expires `PENDING_PAYMENT` bookings older than 10 minutes → `EXPIRED`
- Both `getAvailableSlots` and `checkDoubleBooking` treat `PENDING_PAYMENT` as a blocked slot

### Check-In → Completion
- Check-in atomically sets `COMPLETED` if `endTime` has already passed
- Cron auto-completes any `CONFIRMED` bookings with a check-in that ended 2+ hours ago (safety net)
- Cron auto-marks `NO_SHOW` for `CONFIRMED` bookings with no check-in that ended 3+ hours ago
- Admin can override any status via `PATCH /api/admin/bookings`

### Check-In Fraud Prevention
- Max 15 minutes early
- Max 24 hours late (requires support after that)
- Late check-in (15 min–24 hr) requires reason + acknowledgment
- Idempotent: uses `updateMany` with `checkInTime: null` guard

### Payout Buffer
- 24-hour buffer after lesson completion before instructor payout is eligible
- Refund after payout is blocked for non-admins
- Admin override requires reason and triggers finance team alert

---

## 9. File Reference

| File | Purpose |
|---|---|
| `app/api/public/bookings/bulk/route.ts` | Subdomain booking creation |
| `app/api/public/bookings/[id]/route.ts` | Fetch booking for payment page |
| `app/api/payments/create-intent/route.ts` | Stripe PaymentIntent creation |
| `app/api/stripe/webhook/route.ts` | Stripe event handler |
| `app/api/cron/cleanup-expired-bookings/route.ts` | Slot expiry cron |
| `app/api/bookings/route.ts` | Instructor creates booking |
| `app/api/bookings/[id]/route.ts` | Get / update booking |
| `app/api/bookings/[id]/confirm/route.ts` | Manual confirm |
| `app/api/bookings/[id]/cancel/route.ts` | Cancel with refund |
| `app/api/bookings/[id]/reschedule/route.ts` | Instructor reschedule |
| `app/api/bookings/[id]/check-in/route.ts` | Check-in (web + mobile) |
| `app/api/bookings/send-payment-link/route.ts` | Email wallet top-up link to client |
| `app/api/client/bookings/create-bulk/route.ts` | Client dashboard bulk booking |
| `app/api/client/bookings/[id]/reschedule/route.ts` | Client reschedule |
| `app/api/admin/bookings/route.ts` | Admin list / force-update / create |
| `lib/services/availability.ts` | Slot availability + double-booking check |
| `docs/00-foundation/FINANCIAL_DOCTRINE.md` | Authoritative financial rules |
| `components/BulkBookingForm.tsx` | Subdomain booking form |
| `app/booking/[id]/payment/page.tsx` | Stripe payment page |

---

## 10. Edge Cases & Failure Modes

### Webhook Idempotency

Every Stripe event is stored in the `WebhookEvent` table before processing using a composite key:

```
idempotencyKey = `${event.type}_${event.id}_${event.created}`
```

- Duplicate delivery within any window → `findUnique` hit → returns `{ received: true, duplicate: true }` immediately, no processing
- Unhandled event types are still recorded (idempotency coverage without processing)
- Webhook events are retained indefinitely in MongoDB — no automatic purge (add a TTL index if storage becomes a concern)
- Manual replay: re-send from Stripe dashboard; idempotency key prevents double-processing

### Payment Intent Expiry

Stripe payment intents expire after 24 hours by default. If a user returns to `/booking/[id]/payment` after expiry:

- `create-intent` retrieves the existing intent from Stripe
- Status will be `canceled` or another non-reusable state → falls through to create a fresh intent
- If the booking itself is `EXPIRED` (cron ran) → the payment page checks `booking.status === 'EXPIRED'` before calling `create-intent` and shows a dedicated "Slot Expired — Go Back & Rebook" screen with a `router.back()` button
- The `EXPIRED` check happens before the `create-intent` call, so no stale intent is ever created for an expired slot

### Refund Failure Handling

The current cancel route credits the wallet directly without going through Stripe (wallet-to-wallet refund). This means:

- No Stripe refund call → no Stripe refund failure risk for wallet-paid bookings
- For Stripe-paid bookings (subdomain flow), the refund goes back to the wallet as a CREDIT, not back to the card — this is by design (wallet balance for future lessons)
- If the wallet CREDIT transaction fails inside the `$transaction`, the entire cancel rolls back — booking stays `CONFIRMED`, no partial state
- Admin can manually add wallet credit via `POST /api/admin/clients/{id}/wallet/add-credit` if a refund needs to be applied out-of-band

### Wallet Concurrency

The current implementation re-reads wallet transactions inside the `$transaction` to compute balance, then creates the DEBIT in the same transaction. On MongoDB this provides snapshot isolation within the transaction — concurrent debits that started before the transaction committed will be visible.

**Current protection level:** transaction-scoped balance re-read (good for most cases)

**Known gap:** MongoDB multi-document transactions do not provide the same serialisability guarantees as PostgreSQL. Under extreme concurrency (unlikely for a driving school platform), two transactions could both read the same balance snapshot before either commits. The practical mitigation is the rate limiter (5 req/min per user) which makes this window extremely narrow.

**If this becomes a concern:** add a `version` field to `ClientWallet` and use optimistic locking:

```typescript
const updated = await tx.clientWallet.updateMany({
  where: { id: wallet.id, version: wallet.version },
  data: { version: { increment: 1 } }
});
if (updated.count === 0) throw new Error('WALLET_VERSION_CONFLICT');
```

### Subscription Expiry During Booking Lifecycle

- **At booking creation** (`POST /api/bookings`): `requireActiveSubscription` blocks creation if subscription is not active
- **After booking is created**: existing `CONFIRMED` bookings are not affected — the lesson proceeds regardless of subscription status change
- **Between creation and lesson**: no re-check is performed; the booking is honoured
- **Instructor dashboard**: shows subscription status warnings but does not auto-cancel future bookings
- **New bookings after expiry**: blocked until subscription is reactivated — instructor sees `requiresSubscription: true` error

### Mobile Check-In Security

- **JWT auth**: mobile check-in uses a short-lived JWT (`NEXTAUTH_SECRET`). If the token is expired, the endpoint returns 401 — the mobile app must re-authenticate
- **Simultaneous check-in from two devices**: the `updateMany` with `checkInTime: null` guard is atomic — only one request succeeds, the second gets `{ error: 'Already checked in' }` (400)
- **GPS coordinates**: stored as `checkInLocation` (advisory only) — not enforced for validity. Spoofed coordinates are logged but do not block check-in
- **Late check-in audit trail**: reason and timestamp are appended to `booking.notes` for admin review

### Double-Booking Under Concurrency — Pattern Reference

All booking creation paths use this atomic pattern (MongoDB `$transaction`):

```typescript
await prisma.$transaction(async (tx) => {
  // 1. CHECK inside transaction
  const conflict = await tx.booking.findFirst({
    where: {
      instructorId,
      status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime },   endTime: { gte: endTime }  },
        { startTime: { gte: startTime }, endTime: { lte: endTime } },
      ],
    },
  });
  if (conflict) throw new Error('SLOT_TAKEN'); // → 409

  // 2. CREATE only if no conflict
  return tx.booking.create({ data: { ... } });
});
```

This is the closest equivalent to `SELECT FOR UPDATE` available on MongoDB. The rate limiter (5 req/min) further reduces the concurrency window.

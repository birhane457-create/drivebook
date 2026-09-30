# INT-M-PKG-01 — Remediation Plan v4

**Status:** SUBMITTED FOR INDEPENDENT REVIEW — not approved for implementation  
**Kill switch:** MUST REMAIN ENABLED (`ENABLE_MOBILE_PACKAGE_PURCHASE`) throughout  
**Gate:** Implementation NOT APPROVED until B1/B2 product decision is recorded and this plan is accepted

---

## Changes from v3

- Orchestration failure recovery strategy corrected: client-supplied idempotency key
  replaces `pkg-purchase-${booking.id}` which cannot survive retry across new Booking creation
- Source-verified: `BookingIdempotencyKey` model already exists and is used by bulk booking
  route — same pattern adopted here (no new infrastructure required)
- `FAILED` removed as Booking cleanup status — source-verified absent from Booking lifecycle;
  deletion is the correct cleanup on Stripe failure
- T19/T19a/T19b/T19c rewritten per review requirements
- B1/B2 webhook conditional written but explicitly blocked on product decision

---

## Source Verification Findings (basis for v4 decisions)

### Booking status values (source-verified)
Valid: `PENDING`, `PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `EXPIRED`, `CANCELLED`  
`FAILED` does not exist in the Booking lifecycle. Cleanup on Stripe failure = **delete the Booking**.

### `BookingIdempotencyKey` model (schema line 707)
```prisma
model BookingIdempotencyKey {
  key       String   @id        // client-generated opaque unique key
  bookingId String              // the Booking this key maps to
  response  Json                // stored response for replay
  email     String
  createdAt DateTime @default(now())
}
```
Already used by `app/api/public/bookings/bulk/route.ts` for the same purpose: client sends
`Idempotency-Key` header, server stores `{ key, bookingId, response }` atomically inside the
Booking creation transaction, retries replay the stored response.

The mobile route adopts the identical pattern. No new schema or infrastructure required.

### `stripeService.createPaymentIntent()` (lib/services/stripe.ts line 105)
Calls `stripe.paymentIntents.create(params)` with no second argument.
The Stripe SDK accepts `stripe.paymentIntents.create(params, { idempotencyKey })`.
This parameter is currently absent. Must be added to enable deterministic recovery.

### Webhook Booking state machine (app/api/stripe/webhook/route.ts)
- Only `PENDING_PAYMENT → CONFIRMED` is valid for `payment_intent.succeeded`
- `CONFIRMED`/`COMPLETED` → idempotent replay (no error)
- `EXPIRED` → CANCELLED + refund (outside transaction)
- Any other status → error log, return (no state change)

### Webhook DEBIT path (webhook route line 1113)
```typescript
description: `Lesson: ... ${new Date(booking.startTime!).toLocaleDateString(...)}`
```
Non-null assertion on `startTime`. Produces `Invalid Date` (not a crash) when `startTime = null`.
Semantically wrong for B2 (Buy Later). Targeted conditional required if B2 is chosen.

---

## Architecture Decisions (locked)

1. **No `InstructorPackage` model** — packages remain booking bundles per existing architecture
2. **API: `{ providerId, packageType, idempotencyKey }`** — semantic separation, not `packageId`
3. **`PENDING_PAYMENT` at creation, `CONFIRMED` only on `payment_intent.succeeded`**
4. **`paymentMethod !== 'manual'` as payment evidence: eliminated**
5. **Kill switch stays enabled until all security tests pass**
6. **`BookingIdempotencyKey` pattern for recovery** — client-supplied key, same as bulk route

---

## Open Decision Required Before Implementation

### B1 vs B2 — Product Decision

**B1 (Buy + schedule first lesson at purchase time)**
- `startTime` non-null, `price = firstLessonPrice`
- Existing webhook DEBIT path works unchanged
- `packageHoursRemaining = packageHours - firstLessonDurationHours`

**B2 (Buy Later — no first lesson at purchase time)**
- `startTime = null`, `price = 0`
- Requires targeted webhook conditional (see Files Requiring Changes section)
- `packageHoursRemaining = packageHours` (all hours available)
- Wallet after payment: full `packageTotalPaid` CREDIT, no DEBIT

**This decision must be recorded before any code is written.**

---

## Request Contract

```typescript
{
  providerId:     string,                                       // provider selection
  packageType:    'PACKAGE_6' | 'PACKAGE_10' | 'PACKAGE_15',  // tier selection
  idempotencyKey: string                                        // client-generated opaque UUID
}
```

Server ignores/rejects any client-supplied: `price`, `packageHours`, `packageTotalPaid`,
`status`, `isPaid`, `packageId`, `paymentMethod`.

The `idempotencyKey` must be validated (non-empty string, reasonable length limit).
It must be stored in `BookingIdempotencyKey` atomically with Booking creation.

---

## Idempotent Orchestration

### Recovery sequence on retry

```
Client generates idempotencyKey (UUID) once per purchase attempt
        ↓
POST { providerId, packageType, idempotencyKey }
        ↓
Server: BookingIdempotencyKey.findUnique({ key: idempotencyKey })
        ↓
  ┌─ EXISTS ─────────────────────────────────────────────────────────────────┐
  │  bookingId = stored.bookingId                                             │
  │  booking = Booking.findUnique({ id: bookingId })                         │
  │                                                                           │
  │  if booking.paymentIntentId exists:                                       │
  │    intent = stripeService.retrievePaymentIntent(booking.paymentIntentId) │
  │    if intent.status in reusableStatuses:                                  │
  │      return { clientSecret: intent.client_secret, bookingId, ... }       │
  │    // Intent not reusable (e.g. already succeeded) → replay stored resp  │
  │    return stored.response                                                 │
  │                                                                           │
  │  if booking.paymentIntentId is null:                                      │
  │    // Stripe call succeeded but DB update failed on first attempt         │
  │    // Create PaymentIntent with deterministic idempotency key             │
  │    intent = stripeService.createPaymentIntent({                           │
  │      ...,                                                                 │
  │      idempotencyKey: `pkg-${idempotencyKey}`  ← deterministic per key   │
  │    })                                                                     │
  │    persist booking.paymentIntentId                                        │
  │    return { clientSecret, bookingId, ... }                                │
  └───────────────────────────────────────────────────────────────────────────┘
        ↓
  ┌─ NOT EXISTS ─────────────────────────────────────────────────────────────┐
  │  [normal first-attempt path — see below]                                 │
  └──────────────────────────────────────────────────────────────────────────┘
```

### First-attempt path

```
Step 1: Validate all inputs and provider eligibility
        ↓
Step 2: Compute server-side pricing
        calculatePackagePriceDynamic(provider.hourlyRate, hours, packageType)
        ↓
Step 3: Create Booking (PENDING_PAYMENT) + store BookingIdempotencyKey
        ATOMICALLY inside one prisma.$transaction()
        — both writes succeed or both roll back
        — BookingIdempotencyKey.key has @id (unique); concurrent duplicate → P2002 → 409
        ↓
        if this transaction fails → return error; no Stripe call made; no orphan
        ↓
Step 4: Create Stripe PaymentIntent
        idempotencyKey: `pkg-${idempotencyKey}`  ← deterministic per logical purchase
        metadata.bookingId = booking.id
        ↓
        if Stripe call fails → delete Booking → return 500; no orphan
        ↓
Step 5: Persist booking.paymentIntentId
        ↓
        if DB update fails → PaymentIntent exists in Stripe but paymentIntentId not stored
        → retry with same idempotencyKey enters recovery path (EXISTS branch above)
        → same Stripe idempotency key `pkg-${idempotencyKey}` returns same intent
        → paymentIntentId stored on second attempt
        → no duplicate PaymentIntent
        ↓
Step 6: Return { bookingId, clientSecret, packageTotalPaid, packageHours, status: 'PENDING_PAYMENT' }
```

### Why `pkg-${idempotencyKey}` works across Booking recreations

The Stripe idempotency key `pkg-${idempotencyKey}` is derived from the **client-generated
purchase key**, not from `booking.id`. If Step 3 somehow produced two Bookings (concurrent
requests with different Booking IDs), both would attempt to create a PaymentIntent with the
same Stripe key — Stripe returns the first intent. Only one payment lifecycle exists.

The `BookingIdempotencyKey` storage (Step 3, atomic with Booking creation) ensures that if
two requests race with the same key, the second gets P2002 and returns 409 — the first
Booking wins. Booking creation is therefore also idempotent at the application level.

---

## Server Validation Chain

```
validateMobileToken(req)
  → auth.user.role === 'CLIENT'
  → client = Customer.findFirst({ userId: auth.user.id })     (client must exist)
  → providerId: non-empty string
  → packageType: one of ['PACKAGE_6', 'PACKAGE_10', 'PACKAGE_15']
  → idempotencyKey: non-empty string, max 128 chars
  → Provider.findUnique({ id: providerId })                   (provider must exist)
  → provider.approvalStatus === 'APPROVED'
  → provider.isActive === true
  → provider.acceptingBookings !== false
  → checkProviderEligible(providerId, prisma)                 (doc expiry gate)
  → provider.paymentMode !== 'DIRECT'
  → provider.subscriptionStatus ACTIVE or (TRIAL + not expired)
```

---

## Server-Computed Pricing

```typescript
const serverPricing = await calculatePackagePriceDynamic(
  provider.hourlyRate,
  PACKAGE_HOURS[packageType],   // from lib/config/packages.ts
  packageType,
  false,                        // no test package
  0
);
// serverPricing.total     = packageTotalPaid (authoritative, never from client)
// serverPricing.discountPercentage = lockedDiscountPct
```

---

## Booking Creation (atomic with idempotency key storage)

```typescript
const { booking } = await prisma.$transaction(async (tx) => {
  // Idempotency: attempt to store key atomically with Booking
  // If key already exists (concurrent duplicate), @id constraint throws P2002 → 409
  const newBooking = await tx.booking.create({
    data: {
      providerId,
      customerId: client.id,
      status: 'PENDING_PAYMENT',
      isPackageBooking: true,
      packageHours: PACKAGE_HOURS[packageType],
      packageHoursRemaining: /* B1: hours - firstLessonHours | B2: hours */,
      packageTotalPaid: serverPricing.total,    // authoritative charged amount
      packageStatus: null,                       // NOT set by webhook; lifecycle field
      packageExpiryDate: new Date(Date.now() + 365 * 86400 * 1000),
      price: /* B1: firstLessonPrice | B2: 0 */,
      startTime: /* B1: scheduled | B2: null */,
      lockedHourlyRate: provider.hourlyRate,
      lockedDiscountPct: serverPricing.discountPercentage,
      isPaid: false,
      createdBy: auth.user.id,
    }
  });

  await tx.bookingIdempotencyKey.create({
    data: {
      key: idempotencyKey,
      bookingId: newBooking.id,
      email: auth.user.email ?? '',
      response: { bookingId: newBooking.id, status: 'PENDING_PAYMENT' },
    }
  });

  return { booking: newBooking };
});
```

**`packageStatus` note:** The payment webhook does NOT establish `packageStatus`.
Package status is established by the child-booking lifecycle
(`confirm-package-booking` → `'active'`/`'completed'`) and expiry processing
(cron → `'expired'`). Initial value `null` is handled by the GET packages route
as `packageStatus || 'active'`.

**`price` vs `packageTotalPaid` invariant:**
- `packageTotalPaid` = `serverPricing.total` — authoritative Stripe charge amount
  (used by webhook line 1018: `chargedAmount = packageTotalPaid || booking.price`)
- `price` = first lesson price (B1) or 0 (B2) — used for wallet DEBIT
  (webhook line 1112: `amount: booking.price`)
- These serve different purposes and must both be set explicitly.

---

## PaymentIntent Creation (after Booking exists)

```typescript
try {
  const intent = await stripeService.createPaymentIntent({
    amount: serverPricing.total,
    providerId,
    bookingId: booking.id,
    commissionRate: await getCommissionRate(provider.subscriptionTier ?? 'BASIC'),
    customerEmail: auth.user.email ?? '',
    description: `Package: ${packageType} with ${provider.name}`,
    idempotencyKey: `pkg-${idempotencyKey}`,  // deterministic per logical purchase
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentIntentId: intent.paymentIntentId },
  });

  return NextResponse.json({
    bookingId: booking.id,
    clientSecret: intent.clientSecret,
    packageTotalPaid: serverPricing.total,
    packageHours: PACKAGE_HOURS[packageType],
    status: 'PENDING_PAYMENT',
  }, { status: 201 });

} catch (stripeError) {
  // Stripe call failed — delete Booking to avoid orphaned PENDING_PAYMENT row
  // Deletion is safe: PaymentIntent was never created, webhook cannot fire
  await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
  // Also delete the idempotency key so retry can attempt fresh
  await prisma.bookingIdempotencyKey.delete({ where: { key: idempotencyKey } }).catch(() => {});
  return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
}
```

---

## `stripeService.createPaymentIntent()` Change Required

```typescript
interface CreatePaymentIntentParams {
  // ... existing fields ...
  idempotencyKey?: string;
}

// In createPaymentIntent():
const paymentIntent = await stripe.paymentIntents.create(
  { amount, currency, ... },
  idempotencyKey ? { idempotencyKey } : undefined
);
```

This is the only change to the Stripe service. It is additive and does not affect existing callers.

---

## Webhook Change (B2 only)

If B2 is chosen, one targeted conditional in `app/api/stripe/webhook/route.ts`:

```typescript
if (isPackage && packageTotalPaid) {
  // CREDIT: full package amount
  await tx.walletTransaction.create({ type: 'CREDIT', amount: packageTotalPaid, ... });

  // DEBIT: first lesson only if one was scheduled at purchase time (B1 behavior)
  // B2 (Buy Later): no first lesson scheduled, no DEBIT
  if (booking.startTime && Number(booking.price) > 0) {
    await tx.walletTransaction.create({
      type: 'DEBIT',
      amount: booking.price,
      description: `Lesson: ... ${new Date(booking.startTime).toLocaleDateString(...)}`,
      ...
    });
  }
}
```

This removes the `!` non-null assertion and adds a guard. B1 behavior is unchanged
(B1 has `startTime` and `price > 0`).

---

## Files Requiring Changes

| File | Change | Scope |
|------|--------|-------|
| `lib/services/stripe.ts` | Add optional `idempotencyKey` param | Small — one param, one SDK arg |
| `app/api/client/packages/mobile/route.ts` | Replace POST handler | Main change |
| `app/api/stripe/webhook/route.ts` | B2 only: conditional DEBIT | Small — one conditional |

No schema migration. No new model. `BookingIdempotencyKey` already exists.

---

## Required Security Tests

| # | Test | Required Assertion |
|---|------|--------------------|
| T1 | No auth token | 401 |
| T2 | INSTRUCTOR role | 403 |
| T3 | Missing `providerId` | 400 |
| T4 | Missing `packageType` | 400 |
| T5 | Invalid `packageType` | 400 |
| T6 | Missing `idempotencyKey` | 400 |
| T7 | Non-string types | 400 |
| T8 | Client supplies `price` | ignored; `booking.price` server-derived |
| T9 | Client supplies `packageHours` | ignored; `booking.packageHours = PACKAGE_HOURS[packageType]` |
| T10 | Client supplies `status: 'CONFIRMED'` | ignored; `booking.status = 'PENDING_PAYMENT'` |
| T11 | Client supplies `isPaid: true` | ignored; `booking.isPaid = false` |
| T12 | Non-existent `providerId` | 404; `booking rows = 0`; `PaymentIntents = 0` |
| T13 | Ineligible provider | 403; `booking rows = 0`; `wallet transactions = 0` |
| T14 | Valid provider + `PACKAGE_10` | `booking.packageHours = 10`; `booking.packageTotalPaid` matches `calculatePackagePriceDynamic` exactly; `status = PENDING_PAYMENT`; `isPaid = false`; `clientSecret` returned |
| T15 | Provider selection: Client A selects Provider B | `booking.customerId = Client A`; `booking.providerId = Provider B`; Provider B existing Bookings: count unchanged; Provider B wallet: unchanged; Provider B profile/subscription: unchanged |
| T16 | `payment_intent.succeeded` webhook | `booking.status = CONFIRMED`; `booking.isPaid = true`; wallet CREDIT = `packageTotalPaid`; DEBIT per B1/B2 |
| T17 | Webhook amount mismatch | rejected; `booking.status` remains `PENDING_PAYMENT` |
| T18 | Duplicate webhook | idempotent; no second wallet CREDIT |
| T19 | Stripe PaymentIntent creation fails | Booking deleted; `booking rows after = 0`; `isPaid = false`; no wallet CREDIT; 500 returned; no `clientSecret`; `BookingIdempotencyKey` deleted so retry can attempt fresh |
| T19a | Retry after PaymentIntent persistence failure | First attempt: Booking created, PaymentIntent created in Stripe, `paymentIntentId` DB update fails. Retry with same `idempotencyKey`: recovery path finds existing Booking via `BookingIdempotencyKey`; retrieves same Stripe intent via `pkg-${idempotencyKey}`; persists `paymentIntentId`; returns `clientSecret`. Exactly one Booking exists; exactly one PaymentIntent exists; successful webhook activates that Booking exactly once; exactly one wallet CREDIT. |
| T19b | Retry after client/network timeout (server may have succeeded) | Client received no 201 response. Retry with same `idempotencyKey`: recovery path returns existing `clientSecret` if PaymentIntent reusable, or stored response if already confirmed. Exactly one purchase lifecycle. |
| T19c | Repeat after successful purchase | Same `idempotencyKey` re-submitted after 201 already returned. Returns stored response. No new Booking; no new PaymentIntent; no additional wallet CREDIT. |
| T20 | Child booking after payment | `parentBookingId = booking.id`; `packageHoursUsed` increments; `packageHoursRemaining` decrements; wallet DEBIT created for lesson price |
| T21 | `price`/`packageTotalPaid` invariant | `packageTotalPaid = serverPricing.total`; `price` per B1/B2; `booking.price` used for wallet DEBIT matches what was scheduled |
| T22 | GET /api/client/packages/mobile regression | GET handler unchanged; no regression |
| T23 | B2 webhook DEBIT conditional (B2 only) | CREDIT fires; DEBIT does NOT fire when `startTime = null`; wallet balance = full `packageTotalPaid` |
| T24 | Hostile IDOR baseline | Attacker crafts request with Provider B's ID. Assert: `unauthorized Booking rows = 0`; `unexpected wallet transactions = 0`; `unexpected PaymentIntents = 0`; Provider B's existing state unchanged. (Note: if Client A legitimately purchases from Provider B, one new Booking IS expected — T24 tests that no *unintended* state mutation occurs beyond the new Booking.) |

---

## Gate Status

| Gate | Status |
|------|--------|
| Finding | VERIFIED |
| Production containment | VERIFIED |
| Architecture | VERIFIED |
| Pricing source | VERIFIED |
| Webhook constraints | VERIFIED |
| Existing Stripe idempotency | VERIFIED ABSENT — must add `idempotencyKey` param |
| Recovery identity mechanism | VERIFIED — `BookingIdempotencyKey` already exists, same pattern as bulk route |
| Booking cleanup on Stripe failure | VERIFIED — deletion (not FAILED; status absent from lifecycle) |
| Remediation plan | SUBMITTED FOR REVIEW |
| B1/B2 product decision | REQUIRED BEFORE IMPLEMENTATION |
| Implementation | NOT APPROVED |
| Kill switch | REMAINS ENABLED |

# INT-M-PKG-01 — Remediation Plan v4 (final)

**Status:** WITHDRAWN — NOT FOR IMPLEMENTATION  
**Reason:** The endpoint was designed for the legacy Expo mobile client. The current Capacitor mobile app does not call this endpoint. V4 assumed an active mobile product requirement that is not verified.  
**Kill switch:** MUST REMAIN ENABLED (`ENABLE_MOBILE_PACKAGE_PURCHASE` unset = 503)  

**Architectural finding (verified 2026-08-15):**
- Current Capacitor app: wraps Next.js web app, uses NextAuth session auth, calls `app/api/public/bookings/bulk` for package purchase. Does NOT call `/api/client/packages/mobile`.
- Legacy Expo app (`mobile/services/api.ts`, `mobile/screens/client/WalletScreen.tsx`): calls this endpoint. Is not the current mobile architecture.
- Current client package purchase UI: `app/client-dashboard/page.tsx` → `AddCreditsModal` → `/api/client/wallet-topup-intent`. Package purchase via web booking wizard.

**Next decision (architectural, not technical):**
- RETIRE: remove the obsolete POST handler. The kill switch becomes permanent. Current Capacitor app is unaffected. Legacy Expo code becomes dead.
- REPLACE: only if an explicit product requirement emerges for a separate JWT-based mobile package-purchase API (e.g. a future non-Capacitor mobile client).

Until that decision is made: kill switch stays ON, finding stays OPEN.

---

## Source-Determined Product Behavior

The mobile route is **Buy Later only**. This is not a design choice — it is what the source says:

1. `WalletScreen.tsx` — "Purchase {pkg.name}" button with no lesson scheduling UI
2. `mobile/services/api.ts` — `purchasePackage(packageId, paymentMethod)` sends no scheduled bookings
3. GET handler returns `canScheduleMore: status === 'active' && remaining > 0` — lessons scheduled after purchase
4. Existing disabled POST sets `startTime: new Date()` as a meaningless placeholder, not a real lesson

**Implications that are facts, not choices:**
- `startTime = null`, `price = 0` at package purchase
- `packageHoursRemaining = packageHours` (all hours available immediately)
- Wallet after payment: CREDIT full `packageTotalPaid`; no first-lesson DEBIT
- Webhook DEBIT block requires a `startTime && price > 0` guard to skip the DEBIT (existing code has `new Date(booking.startTime!)` non-null assertion that would produce `Invalid Date` on null — targeted fix required)

---

## Architecture Decisions (locked)

1. No `InstructorPackage` model — packages remain booking bundles per existing architecture
2. API: `{ providerId, packageType, idempotencyKey }` — semantic separation, no `packageId`-as-provider
3. `PENDING_PAYMENT` at creation; `CONFIRMED` only on `payment_intent.succeeded`
4. `paymentMethod !== 'manual'` as payment evidence: eliminated entirely
5. Kill switch stays enabled until all security tests pass
6. `BookingIdempotencyKey` pattern for recovery — client-supplied key, same as bulk route

---

## Source Verification Findings

**`BookingIdempotencyKey` (schema line 707):**
```prisma
model BookingIdempotencyKey {
  key       String   @id    // PRIMARY KEY — database-enforced uniqueness
  bookingId String
  response  Json
  email     String
  createdAt DateTime @default(now())
}
```
`@id` = PRIMARY KEY in PostgreSQL. Concurrent inserts with same key → P2002 on the second.
Atomic creation with Booking inside one transaction prevents any window between the two.

**`stripeService.createPaymentIntent()` (lib/services/stripe.ts line 105):**
```typescript
const paymentIntent = await stripe.paymentIntents.create({ ... });
// No second argument — no idempotency key currently passed
```
Must add optional `idempotencyKey` parameter forwarded to the Stripe SDK second argument.

**Booking status values (source-verified from webhook and bulk route):**
`PENDING`, `PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `EXPIRED`, `CANCELLED`
`FAILED` does not exist in the Booking lifecycle. Cleanup on Stripe failure = **delete**.

**Webhook DEBIT path (webhook route line 1113):**
```typescript
description: `Lesson: ... ${new Date(booking.startTime!).toLocaleDateString(...)}`
```
Non-null assertion. Produces `Invalid Date` (not a crash) when `startTime = null`.
Requires a `startTime && price > 0` conditional to skip DEBIT for Buy Later packages.

**Webhook amount validation (webhook route line 1018):**
```typescript
const chargedAmount = (booking as any).packageTotalPaid || booking.price;
```
For packages, `packageTotalPaid` is the authoritative charged amount.
`booking.price` is the first-lesson DEBIT amount. For Buy Later: `price = 0`, no DEBIT fires.

---

## Request Contract

```typescript
{
  providerId:     string,                                       // provider selection
  packageType:    'PACKAGE_6' | 'PACKAGE_10' | 'PACKAGE_15',  // tier selection
  idempotencyKey: string                                        // client-generated opaque UUID
}
```

Server rejects (or ignores) any client-supplied: `price`, `packageHours`, `packageTotalPaid`,
`status`, `isPaid`, `packageId`, `paymentMethod`, `startTime`, `endTime`.

`idempotencyKey`: non-empty string, max 128 characters, validated server-side.

---

## Idempotent Orchestration

### Recovery on retry (idempotency key already exists)

```
POST { providerId, packageType, idempotencyKey }
        ↓
BookingIdempotencyKey.findUnique({ key: idempotencyKey }) → EXISTS
        ↓
booking = Booking.findUnique({ id: stored.bookingId })
        ↓
  ┌─ booking.paymentIntentId exists ─────────────────────────────────────┐
  │  intent = stripeService.retrievePaymentIntent(booking.paymentIntentId)│
  │  if intent.status in reusableStatuses:                                │
  │    return { clientSecret, bookingId, ... }   ← reuse existing intent │
  │  else:                                                                │
  │    return stored.response                    ← replay stored response │
  └───────────────────────────────────────────────────────────────────────┘
        ↓
  ┌─ booking.paymentIntentId is null ────────────────────────────────────┐
  │  Stripe call succeeded, DB update failed on first attempt            │
  │  intent = stripeService.createPaymentIntent({                        │
  │    ..., idempotencyKey: `pkg-${idempotencyKey}`                      │
  │  })  ← Stripe returns the same intent created on first attempt       │
  │  await prisma.booking.update({ paymentIntentId: intent.id })         │
  │  return { clientSecret, bookingId, ... }                             │
  └───────────────────────────────────────────────────────────────────────┘
```

### First-attempt path (no existing key)

```
Step 1: Validate inputs + provider eligibility
        ↓
Step 2: Compute server-side pricing
        calculatePackagePriceDynamic(provider.hourlyRate, hours, packageType)
        ↓
Step 3: Create Booking + BookingIdempotencyKey atomically
        prisma.$transaction([Booking.create, BookingIdempotencyKey.create])
        — both succeed or both roll back
        — concurrent same-key → P2002 on BookingIdempotencyKey → loser recovers via EXISTS path
        — if transaction fails: return error; no Stripe call; no orphan
        ↓
Step 4: Create Stripe PaymentIntent
        idempotencyKey: `pkg-${idempotencyKey}`  (deterministic per logical purchase)
        metadata.bookingId = booking.id
        — if Stripe fails: delete Booking + delete idempotency key → return 500; clean state
        ↓
Step 5: Persist booking.paymentIntentId
        — if DB update fails: retry enters EXISTS → null path above → recovery succeeds
        ↓
Step 6: Return { bookingId, clientSecret, packageTotalPaid, packageHours, status: 'PENDING_PAYMENT' }
```

**DB concurrency** (prevents duplicate Bookings): `BookingIdempotencyKey.key @id` unique constraint.  
**Cross-system idempotency** (prevents duplicate PaymentIntents): Stripe `idempotencyKey` on `paymentIntents.create`.  
These address different failure modes. Neither replaces the other.

---

## Server Validation Chain

```
validateMobileToken(req)                                    existing
  → auth.user.role === 'CLIENT'                             existing
  → client = Customer.findFirst({ userId: auth.user.id })   existing
  → Provider.findUnique({ id: providerId })
  → provider.approvalStatus === 'APPROVED'
  → provider.isActive === true
  → provider.acceptingBookings !== false
  → checkProviderEligible(providerId, prisma)               existing helper (DOC-EXP-01)
  → provider.paymentMode !== 'DIRECT'                       existing guard
  → provider.subscriptionStatus ACTIVE or (TRIAL + not expired)
```

---

## Server-Computed Pricing

```typescript
const serverPricing = await calculatePackagePriceDynamic(
  provider.hourlyRate,
  PACKAGE_HOURS[packageType],   // from lib/config/packages.ts
  packageType,
  false, 0
);
// serverPricing.total = packageTotalPaid — never from client
```

---

## Booking Creation (atomic with idempotency key)

```typescript
const { booking } = await prisma.$transaction(async (tx) => {
  const newBooking = await tx.booking.create({
    data: {
      providerId,
      customerId: client.id,
      status: 'PENDING_PAYMENT',                             // never 'CONFIRMED' at creation
      isPackageBooking: true,
      packageHours: PACKAGE_HOURS[packageType],
      packageHoursRemaining: PACKAGE_HOURS[packageType],     // all hours available (Buy Later)
      packageTotalPaid: serverPricing.total,                 // authoritative; never from client
      packageStatus: null,                                   // lifecycle field; webhook does not set it
      packageExpiryDate: new Date(Date.now() + 365 * 86400 * 1000),
      price: 0,                                              // Buy Later; no first lesson at purchase
      startTime: null,                                       // Buy Later; lessons scheduled later
      lockedHourlyRate: provider.hourlyRate,
      lockedDiscountPct: serverPricing.discountPercentage,
      isPaid: false,                                         // never derived from paymentMethod
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

**`packageStatus` note:** The payment webhook does NOT establish `packageStatus`. It is set to
`'active'` by `confirm-package-booking` when the first child lesson is confirmed, and to
`'expired'` by the expiry cron. Initial value `null` is handled by the GET packages route
as `packageStatus || 'active'`.

**`price` vs `packageTotalPaid`:**
- `packageTotalPaid = serverPricing.total` — what Stripe charges; used by webhook amount
  validation (`chargedAmount = packageTotalPaid || booking.price`, webhook line 1018)
- `price = 0` — Buy Later; webhook DEBIT block skips DEBIT when `startTime = null && price = 0`

---

## PaymentIntent Creation

```typescript
try {
  const intent = await stripeService.createPaymentIntent({
    amount: serverPricing.total,
    providerId,
    bookingId: booking.id,
    commissionRate: await getCommissionRate(provider.subscriptionTier ?? 'BASIC'),
    customerEmail: auth.user.email ?? '',
    description: `Package: ${packageType} with ${provider.name}`,
    idempotencyKey: `pkg-${idempotencyKey}`,    // deterministic per logical purchase
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
  // Stripe failed — delete Booking and idempotency key so retry can attempt fresh
  await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
  await prisma.bookingIdempotencyKey.delete({ where: { key: idempotencyKey } }).catch(() => {});
  return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
}
```

---

## Files Requiring Changes

| File | Change | Scope |
|------|--------|-------|
| `lib/services/stripe.ts` | Add optional `idempotencyKey?: string` param; pass as second arg to `stripe.paymentIntents.create` | Small |
| `app/api/client/packages/mobile/route.ts` | Replace POST handler with corrected implementation | Main change |
| `app/api/stripe/webhook/route.ts` | Add `startTime && price > 0` guard before DEBIT block | One conditional |

No schema migration. No new model. `BookingIdempotencyKey` already exists.

### Webhook change (targeted)

```typescript
// Current (line ~1112) — non-null assertion fails for Buy Later:
// description: `Lesson: ${new Date(booking.startTime!).toLocaleDateString(...)}`,

// Corrected:
if (isPackage && packageTotalPaid) {
  // CREDIT: full package amount
  await tx.walletTransaction.create({ type: 'CREDIT', amount: packageTotalPaid, ... });

  // DEBIT: first lesson only if one was scheduled at purchase (Buy+Schedule flow)
  // Buy Later packages (startTime=null, price=0) skip this block entirely
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

This is a safe addition. Existing Buy+Schedule packages (from the web bulk flow) have
non-null `startTime` and `price > 0`, so their behavior is unchanged.

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
| T7 | Non-string / malformed types | 400 |
| T8 | Client supplies `price` | ignored; `booking.price = 0` |
| T9 | Client supplies `packageHours` | ignored; `booking.packageHours = PACKAGE_HOURS[packageType]` |
| T10 | Client supplies `status: 'CONFIRMED'` | ignored; `booking.status = 'PENDING_PAYMENT'` |
| T11 | Client supplies `isPaid: true` | ignored; `booking.isPaid = false` |
| T12 | Non-existent `providerId` | 404; booking rows = 0; PaymentIntents = 0 |
| T13 | Ineligible provider | 403; booking rows = 0; wallet transactions = 0 |
| T14 | Valid provider + `PACKAGE_10` | `booking.packageHours = 10`; `booking.packageTotalPaid` matches `calculatePackagePriceDynamic` exactly; `status = PENDING_PAYMENT`; `isPaid = false`; `clientSecret` returned |
| T15 | Provider selection: Client A selects Provider B | `booking.customerId = Client A`; `booking.providerId = Provider B`; Provider B existing Bookings: count unchanged; Provider B wallet: unchanged; Provider B profile/subscription: unchanged |
| T16 | `payment_intent.succeeded` webhook | `booking.status = CONFIRMED`; `booking.isPaid = true`; wallet CREDIT = `packageTotalPaid`; no wallet DEBIT (Buy Later: `startTime = null`, `price = 0`) |
| T17 | Webhook amount mismatch | rejected; `booking.status` remains `PENDING_PAYMENT` |
| T18 | Duplicate webhook | idempotent; no second wallet CREDIT |
| T19 | Stripe PaymentIntent creation fails | Booking deleted; booking rows after = 0; iPaid = false; no wallet CREDIT; BookingIdempotencyKey deleted; 500 returned |
| T19a | Retry after PaymentIntent persistence failure | First attempt: Booking + idempotency key created; Stripe intent created; `paymentIntentId` DB update fails. Retry with same `idempotencyKey`: recovery finds existing Booking; retrieves same Stripe intent via `pkg-${idempotencyKey}`; persists `paymentIntentId`; returns `clientSecret`. Exactly 1 Booking; exactly 1 PaymentIntent; successful webhook confirms once; exactly 1 wallet CREDIT. |
| T19b | Retry after client/network timeout | Client received no response. Retry with same `idempotencyKey`: returns existing `clientSecret` or stored response. Exactly 1 purchase lifecycle. |
| T19c | Repeat after successful purchase | Same `idempotencyKey` after 201 returned. Returns stored response. No new Booking; no new PaymentIntent; no additional wallet CREDIT. |
| T19d | Concurrent same-key requests | Two simultaneous POSTs: same client, same provider, same packageType, same `idempotencyKey`. Exactly 1 Booking; exactly 1 `BookingIdempotencyKey` row (P2002 on second); exactly 1 PaymentIntent; exactly 1 wallet CREDIT. |
| T20 | Child lesson booking after payment | `parentBookingId = booking.id`; `packageHoursUsed` increments; `packageHoursRemaining` decrements; wallet DEBIT created for lesson price |
| T21 | `price`/`packageTotalPaid` invariant | `booking.price = 0`; `booking.packageTotalPaid = serverPricing.total` |
| T22 | GET /api/client/packages/mobile regression | no regression on GET handler |
| T23 | Webhook DEBIT conditional | package CREDIT fires; DEBIT does NOT fire when `startTime = null`; wallet balance = full `packageTotalPaid` after payment |
| T24 | Hostile IDOR baseline | Attacker crafts request with Provider B's ID. `unauthorized Booking rows = 0`; `unexpected wallet transactions = 0`; `unexpected PaymentIntents = 0`; Provider B's existing state unchanged. |

---

## Gate Status

| Gate | Status |
|------|--------|
| Finding | VERIFIED |
| Production containment | VERIFIED |
| Architecture | VERIFIED |
| Buy Later as product behavior | VERIFIED — source-determined, not a design choice |
| Pricing source | VERIFIED |
| Webhook constraints | VERIFIED — DEBIT conditional required |
| Existing Stripe idempotency | VERIFIED ABSENT — `idempotencyKey` param must be added |
| Recovery identity mechanism | VERIFIED — `BookingIdempotencyKey` already exists |
| `BookingIdempotencyKey` DB uniqueness | VERIFIED — `key @id` = PRIMARY KEY; database-enforced |
| Booking creation race | VERIFIED — DB uniqueness; second concurrent same-key → P2002 → recovers |
| Booking cleanup on Stripe failure | VERIFIED — deletion (`FAILED` not a valid Booking status) |
| Remediation plan | READY FOR INDEPENDENT REVIEW |
| Implementation | NOT APPROVED until plan accepted |
| Kill switch | REMAINS ENABLED |

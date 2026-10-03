# Payment Modes — PLATFORM and DIRECT

**Finding:** APP-H-06  
**Status:** DOCUMENTED  
**Date:** 2026-08-15

---

## Summary

DriveBook supports two payment modes for booking payments. Only **PLATFORM mode** is active in production. **DIRECT mode** is partially built and blocked.

| Mode | Description | Status |
|------|-------------|--------|
| `PLATFORM` | Student pays DriveBook's Stripe account; DriveBook deducts commission and pays instructor weekly | ✅ Active — all bookings |
| `DIRECT` | Student pays instructor's own Stripe account directly (via Stripe Connect); DriveBook earns subscription fee only | ⛔ Blocked — Phase 2 |

---

## PLATFORM Mode (current default)

Every instructor has `paymentMode = 'PLATFORM'` by default (`Provider.paymentMode String @default("PLATFORM")`).

- Student pays `DRIVEBOOK.COM.AU` on their bank statement
- DriveBook collects commission per lesson
- Instructor receives weekly payout via `FinancialLedger` and `Payout` flow
- All booking payment routes use this mode

---

## DIRECT Mode (Phase 2 — blocked)

DIRECT mode allows a white-labelled payment experience: the student's bank statement shows the instructor's own business name (configured in their Stripe Connect account).

**What is already built:**

- `createDirectPaymentIntent()` in `lib/services/stripe.ts` — uses `on_behalf_of` + `transfer_data.destination`
- DIRECT branch in `app/api/payments/create-intent/route.ts` — code exists but blocked by a 503 guard
- DIRECT branch in `app/api/bookings/[id]/check-out/route.ts` — sets `platformFee=0`, `instructorPayout=booking.price`
- `paymentMode` field on `Provider` schema
- Stripe Connect account creation and onboarding flow

**What is NOT yet built:**

- Webhook `payment_intent.succeeded` DIRECT branch (must skip commission ledger entry and payout queue)
- Admin UI toggle to enable DIRECT mode for an instructor
- Connect onboarding completion gate before DIRECT is allowed
- PREMIUM subscription requirement enforcement for DIRECT
- Refund handling for DIRECT bookings in webhook
- Removal of the 503 production guard

**Current production guard** (`app/api/payments/create-intent/route.ts`):
```typescript
if (booking?.provider?.paymentMode === 'DIRECT') {
  return NextResponse.json({
    error: 'Direct payment mode is not yet available. Please contact support.',
    code: 'PAYMENT_MODE_NOT_IMPLEMENTED',
  }, { status: 503 });
}
```

**Full design document:** `docs/newplan/PAYMENT-WHITE-LABEL.md`  
**Tracker cross-reference:** MM-10-A (SUPERSEDED — DIRECT mode is intentional PLATFORM-only architecture, not a vulnerability)

---

## Schema Reference

```prisma
model Provider {
  paymentMode     String  @default("PLATFORM")  // "PLATFORM" | "DIRECT"
  stripeAccountId String?
  chargesEnabled  Boolean @default(false)
}
```

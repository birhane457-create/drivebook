# Booking & Payment Security Issues - Quick Reference

**Generated:** June 15, 2026
**Updated:** July 2026 (production-readiness audit — additional issues found and resolved)
**Full Audit:** `BOOKING_PAYMENT_SECURITY_AUDIT.md`

---

## ✅ RESOLVED — July 2026 Production-Readiness Audit

| # | Issue | Fix Applied |
|---|-------|-------------|
| B5 | Password fields persisted in localStorage on every keystroke | `saveToLocalStorage` now excludes `accountHolderPassword` and `accountHolderConfirmPassword` |
| B6 | 3DS `requires_action` showed error instead of calling `stripe.handleNextAction()` | Fixed — `handleNextAction({ clientSecret })` called; 3DS-enrolled cards now work |
| B7 | Payment page had 4 `console.log` statements exposing payment intent data | All removed |
| B9 | `customer@example.com` hardcoded fallback in payment intent creation | Replaced with `null` — Stripe omits the field gracefully |
| B12 | Timezone bug in `validate-slots` — dates parsed as server UTC not Perth AWST | Fixed — ISO `+08:00` offset parse |
| B13 | Same timezone bug in `check-and-reserve` POST and DELETE | Fixed — same `+08:00` parse, renamed to `parsePerthDateTime` |
| B8 | `validate-slots` included `COMPLETED` (past) bookings in conflict check | Removed `COMPLETED` from the status filter |
| B1 | Slot DELETE sent params in request body — server reads URL query params, slots never released | `BookingDetailsForm` now sends params as URL query string |

---

## ✅ RESOLVED — June 19, 2026

| # | Issue | Status | Fix Applied |
|---|-------|--------|-------------|
| 4 | Slot validation in bulk booking | ✅ Fixed | Verified already inside `$transaction` — conflict check + SlotReservation creation atomic |
| 5 | Email failure no fallback | ✅ Fixed | SMS fallback then in-app notification fallback added in `bookings/route.ts` |
| 6 | Webhook idempotency silent fail | ✅ Fixed | Catch block now returns 500 (hard-fail) — tells Stripe to retry, prevents duplicate wallet credit |
| 8 | Commission rate not locked | ✅ Fixed | `getCommissionRate()` called at booking creation, stored as `commissionRate` on Booking record in both routes |

---

## 🟡 DEFERRED — Low Priority (acceptable for launch)

| # | Issue | Location | Impact | Decision |
|---|-------|----------|--------|----------|
| 7 | Expired booking fee loss | `stripe/webhook/route.ts` | User loses Stripe fee on rare auto-refund | Deferred — rare edge case, refund already issued |
| 9 | Failed PI cleanup missing | `stripe/webhook/route.ts` | Orphaned PaymentIntents accumulate | Deferred — cosmetic, no financial impact |
| 10 | Booking amount sanity checks | Multiple locations | $0 or $100k edge cases | Deferred — Zod validation + server-side pricing reduces risk |

---

## ✅ Previously Resolved (June 15, 2026)

All 3 original CRITICAL issues were resolved before June 15 audit:
- CRITICAL-1: Price component validation — server-side pricing, client amounts ignored
- CRITICAL-2: Wallet credit before payment — credit only on webhook confirmation
- CRITICAL-3: Amount validation null fallback — Zod schema + server calculation

---

## Related Documentation

- Full Audit Report: `BOOKING_PAYMENT_SECURITY_AUDIT.md`
- Payment Flow: `06-payments/WALLET_TOPUP.md`
- Booking Flow: `01-public/BOOKING_FLOW_COMPLETE.md`

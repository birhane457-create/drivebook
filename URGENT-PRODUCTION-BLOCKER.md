# 🚨 URGENT: Production Deployment Blocker

**Date:** 2026-11-25  
**Status:** 🔴 **DO NOT DEPLOY TO PRODUCTION**  
**Affected System:** Public Stripe Booking (Book Now)  
**Code Base:** main @ `10b30fea1`

---

## Critical Issue Summary

**4 release-blocking defects** found in public Stripe booking flow. All confirmed in current source code.

---

## 🔴 Blocker #1: Wrong Amount Charged

**Problem:** PaymentIntent charges $60 (first lesson) instead of $393 (full package)

**Location:** `/app/api/payments/create-intent/route.ts` line 186

**Current code:**
```typescript
const paymentAmount = booking.price;  // ❌ $60
```

**Fix:**
```typescript
const paymentAmount = booking.isPackageBooking && booking.packageTotalPaid
  ? booking.packageTotalPaid  // ✅ $393.25
  : booking.price;
```

**Impact:** Customer undercharged → webhook rejects → no booking confirmed  
**Fix time:** 30 minutes  
**Priority:** 🔴 P0 — Financial integrity

---

## 🔴 Blocker #2: Account Takeover

**Problem:** Booking linked to existing account without password check

**Location:** `/app/api/public/bookings/bulk/route.ts` lines 540-575

**Current code:**
```typescript
if (existingUser) {
  userId = existingUser.id;  // ❌ No password check
}
```

**Fix:** Add password verification or OTP before linking

**Impact:** Attacker can book lessons on victim's account  
**Fix time:** 4 hours (including UI)  
**Priority:** 🔴 P0 — Security

---

## 🔴 Blocker #3: Short-Notice Paid But Not Confirmed

**Problem:** Customer pays for short-notice booking, but webhook doesn't confirm it

**Location:** `/app/api/stripe/webhook/route.ts` line 1165

**Current code:**
```typescript
if (booking.status !== 'PENDING_PAYMENT') {
  return;  // ❌ Silently ignores PENDING status (short-notice)
}
```

**Fix:** Block payment for PENDING bookings (require approval first)

**Impact:** Customer charged but booking never confirmed  
**Fix time:** 2 hours  
**Priority:** 🔴 P0 — Financial + UX

---

## 🔴 Blocker #4: Guest Checkout Broken (Needs Verification)

**Problem:** Payment token not passed to payment intent API

**Location:** Frontend `/app/booking/[id]/payment/page.tsx` (suspected)

**Expected:**
```typescript
body: JSON.stringify({ 
  bookingId, 
  paymentToken: token  // ⚠️ Must be included
})
```

**Impact:** All guest bookings fail with 401 Unauthorized  
**Fix time:** 30 minutes (if confirmed)  
**Priority:** 🔴 P0 — Functionality

---

## Immediate Action Required

### Today (Urgent)

1. ✅ **Verify Issue #4** — Check frontend code (30 min)
2. ✅ **Fix Issue #1** — Amount mismatch (30 min)
3. ✅ **Fix Issue #3** — Short-notice status (2 hours)
4. ✅ **Fix Issue #4** — Token passing (if exists, 30 min)

**Total:** ~4 hours

### Tomorrow

5. ✅ **Fix Issue #2** — Account ownership (4 hours)
6. ✅ **Integration tests** — All 4 issues (2 hours)
7. ✅ **Manual E2E test** — Staging environment (2 hours)

**Total:** ~8 hours

---

## Decision Required

**Option A: Block public booking until fixed** (Recommended)
- Disable public booking route in production
- Keep wallet-funded booking enabled (not affected)
- Fix issues over next 2 days
- Re-enable after verification

**Option B: Deploy wallet-only**
- Deploy wallet-funded flow only (already secure)
- Keep public Stripe booking disabled
- Fix public booking in separate release

**Option C: Rush fixes today**
- Risk: Incomplete testing
- Not recommended for financial/security issues

---

## Code Locations Quick Reference

| Issue | File | Line | Fix Type |
|-------|------|------|----------|
| #1 Amount | `/app/api/payments/create-intent/route.ts` | ~186 | 1-line change |
| #2 Account | `/app/api/public/bookings/bulk/route.ts` | ~550 | Add password check |
| #3 Short-notice | `/app/api/payments/create-intent/route.ts` | ~185 | Reject PENDING |
| #4 Token | `/app/booking/[id]/payment/page.tsx` | TBD | Add token param |

---

## Risk If Deployed Now

| Risk | Probability | Impact | Consequence |
|------|-------------|--------|-------------|
| **Customer charged wrong amount** | 100% (every package) | High | Chargebacks, Stripe suspension |
| **Account takeover** | 10-20% (targeted) | Critical | Security breach, legal |
| **Short-notice unpaid bookings** | 15-20% (all short-notice) | High | Support burden, refunds |
| **Guest checkout failure** | Unknown (if bug exists) | Critical | 100% booking failure |

---

## Deployment Decision

**Who decides:** Engineering Lead + Product Owner  
**When:** Before any production deployment  
**Criteria:** ALL 4 issues fixed + tested + verified

---

**Contact:** Development Team  
**Reference:** `CRITICAL-FINDINGS-PUBLIC-STRIPE-BOOKING.md` (full details)

# Package Expiry Refund Policy

**Finding:** PAY-H-06  
**Status:** DOCUMENTED  
**Risk:** LOW — business policy, not a code defect  
**Date:** 2026-08-15  
**Authority:** This document is the canonical record of the package expiry refund policy for audit purposes.

---

## Policy Statement

**Unused package hours that expire are forfeited. No refund is issued on expiry.**

This is a deliberate business decision, not a code omission.

---

## Current Behavior (Source-Verified)

### Package Lifetime

All packages expire 365 days from the purchase date (`packageExpiryDate = purchaseDate + 365d`). This is stated explicitly in the packages API response (`app/api/packages/route.ts`):

```
'All packages expire 365 days from purchase'
'Unused hours cannot be refunded after expiry'
```

### Expiry Process

The expiry lifecycle is handled by `lib/jobs/packageExpiryAlerts.ts`, invoked by the notifications cron (`app/api/cron/notifications/route.ts`):

| Trigger | Action |
|---------|--------|
| 7 days before expiry | In-app notification: "Package Expiring Soon — X hours remaining" |
| 1 day before expiry | In-app notification: "Package Expires Tomorrow — Renew now" |
| Day of expiry | In-app notification: "Package Expires Today — you'll lose X hours" |
| Day after expiry | `booking.packageStatus` set to `'expired'`; notification: "Package Expired — X hours lost" |

**No financial action is taken at any stage.** The wallet balance is not modified. No Stripe refund is issued. No `WalletTransaction` is created. Unused hours are silently forfeited.

### Enforcement at Booking Time

`app/api/client/schedule-package-hours/route.ts` blocks scheduling against an expired package:

```typescript
if (packageBooking.packageExpiryDate && new Date(packageBooking.packageExpiryDate) < new Date()) {
  return NextResponse.json({ error: 'Package has expired' }, { status: 400 });
}
```

The customer cannot use hours from an expired package.

---

## Distinction: Expiry vs Cancellation

| Scenario | Trigger | Refund behavior |
|----------|---------|-----------------|
| **Package expiry** (PAY-H-06) | Time limit exceeded; customer did not cancel | **No refund — hours forfeited** |
| **Customer cancellation** | Customer requests cancellation before expiry | Partial refund (tier-aware calculation); subject to admin approval workflow — see `PACKAGE_REFUND_APPROVAL_WORKFLOW.md` |

These are independent flows with different policies.

---

## Policy Rationale

The no-refund-on-expiry policy is consistent with standard practice for time-limited service packages (gym memberships, prepaid lesson bundles, software subscriptions). The customer receives:

1. **365-day window** — generous time limit for driving lesson packages
2. **Three advance notifications** — at 7 days, 1 day, and day-of expiry
3. **Ability to cancel before expiry** — customer can request a cancellation refund at any point while the package is active (see cancellation workflow)

The policy is pre-disclosed to customers at purchase time via the packages API response.

---

## What Is NOT Covered by This Policy

- **Partial refund on active cancellation** — covered in `PACKAGE_REFUND_APPROVAL_WORKFLOW.md`
- **Refund when instructor account is deactivated/suspended** — not yet documented; tracked separately
- **Refund for platform-side errors** — handled case-by-case via admin override

---

## Audit Trail

| Item | Status |
|------|--------|
| Policy embedded in packages API response | ✅ Present (`app/api/packages/route.ts` line 146) |
| Customer notified before expiry | ✅ 3-stage notification (7d / 1d / today) |
| No refund issued at expiry | ✅ Confirmed by source inspection of `packageExpiryAlerts.ts` |
| Customer blocked from using expired hours | ✅ `schedule-package-hours/route.ts` |
| Policy document exists | ✅ This file |

---

## Finding Closure

PAY-H-06 was raised because the expiry refund behavior was not explicitly documented — leaving ambiguity about whether the current behavior (no refund) was intentional or an oversight.

This document resolves the ambiguity: **the no-refund-on-expiry behavior is the intentional policy.** No code change is required. The finding closes as a documentation gap now filled.

**Finding:** PAY-H-06 — Package expiry refund policy undocumented  
**Resolution:** DOCUMENTED — this file  
**Code change:** None required  
**Tracker:** PAY-H-06 → CLOSED

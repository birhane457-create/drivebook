# Check-In

**Auth required:** INSTRUCTOR role (web) or JWT Bearer token (mobile)  
**API:** `POST /api/bookings/[id]/check-in`  
**File:** `components/mobile/CheckInButton.tsx`, `app/api/bookings/[id]/check-in/route.ts`

---

## Purpose

Check-in marks the lesson as started. It is required for the booking to auto-complete after the lesson ends.

---

## Time Rules

| Timing | Result |
|--------|--------|
| More than 15 min early | Blocked — "Too early to check in" |
| On time (within 15 min early to on time) | Allowed |
| Up to 24 hours late | Allowed with `acknowledgeLateCheckIn: true` + reason (min 10 chars) |
| More than 24 hours late | Blocked — "Please contact support" |

---

## Auto-Complete

If `endTime` has already passed at the time of check-in, the booking is atomically set to `COMPLETED` in the same database update.

The cron job (`/api/cron/cleanup-expired-bookings`) also auto-completes any `CONFIRMED` bookings with a check-in that ended 2+ hours ago (safety net).

---

## Idempotency

The check-in uses `updateMany` with a `checkInTime: null` condition. If two devices attempt to check in simultaneously, only one succeeds. The second gets `{ error: 'Already checked in' }`.

---

## Mobile Check-In

The mobile app uses JWT Bearer token auth (not NextAuth sessions). The token is issued at login and must be included in the `Authorization: Bearer <token>` header.

If the token is expired, the endpoint returns 401 — the mobile app must re-authenticate.

GPS coordinates are optionally sent with the check-in request and stored as `checkInLocation` (advisory only — not enforced for validity).

---

## Late Check-In Audit Trail

When a late check-in is acknowledged, the reason and timestamp are appended to `booking.notes` for admin review.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Full booking management
- `docs/mobile/ARCHITECTURE.md` — Mobile app architecture

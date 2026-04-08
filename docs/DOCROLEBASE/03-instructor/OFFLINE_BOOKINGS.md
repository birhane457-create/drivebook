# Offline Booking Management (Schedule Manager)

**Feature name:** Offline Booking Tracking / Schedule Manager  
**Tier gate:** PRO and above  
**Status:** Implemented — April 2026  
**Spec date:** April 2026

---

## What This Is

Instructors often have existing students they collect payment from directly — cash, bank transfer, or invoice. These lessons happen outside the DriveBook payment flow but still need to be tracked: they block availability, appear in the schedule, and should be included in the instructor's own records.

**Offline bookings** are instructor-managed schedule entries. They are:
- Created by the instructor only (not by students)
- Not processed through the platform payment system
- Not subject to platform commission
- Not visible to the student on their DriveBook dashboard
- Counted in availability — they block the slot from other bookings

---

## Two Booking Types — Clear Distinction

| Property | Platform Booking | Offline Booking |
|----------|-----------------|-----------------|
| Payment | Via DriveBook wallet or Stripe | Cash / bank / external — instructor's responsibility |
| Commission | Yes — platform takes commission | No — zero platform fee |
| Student account | Required (or invited) | Not required — name only |
| Student visibility | Visible on student dashboard | Not visible to student |
| Availability blocking | Yes | Yes |
| Receipts | Platform sends receipt email | No platform receipt |
| Refunds | Platform handles | Instructor handles |
| Audit trail | Full platform audit log | Instructor-only record |
| Source field | `source: 'platform'` | `source: 'offline'` |
| `isPaid` | Set by platform on payment | Set by instructor manually |

---

## Tier Gate

| Tier | Platform Bookings | Offline Bookings |
|------|------------------|-----------------|
| BASIC | ✅ Unlimited | ❌ Not available |
| PRO | ✅ Unlimited | ✅ Unlimited |
| STUDIO | ✅ Unlimited | ✅ Unlimited |
| BUSINESS | ✅ Unlimited | ✅ Unlimited |

BASIC instructors who try to create an offline booking see an upgrade prompt:
> "Offline booking tracking is a PRO feature. Upgrade to manage your full schedule in one place."

---

## What the Instructor Can Do (PRO+)

**Create an offline booking:**
- Client name (free text — no DriveBook account required)
- Date and time
- Duration
- Amount paid (optional — for their own records)
- Payment method (cash / bank transfer / other)
- Notes

**Manage offline bookings:**
- Reschedule (date/time change)
- Mark as completed
- Delete (soft delete — record retained)
- Add lesson feedback (same PDA form as platform bookings)

**What they cannot do:**
- Convert an offline booking to a platform booking (different payment trail)
- Charge the student through the platform for an offline booking
- Issue a platform receipt for an offline booking

---

## UI Distinction in Bookings List

The instructor bookings page shows a clear visual split:

**Platform Bookings** (blue badge)
- Paid through DriveBook
- Commission applies
- Student has a DriveBook account

**Offline / My Schedule** (grey badge)
- Managed by instructor
- No platform commission
- Student may not have a DriveBook account

Filter tabs: `All` | `Platform` | `Offline` | `Upcoming` | `Past`

---

## Schema Changes Required

Add `source` field to `Booking` model:

```prisma
source  String  @default("platform")  // 'platform' | 'offline'
```

Add `offlinePaymentMethod` and `offlineAmountPaid` for instructor records:

```prisma
offlinePaymentMethod  String?   // 'cash' | 'bank_transfer' | 'other'
offlineAmountPaid     Float?    // instructor's record of what was paid
```

**SQL migration:**
```sql
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS "offlinePaymentMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "offlineAmountPaid" DOUBLE PRECISION;
```

---

## API Changes Required

**New endpoint:**
`POST /api/bookings/offline` — create an offline booking (PRO+ gate)

**Request body:** `clientName`, `clientPhone`, `clientEmail` (optional — for platform client guard), `date`, `time`, `durationMinutes`, `pickupAddress`, `notes`, `offlinePaymentMethod`, `offlineAmountPaid`

**Gate checks (in order):**
1. PRO+ subscription — returns 403 `{ upgradeRequired: true }` for BASIC
2. Platform client guard — if `clientEmail` matches a DriveBook-registered client for this instructor, returns 403 `{ platformClientBlocked: true }`
3. Slot conflict — offline bookings block the slot like any other booking

**Modified endpoints:**
- `GET /api/bookings` — add `?source=platform|offline|all` filter param (implemented ✅)
- `GET /api/analytics` — exclude offline bookings from commission/revenue stats; include in schedule/hours stats

---

## Notifications for Offline Bookings

Offline students don't have a DriveBook account, so in-app notifications don't apply. Instead:

| Event | Student | Instructor |
|-------|---------|------------|
| Booking created | ❌ No confirmation (no account) | ✅ In-app notification |
| 24hr reminder | ✅ SMS to `clientPhone` (if provided) | ✅ SMS to instructor phone |
| 24hr reminder | ✅ Email to `clientEmail` (if provided) | ✅ In-app notification |

The `clientEmail` field is stored on the `Booking` record for offline bookings and used by the lesson reminders cron.

---

Offline bookings are **completely excluded** from:
- Platform commission calculation
- Payout processing
- Revenue reporting
- Ledger entries
- Stripe reconciliation

They are **included** in:
- Availability blocking (slot conflict checks)
- Instructor's own schedule view
- Lesson feedback / PDA tracking
- Hours worked (for instructor's personal analytics)

---

## Platform Client Guard — Revenue Protection

This is the most important rule in the offline booking system.

**Rule:** If a client has a DriveBook account linked to this instructor, they cannot be booked offline. The instructor must use a platform booking.

**Why:** The platform found or processed that student. Allowing the instructor to route them to cash would let them bypass commission on every repeat lesson — the platform acquires the student once and earns nothing after.

**How it works:**
- When creating an offline booking, the instructor can optionally provide the client's email
- The API checks: does a `Client` record exist for this instructor with this email AND a linked `userId` (DriveBook account)?
- If yes → 403 blocked with message: "This student has a DriveBook account linked to your profile. Please use a platform booking."
- If no → offline booking allowed

**What this means in practice:**
- Instructor's pre-existing cash students (no DriveBook account) → can be logged offline ✅
- Students who found the instructor via DriveBook → must use platform booking ✅
- Students the instructor added manually but who later registered → must use platform booking ✅

**The boundary is the DriveBook account, not the student.** If a student has never registered on DriveBook, the instructor can log their lessons offline. Once they register, all future bookings must go through the platform.

---

## Implementation Status

| Item | Status |
|------|--------|
| Schema fields (`source`, `offlinePaymentMethod`, `offlineAmountPaid`) | ✅ Done — migration run |
| `POST /api/bookings/offline` with PRO gate | ✅ Done |
| Platform client guard in API | ✅ Done |
| Slot conflict check for offline bookings | ✅ Done |
| `GET /api/bookings?source=` filter | ✅ Done |
| Bookings list UI — source badges + filter tabs | ✅ Done |
| "Offline / Cash" button in bookings list | ✅ Done |
| Offline booking form at `/dashboard/bookings/new?offline=true` | ✅ Done |
| Analytics — offline excluded from revenue/commission stats | ✅ Done (Transaction table naturally excludes offline — no Transaction record created) |
| Prisma schema updated | ✅ Done |
| `clientEmail` stored on offline booking for email reminders | ✅ Done |
| SMS + email reminders for offline students (24hr cron) | ✅ Done |
| SMS reminder for instructor (24hr cron, all bookings) | ✅ Done |

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Platform booking management
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Tier feature gates
- `docs/DOCROLEBASE/00-overview/SYSTEM_FLOWS.md` — Booking flow diagrams
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Commission rules

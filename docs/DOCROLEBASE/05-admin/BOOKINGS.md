# Admin Bookings

**Route:** `/admin/bookings`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/bookings/page.tsx`
**APIs:** `GET /api/admin/bookings`, `PATCH /api/admin/bookings`, `POST /api/admin/bookings`

---

## Overview

The admin bookings page shows every booking on the platform. Admin can view, filter, and manage the status of any booking regardless of which instructor or client it belongs to. This is the primary tool for resolving lesson issues, marking completions, and handling no-shows.

---

## Stats Bar

Seven counters shown at the top of the page:

| Counter | Description |
|---------|-------------|
| Total | All bookings ever |
| Confirmed | Active upcoming or in-progress lessons |
| Pending | Awaiting instructor confirmation |
| Completed | Lessons marked complete |
| Cancelled | Cancelled by any party |
| No-Show | Marked as no-show (either party) |
| Ended (unpaid) | CONFIRMED bookings whose `endTime` has passed — needs admin action |

The "Ended (unpaid)" counter is the most operationally important. A purple alert banner appears when this count is > 0, prompting admin to mark those lessons complete so instructor payouts can be released.

---

## Filters

- Free-text search: client name, client email, instructor name, booking ID
- Status filter buttons: All / CONFIRMED / PENDING / COMPLETED / CANCELLED / NO_SHOW

The API fetches up to 200 bookings ordered by `startTime DESC`. Client-side filtering is applied on top.

---

## Table Columns

| Column | Notes |
|--------|-------|
| Client | Name + email/phone. Package lesson badge shown if `isPackageBooking = true` |
| Instructor | Name |
| Date / Time | Start date, start–end time |
| Status | Colour-coded badge. Purple "ended" indicator for lessons past `endTime` still in CONFIRMED |
| Price | Lesson price paid by client |
| Manage | Opens the action drawer. Purple button for ended-but-unresolved lessons |

---

## Action Drawer

Clicking "Manage" opens a bottom sheet (mobile) / modal (desktop) with context-aware actions.

### Available actions

| Action | When available | Effect |
|--------|---------------|--------|
| Mark as Completed | CONFIRMED or PENDING, and `endTime` has passed | Sets `status = COMPLETED`. Transaction becomes eligible for payout. Shows payout link. |
| Mark as No-Show | CONFIRMED, and `startTime` has passed | Opens no-show party picker (see below) |
| Confirm Booking | PENDING only | Sets `status = CONFIRMED` |
| Cancel Booking | Any non-terminal status | Calls `POST /api/bookings/[id]/cancel`. Refund applied per cancellation policy. |

Actions are disabled with a reason shown when timing conditions aren't met (e.g. "Lesson ends 3:00 PM on 24 Mar" blocks Complete until then).

Terminal statuses (COMPLETED, CANCELLED, NO_SHOW) show "no further actions available."

### No-show party picker

When admin marks a booking as NO_SHOW, a second step asks who didn't show:

| Party | Effect |
|-------|--------|
| Instructor didn't show | `status = NO_SHOW`, transaction tagged `[INSTRUCTOR_NO_SHOW]`. Goes to Withheld tab in Payouts. Recommended resolution: refund client + charge instructor penalty. |
| Client didn't show | `status = NO_SHOW`, transaction tagged `[CLIENT_NO_SHOW]`. Goes to Withheld tab in Payouts. Recommended resolution: approve instructor for payout. |
| Both / Disputed | `status = NO_SHOW`, transaction tagged `[DISPUTED]`. Goes to Disputes tab in Payouts for manual resolution. |

The tag is written to `Transaction.description` and is read by the Payouts page to surface the correct resolution path.

### Package lesson handling

If `isPackageBooking = true`, a purple banner is shown in the drawer. Cancellation refunds return as wallet credit (not a card refund). This is noted in the cancel and no-show confirmation screens.

### Post-complete screen

After marking complete, a confirmation screen shows:
- Instructor payout amount now eligible
- Link to `/admin/payouts` to process the payout

### Post-no-show screen

After recording a no-show, a screen shows the resolution steps specific to the party selected (instructor / client / both), with a link to `/admin/payouts`.

---

## API

### `GET /api/admin/bookings`

Returns up to 200 bookings ordered by `startTime DESC`, plus a `stats` object.

Query params: `status`, `search`, `from`, `to` (all optional).

### `PATCH /api/admin/bookings`

Updates a booking's status.

```json
{ "bookingId": "string", "status": "CONFIRMED|COMPLETED|CANCELLED|NO_SHOW|PENDING", "noShowParty": "instructor|client|both" }
```

`noShowParty` is only used when `status = NO_SHOW`. It writes the party label to the first linked transaction's `description` field.

### `POST /api/admin/bookings`

Creates a booking on behalf of a client. Used from the Client Detail page (see CLIENTS.md).

Required: `clientId`, `instructorId`, `startTime`, `endTime`.
Optional: `notes`, `price` (defaults to instructor hourly rate × duration).

Checks client wallet balance before creating. Deducts from wallet atomically. Sets `status = CONFIRMED`, `isPaid = true`.

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — What happens after a booking is marked complete or no-show
- [DISPUTES.md](./DISPUTES.md) — Dispute resolution for no-show cases
- [CLIENTS.md](./CLIENTS.md) — Creating bookings from the client detail page

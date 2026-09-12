# Booking Status Colours

**Status:** ✅ COMPLETE (July 2026)  
**File:** `lib/config/booking-status.ts`

---

## Overview

Single source of truth for all booking status colours and labels. Every page that displays a booking status badge imports from this file — no hardcoded colour classes anywhere.

---

## Status Map

| Status | Colour | Label | Use case |
|--------|--------|-------|----------|
| `CONFIRMED` | Emerald | Confirmed | Paid and scheduled |
| `COMPLETED` | Sky | Completed | Lesson finished |
| `PENDING` | Amber | Pending Approval | Short-notice — awaiting instructor |
| `PENDING_PAYMENT` | Violet | Awaiting Payment | Booked, payment link sent |
| `CANCELLED` | Rose | Cancelled | Cancelled by either party |
| `NO_SHOW` | Orange | No Show | Student didn't appear |
| `EXPIRED` | Slate | Expired | Payment window closed |

---

## API

```typescript
import { getStatusConfig, isActiveStatus, isDoneStatus } from '@/lib/config/booking-status';

// Get full config for a status
const cfg = getStatusConfig(booking.status);
cfg.label   // "Confirmed"
cfg.dot     // "bg-emerald-400"     — Tailwind class for the colour dot
cfg.badge   // "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
cfg.border  // "border-l-emerald-400"  — left-border accent for timeline/card rows
cfg.text    // "text-emerald-400"

// Status helpers
isActiveStatus(status)  // true for CONFIRMED, PENDING, PENDING_PAYMENT
isDoneStatus(status)    // true for COMPLETED, NO_SHOW
```

---

## Usage patterns

### Badge with dot
```tsx
<span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
  {cfg.label}
</span>
```

### Left-border card accent
```tsx
<div className={`border-l-4 ${cfg.border} bg-slate-800/60 rounded-xl px-3 py-2`}>
  ...
</div>
```

---

## Pages using this

- `app/dashboard/bookings/page.tsx` — instructor bookings list
- `app/client-dashboard/bookings/page.tsx` — student bookings list (uses `CLIENT_STATUS_STYLE` wrapper for display-layer keys)
- `app/admin/bookings/page.tsx` — admin bookings table
- `components/instructor/TodayWorkspace.tsx` — today timeline
- `app/dashboard/schedule/page.tsx` — week/agenda views

**Note on client dashboard:** The student bookings API returns display-layer status strings (`upcoming`, `completed`, `awaiting_payment`, etc.) rather than raw DB statuses. `CLIENT_STATUS_STYLE` in `app/client-dashboard/bookings/page.tsx` maps these to the same colour palette but is a separate constant, not imported from `booking-status.ts`.

---

## Adding a new status

1. Add the status to the `BookingStatus` union type in `lib/config/booking-status.ts`
2. Add an entry to `BOOKING_STATUS` with all five fields (label, dot, badge, border, text)
3. Update `isActiveStatus` or `isDoneStatus` if appropriate
4. The new badge will appear everywhere automatically

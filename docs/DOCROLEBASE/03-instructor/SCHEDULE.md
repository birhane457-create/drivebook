# Instructor Schedule Workspace

**Route:** `/dashboard/schedule`  
**Auth required:** INSTRUCTOR role (via dashboard layout)  
**File:** `app/dashboard/schedule/page.tsx`  
**Status:** ✅ COMPLETE — Sprints 2 + 3 (July 2026)

---

## Design Principles

These six principles explain why the architecture is the way it is. Future contributors should understand the intent, not just the implementation.

- **Booking is the single source of truth.** All views read from the `Booking` model. The schedule never stores its own state.
- **Schedule is a view over bookings, not a separate data model.** Adding a new view (month, timeline, vehicle) requires no schema changes — only a new render layer.
- **Dashboard focuses on today's operations.** It answers: "What am I doing right now?"
- **Schedule focuses on planning and reviewing lessons.** It answers: "How does my week look? What happened last month?"
- **Availability controls when instructors can be booked.** Working hours and blocked dates live in `Availability` — not in the schedule.
- **Google Calendar mirrors DriveBook; DriveBook owns the data.** Google Calendar sync is an export. DriveBook is the authoritative record.

---

## Purpose

The scheduling workspace is a dedicated page for planning and reviewing lessons. It is separate from the dashboard (`/dashboard`) which is focused on today's operations.

| | Dashboard `/dashboard` | Schedule `/dashboard/schedule` |
|---|---|---|
| Scope | Today + next 5 | ±60 days |
| Purpose | Daily operations snapshot | Planning workspace |
| Render | Server (fast, always fresh) | Client (needs navigation state) |
| Views | Today timeline only | Today / Week / Agenda |
| Data source | Server-side DB fetch | `GET /api/bookings` client fetch |

---

## Navigation

Schedule is a **first-class core nav item** in `DashboardNav.tsx` between Bookings and Clients:

```
Dashboard · Bookings · Schedule · Clients · Earnings
```

Added in Sprint 2 (July 2026).

---

## Three Views

### Today
Reuses the `TodayWorkspace` component (same as the dashboard Today Workspace).  
Receives `instructorName` from `useSession()` so the greeting is personalised.  
Shows today's lessons in chronological order with summary cards.

### Week
A 7-column time grid showing the instructor's week.

**Features:**
- Hour gutter (6am–9pm, 15 visible hours at 64px/hour)
- Day headers — today column highlighted in sky blue
- Booking blocks positioned absolutely by `startTime` and `duration`
- **Current time indicator** — red dot + horizontal line, updates every 60 seconds, only in today's column
- **Auto-scroll** — on mount, scrolls to current hour minus 80px so the current time is near the top
- Week navigation: ← / → arrows, "Today" button snaps back to current week
- Week starts on Monday

**Overlap handling:** Blocks are absolutely positioned. If two lessons overlap in the same column they will stack (one covers the other). No collision algorithm — single-instructor use means overlaps are rare. Deferred to Sprint 5 (fleet/multi-instructor).

### Agenda
A chronological date-grouped list with range filter.

**Ranges:**
| Tab | What it shows |
|-----|--------------|
| Today | Today's lessons only |
| This Week | Next 7 days from today |
| This Month | Next 30 days from today |
| Past 30 Days | Last 30 days in reverse order |

---

## Booking Cards

Used in both Week and Agenda views. Each card shows:
- Student name
- Time range (start – end) + pickup suburb (extracted from address)
- Status badge (dot + label from `lib/config/booking-status.ts`)
- Left-border accent in status colour

Tapping any card navigates to `/dashboard/bookings/[id]` (existing booking detail page).

**Status border colours** match `booking-status.ts`:
- CONFIRMED → emerald
- COMPLETED → sky
- PENDING → amber
- PENDING_PAYMENT → violet
- CANCELLED → rose
- NO_SHOW → orange

---

## Filters (Week + Agenda)

Shown above the view when in Week or Agenda mode:

**Search** — text input, filters by:
- Student name (`clientName`)
- Phone number (whitespace-stripped, so "0470 255 305" matches "0470255305")
- Pickup address / suburb (`pickupAddress`)
- Booking ID (useful for support lookups)

Clears with × button. Placeholder: "Search student, phone, location…"

**Status filter** — dropdown showing only statuses present in the loaded data. Uses `getStatusConfig(s).label` for human-readable names.

**Clear filters** — appears when any filter is active. Resets both in one tap.

**Result count** — shown above agenda groups: "N lessons matching '...'" when filtered.

---

## New Booking Button

A sky "New" button with `+` icon sits in the page header alongside the view switcher. Links to `/dashboard/bookings/new`.

---

## Data Fetch

```
GET /api/bookings
  ?from=<ISO>            // 60 days ago
  &to=<ISO>              // 60 days ahead
  &status=CONFIRMED,COMPLETED,PENDING,PENDING_PAYMENT,NO_SHOW,CANCELLED
  &limit=400
```

The extended `GET /api/bookings` route (updated Sprint 2) accepts `from`, `to`, `status` (comma-separated), and `limit` params. Response is normalised — `clientPhone` merged from booking or client relation, client object stripped.

---

## Components

| Component | File | Used in |
|-----------|------|---------|
| `TodayWorkspace` | `components/instructor/TodayWorkspace.tsx` | Today view |
| `BookingCard` (local) | inline in `schedule/page.tsx` | Week + Agenda views |
| `WeekView` (local) | inline in `schedule/page.tsx` | Week view |
| `AgendaView` (local) | inline in `schedule/page.tsx` | Agenda view |

`BookingCard`, `WeekView`, and `AgendaView` are defined inside the page file — not separate component files. This keeps the schedule page self-contained. Extract to separate files if reuse is needed elsewhere.

---

## Empty States

Every empty state has a short human message and a "New Booking" button where appropriate. The filter empty state deliberately omits the button (user should clear filters, not create a booking).

| Context | Message |
|---------|---------|
| Today — no lessons | "Nothing scheduled today. Enjoy the day off — or create a booking to fill it." |
| This Week — no lessons | "No lessons this week. A quiet week — or a good time to plan ahead." |
| This Month — no lessons | "No lessons scheduled this month. Create a booking to fill your schedule." |
| Past 30 Days — no history | "No completed lessons in the past 30 days. Your lesson history will appear here once you have completed bookings." |
| Filtered — no results | "No lessons match your filters. Try clearing the search or changing the status filter." |

The TodayWorkspace component (used on both the dashboard and Schedule → Today) shares the same empty state: "Nothing scheduled today. Enjoy the day off — or create a booking to fill it."

---

## What Is NOT Built (deferred)

| Feature | Why deferred |
|---------|-------------|
| Drag-and-drop rescheduling | No user demand yet — add after real usage data |
| Month view | Week + Agenda cover the use cases. Month view is low density for a single instructor. |
| Recurring lessons | No recurrence fields in schema |
| Vehicle conflict display | Deferred to Sprint 5 (Vehicle model + Business dashboard) |
| Two-way Google Calendar conflict | Deferred to Sprint 6 |

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Main dashboard (Today Workspace lives here)

### Key files a developer needs to know

| File | What it does |
|------|-------------|
| `app/dashboard/schedule/page.tsx` | The schedule page — all three views live here. `BookingCard`, `WeekView`, `AgendaView` are defined inline (extract when reuse is needed). |
| `components/instructor/TodayWorkspace.tsx` | Today timeline component — used on both the dashboard and Schedule → Today. Props: `bookings`, `instructorName`, `hourlyRate`. |
| `components/instructor/FindNextSlot.tsx` | "Find Next Slot" button used in new booking creation. Searches availability forward from now, returns up to 3 suggestions with date / time / duration / time-until. `onSelect(date, time, duration)` fires when instructor taps a suggestion. |
| `components/BookingFormNew.tsx` | Standard booking form. Accepts `initialDate?: string` (YYYY-MM-DD) and `initialTime?: string` (HH:MM 24h) props to pre-fill the date/time picker — used by FindNextSlot. |
| `lib/config/booking-status.ts` | **Single source of truth for all booking status colours and labels.** Import `getStatusConfig(status)` anywhere a status badge or border colour is needed. Also exports `isActiveStatus()`, `isDoneStatus()`. |
| `app/api/bookings/route.ts` | GET endpoint. Accepts `?from=ISO&to=ISO&status=COMMA,LIST&limit=N`. Used by the schedule page to fetch the ±60-day window. |
| `lib/services/availability.ts` | `getAvailableSlots()` — used by FindNextSlot via the availability API. `invalidateAvailabilityCache()` — call after any booking creation/cancellation. |

### Adding a new view to the Schedule page

1. Define a new component (e.g. `MonthView`) inside `schedule/page.tsx`
2. Add a new `ViewMode` type value
3. Add a button to the view switcher
4. Render conditionally in the `{!loading && !error && (...)}` block
5. Use `BookingCard` for individual booking display — no new card component needed
6. Use `matchesSearch(b, search)` and `b.status === statusFilter` for filter consistency
7. No backend changes needed — the existing fetch covers ±60 days

### Status colour system — quick reference

```ts
import { getStatusConfig } from '@/lib/config/booking-status';

// Badge with dot
const cfg = getStatusConfig(booking.status);
<span className={cfg.badge}>
  <span className={cfg.dot} />
  {cfg.label}
</span>

// Left-border accent (for cards)
<div className={`border-l-4 ${cfg.border}`}>...</div>
```

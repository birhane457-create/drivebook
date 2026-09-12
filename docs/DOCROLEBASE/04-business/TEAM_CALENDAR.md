> **⚠️ Coming Soon** — This feature is planned for the future **BUSINESS** multi-provider tier. It is not yet implemented. BUSINESS is displayed in the subscription UI as Coming Soon with no Stripe price IDs or backend routes.

# Team Calendar

**Route:** `/dashboard/team-calendar`  
**Auth required:** INSTRUCTOR role + BUSINESS tier  

---

## Purpose

A combined calendar view showing availability and bookings across all team instructors. Useful for school admins to see who is available and avoid scheduling conflicts.

---

## What It Shows

- All team instructors' working hours overlaid on a weekly calendar
- Confirmed bookings per instructor (color-coded by instructor)
- Available slots per instructor
- Blocked times (exceptions, PDA tests)

---

## Filtering

- Filter by instructor
- Filter by date range
- Filter by booking status

---

## Related

- [INSTRUCTORS.md](./INSTRUCTORS.md) — Team management
- `docs/03-instructor/AVAILABILITY.md` — Individual availability settings

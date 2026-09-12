> **⚠️ Coming Soon** — This feature is planned for the future **BUSINESS** multi-provider tier. It is not yet implemented. BUSINESS is displayed in the subscription UI as Coming Soon with no Stripe price IDs or backend routes.

# Business — Team Instructors

**Route:** `/dashboard/team`  
**Auth required:** INSTRUCTOR role + BUSINESS tier  

---

## Purpose

BUSINESS tier accounts can manage a team of instructors under one school umbrella.

---

## Adding Instructors

The school owner can invite instructors to join their team. Each team instructor:
- Has their own `Instructor` record
- Is linked to the school owner's account
- Has their own bookings, clients, and availability
- Shares the school's branding (if configured)

---

## Limits

`Instructor.maxInstructors`:
- BASIC: 1 (solo only)
- PRO: 1 (solo only)
- BUSINESS: 999 (Coming Soon — not yet implemented)

---

## Instructor Status

Team instructors go through the same approval process as solo instructors:
- `approvalStatus`: PENDING → APPROVED / REJECTED / SUSPENDED

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Business overview
- [TEAM_CALENDAR.md](./TEAM_CALENDAR.md) — Combined availability
- `docs/05-admin/INSTRUCTOR_APPROVALS.md` — Platform-level approval

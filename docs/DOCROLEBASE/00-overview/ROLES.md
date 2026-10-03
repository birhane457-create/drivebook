# Role Catalogue — DriveBook

**Finding:** APP-H-04  
**Status:** DOCUMENTED  
**Date:** 2026-08-15  
**Authority:** This is the canonical single-document role reference for the platform.

---

## Overview

DriveBook has two role layers:

1. **User roles** — stored on `User.role` (a plain string in the DB, not a Postgres enum)
2. **Admin staff presets** — logical groupings of granular permissions assigned to ADMIN users via `StaffMember.permissions[]`

These are distinct. A user with `role = 'ADMIN'` still has no access to any admin action until a `StaffMember` record with explicit `permissions` is created for them.

---

## 1 — User Roles (`User.role`)

These are the valid values for the `User.role` string field in the database.

| Value | Who | Access |
|-------|-----|--------|
| `CLIENT` | Students booking lessons | Book lessons, manage wallet, view booking history, cancel bookings |
| `INSTRUCTOR` | Driving instructors delivering lessons | Manage schedule, view earnings, configure profile, accept/decline bookings |
| `ADMIN` | Platform operations staff | Admin dashboard access, scoped by `StaffMember.permissions[]` |
| `SUPER_ADMIN` | Platform owners | Full access to all admin actions — no permission check, no dollar limits |

**Default:** `CLIENT` — every new user starts with `role = 'CLIENT'`.

**Guest:** Not a database role. Guests can browse public instructor pages and initiate a booking flow; they are assigned a `CLIENT` role on registration.

### Important string discrepancy

`lib/auth/requireRole.ts` (`requireInstructor()`) checks `user.role !== 'provider'` (lowercase). This is a legacy string from an earlier phase and is the actual runtime value for instructor accounts in the current database. New code should use `'INSTRUCTOR'` consistently — this discrepancy is noted for awareness and should be resolved during a future schema migration.

---

## 2 — Admin Staff Presets (StaffMember permission groupings)

These are NOT stored as a `role` field. They are logical names for common `StaffMember.permissions[]` configurations defined in `lib/rbac/role-presets.ts`.

| Preset name | Typical role | Scope |
|-------------|-------------|-------|
| `ADMIN` | General admin manager | Most platform operations — bookings, providers, clients, documents, credits, disputes view |
| `FINANCE` | Accounts team | Payout processing, financial reports, subscription overrides, credit management |
| `OPERATIONS` | Day-to-day ops | Booking management, document verification, policy management, provider lifecycle |
| `SUPPORT` | Customer support | Client account editing, password resets, booking view, support contact |

The `SUPER_ADMIN` user role bypasses all permission checks — no preset applies.

**Full permission membership** for each preset: see `lib/rbac/role-presets.ts`.  
**Full Role → Permission matrix**: see `RBAC-SPEC.md` Section 2.

---

## 3 — Role Assignment Flow

| Transition | How |
|-----------|-----|
| New user | Always created as `CLIENT` |
| CLIENT → INSTRUCTOR | Admin approves an instructor application; `User.role` set to `INSTRUCTOR` (or `'provider'` — see §1 note) |
| CLIENT/INSTRUCTOR → ADMIN | Super admin sets `User.role = 'ADMIN'` and creates a `StaffMember` record with appropriate `permissions[]` |
| ADMIN → SUPER_ADMIN | Database-level change only — no API route allows self-promotion |

---

## 4 — Related Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | `User.role String @default("CLIENT")` — source of truth for DB values |
| `lib/rbac/permissions.ts` | All 47 permission constants (`PERM.*`) |
| `lib/rbac/checkPermission.ts` | Runtime enforcement — reads `StaffMember.permissions` |
| `lib/rbac/role-presets.ts` | ADMIN / FINANCE / OPERATIONS / SUPPORT preset arrays |
| `lib/auth/requireRole.ts` | `requireInstructor()` and `requirePermission()` helpers for route handlers |
| `docs/DOCROLEBASE/00-overview/RBAC-SPEC.md` | Full permission catalogue and Role→Permission matrix |
| `docs/DOCROLEBASE/08-technical/RBAC_USAGE_GUIDE.md` | Developer guide for adding permission checks to routes |

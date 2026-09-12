# Student Profile & Settings

**Route:** `/client-dashboard/profile`  
**Auth required:** CLIENT role  
**API:** `GET /api/client/profile`, `PUT /api/client/profile`

> Note: There is no `/client-dashboard/settings` page. Profile editing lives at `/client-dashboard/profile`. The mobile bottom nav "Profile" tab links there.

---

## What Can Be Updated

- Display name
- Phone number
- Default pickup address (saved for future bookings)

Email is **read-only** — displayed but cannot be changed through this page.

---

## Password Change

Students do not have a self-service password change form on the profile page. Students who forget their password can use:
1. `/login` → "Forgot password" → reset email
2. The `/set-password?token=...` flow (used after voice-AI bookings)

---

## Account Deletion

Students can request account deletion via support email. Accounts are not deleted automatically due to financial record retention requirements.

---

## Terms Acceptance

The `User` model tracks:
- `termsAcceptedAt` — when the student accepted the terms
- `termsVersion` — which version they accepted (e.g. `"1.0"`)
- `ageDeclaration` — boolean confirming they are 16+

These are set at registration.

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Student home
- `app/client-dashboard/profile/page.tsx` — Profile editing page
- `app/api/client/profile/route.ts` — GET + PUT endpoint

# Student Settings

**Route:** `/client-dashboard/settings`  
**Auth required:** CLIENT role  
**API:** `PATCH /api/client/profile`

---

## What Can Be Updated

- Display name
- Phone number
- Default pickup address (saved for future bookings)
- Password change (requires current password)
- Email notifications preferences

---

## Account Deletion

Students can request account deletion from the settings page. This triggers a support email — accounts are not deleted automatically due to financial record retention requirements.

---

## Terms Acceptance

The `User` model tracks:
- `termsAcceptedAt` — when the student accepted the terms
- `termsVersion` — which version they accepted (e.g. `"1.0"`)
- `ageDeclaration` — boolean confirming they are 16+

These are set at registration and shown in the settings page for reference.

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Student home
- `app/terms/page.tsx` — Terms of Service
- `app/privacy/page.tsx` — Privacy Policy

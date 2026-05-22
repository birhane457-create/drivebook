# Admin Support Centre

**Route:** `/admin/support`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/support/page.tsx`, `app/admin/support/user/[userId]/page.tsx`

---

## Purpose

The Support Centre is the primary tool for admin to help students and instructors. When a user contacts support, admin searches for them here and can take action on their behalf without the user needing to do anything themselves.

---

## User Search

`/admin/support` — search by name or email (min 2 characters). Returns up to 20 matching users with their role, approval status, and join date. Click any user to open their support panel.

Quick links shown when no search is active:
- Pending Instructors → `/admin/instructors?status=PENDING`
- All Clients → `/admin/clients`
- All Bookings → `/admin/bookings`

---

## Per-User Support Panel

**Route:** `/admin/support/user/[userId]`  
**API:** `GET /api/admin/users/[userId]`

Shows the user's full account state and provides action tools.

### Account Info

- Role, email, join date
- Wallet balance (for CLIENT users)
- Instructor: approval status, subscription tier, ABN, withholding rate
- Booking count

### Actions

**Send Message** (`POST /api/admin/contact`)

Sends a message to the user via:
- Email + in-app notification (default)
- Email only
- In-app notification only

All messages are logged to AuditLog with `action: ADMIN_CONTACT_SENT`.

**Password Reset** (`POST /api/admin/users/[userId]/reset-password`)

Sends a 24-hour password reset link to the user's email. Admin-initiated — user doesn't need to request it. Logged to AuditLog with `action: ADMIN_PASSWORD_RESET_SENT`.

**Add Wallet Credit** (CLIENT users only)

Calls `POST /api/admin/clients/[clientId]/wallet/add-credit` with amount and reason. The `clientId` is the `Client` record ID (not the `User` ID) — returned by `GET /api/admin/users/[userId]` as `clientId`. Immediately adds credit to the student's wallet. Logged to AuditLog.

Only available for users with a `CLIENT` record (learner accounts). Instructor accounts have no wallet and will show an error if attempted.

### Quick Links

- View Instructor Profile → `/admin/instructors/[id]`
- Review Documents → `/admin/documents/review/[id]`
- View Client Detail → `/admin/clients/[id]`

---

## APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/admin/users/[userId]` | GET | Full user profile for support panel — includes `clientId` field |
| `POST /api/admin/contact` | POST | Send email + notification to user |
| `POST /api/admin/users/[userId]/reset-password` | POST | Admin-initiated password reset |
| `POST /api/admin/clients/[clientId]/wallet/add-credit` | POST | Add wallet credit (use `clientId` from user profile, not `userId`) |

---

## Audit Trail

Every support action is logged:

| Action | Trigger |
|--------|---------|
| `ADMIN_CONTACT_SENT` | Admin sends message to user |
| `ADMIN_PASSWORD_RESET_SENT` | Admin sends password reset |
| `WALLET_CREDITED` | Admin adds wallet credit |

---

## Related

- [CLIENTS.md](./CLIENTS.md) — Full client management
- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md) — Instructor management
- [AUDIT_LOG.md](./AUDIT_LOG.md) — All admin actions logged here

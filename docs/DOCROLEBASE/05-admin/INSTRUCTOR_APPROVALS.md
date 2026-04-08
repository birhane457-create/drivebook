# Instructor Approvals

**Route:** `/admin/instructors`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/instructors/page.tsx`, `components/admin/InstructorApprovalList.tsx`  
**APIs:** `GET /api/admin/instructors`, `POST /api/admin/instructors/[id]/approve`, `POST /api/admin/instructors/[id]/reject`, `POST /api/admin/instructors/[id]/suspend`

---

## Instructor Lifecycle

```
PENDING → APPROVED
PENDING → REJECTED
APPROVED → SUSPENDED
SUSPENDED → APPROVED  (reinstatement)
```

`Instructor.approvalStatus` field.

---

## Instructor List

Filterable by:
- Status (PENDING, APPROVED, REJECTED, SUSPENDED)
- Search (name, email)

Each row shows: name, email, subscription tier, status, documents verified, date registered.

---

## Approve

Sets `approvalStatus: "APPROVED"` and `isVerified: true`. Sends an approval email to the instructor.

**API:** `POST /api/admin/instructors/[id]/approve`

---

## Reject

Sets `approvalStatus: "REJECTED"`. Requires a rejection reason. Sends a rejection email to the instructor.

**API:** `POST /api/admin/instructors/[id]/reject`

---

## Suspend

Sets `approvalStatus: "SUSPENDED"` and `isActive: false`. The instructor cannot create new bookings while suspended. Existing confirmed bookings are not affected.

**API:** `POST /api/admin/instructors/[id]/suspend`

---

## Document Review

**Route:** `/admin/documents/review/[instructorId]`  
**File:** `app/admin/documents/review/[instructorId]/page.tsx`

Admins review uploaded documents before approving an instructor:
- Driver's licence (front + back)
- Insurance policy
- Police check
- WWC check
- Photo ID
- Vehicle registration

Document expiry dates are shown. Expired documents trigger a warning.

**API:** `GET /api/admin/documents/instructor/[instructorId]`, `POST /api/admin/documents/compliance`

---

## Instructor Detail

**Route:** `/admin/instructors/[id]`  
**File:** `app/admin/instructors/[id]/page.tsx`

Full instructor profile view including:
- All profile fields
- Subscription status and history
- Booking history
- Document status
- Audit log entries

---

## ABN Verification

**Route:** `POST /api/admin/instructors/[id]/verify-abn`  
**File:** `app/api/admin/instructors/[id]/verify-abn/route.ts`

Admins can manually verify or revoke an instructor's ABN. This is used when the ABR API is unavailable or the admin has confirmed the ABN via other means.

### Request Body

```json
{
  "verified": true,
  "entityName": "John Smith Driving Pty Ltd",
  "note": "Confirmed via ABR lookup"
}
```

### Effect on Instructor Record

| Field | When `verified: true` | When `verified: false` |
|-------|----------------------|------------------------|
| `abnVerified` | `true` | `false` |
| `abnStatus` | `ACTIVE` | `REVIEW_REQUIRED` |
| `abnEntityName` | Set from `entityName` | Unchanged |
| `abnVerifiedAt` | Current timestamp | `null` |
| `abnVerifiedBy` | Admin user ID | Unchanged |
| `withholdingTaxRate` | `0` (no withholding) | `47` (47% withholding) |

### Withholding Tax Gate on Payouts

`withholdingTaxRate` directly controls how much is withheld from instructor payouts:

- Verified ABN → `withholdingTaxRate: 0` → full payout amount
- Unverified or no ABN → `withholdingTaxRate: 47` → 47% withheld from each payout

This is enforced in `payout-service.ts` at payout build time. An instructor with an unverified ABN will still receive payouts, but 47% is withheld and retained by the platform.

### Audit Trail

Every verify/revoke action creates an `AuditLog` entry:

| Action | Trigger |
|--------|---------|
| `ABN_VERIFIED` | `verified: true` |
| `ABN_VERIFICATION_REVOKED` | `verified: false` |

Metadata includes: `abn`, `entityName`, `note`.

### Automatic ABN Recheck

A **weekly** cron (Mondays 2am AEST) at `GET /api/cron/recheck-abn` re-validates all instructor ABNs against the ABR API. If an ABN that was previously active is found to be cancelled or invalid, it sets `abnVerified: false`, `withholdingTaxRate: 47`, and fires an alert via the alert service.

Requires `ABR_GUID` env var to be set. If not configured, the cron returns `{ skipped: true }` and does nothing.

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Platform overview
- [DOCUMENTS.md](./DOCUMENTS.md) — Document compliance review
- [PAYOUTS.md](./PAYOUTS.md) — How ABN status gates payout withholding
- [AUDIT_LOG.md](./AUDIT_LOG.md) — ABN verification events
- `docs/03-instructor/SETTINGS.md` — What instructors submit for approval

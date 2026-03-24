# Documents & Compliance

**Routes:** `/admin/documents`, `/admin/documents/review/[instructorId]`  
**Auth required:** ADMIN or SUPER_ADMIN  
**Files:** `app/admin/documents/page.tsx`, `app/admin/documents/review/[instructorId]/page.tsx`  
**APIs:** `GET /api/admin/documents/compliance`, `POST /api/admin/documents/compliance`, `GET /api/admin/documents/instructor/[instructorId]`, `POST /api/admin/documents/instructor/[instructorId]/approve`, `POST /api/admin/documents/instructor/[instructorId]/expiry`, `POST /api/admin/documents/instructor/[instructorId]/upload`

---

## Documents Overview Page — `/admin/documents`

Lists all instructors with a compliance summary. Each row shows:

- Instructor name and email
- Overall compliance status: `valid` / `expiring` / `expired`
- Individual document issues (e.g. "License: expired", "WWC: missing")
- Whether documents have been formally verified (`documentsVerified`)
- Active/inactive status

### Status Logic

Computed per instructor by `GET /api/admin/documents/compliance`:

| Status | Condition |
|--------|-----------|
| `valid` | All docs present, no expiry within 30 days |
| `expiring` | At least one doc expires within 30 days, none expired |
| `expired` | At least one doc is missing or past expiry |

Overall status = worst of the four tracked docs (license, insurance, police check, WWC).

### Bulk Actions (POST /api/admin/documents/compliance)

| Action | Effect |
|--------|--------|
| `deactivate` | Sets `isActive: false` for a specific instructor |
| `sendReminder` | Queues a document renewal reminder (logged, email TBD) |
| `autoProcess` | Scans all active instructors — deactivates any where ALL four docs are expired |

---

## Document Review Page — `/admin/documents/review/[instructorId]`

Per-instructor document review. Fetches from `GET /api/admin/documents/instructor/[instructorId]`.

### Document Fields

| Field | Label | Expiry Tracked | Required |
|-------|-------|----------------|----------|
| `licenseImageFront` | Driver License (Front) | Yes (`licenseExpiry`) | Yes |
| `licenseImageBack` | Driver License (Back) | No | Yes |
| `insurancePolicyDoc` | Insurance Policy | Yes (`insuranceExpiry`) | Yes |
| `policeCheckDoc` | Police Check | Yes (`policeCheckExpiry`) | Yes |
| `wwcCheckDoc` | Working with Children Check | Yes (`wwcCheckExpiry`) | Yes |
| `photoIdDoc` | Photo ID | No | Yes |
| `certificationDoc` | Instructor Certification | No | No |
| `vehicleRegistrationDoc` | Vehicle Registration | No | Yes |

### Traffic Light System

Each document row shows a colored dot:

| Color | Meaning |
|-------|---------|
| Green ✓ | Document present, expiry valid (>30 days) |
| Yellow ! | Document present but expiry within 30 days, or no expiry date set |
| Red ✗ | Document missing or expired |

Overall header status = worst of all tracked docs.

### Actions

- Save Expiry Dates — `POST /api/admin/documents/instructor/[instructorId]/expiry` — persists the four expiry date inputs
- Approve All Documents — `POST /api/admin/documents/instructor/[instructorId]/approve` — sets `documentsVerified: true` and records `documentsVerifiedAt`
- Upload / Replace — `POST /api/admin/documents/instructor/[instructorId]/upload` (multipart) — replaces a specific document field
- Remove — same upload endpoint with `{ field, remove: true }` — clears the document URL

### Expiry Summary Panel

Shows a 2×2 grid of the four expiry-tracked documents with color-coded date badges. Useful for quick at-a-glance review before approving.

---

## Compliance Data Source

Expiry dates are stored inside the `workingHours` JSON field on the `Instructor` model under `workingHours.expiry`:

```json
{
  "expiry": {
    "licenseExpiry": "2026-06-01",
    "insuranceExpiry": "2026-09-15",
    "policeCheckExpiry": "2027-01-01",
    "wwcCheckExpiry": "2026-12-31"
  }
}
```

This is a known schema quirk — expiry dates are embedded in `workingHours` rather than top-level fields.

---

## Related

- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md) — Approve/reject/suspend flow
- [AUDIT_LOG.md](./AUDIT_LOG.md) — Document verification events are logged

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
REJECTED → APPROVED   (reinstatement)
```

`Instructor.approvalStatus` field.

---

## Instructor List

The list uses `InstructorApprovalList` — a client component with inline actions.

**Each row shows:**
- Avatar + name
- Approval status badge (PENDING / APPROVED / REJECTED / SUSPENDED)
- Subscription tier badge (PRO / STUDIO / BUSINESS — BASIC not shown)
- Compliance dot (green = all valid, yellow = expiring soon, red = expired/missing)
- Email, phone, suburb
- Booking count, average rating, hourly rate
- Action buttons (context-aware per status)
- Expand chevron → shows compliance expiry dates, document status, stats, bio

**Filter tabs:** All / PENDING / APPROVED / REJECTED / SUSPENDED (via `?status=` query param)

**Search:** Name, email, phone, suburb — client-side filter

---

## Inline Actions

All actions happen without leaving the list page:

| Action | When shown | Effect |
|--------|-----------|--------|
| Approve | PENDING | Sets `approvalStatus = APPROVED`, `isVerified = true`. Sends approval email. |
| Reject | PENDING | Opens reason modal (min 10 chars). Sets `approvalStatus = REJECTED`. Sends rejection email. |
| Suspend | APPROVED | Opens reason modal. Sets `approvalStatus = SUSPENDED`, `isActive = false`. |
| Reactivate | SUSPENDED or REJECTED | Calls approve endpoint. Sets `approvalStatus = APPROVED`. |
| Profile | Any | Links to `/admin/instructors/[id]` |
| Docs | Any | Links to `/admin/documents/review/[id]` |

After each action, the page reloads to reflect the new state. A flash toast confirms success.

---

## Instructor Detail

**Route:** `/admin/instructors/[id]`  
**File:** `app/admin/instructors/[id]/page.tsx`

Three tabs: Overview / Bookings / Documents

**Overview tab shows:**
- Booking stats (completed, upcoming, cancelled, pending)
- Document status (license, insurance, police check, WWC) with expiry dates
- Subscription tier, status, hourly rate, payout method
- ABN number, verification status, withholding tax rate
- Link to manage ABN verification

**Bookings tab:** All bookings for this instructor with status, client, date, price

**Documents tab:** Document images with view links, expiry dates, link to full document review page

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

## ABN Verification

**Route:** `POST /api/admin/instructors/[id]/verify-abn`

Admins can manually verify or revoke an instructor's ABN.

| Field | When `verified: true` | When `verified: false` |
|-------|----------------------|------------------------|
| `abnVerified` | `true` | `false` |
| `abnStatus` | `ACTIVE` | `REVIEW_REQUIRED` |
| `withholdingTaxRate` | `0` | `47` |

A weekly cron (`GET /api/cron/recheck-abn`) re-validates all instructor ABNs against the ABR API. If an ABN is cancelled, `abnVerified` is cleared and payouts are blocked.

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Platform overview with pending count alert
- [DOCUMENTS.md](./DOCUMENTS.md) — Document compliance review
- [PAYOUTS.md](./PAYOUTS.md) — How ABN status gates payout withholding
- [AUDIT_LOG.md](./AUDIT_LOG.md) — ABN verification events

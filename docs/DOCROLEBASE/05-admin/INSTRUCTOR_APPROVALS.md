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
- Expand chevron → shows: contact info (email, phone, joined date, terms accepted date), compliance expiry dates, document status, stats, bio

**Filter tabs:** All / PENDING / APPROVED / REJECTED / SUSPENDED (via `?status=` query param)

The "Pending" tab shows a live count badge (amber) when there are instructors awaiting approval. An amber alert banner also appears at the top of the list when PENDING instructors exist, with a "Review Now →" shortcut. PENDING instructors cannot create bookings until approved.

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

**Four tabs: Overview / Subscription / Bookings / Documents**

### Overview tab
- Booking stats (completed, upcoming, cancelled, pending)
- Document status (licence, insurance, police check, WWC) with expiry dates
- Subscription & Tax card: tier, status, hourly rate, payout method, Stripe Connect status, ABN, withholding rate
- Joined date (`user.createdAt`), Terms accepted date (`user.termsAcceptedAt`)
- Link to manage ABN verification

### Subscription tab ⭐ New (July 2026)
Full subscription management panel. See [ADMIN_BUSINESS_RULES §7a](../00-overview/ADMIN_BUSINESS_RULES.md#7a-subscription-management-admin-ui) for complete reference.
- DB state vs live Stripe state side-by-side
- Automatic drift detection with one-click Force Sync
- Actions: Force Sync, Cancel at Period End, Cancel Immediately, Link Stripe Sub, Override Tier/Status, Delete duplicate rows
- All actions audit-logged

### Bookings tab
All bookings for this instructor — status, client, date, price. Link to `/admin/bookings` for full booking detail.

### Documents tab
Document images with view links, expiry date summary, link to full document review page (`/admin/documents/review/[id]`).

**Note:** To approve, reject, or set expiry dates, use the full Document Review page, not this tab — the tab is read-only summary only.

---

## Document Review

**Route:** `/admin/documents/review/[instructorId]`  
**File:** `app/admin/documents/review/[instructorId]/page.tsx`

Admins review uploaded documents before approving an instructor. Shows all 8 document types in a grid.

**Per-document actions:**
- **View** — opens URL in new tab
- **Reject** — opens modal (reason required) → nulls the field, sets `documentsVerified=false`, sends SMS to instructor with rejection reason, writes `DOCUMENT_REJECTED` audit log
- **Remove** — nulls field without notification (admin-only cleanup)
- **Upload/Replace** — admin uploads file on behalf via Cloudinary

**Expiry dates** — admin sets license/insurance/police/WWC expiry via date inputs. Saved to real DateTime columns in DB (`licenseExpiry` etc.) AND `workingHours.expiry` JSON for compatibility.

**Page-level actions:**
- **Save Expiry Dates** → `POST /api/admin/documents/instructor/[id]/expiry`
- **Approve All Documents** → `POST /api/admin/documents/instructor/[id]/approve` — sets `documentsVerified=true`, sends SMS, writes `DOCUMENTS_APPROVED` audit log

**Admin Document API routes (complete):**

| Route | Method | What it does |
|---|---|---|
| `/api/admin/documents/instructor/[id]` | GET | Returns all 8 doc fields + expiry dates |
| `/api/admin/documents/instructor/[id]/approve` | POST | Approves all documents + SMS + audit log |
| `/api/admin/documents/instructor/[id]/reject` | POST | Rejects one document (requires `documentKey` + `reason`) + SMS + audit log |
| `/api/admin/documents/instructor/[id]/expiry` | POST | Sets 4 expiry dates (writes to real columns + JSON fallback) |
| `/api/admin/documents/instructor/[id]/upload` | POST | Admin uploads/removes doc on behalf |
| `/api/admin/documents/compliance` | GET | Compliance status for all instructors |
| `/api/admin/documents/compliance` | POST | Batch actions: `deactivate`, `sendReminder`, `autoProcess` |

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

# Instructor Documents & Account Setup

**Route:** `/dashboard/documents`  
**Auth required:** INSTRUCTOR role  
**File:** `app/dashboard/documents/page.tsx`  
**APIs:** `GET/POST /api/instructor/documents`, `GET /api/instructor/profile`  
**Last updated:** July 2026

---

## What the Page Does

Despite the nav label "Documents", this page is titled **"Account Setup"** and serves two purposes:

1. A **5-step setup progress checklist** — shows overall account readiness for accepting bookings
2. A **document upload interface** — all 8 document types, collapsible rows, upload/replace/view

---

## Setup Progress Checklist

| Step | Condition | Fix link |
|---|---|---|
| Profile complete | `name`, `phone`, `bio`, `hourlyRate`, `baseAddress` all set | `/dashboard/profile` |
| Working hours set | `workingHours` JSON is non-empty | `/dashboard/settings` |
| Tax / ABN verified | `abn` present AND `abnVerified = true` | `/dashboard/settings` |
| Documents uploaded | All 7 required docs uploaded | (same page) |
| Admin verification | `documentsVerified = true` | Awaiting admin action |

Score: **N / 5**. Each step lights green when complete. 1–2 business day turnaround for admin verification after all docs uploaded.

---

## Required & Optional Documents

| Field key | Label | Required | Expiry tracked |
|---|---|---|---|
| `licenseImageFront` | Licence (Front) | ✅ | `licenseExpiry` |
| `licenseImageBack` | Licence (Back) | ✅ | — |
| `insurancePolicyDoc` | Insurance Policy | ✅ | `insuranceExpiry` |
| `policeCheckDoc` | Police Check | ✅ | `policeCheckExpiry` |
| `wwcCheckDoc` | WWC Check | ✅ | `wwcCheckExpiry` |
| `photoIdDoc` | Photo ID | ✅ | — |
| `vehicleRegistrationDoc` | Vehicle Rego | ✅ | — |
| `certificationDoc` | Certification | ❌ optional | — |

**7 required** — all 7 must be uploaded before admin can verify.  
**1 optional** — certification (e.g., dual-control instructor cert).

---

## Upload Flow

1. Tap any document row to expand it
2. Tap "Upload document" — file picker opens
3. Accepted: JPG, PNG, or PDF · Max 10 MB
4. File sent to `POST /api/instructor/documents` as FormData (`file` + `documentType`)
5. Cloudinary stores the file; DB field updated with URL
6. Row refreshes — shows "Document on file" + view link

Replacing: tap "Replace document" to overwrite. The previous URL is lost (no versioning).

---

## Expiry Display

Four documents show expiry status from the DB (`licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry`):

| Status | Colour | Condition |
|---|---|---|
| Valid | Emerald | Expiry > 30 days away |
| Expiring soon | Amber | Expiry ≤ 30 days away |
| Expired | Red | Expiry date in the past |

Instructors do not set expiry dates themselves — admin sets them during document review.

---

## What Happens After Upload

1. Instructor sees "All documents uploaded — awaiting admin review" banner
2. Admin is NOT auto-notified (manual check via `/admin/documents`)
3. Admin reviews documents at `/admin/documents/review/[instructorId]`
4. Admin can:
   - **Approve all** → sets `documentsVerified = true`, sends SMS, writes audit log
   - **Reject individual doc** → nulls that field, `documentsVerified = false`, sends SMS with reason
   - **Set expiry dates** → written to both dedicated DB columns AND `workingHours.expiry` JSON (dual-write for compatibility)
5. Instructor sees green "All documents verified" banner after approval
6. Expiry alerts sent to instructor (in-app + email) 30 days before any expiry

---

## Next-Step Banner Logic

| Condition | Banner |
|---|---|
| `documentsVerified = true` + no expiring docs | ✅ "All documents verified — you're fully approved" |
| `documentsVerified = true` + any doc expiring/expired | ⚠️ "Action needed: N document(s) expiring" |
| `uploadedCount < requiredCount` | 🔼 "Next step: Upload [next missing doc]" |
| All uploaded, awaiting admin | ⏳ "All documents uploaded — awaiting admin review" |

---

## Other Account Sections (bottom of page)

Quick-links to: Profile, Settings & Tax, Subscription & Billing, Terms & Policies.

---

## Related

- [ONBOARDING_APPROVAL.md](./ONBOARDING_APPROVAL.md) — Admin approval pipeline
- [SETTINGS.md](./SETTINGS.md) — Working hours, ABN
- [DASHBOARD.md](./DASHBOARD.md) — Dashboard overview, nav structure

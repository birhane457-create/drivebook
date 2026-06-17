# Document Verification

## Overview
The Document Verification system enables instructors to upload verification documents (license, insurance, police checks, certifications, etc.) and admins to review and approve them. The system stores documents in Cloudinary and tracks verification status with traffic light compliance monitoring.

**Status**: ✅ 85-90% IMPLEMENTED (June 14, 2026)  
**Instructor Upload/Retrieval**: ✅ 100% COMPLETE  
**Admin Approval Workflow**: ✅ 95% COMPLETE  
**Admin UI Dashboard**: ✅ 95% COMPLETE  
**Document Expiration Tracking**: ✅ 100% COMPLETE  
**Notifications**: ✅ 100% COMPLETE  
**Missing**: Reject button in individual review UI (API exists, 5-10% remaining)  
**Authentication**: NextAuth (instructor + admin role verification)  

---

## AS IS - Current Implementation (85-90% Complete)

### ✅ FULLY IMPLEMENTED: Instructor Upload/Retrieval (100%)

**Upload Endpoint**: `POST /api/instructor/documents`
- Accepts FormData: `file` + `documentType` (one of 10 types)
- Validates document type against whitelist
- Uploads to Cloudinary with instructor ID prefix
- Updates Instructor record with document URL
- Response: `{ success: true, url: "..." }`
- Mobile support: Also available at `POST /api/instructor/documents/mobile`

**Retrieval Endpoint**: `GET /api/instructor/documents`
- Returns all 10 document fields from Instructor record
- Shows `documentsVerified` (boolean) + `documentsVerifiedAt` (timestamp)
- Mobile support: Also available

### ✅ FULLY IMPLEMENTED: Admin Approval Workflow (95%)

**Get Instructor Documents (Admin)**: `GET /api/admin/documents/instructor/{instructorId}`
- Admin-only endpoint (requires ADMIN or SUPER_ADMIN role)
- Returns instructor with all document URLs + expiry dates
- Expiry dates stored in `workingHours.expiry` JSON object

**Approve Documents**: `POST /api/admin/documents/instructor/{instructorId}/approve`
- Admin-only (requires ADMIN or SUPER_ADMIN role)
- Sets `documentsVerified=true` and `documentsVerifiedAt=now()`
- Sends SMS notification to instructor: "Your documents have been verified and approved"
- Returns: `{ success: true }`

**Reject Document**: `POST /api/admin/documents/instructor/{instructorId}/reject`
- Admin-only endpoint
- Accepts JSON: `{ documentKey: "licenseImageFront", reason: "License expired" }`
- Sets specific document field to null and `documentsVerified=false`
- Sends SMS to instructor with document name + reason
- Example SMS: "Your Driver's License (Front) was rejected. Reason: License expired. Please re-upload the correct document."
- Returns: `{ success: true }`

**Save Expiry Dates**: `POST /api/admin/documents/instructor/{instructorId}/expiry`
- Admin-only endpoint
- Accepts JSON with expiry dates: `{ licenseExpiry, insuranceExpiry, policeCheckExpiry, wwcCheckExpiry }`
- Stores in `workingHours.expiry` JSON
- Returns: `{ success: true }`

**Upload on Behalf (Admin)**: `POST /api/admin/documents/instructor/{instructorId}/upload`
- Admin can upload document for instructor
- Accepts FormData or JSON with field + remove flag
- Can also remove documents

### ✅ FULLY IMPLEMENTED: Admin UI - Compliance Dashboard (95%)

**File**: `app/admin/documents/page.tsx`

**Features**:
- 📊 **Traffic Light System**: 🟢 Valid, 🟡 Expiring (within 30 days), 🔴 Expired/Missing, ⚪ In Review
- 🔍 **Filter by Status**: all/valid/expiring/expired/review
- 🔎 **Search**: By name, email, or phone
- 📋 **Stats Cards**: Total instructors, counts per status
- ⚙️ **Batch Actions**:
  - "Auto-Process All" - Deactivate all with all docs expired
  - "Send Reminder" - Send SMS + email to instructor for expiring docs
  - "Deactivate" - Mark instructor as inactive
- 🔄 **Expandable Rows**: Show contact info, expiry dates, issues list
- 📱 **Responsive**: Grid layout, works mobile + desktop

**Data Flow**:
1. Calls `GET /api/admin/documents/compliance`
2. Gets list of all instructors with compliance status
3. Displays in table with traffic lights
4. User clicks "Review" → navigates to individual review page

### ✅ FULLY IMPLEMENTED: Admin UI - Individual Review Page (95%)

**File**: `app/admin/documents/review/{instructorId}/page.tsx`

**Features**:
- 👤 **Header**: Instructor name, email, phone, overall traffic light
- 📄 **Document Grid**: Table with traffic light per document
  - Traffic light color: 🟢 Valid, 🟡 Expiring soon, 🔴 Expired/Missing
  - Shows document label + required flag
  - "View" button (opens document in new tab)
  - "Remove" button (clears document URL)
  - "Upload" / "Replace" button (file picker)
- 📅 **Expiry Dates**: Date inputs for each document with validation
  - Automatically calculates and shows: "Valid", "Expiring soon", "Expired", "No date set"
  - Highlights in red/yellow/green based on days remaining
- 📋 **Expiry Summary**: Shows all 4 key document expiry dates with status
- 🎯 **Action Buttons**:
  - **"Save Expiry Dates"** - Calls PATCH to save dates to database
  - **"Approve All Documents"** - Approves all docs + sends SMS notification
  - ⚠️ **MISSING**: "Reject Document" button (API exists, no UI button)

**Data Flow**:
1. Loads instructor data via `GET /api/admin/documents/instructor/{id}`
2. Displays documents with current URLs + expiry dates
3. Admin can:
   - Update expiry dates + save
   - Upload missing/replacement documents
   - Remove documents
   - Approve all documents
   - (Reject must be done via API directly or table)

### ✅ FULLY IMPLEMENTED: Document Expiration & Compliance (100%)

**Compliance Endpoint**: `GET /api/admin/documents/compliance`
- Admin-only
- Scans all instructors and checks 4 key documents:
  - Driver License (Front)
  - Insurance Policy
  - Police Check
  - WWC Check
- For each document, checks:
  - ❌ Missing? → "expired" status + "missing" issue
  - ✅ Has URL but no expiry date? → "expiring" status + "no expiry set" issue
  - ❌ Expiry in past? → "expired" + "expired" issue
  - 🟡 Expiry < 30 days? → "expiring" + "expiring soon" issue
  - ✅ Expiry > 30 days future? → "valid" + no issue
- Returns overall status per instructor + issues list
- Response includes: instructorId, name, email, phone, status, issues[], isActive, documentsVerified, all 4 expiry dates

**Batch Processing**: `POST /api/admin/documents/compliance`
- **Action: 'deactivate'** - Mark instructor as inactive (isActive=false)
- **Action: 'sendReminder'** - Send SMS + email reminder for expiring documents
  - Queries all expiring/expired docs
  - Sends SMS via `smsService`
  - Sends email via `emailService` with list of expiring docs and days remaining
  - Email template: "Please upload updated documents to avoid suspension"
- **Action: 'autoProcess'** - Bulk deactivate all instructors with ALL 4 docs expired
  - Iterates all active instructors
  - If all 4 docs expired, sets isActive=false
  - Returns count of deactivated

### ✅ FULLY IMPLEMENTED: Notifications (100%)

**SMS Notifications** (via `smsService.sendSMS`):
- ✅ On approve: "Your documents have been verified and approved! You can now accept bookings."
- ✅ On reject: "Your [DocType] was rejected. Reason: [reason]. Please re-upload the correct document."
- ✅ On batch reminder: (via email, see below)

**Email Notifications** (via `emailService.sendGenericEmail`):
- ✅ On expiry reminder: 
  - Subject: "Action required: X document(s) expiring — {name}"
  - Lists each expiring doc with days remaining or "EXPIRED"
  - Includes link to `/dashboard/documents` to re-upload
  - HTML formatted

**In-App Notifications** (via `notifyDocumentExpiring`):
- ✅ Creates notification when document is expiring soon

---

### ⚠️ MINOR GAP (5-10% Remaining)

**Missing UI Element**: "Reject Document" button in individual review page

- **What exists**:
  - ✅ Reject endpoint: `POST /api/admin/documents/instructor/{id}/reject`
  - ✅ API is fully functional
  - ✅ Sends SMS with reason to instructor
  - ✅ Clears document URL + sets verified=false

- **What's missing**:
  - ❌ No "Reject" button in `/admin/documents/review/{id}/page.tsx`
  - ❌ User cannot reject individual documents from UI
  - ❌ User must call API directly or use API testing tools

- **Workaround**: Admin can use browser DevTools console to call the reject endpoint, or the endpoint can be called from another admin dashboard UI component (if one exists)

- **Effort to complete**: ~30 minutes (add button + modal for reason input)

---

## AS IT SHOULD BE - Recommended Enhancements

### 1. Add "Reject Document" Button to Review UI (QUICK WIN - 30 MIN)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Admin can reject via API but no UI button exists in individual review page | Incomplete workflow: approve button exists but not reject |
| **Missing UI** | Add "Reject Document" button next to each document in the table | Modal/dialog to select reason |
| **Implementation** | In `/admin/documents/review/{id}/page.tsx`, add button + modal with reason textarea. Call `POST /api/admin/documents/instructor/{id}/reject` with documentKey + reason. Refresh document list. | |
| **Effort** | Low (~30 minutes: button + modal component + API call) | **PRIORITY: Do this first to reach 100%** |

### 2. Audit Logging for Document Actions (COMPLIANCE - 1 HOUR)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Document approvals/rejections happen but no audit trail created | Compliance requirement: must track who approved/rejected what and when |
| **Enhancement** | Create AuditLog entry for each approve/reject action | Track decision history for compliance |
| **Implementation** | In approve/reject endpoints, create: `prisma.auditLog.create({ action: 'DOCUMENT_APPROVAL'/'DOCUMENT_REJECTION', actorId, targetId, metadata: { documentTypes, reason } })` | |
| **Effort** | Low (~1 hour: add audit logging to 2 endpoints) | **PRIORITY: Do second** |

### 3. Bulk Reject in Compliance Dashboard (NICE-TO-HAVE - 2 HOURS)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Compliance page has "Auto-Process" but no bulk reject action | Users can only reject individual documents from review page |
| **Enhancement** | Add checkbox to select multiple instructors + "Bulk Reject Reason" action | Batch reject workflow for efficiency |
| **Implementation** | Add checkboxes to table rows. Post to compliance endpoint with action='bulkReject', instructorIds[], reason | |
| **Effort** | Medium (~2 hours: checkboxes, modal, API endpoint) | Phase 2 (lower priority) |

### 4. Document Upload History & Versioning (NICE-TO-HAVE - 4 HOURS)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Overwriting a document loses previous version | Can't see when documents were updated or approval history |
| **Enhancement** | Store document history: `docHistory: [{ url, uploadedAt, approvedAt, approvedBy, status }]` | Full audit trail |
| **Implementation** | Schema migration: document fields from String to JSON array. Update upload/approve logic to append to history. | |
| **Effort** | High (~4-5 hours: schema migration, history UI, queries) | Phase 2 |

### 5. Document Quality Checks & OCR (ADVANCED - 6+ HOURS)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | No validation that uploaded file is actually a valid document | Could upload blurry/unreadable images |
| **Enhancement** | Use Cloudinary OCR or AWS Textract to verify document contains expected info | Catch invalid uploads early |
| **Implementation** | Call OCR service after upload. If fails, flag for manual review. Async, non-blocking. | |
| **Effort** | High (~6-8 hours: OCR integration, manual review queue) | Phase 3 |

### 6. Auto-Expiry Notifications Cron (NICE-TO-HAVE - 2 HOURS)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Reminders only sent on admin request (sendReminder action) | Should automatically notify instructors 30/7 days before expiry |
| **Enhancement** | Add cron job: runs daily, checks expiring documents, sends notifications | Proactive reminders reduce compliance issues |
| **Implementation** | `app/api/cron/document-expiry-alerts/route.ts` - daily check for docs expiring in 30/7 days, send email/SMS | |
| **Effort** | Medium (~2-3 hours: cron job, query, notification logic) | Phase 2 |

### 7. Instructor Dashboard - Document Status Page (NICE-TO-HAVE - 2 HOURS)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Instructor uploads documents but doesn't see verification status or admin feedback | No feedback loop for instructor |
| **Enhancement** | Create `/dashboard/documents` page showing upload status + approval status + admin comments | Transparency and UX |
| **Implementation** | Display all 10 documents, their status (pending/approved/rejected), expiry dates, upload form | |
| **Effort** | Low-Medium (~2-3 hours: UI page, API calls) | Phase 2 |

### 8. Document Expiration Enforcement on Booking (COMPLIANCE - 2 HOURS)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Documents can be expired but instructor can still accept bookings | Risk: instructors working without valid credentials |
| **Enhancement** | Check if all required docs are valid/not expired before allowing booking creation | Compliance gate |
| **Implementation** | In booking creation endpoint, check: all 4 docs have URLs + not expired. If not, return 403 "Credentials expired" | ||
| **Effort** | Low (~2 hours: validation logic in booking endpoint) | Phase 1 |

---

## Priority Implementation Path to 100%

### IMMEDIATE (30 min - 1 hour)
- ✅ Add "Reject Document" button to review UI (get to 100%)
- ✅ Add audit logging (compliance requirement)

### PHASE 1 (2-3 hours)
- Document expiration enforcement on booking creation
- Instructor dashboard status page

### PHASE 2 (Optional, 6-8 hours)
- Auto-expiry notifications cron
- Bulk reject in compliance dashboard
- Document versioning & history

### PHASE 3 (Optional, 6+ hours)
- OCR document validation
- Third-party credential verification

---

## Missing Implementation - Admin Review API

**Critical**: The document verification workflow is incomplete. Here's what needs to be built:

```typescript
// NEEDED: PATCH /api/admin/documents/{instructorId}
// Admin approves/rejects documents

export async function PATCH(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role !== 'ADMIN') return 401;

  const { action, documentTypes, reason } = await req.json();
  // action: 'APPROVE' | 'REJECT' | 'REQUEST_MORE'
  // documentTypes: ['licenseImageFront', 'insurancePolicyDoc', ...]
  
  // Update Instructor
  if (action === 'APPROVE') {
    await prisma.instructor.update({
      where: { id: instructorId },
      data: {
        documentsVerified: true,
        documentsVerifiedAt: new Date(),
      },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'DOCUMENT_VERIFICATION',
      actorId: session.user.id,
      targetType: 'INSTRUCTOR',
      targetId: instructorId,
      metadata: { action, documentTypes, reason },
    },
  });

  // Email instructor
  // ...
}
```

---

## Implementation Checklist

- [x] Document type validation (10 types)
- [x] Cloudinary upload integration
- [x] Instructor-side upload (POST endpoint)
- [x] Instructor-side retrieval (GET endpoint)
- [x] Instructor mobile upload (POST endpoint)
- [x] Verification status fields in schema (`documentsVerified`, `documentsVerifiedAt`)
- [x] Admin document retrieval API (`GET /api/admin/documents/instructor/{id}`)
- [x] Admin approve documents API (`POST /api/admin/documents/instructor/{id}/approve`)
- [x] Admin reject document API (`POST /api/admin/documents/instructor/{id}/reject`)
- [x] Admin save expiry dates API (`POST /api/admin/documents/instructor/{id}/expiry`)
- [x] Admin upload on behalf API (`POST /api/admin/documents/instructor/{id}/upload`)
- [x] Admin document compliance API (`GET /api/admin/documents/compliance`)
- [x] Admin batch actions API (`POST /api/admin/documents/compliance`)
- [x] Admin compliance dashboard UI (`app/admin/documents/page.tsx`)
- [x] Admin individual review page UI (`app/admin/documents/review/{id}/page.tsx`)
- [x] SMS notifications on approve/reject
- [x] Email notifications for expiry reminders
- [x] In-app notifications for expiring documents
- [x] Traffic light system (status indicators)
- [x] Document expiration tracking
- [x] Batch deactivate on expiry
- [ ] ⚠️ **Reject Document button in review UI (30 min)**
- [ ] **Audit logging for approvals/rejections (1 hour)**
- [ ] Document expiration enforcement on booking
- [ ] Instructor dashboard status page
- [ ] Auto-expiry notifications cron
- [ ] Bulk reject in compliance dashboard
- [ ] Document versioning & history
- [ ] Automated OCR/quality checks
- [ ] Third-party verification integration
- [ ] Privacy/redaction

---

## Related Features

- **Instructor Onboarding**: `ONBOARDING_APPROVAL.md` — Documents are part of onboarding flow
- **Admin Dashboard**: `05-admin/ADMIN_API.md` — Admin endpoints for verification
- **Audit Logging**: Document reviews are logged for compliance

---

## Database Schema (Fields Used)

```prisma
model Instructor {
  // ... existing fields

  licenseImageFront      String?
  licenseImageBack       String?
  insurancePolicyDoc     String?
  policeCheckDoc         String?
  wwcCheckDoc            String?
  photoIdDoc             String?
  certificationDoc       String?
  vehicleRegistrationDoc String?
  profileImage           String?
  carImage               String?

  documentsVerified      Boolean?      @default(false)
  documentsVerifiedAt    DateTime?

  // Future: Document expiration
  // licenseExpiry        DateTime?
  // policeCheckExpiry    DateTime?
  // wwcCheckExpiry       DateTime?
}
```

---

## Testing Recommendations

### Upload
- ✅ Upload valid document type → 200, URL returned
- ✅ Upload invalid document type → 400 error
- ✅ Upload missing file or documentType → 400 error
- ✅ Instructor uploads without auth → 401
- ✅ Multiple uploads of same type overwrite previous URL

### Retrieval
- ✅ GET documents shows all 10 fields (some null) → 200
- ✅ Retrieve without auth → 401
- ✅ After upload, new URL appears in GET response

### Authorization
- ✅ Instructor can upload own documents → Success
- ✅ Instructor cannot upload to another instructor's account → 401/403
- ✅ Client cannot upload documents → 401

---

## Security Considerations

1. **Authentication**: NextAuth required; verify session instructor ID before allowing uploads
2. **File Type Validation**: Verify file extension and MIME type
3. **Storage**: Documents stored in Cloudinary with unique folder per instructor
4. **URL Privacy**: Document URLs should not be enumerable; require auth to list
5. **Data Sensitivity**: License numbers, DOB, addresses are PII; consider encryption or redaction
6. **Audit Trail**: All uploads and approvals logged for compliance

---

## Performance Notes

- **Upload**: Streaming file upload to Cloudinary (non-blocking)
- **Retrieval**: Single `findUnique` query to fetch all document URLs
- **Caching**: Can cache verification status in session (expires on logout)
- **Cloudinary**: Signed URLs can be generated server-side for private documents

---

## Notes for Admin

**Critical Implementation Gap**: This feature is only 40% complete. Instructors can upload documents, but no admin review workflow exists yet. Must build:
1. Admin review page (`/admin/documents/review`)
2. Admin API endpoint (`PATCH /api/admin/documents/{instructorId}`)
3. Email notifications for instructor decisions
4. Bulk approval actions

**Recommended Priority**: Build admin review as first Phase 2 item before adding document expiration or other enhancements.


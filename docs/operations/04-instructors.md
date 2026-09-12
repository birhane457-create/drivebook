# 04 — Instructor Management

---

## Instructor Approval

**Admin page:** `/admin/instructors/[id]`

### Pre-approval checklist:
- [ ] Licence document (`licenseImageFront`) uploaded and not expired
- [ ] Licence back (`licenseImageBack`) uploaded
- [ ] Insurance policy document (`insurancePolicyDoc`) uploaded and not expired
- [ ] Police check (`policeCheckDoc`) uploaded and not expired
- [ ] WWC check (`wwcCheckDoc`) uploaded (state-dependent)
- [ ] Photo ID (`photoIdDoc`) uploaded
- [ ] Vehicle registration (`vehicleRegistrationDoc`) uploaded
- [ ] Profile photo (`profileImage`) uploaded
- [ ] ABN provided (if business) — must be verified before first payout
- [ ] Phone number confirmed (used by AI receptionist and SMS)
- [ ] Hourly rate set (cannot be $0)
- [ ] Working hours configured
- [ ] Base address set (used for search radius)
- [ ] `approvalStatus` is currently `PENDING`

### On approval the system automatically:
- Sets `approvalStatus = APPROVED`
- Makes instructor visible in search
- Activates trial subscription (14 days BASIC/PRO/STUDIO, 30 days BUSINESS)

### Do NOT:
- Approve without all required documents
- Manually set `subscriptionStatus` — managed by subscription webhook
- Approve with expired document

---

## Suspension

### Before suspending:
- [ ] Document reason (policy breach, compliance failure, dispute)
- [ ] Check and cancel upcoming confirmed bookings
- [ ] Notify students with paid packages
- [ ] Set `payoutHold = true` before suspending
- [ ] ADMIN or SUPER_ADMIN role required

### On suspension the system automatically:
- Sets `approvalStatus = SUSPENDED`
- Hides instructor from public search
- Blocks new bookings on subdomain page
- Does **NOT** cancel existing confirmed bookings — admin must do this manually

### Before unsuspending:
- [ ] Reason for suspension resolved
- [ ] Re-verify any expired documents
- [ ] Check with SUPER_ADMIN if suspension was for dispute/chargeback
- [ ] Confirm Stripe Connect status still valid

### Do NOT:
- Unsuspend without clearing `payoutHold` if set for dispute
- Reinstate without audit log entry

---

## Document Lifecycle

The platform does **not** have per-document state stages. The model is simpler:

| State | What it means |
|---|---|
| URL = null | Document not uploaded (or was rejected and nulled) |
| URL present | Document uploaded — awaiting admin review |
| `documentsVerified = true` | Admin has reviewed and approved all documents |
| `documentsVerified = false` + URL = null for a field | That specific document was rejected — instructor must re-upload |

When admin rejects a document:
- The specific field is set to `null` (document removed)
- `documentsVerified` is set to `false`
- Instructor receives SMS with the rejection reason
- An `AuditLog` entry (`DOCUMENT_REJECTED`) is written

When admin approves all documents:
- `documentsVerified = true`, `documentsVerifiedAt = now()`
- Instructor receives SMS confirmation
- An `AuditLog` entry (`DOCUMENTS_APPROVED`) is written

### Expiry tracking:

Four documents track expiry dates via dedicated DB columns (`licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry`) set by admin during review. The compliance dashboard reads these columns (with fallback to `workingHours.expiry` for records not yet re-saved since July 2026).

### Expiry alerts (automated):
- System sends in-app alert and email 30 days before expiry
- Compliance dashboard shows traffic-light status to admin at all times
- `autoProcess` action on compliance dashboard deactivates instructors where ALL 4 compliance docs are expired

### On expiry:
- Instructor still accepts bookings (existing students not disrupted)
- Admin can deactivate from compliance dashboard
- Admin must verify renewed document and update expiry date before payout hold is cleared

---

## Voice Line Management

**Admin page:** `/admin/voice-lines`

### Assigning:
- [ ] Instructor must be PRO, STUDIO, or BUSINESS tier
- [ ] Check pool for `AVAILABLE` numbers
- [ ] Assignment logged automatically to audit log
- [ ] Line activates immediately

### Releasing:
- [ ] Triggered by downgrade, cancellation, or suspension
- [ ] Released line returns to `AVAILABLE` pool
- [ ] Notify instructor before releasing

### Do NOT:
- Assign to BASIC tier instructor
- Manually edit `voiceLine` on the instructor record — must go through assignment service (updates both `Instructor` and `TwilioPhoneNumber` records)

---

## ABN Verification

If an instructor has an ABN on file that is not verified:
- Payouts are blocked (47% withholding rule)
- Admin must verify ABN via `/admin/instructors/[id]` → ABN section
- If ABN is invalid or cannot be verified, apply `withholdingTaxRate = 47%` and document

If no ABN on file:
- 47% withholding applies automatically
- Payout still runs — withholding amount is deducted

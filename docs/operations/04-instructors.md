# 04 — Instructor Management

---

## Instructor Approval

**Admin page:** `/admin/instructors/[id]`

### Pre-approval checklist:
- [ ] License number present and not expired
- [ ] Insurance policy document uploaded and not expired
- [ ] Police check uploaded and not expired
- [ ] WWC check uploaded (state-dependent)
- [ ] Profile photo uploaded
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

| Stage | Description |
|---|---|
| `UPLOADED` | File uploaded, not yet reviewed |
| `PENDING_VERIFICATION` | Admin review in progress |
| `VERIFIED` | Document accepted, expiry recorded |
| `EXPIRED` | Past expiry date — instructor cannot receive new payouts |
| `REJECTED` | Document rejected — reason required |
| `ARCHIVED` | Superseded by newer document |

### Expiry alerts (automated):
- System sends in-app alert 30 days before expiry
- Weekly cron (`document-expiry-check`) runs every Monday 2am UTC

### On expiry:
- Instructor still accepts bookings (existing students not disrupted)
- Payouts are blocked until renewed document is verified
- Admin must manually verify the renewed document and update expiry date

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

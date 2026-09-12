# 08 — Data & Documents

---

## Document Lifecycle

```
UPLOADED → PENDING_VERIFICATION → VERIFIED
                                       ↓ (expiry date passes)
                               EXPIRED
                  ↓ (admin rejects)
              REJECTED
                  ↓ (superseded)
              ARCHIVED
```

| Stage | Admin action | Notes |
|---|---|---|
| UPLOADED | Review and verify or reject | Check document is genuine, not expired |
| PENDING_VERIFICATION | In review | Don't take bookings-blocking action yet |
| VERIFIED | Set expiry date | Must record exact expiry — drives alert system |
| EXPIRED | Block payouts | Instructor can still accept bookings; payouts halt |
| REJECTED | Notify instructor with reason | Reason required — minimum 20 chars |
| ARCHIVED | Old version superseded | Do not delete — retain for audit trail |

---

## Document Verification Standards

### Licence:
- Must show full name matching instructor's account name
- Must be a current Australian driving licence
- Check expiry date matches what admin records
- Accept: photo of front and back

### Insurance:
- Must cover commercial driving instruction
- Must show policy number, coverage dates, insured name
- Minimum coverage: check current state requirements (WA: $20M third-party)

### Police Check:
- Must be issued within the past 3 years
- Accepted issuing bodies: AFP, state police, accredited third-party (e.g. CrimTrac)
- Check issue date, not just expiry

### WWC Check:
- Required for instructors teaching under-18 students
- Must be current for the state of operation
- Card number must be recorded

---

## Data Export

### Student export:
Accessible to student on request. Contains:
- Booking history (date, instructor, duration, status, price)
- Progress notes (from instructor)
- Wallet transaction history
- Account creation date

**How to generate:**
1. Go to `/admin/clients/[id]`
2. Export → CSV
3. Review output for third-party data before sending
4. Send via secure email, log in AuditLog

### Instructor export:
- Booking history
- Payout history
- Student list (names + contact, if student consents)
- Document records (metadata only — not the document files)

---

## Backup & Recovery

| What | Frequency | Managed by | Location |
|---|---|---|---|
| PostgreSQL DB | Daily automated | Supabase | Supabase dashboard |
| Point-in-time recovery | 7 days | Supabase | Supabase dashboard |
| Media files (S3/Cloudinary) | Continuous | Cloudinary | Cloudinary dashboard |
| Code | On push | Git | Repository |

### Before any destructive DB operation:
1. Confirm Supabase has a recent backup (check dashboard)
2. Take a manual snapshot if the operation is high-risk
3. Document the operation in the release log

---

## Encryption

| Data | Encryption |
|---|---|
| Passwords | bcrypt (cost 10) |
| Payment data | Never stored — Stripe handles |
| Bank account details | Stripe Connect — not stored by DriveBook |
| ABN | Stored in plaintext — not sensitive |
| Document files | Encrypted at rest by Cloudinary/S3 |
| DB data at rest | Encrypted by Supabase (AES-256) |
| DB data in transit | TLS 1.2+ enforced (`sslmode=require`) |
| Session tokens | JWT signed with `NEXTAUTH_SECRET` |

---

## Access Logs

All admin access to sensitive data is logged in `AuditLog`. When responding to a privacy complaint or audit:

1. Query `AuditLog` for `actorId = {admin_id}` or `targetId = {user_id}`
2. Filter by date range relevant to the complaint
3. Export as evidence
4. Do not modify or delete — these are immutable records

The audit log is the single source of truth for who did what and when.

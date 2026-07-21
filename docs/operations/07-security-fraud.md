# 07 — Security & Fraud

---

## Fraud Signals

Treat the following as potential fraud — investigate before taking action:

| Signal | Risk | Check |
|---|---|---|
| Same email/phone with multiple accounts | Account farming | Query User table for duplicates |
| New account + immediate large package purchase | Stolen card | Check card country, IP vs location |
| Multiple failed payment attempts across accounts | Card testing | Check Stripe radar logs |
| Refund rate > 30% for an instructor | Fraudulent instructor | Review booking completion data |
| Student requests refunds on multiple accounts | Refund abuse | Cross-reference phone/email |
| Instructor with no reviews but high booking volume | Fake bookings | Verify lesson completions |
| Payout to unverified bank + immediate withdrawal | Money laundering signal | Flag for manual review, notify SUPER_ADMIN |
| Excessive short-notice cancellations | Policy gaming | Check `policyExceptionCount` on instructor |

---

## Fraud Response Procedure

1. **Do not notify the suspect account** before investigation
2. Gather evidence: booking history, payment records, IP addresses, device fingerprints
3. Check Stripe radar for flagged cards
4. Escalate to SUPER_ADMIN immediately
5. Take one of:

| Action | When | Who |
|---|---|---|
| Freeze account (block new bookings/logins) | Strong fraud signal | ADMIN |
| Suspend instructor payout (`payoutHold = true`) | Suspected fraudulent payouts | ADMIN |
| Cancel and refund affected bookings | Stolen card confirmed | ADMIN + SUPER_ADMIN |
| Delete account | Confirmed fraud, no legitimate activity | SUPER_ADMIN only |
| Report to Stripe | Stolen card, money laundering | ADMIN — via Stripe dashboard |

6. Record a Fraud Case ID in the audit log
7. If student is affected by instructor fraud: issue 100% goodwill refund regardless of cancellation policy

---

## Account Verification Escalation

If an account's identity is in question:
- Request government ID via email
- Temporarily restrict to read-only until verified
- SUPER_ADMIN approval required to reinstate
- If ID cannot be verified within 7 days: suspend account

---

## Data Privacy — Australian Privacy Act

DriveBook collects and processes personal information under the **Australian Privacy Act 1988** and the **Australian Privacy Principles (APPs)**.

### Data we collect:
- Students: name, email, phone, pickup address, lesson history
- Instructors: name, email, phone, address, ABN, bank details, license/insurance documents, vehicle info
- Payment: handled by Stripe — DriveBook does not store raw card data

### Student data requests:

| Request type | Response time | Who handles | Process |
|---|---|---|---|
| Access request (what data we hold) | 30 days | ADMIN | Export from DB, review for third-party data, send via secure email |
| Correction request | 30 days | ADMIN | Update in DB, confirm in writing |
| Deletion request | 30 days | SUPER_ADMIN | See §Data Deletion below |
| Portability request | 30 days | ADMIN | Export as CSV, see §Data Export |

### Data deletion procedure:
1. Check for active bookings or unpaid balances — resolve before deletion
2. Soft-delete user record (`deletedAt` timestamp)
3. Anonymise personal fields: name → "Deleted User", email → `deleted_{id}@deleted.drivebook.com.au`, phone → null
4. Retain financial records (transactions, payouts) for 7 years — ATO requirement
5. Retain audit logs — cannot be deleted
6. Log deletion action in AuditLog with reason

### Data export (portability):
- Students: booking history, progress notes, wallet transactions
- Instructors: booking history, payout history, student list
- Export format: CSV
- Delivery: secure email or download link (expires 24 hours)
- Log export action in AuditLog

### Data retention schedule:
| Data type | Retention | Reason |
|---|---|---|
| User accounts | Until deletion request | Privacy Act |
| Booking records | 7 years | ATO / tax |
| Financial transactions | 7 years | ATO / tax |
| Audit logs | 7 years (`AUDIT_RETENTION_DAYS = 2555`) | Compliance |
| Session tokens | 7 days | Security |
| OTP tokens | 5 minutes | Security |
| Payment methods | Not stored — Stripe only | PCI compliance |

---

## Security Controls

### Authentication:
- Passwords: bcrypt hashed, never stored in plain text
- Sessions: JWT, 7-day max age
- OTP: 5-minute expiry, 3 attempts, then locked
- Rate limits on auth: 5 attempts per 15 minutes per IP

### Access controls:
- Role-based: CLIENT / INSTRUCTOR / ADMIN / SUPER_ADMIN
- Instructor approval gate: unapproved instructors blocked at auth, not just routes
- Voice service: API key + VAPI secret, both required for voice endpoints

### What to do after a suspected breach:
1. Immediately notify SUPER_ADMIN
2. Rotate `NEXTAUTH_SECRET` in `.env` (invalidates all sessions)
3. Rotate `VOICE_SERVICE_API_KEY`
4. Check audit logs for anomalous activity in the past 30 days
5. If payment data involved: notify Stripe immediately
6. If personal data involved: notify affected users within 30 days (APPs requirement)
7. Document incident in `drivebook-hybrid/docs/incidents/`

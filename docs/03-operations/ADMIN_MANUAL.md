# ADMIN MANUAL

**Purpose**: Admin dashboard operations guide  
**Owner**: Operations Team  
**Last Updated**: May 2026  
**Scope**: Daily admin tasks  

---

## COMMON TASKS

### 1. Add Wallet Credits
1. Navigate to Admin → Clients → [client] → Wallet
2. Enter amount and reason
3. Click "Add Credits"
4. Receipt is automatically emailed to the client
5. Audit log entry created with `WALLET_CREDITED`

**Rule**: Always provide reason for audit trail

### 2. Deduct Wallet Credits
1. Navigate to Admin → Clients → [client] → Wallet
2. Enter amount and reason (required, min 3 chars)
3. Click "Deduct Credits"
4. Receipt emailed to client with transaction ID for dispute reference
5. Audit log entry created with `WALLET_DEDUCTED`

**Rule**: Reason is mandatory. System blocks if balance is insufficient.

### 3. Process Payouts
1. Navigate to Admin → Payouts
2. Review eligible payouts (24h+ after booking completion)
3. Verify amounts and instructor ABN status
4. Click "Process Payout"
5. Confirm action

**Rule**: Only process COMPLETED bookings. Instructors without verified ABN have 47% withheld.

### 4. Manual Booking Confirmation
1. Navigate to Admin → Bookings
2. Filter by PENDING status
3. Find booking
4. Click "Confirm"

**Use Case**: Webhook failure fallback

### 5. Refund After Payout (Admin Override)
1. Navigate to booking
2. Click "Cancel"
3. System blocks (instructor already paid)
4. Enter admin override reason
5. Confirm (creates platform loss alert)

**Rule**: Only for exceptional cases

### 6. Approve / Suspend Instructor
1. Navigate to Admin → Instructors → [instructor]
2. Click "Approve" or "Suspend"
3. Instructor receives email notification
4. Audit log entry created

**Note**: Pending instructors cannot create bookings until approved.

### 7. Support Centre — User Management
1. Navigate to Admin → Support
2. Search for user by name or email
3. Click user to open detail panel
4. Available actions:
   - Edit profile (name, phone, email)
   - Reset password (sends reset email)
   - Add/deduct wallet credit
   - Approve/suspend instructor
   - View recent bookings

**Use Case**: User cannot log in, needs profile correction, wallet dispute.

### 8. Schedule a Commission Rate Change
1. Navigate to Admin → Pricing → Rate Change Scheduler
2. Select tier, new rate, effective date, and reason
3. Click "Schedule Change"
4. Instructors on the affected tier will see a notice on their subscription page
5. The cron job applies the change automatically on the effective date

**Rule**: Always give at least 14 days notice. The reason is shown to instructors.

### 9. Cancel a Scheduled Rate Change
1. Navigate to Admin → Pricing → Rate Change Scheduler
2. Find the pending change
3. Click "Cancel"
4. The change is marked CANCELLED and will not be applied

---

## MONITORING

### Daily Checks
- [ ] Review PENDING bookings (>30 min old)
- [ ] Check wallet reconciliation report
- [ ] Review failed webhooks
- [ ] Verify payout queue

### Weekly Checks
- [ ] Review instructor documents expiry
- [ ] Check platform revenue
- [ ] Review audit logs for anomalies

---

## EMERGENCY PROCEDURES

### Wallet Balance Mismatch
1. Check reconciliation report
2. Review wallet transactions
3. Reconstruct ledger
4. Create manual adjustment if needed
5. Document in audit log

### Payment Not Confirmed
1. Check Stripe dashboard
2. Review webhook logs
3. Manual confirm if payment succeeded
4. Alert tech team if webhook issue

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Money flow
- `../00-foundation/SYSTEM_PRINCIPLES.md` - Admin rules
- `INCIDENT_RESPONSE.md` - Problem solving


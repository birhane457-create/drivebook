# ADMIN MANUAL

**Purpose**: Admin dashboard operations guide  
**Owner**: Operations Team  
**Last Updated**: March 4, 2026  
**Scope**: Daily admin tasks  

---

## COMMON TASKS

### 1. Add Wallet Credits
1. Navigate to Admin → Clients
2. Find client
3. Click "Manage Wallet"
4. Enter amount and reason
5. Click "Add Credits"

**Rule**: Always provide reason for audit trail

### 2. Process Payouts
1. Navigate to Admin → Payouts
2. Review eligible payouts (24h+ after completion)
3. Verify amounts
4. Click "Process Payout"
5. Confirm action

**Rule**: Only process COMPLETED bookings

### 3. Manual Booking Confirmation
1. Navigate to Admin → Bookings
2. Filter by PENDING status
3. Find booking
4. Click "Confirm"

**Use Case**: Webhook failure fallback

### 4. Refund After Payout (Admin Override)
1. Navigate to booking
2. Click "Cancel"
3. System blocks (instructor already paid)
4. Enter admin override reason
5. Confirm (creates platform loss alert)

**Rule**: Only for exceptional cases

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


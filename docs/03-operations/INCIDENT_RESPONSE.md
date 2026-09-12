# INCIDENT RESPONSE

**Purpose**: Problem-solving procedures  
**Owner**: Operations Team  
**Last Updated**: March 4, 2026  
**Scope**: Common issues and solutions  

---

## FINANCIAL ISSUES

### Money Doesn't Balance

**Step 1**: Reconstruct Ledger
```typescript
const ledger = await reconstructLedger(bookingId);
console.log('Ledger:', ledger);
```

**Step 2**: Check Wallet Transactions
```typescript
const walletTxs = await prisma.walletTransaction.findMany({
  where: { description: { contains: bookingId } }
});
```

**Step 3**: Verify State Machine
- Is booking PAID and CANCELLED? (Invalid)
- Is booking COMPLETED without transaction? (Invalid)

**Step 4**: Manual Fix (Admin Only)
- Create adjustment transaction
- Log in audit log
- Alert finance team

---

## BOOKING ISSUES

### PENDING Booking Stuck

**Cause**: Webhook failure or payment timeout

**Solution**:
1. Check Stripe payment status
2. If paid → Manual confirm
3. If not paid → Auto-cancel will handle

### Cannot Cancel Booking

**Cause**: Instructor already paid

**Solution**:
1. Check transaction status
2. If PAID → Admin override required
3. Provide reason
4. Creates platform loss alert

---

## PAYMENT ISSUES

### Webhook Not Received

**Check**:
1. Stripe dashboard → Events
2. Webhook logs in database
3. Signature verification

**Solution**:
1. Manual confirm if payment succeeded
2. Alert tech team
3. Review webhook configuration

---

## ESCALATION

**Level 1**: Operations team (common issues)  
**Level 2**: Tech team (system issues)  
**Level 3**: Finance team (money issues)

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Problem-solving method
- `ADMIN_MANUAL.md` - Admin procedures


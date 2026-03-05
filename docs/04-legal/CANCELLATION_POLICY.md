# CANCELLATION POLICY

**Purpose**: Define refund policy and legal requirements  
**Owner**: Legal/Operations Team  
**Last Updated**: March 4, 2026  
**Scope**: All bookings  

---

## REFUND TIERS

| Notice Period | Client Refund | Platform Keeps |
|--------------|---------------|----------------|
| 48+ hours    | 100%          | 0%             |
| 24-48 hours  | 50%           | 50%            |
| < 24 hours   | 0%            | 100%           |

---

## POLICY TEXT

### For Clients

**Cancellation Policy**

You may cancel your driving lesson booking according to the following refund schedule:

- **48 hours or more before lesson**: Full refund (100%)
- **24-48 hours before lesson**: Partial refund (50%)
- **Less than 24 hours before lesson**: No refund (0%)

Refunds are processed immediately to your wallet balance and can be used for future bookings or withdrawn to your original payment method.

**Important Notes**:
- Cancellation time is calculated from the original booking time
- If you reschedule a lesson, the cancellation policy applies to the original time
- Refunds are automatic based on cancellation time
- No-shows are treated as same-day cancellations (0% refund)

---

## LEGAL REQUIREMENTS

### 1. Display Before Payment
Policy must be shown before client completes payment.

### 2. Require Agreement
Client must check box: "I agree to the cancellation policy"

### 3. Store Agreement
```typescript
{
  cancellationPolicyVersion: "v1.0",
  cancellationPolicyAgreedAt: "2026-03-04T10:00:00Z",
  cancellationPolicyTimezone: "America/New_York"
}
```

### 4. Provide Proof
Store agreement for dispute resolution.

---

## DISPUTE RESOLUTION

### Stripe Chargeback
**Evidence Required**:
- Policy text shown before payment
- Checkbox agreement timestamp
- Cancellation time calculation
- Refund amount calculation

### Client Complaint
**Process**:
1. Review booking details
2. Verify cancellation time
3. Show policy agreement
4. Explain calculation
5. Escalate to admin if needed

---

## EXCEPTIONS

### Instructor Cancellation
- Client receives 100% refund regardless of notice
- Instructor may face penalty

### Platform Issue
- Client receives 100% refund
- Platform absorbs loss

### Emergency
- Case-by-case review
- Admin override available

---

## IMPLEMENTATION

### Display Policy
```typescript
<div className="policy-box">
  <h3>Cancellation Policy</h3>
  <p>48+ hours: 100% refund</p>
  <p>24-48 hours: 50% refund</p>
  <p>Less than 24 hours: No refund</p>
  
  <label>
    <input type="checkbox" required />
    I agree to the cancellation policy
  </label>
</div>
```

### Store Agreement
```typescript
await prisma.booking.create({
  data: {
    // ... booking data
    cancellationPolicyVersion: "v1.0",
    cancellationPolicyAgreedAt: new Date(),
    cancellationPolicyTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
});
```

---

## UPDATES

### Changing Policy
1. Create new version (v2.0)
2. Update policy text
3. Require new agreement
4. Old bookings use old policy

### Grandfathering
Existing bookings keep their agreed policy version.

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Refund calculation
- `WALLET_TERMS.md` - Wallet refund terms


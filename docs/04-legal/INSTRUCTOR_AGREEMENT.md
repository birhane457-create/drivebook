# INSTRUCTOR AGREEMENT

**Purpose**: Define instructor terms and obligations  
**Owner**: Legal Team  
**Last Updated**: March 4, 2026  
**Scope**: All instructors on platform  

---

## AGREEMENT TERMS

### 1. Commission Structure

**Standard Rate**: 15% platform fee, 85% instructor payout

**First Booking Bonus**: 10% platform fee, 90% instructor payout
- Applies to first booking with each new client
- Incentivizes instructor growth

**Example**:
```
Lesson Price: $140
Standard: Platform $21, Instructor $119
First Booking: Platform $14, Instructor $126
```

### 2. Payout Terms

**Eligibility**:
- Lesson must be COMPLETED (check-out done)
- 24-hour buffer after completion
- Admin approval required

**Processing**:
- Weekly payout schedule
- Via Stripe Connect or bank transfer
- Processing time: 2-3 business days

**Minimum Payout**: $50.00

### 3. Cancellation Policy

**Instructor Cancellation**:
- Must provide 48+ hours notice
- Client receives 100% refund
- Instructor may face penalty for repeated cancellations

**Client Cancellation**:
- Instructor not paid if cancelled before completion
- No penalty to instructor

**No-Show**:
- If client doesn't show, instructor can mark as no-show
- Instructor receives full payment
- Client receives 0% refund

### 4. Refund Clawback

**After Payout**:
- If client requests refund after instructor paid
- Platform may deduct from future earnings
- Case-by-case review

**Dispute Resolution**:
- Platform mediates disputes
- Final decision by platform
- Instructor may appeal

### 5. Platform Authority

**Platform Rights**:
- Set commission rates
- Modify cancellation policy
- Suspend or terminate account
- Withhold payout for violations

**Instructor Rights**:
- Set own hourly rate
- Accept or decline bookings
- Set working hours
- Request payout

### 6. Quality Standards

**Requirements**:
- Valid driving instructor license
- Current insurance
- Background check
- Vehicle registration

**Violations**:
- Repeated cancellations
- Poor reviews
- Safety violations
- Fraud or misrepresentation

**Consequences**:
- Warning
- Temporary suspension
- Permanent termination
- Payout withholding

### 7. Independent Contractor

**Status**: Instructors are independent contractors, not employees

**Responsibilities**:
- Own taxes
- Own insurance
- Own vehicle maintenance
- Own schedule

**Platform Provides**:
- Booking system
- Payment processing
- Client matching
- Support

---

## LEGAL REQUIREMENTS

### Display Agreement
Agreement must be shown:
- During instructor registration
- Before first booking
- In instructor dashboard

### Require Signature
```typescript
<label>
  <input type="checkbox" required />
  I agree to the Instructor Agreement
</label>
```

### Store Agreement
```typescript
{
  instructorAgreementVersion: "v1.0",
  instructorAgreementSignedAt: "2026-03-04T10:00:00Z",
  instructorAgreementIpAddress: "192.168.1.1"
}
```

---

## UPDATES

### Changing Terms
1. Create new version (v2.0)
2. Notify all instructors
3. Require new agreement
4. 30-day notice period

### Grandfathering
Existing instructors may keep old terms for 90 days.

---

## IMPLEMENTATION

### Schema Addition
```prisma
model Instructor {
  // ... existing fields
  agreementVersion      String?
  agreementSignedAt     DateTime?
  agreementIpAddress    String?
  agreementAccepted     Boolean  @default(false)
}
```

### Enforcement
```typescript
// Before allowing bookings
if (!instructor.agreementAccepted) {
  throw new Error('Must accept instructor agreement');
}

// Before processing payout
if (!instructor.agreementAccepted) {
  throw new Error('Must accept agreement before payout');
}
```

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Commission structure
- `CANCELLATION_POLICY.md` - Refund policy


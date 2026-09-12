# WALLET TERMS & CONDITIONS

**Purpose**: Define wallet credit terms  
**Owner**: Legal Team  
**Last Updated**: March 4, 2026  
**Scope**: Client wallet system  

---

## WALLET DEFINITION

DriveBook Wallet is a prepaid credit system that allows clients to:
- Add funds for future bookings
- Receive refunds from cancelled bookings
- Pay for lessons without entering payment details each time

---

## TERMS

### 1. Wallet Credits

**What They Are**:
- Prepaid credits stored in your account
- Denominated in USD
- Used to pay for driving lessons

**What They Are Not**:
- Not a bank account
- Not FDIC insured
- Not a stored value card
- Not transferable to other users

### 2. Adding Credits

**Methods**:
- Credit/debit card via Stripe
- Promotional credits from DriveBook
- Refunds from cancelled bookings

**Limits**:
- Minimum: $10.00
- Maximum: $1,000.00 per transaction
- No maximum balance

### 3. Using Credits

**Allowed Uses**:
- Pay for driving lessons
- Book multiple lessons in advance

**Not Allowed**:
- Transfer to other users
- Cash out (except refund to original payment method)
- Use for non-lesson purchases

### 4. Refunds

**Refund to Wallet**:
- Cancellation refunds go to wallet immediately
- Can be used for future bookings

**Refund to Payment Method**:
- Available upon request
- Minimum refund: $10.00
- Processing time: 5-7 business days
- Refunded to original payment method

### 5. Expiration

**Policy**: Wallet credits expire after 365 days of inactivity

**Inactivity Defined**:
- No bookings made
- No credits added
- No credits used

**Notice**:
- Email sent 30 days before expiration
- Email sent 7 days before expiration

**After Expiration**:
- Credits forfeited to DriveBook
- No refund available

### 6. Account Closure

**Voluntary Closure**:
- Request via support
- Unused balance refunded to original payment method
- Minimum refund: $10.00
- Processing time: 5-7 business days

**Involuntary Closure**:
- Platform may close account for violations
- Unused balance may be forfeited
- Case-by-case review

### 7. Disputes

**Process**:
1. Contact support@drivebook.com
2. Provide transaction details
3. Review within 5 business days
4. Resolution communicated via email

**Chargebacks**:
- Wallet credits purchased via card may be charged back
- Chargeback results in negative balance
- Account suspended until resolved

---

## LEGAL REQUIREMENTS

### Display Terms
Terms must be shown:
- Before first wallet credit purchase
- In wallet management page
- In terms of service

### Require Agreement
```typescript
<label>
  <input type="checkbox" required />
  I agree to the Wallet Terms & Conditions
</label>
```

### Store Agreement
```typescript
{
  walletTermsVersion: "v1.0",
  walletTermsAgreedAt: "2026-03-04T10:00:00Z"
}
```

---

## COMPLIANCE

### Consumer Protection
- Clear terms
- No hidden fees
- Easy refund process
- Expiration notice

### Financial Regulations
- Not a money transmitter (prepaid for services)
- Not a bank (no interest, no FDIC)
- Proper accounting (separate from revenue)

---

## IMPLEMENTATION

### Schema Addition
```prisma
model ClientWallet {
  // ... existing fields
  termsVersion      String?
  termsAgreedAt     DateTime?
  lastActivityAt    DateTime  @default(now())
  expiresAt         DateTime?
}
```

### Expiration Check
```typescript
// Daily cron job
const inactiveWallets = await prisma.clientWallet.findMany({
  where: {
    lastActivityAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    balance: { gt: 0 }
  }
});

for (const wallet of inactiveWallets) {
  // Send expiration notice
  // After 30 days, forfeit balance
}
```

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Wallet system
- `CANCELLATION_POLICY.md` - Refund policy


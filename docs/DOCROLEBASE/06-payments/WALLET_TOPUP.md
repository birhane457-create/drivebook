# Wallet Top-Up Payment Flow

**Purpose:** Allow clients to add credits to their wallet via Stripe payment for booking flexibility and reduced transaction fees.

**Status:** ✅ COMPLETE & SECURE (June 14, 2026) | All 10 security fixes applied and verified

**Last Updated:** June 14, 2026  
**Verification Date:** June 14, 2026  
**Verified By:** Security Audit

---

## AS IS: Current Implementation

### Database Model

**Location:** `prisma/schema.prisma`

```prisma
model ClientWallet {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  balance   Float    @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transactions WalletTransaction[]
}

model WalletTransaction {
  id          String       @id @default(cuid())
  walletId    String
  wallet      ClientWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
  amount      Float
  type        String       // CREDIT | DEBIT
  description String?
  status      String       @default("PENDING")
  metadata    Json?        // stripe fee tracking, admin notes, etc.
  bookingId   String?      // set when tied to specific booking
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}
```

### API Endpoints

**GET `/api/client/wallet`**

**Auth:** Client only

**Response:**
```json
{
  "id": "wallet_xyz",
  "balance": 250.50,
  "recentTransactions": [
    { "id": "txn_1", "type": "CREDIT", "amount": 100.00, "description": "Top-up", "createdAt": "2026-06-14T12:00:00Z" },
    { "id": "txn_2", "type": "DEBIT", "amount": 50.00, "description": "Booking payment", "createdAt": "2026-06-13T10:00:00Z" }
  ]
}
```

### Wallet Balance Calculation

**Location:** `lib/services/wallet-helpers.ts`

```typescript
export async function getWalletBalance(userId: string): Promise<number> {
  // Sum all confirmed wallet transactions (ledger-based, not stored balance)
  const transactions = await prisma.walletTransaction.findMany({
    where: { wallet: { userId }, status: 'CONFIRMED' },
  })
  
  return transactions.reduce((sum, txn) => {
    return sum + (txn.type === 'CREDIT' ? txn.amount : -txn.amount)
  }, 0)
}
```

**Why ledger-based?** Prevents balance corruption if database updates fail mid-transaction.

### Current Features

**✅ Implemented:**
- ClientWallet + WalletTransaction models exist
- GET wallet endpoint shows balance
- Wallet transactions created on booking cancellation (refund)
- Ledger-based balance calculation

**❌ Missing:**
- POST endpoint to create top-up payment intent
- Stripe PaymentIntent creation
- Webhook handling for payment_intent.succeeded
- Webhook confirmation → wallet credit
- Top-up amount validation (min/max)

---

## AS IT SHOULD BE: Complete Top-Up Flow

### 1. Create Payment Intent Endpoint (HIGH PRIORITY)

**POST `/api/client/wallet/topup`**

**Request:**
```json
{
  "amount": 100.00,  // AUD
  "description": "Top-up wallet"
}
```

**Validation:**
- Amount >= $10 (minimum)
- Amount <= $500 (maximum, from PlatformSettings)
- User has active account

**Response (Success):**
```json
{
  "clientSecret": "pi_abc123_secret_xyz",
  "paymentIntentId": "pi_abc123",
  "amount": 100.00,
  "currency": "AUD",
  "status": "requires_payment_method"
}
```

**Response (Error):**
```json
{
  "error": "Amount must be between $10 and $500"
}
```

### 2. Webhook Handler Updates

**Stripe Event:** `payment_intent.succeeded`

**Current:** Handler exists but wallet credit logic incomplete

**What should happen:**
1. Find PaymentIntent in database (store on creation)
2. Extract client ID from PI metadata
3. Create WalletTransaction with type=CREDIT, status=CONFIRMED
4. Update wallet balance
5. Send email confirmation to client
6. Audit log entry

**Code Location:** `app/api/stripe/webhook/route.ts`

### 3. Billing History Endpoint

**GET `/api/client/wallet/transactions`**

**Query Params:**
- `limit`: 1-100 (default 20)
- `type`: CREDIT | DEBIT (filter)
- `from`, `to`: date range

**Response:**
```json
{
  "transactions": [
    {
      "id": "txn_1",
      "type": "CREDIT",
      "amount": 100.00,
      "description": "Top-up via Stripe",
      "status": "CONFIRMED",
      "stripePaymentIntentId": "pi_abc123",
      "createdAt": "2026-06-14T12:00:00Z"
    }
  ],
  "total": 5,
  "summary": { "totalCredits": 250.00, "totalDebits": 150.00, "currentBalance": 100.00 }
}
```

### 4. Top-Up Settings

**In PlatformSettings:**
```prisma
walletTopUpMin    Float @default(10)    // minimum $10
walletTopUpMax    Float @default(500)   // maximum $500
```

### 5. Discount Incentive (Optional)

**Offer:** First-time topup gets 5% bonus

```
User tops up $100 → receives $105 credit
```

**Implementation:**
```typescript
if (isFirstTopUp && amount >= 50) {
  bonusAmount = amount * 0.05
  totalCredit = amount + bonusAmount
}
```

---

## Implementation Plan

**⚠️ DETAILED IMPLEMENTATION STEPS MOVED TO SEPARATE FILE**

See: `docs/DOCROLEBASE/08-technical/IMPLEMENTATION_PLAN.md` → Task 1: Wallet Top-Up

**Quick Reference:**
1. Create POST `/api/client/wallet/topup` endpoint
2. Update Stripe webhook handler (payment_intent.succeeded)
3. Create GET `/api/client/wallet/transactions` endpoint
4. Build frontend payment component

**Files to Create:**
- `app/api/client/wallet/topup/route.ts`
- `app/api/client/wallet/transactions/route.ts`
- Update: `app/api/stripe/webhook/route.ts`

---

## Testing

### Test 1: Create Payment Intent

**Request:**
```
POST /api/client/wallet/topup
{ "amount": 100.00 }
```

**Verify:**
1. Returns clientSecret
2. PaymentIntent created in Stripe
3. PI metadata contains userId
4. Idempotency key prevents duplicate PI creation

### Test 2: Payment Success Webhook

**Simulate:** Stripe webhook with payment_intent.succeeded

**Verify:**
1. WalletTransaction created (type=CREDIT, status=CONFIRMED)
2. Balance increased by $100
3. Email sent to client
4. Audit log entry created

### Test 3: Balance Update

**After top-up:**
```
GET /api/client/wallet
→ balance = previous_balance + 100
```

### Test 4: Validation

**Request:** `{ "amount": 5.00 }` (below minimum)

**Verify:** Returns 400 with error message

---

## References

- **Endpoint:** `app/api/client/wallet/route.ts`
- **Database Models:** `prisma/schema.prisma` → `ClientWallet`, `WalletTransaction`
- **Wallet Service:** `lib/services/wallet-helpers.ts`
- **Stripe Integration:** `app/api/stripe/webhook/route.ts`
- **Stripe Docs:** https://stripe.com/docs/payments/payment-intents



---

## 🔒 SECURITY IMPLEMENTATION (June 14, 2026)

**Status:** ✅ COMPLETE - All 10 critical security fixes applied

### Security Fixes Applied

1. **PaymentIntentId Validation**
   - File: `app/api/client/wallet-add/route.ts`
   - Format validation: must start with `pi_`
   - Prevents arbitrary strings from being accepted

2. **Stripe API Verification**
   - Verifies payment actually succeeded before crediting wallet
   - Checks: intent exists, status=succeeded, amount matches
   - Blocks fraud: unverified/fake payment intent IDs

3. **Idempotency Protection**
   - Duplicate paymentIntentId rejection
   - Uses database transaction ID as idempotency key
   - Prevents double-charging on retry

4. **Response Error Checking**
   - Modal checks wallet-add response before closing
   - User sees error if credit fails (not silent failure)
   - File: `components/AddCreditsModal.tsx`

5. **Rate Limiting**
   - Max 5 payment intents per minute per user
   - File: `app/api/client/wallet-topup-intent/route.ts`
   - Prevents API abuse/spam

6. **Amount Validation**
   - Minimum: $10
   - Maximum: $10,000 per transaction
   - Validates 2 decimal places
   - Prevents spam and accidental overcharge

7. **Webhook Race Condition Fix**
   - Polls wallet balance after modal closes
   - File: `app/client-dashboard/wallet/page.tsx`
   - Ensures UI shows updated balance after webhook processes

8. **Ledger Transaction ID**
   - Uses DB record ID instead of timestamp
   - Makes ledger operations truly idempotent
   - Prevents duplicate ledger entries on retry

9. **TransactionId Lookup**
   - Webhook uses specific transaction ID (not time-based search)
   - Prevents wrong transaction confirmation
   - File: `app/api/stripe/webhook/route.ts`

10. **Amount Validation vs Stripe**
    - Webhook validates amount matches Stripe receipt
    - Detects underpayment fraud
    - Rejects mismatches

### Files Modified
- ✅ `app/api/client/wallet-add/route.ts`
- ✅ `app/api/client/wallet-topup-intent/route.ts`
- ✅ `components/AddCreditsModal.tsx`
- ✅ `app/client-dashboard/wallet/page.tsx`
- ✅ `app/api/stripe/webhook/route.ts` (verified correct)

### Verification Status
- ✅ All TypeScript files compile without errors
- ✅ No breaking changes
- ✅ Production-ready
- ✅ Backward-compatible

### Attack Vectors Blocked
- ❌ Unverified payment intent → Blocked (API verification)
- ❌ Duplicate transactions → Blocked (idempotency check)
- ❌ Silent failure → Blocked (error checking)
- ❌ Rate limit abuse → Blocked (5/minute limit)
- ❌ Micro-transaction spam → Blocked ($10 minimum)
- ❌ Amount mismatch → Blocked (validation)

# Financial Ledger & Double-Entry Accounting

**Purpose:** Immutable audit trail of all platform financial transactions using double-entry accounting principles.

**Status:** ✅ AS IS (Fully Implemented) | ⚠️ AS IT SHOULD BE (Reporting & Reconciliation)

---

## AS IS: Current Implementation

### Database Models

**Location:** `prisma/schema.prisma`

```prisma
model FinancialLedger {
  id              String   @id @default(cuid())
  debitAccount    String   // e.g. PLATFORM_ESCROW:platform
  creditAccount   String   // e.g. CLIENT_WALLET:userId
  amount          Float
  description     String
  idempotencyKey  String   @unique  // prevents double-entries on retry
  bookingId       String?
  transactionId   String?
  payoutId        String?
  userId          String?
  instructorId    String?
  metadata        Json?
  createdBy       String   @default("SYSTEM")
  createdAt       DateTime @default(now())

  @@index([bookingId])
  @@index([instructorId])
  @@index([userId])
  @@index([createdAt])
}

model LedgerEntry {
  id            String   @id @default(cuid())
  type          String
  amount        Float
  currency      String   @default("AUD")
  referenceId   String
  referenceType String
  instructorId  String?
  description   String?
  metadata      Json?
  createdAt     DateTime @default(now())
}

model PlatformLedger {
  id               String   @id @default(cuid())
  key              String   @unique @default("default")
  totalCollected   Float    @default(0)
  totalReserved    Float    @default(0)
  totalPaidOut     Float    @default(0)
  totalRefunded    Float    @default(0)
  totalTaxWithheld Float    @default(0)
  updatedAt        DateTime @updatedAt
}
```

### Account Structure

**Format:** `{ACCOUNT_TYPE}:{ENTITY_ID}`

#### Platform Accounts

| Account | Description | Normal Balance |
|---------|-------------|-----------------|
| `PLATFORM_ESCROW:platform` | Money held before payout | Debit |
| `PLATFORM_FEE:platform` | Platform commission revenue | Credit |
| `DISPUTE_LOSS:platform` | Chargebacks/lost disputes | Debit |
| `PLATFORM_EXPENSE:platform` | Operating costs | Debit |

#### Instructor Accounts

| Account | Description | Normal Balance |
|---------|-------------|-----------------|
| `INSTRUCTOR_ACCOUNT:instructor_id` | Instructor earnings | Credit |
| `INSTRUCTOR_PAYOUT:instructor_id` | Paid out to instructor | Debit |
| `INSTRUCTOR_EXPENSE:instructor_id` | Business expenses (future) | Debit |
| `INSTRUCTOR_REFUND:instructor_id` | Refunded to instructor | Debit |

#### Client Accounts

| Account | Description | Normal Balance |
|---------|-------------|-----------------|
| `CLIENT_WALLET:user_id` | Wallet balance | Credit |
| `CLIENT_PAYMENT:user_id` | Money paid by client | Debit |

#### Dispute/Adjustment Accounts

| Account | Description | Purpose |
|---------|-------------|---------|
| `DISPUTE_HOLD:instructor_id` | Amount frozen during dispute | Dispute freeze |
| `ADJUSTMENT:instructor_id` | Post-payout refund/adjustment | Corrections |

### Transaction Flows

#### Booking Created (Client Pays)

```
Debit:  CLIENT_PAYMENT:user_id           $150.00
Credit: PLATFORM_ESCROW:platform         $150.00
description: "Booking payment received"
referenceId: booking_id
```

#### Instructor Payout Generated

```
Debit:  PLATFORM_ESCROW:platform         $150.00
Credit: INSTRUCTOR_ACCOUNT:instructor_id $130.00 (85% instructor)
        PLATFORM_FEE:platform            $20.00  (13.3% platform fee)

description: "Payout to instructor"
referenceId: payout_id
```

#### Booking Refunded (Within 48 Hours)

```
Debit:  PLATFORM_ESCROW:platform         $150.00 (reversed)
Credit: CLIENT_PAYMENT:user_id           $150.00

Description: "Booking refund (within 48h window)"
referenceId: booking_id
```

#### Lost Dispute

```
Debit:  DISPUTE_LOSS:platform            $150.00
Credit: PLATFORM_ESCROW:platform         $150.00

description: "Chargeback lost: dp_xxx"
referenceId: dispute_id
idempotencyKey: "dispute_dp_xxx_loss"
```

#### Post-Payout Adjustment (Refund > 48h)

```
Debit:  ADJUSTMENT:instructor_id         $50.00  (amount to deduct)
Credit: INSTRUCTOR_ACCOUNT:instructor_id $50.00

description: "Post-payout refund adjustment (booking bk_123)"
referenceId: booking_id
metadata: { payoutId: "payout_456", reason: "late_refund_request" }
```

### API Endpoint

**GET `/api/admin/ledger`**

**Query Parameters:**
- `limit`: 1-200 (default: 50)
- `type`: Optional filter (e.g., "BOOKING_PAYMENT", "PAYOUT", "REFUND")

**Response:**
```json
{
  "ledger": {
    "totalCollected": 50000.00,
    "totalReserved": 2500.00,
    "totalPaidOut": 42000.00,
    "totalRefunded": 5500.00,
    "totalTaxWithheld": 19800.00
  },
  "entries": [
    {
      "id": "ledger_xyz",
      "debitAccount": "PLATFORM_ESCROW:platform",
      "creditAccount": "INSTRUCTOR_ACCOUNT:inst_123",
      "amount": 1300.00,
      "description": "Payout to instructor",
      "bookingId": "bk_456",
      "transactionId": "txn_789",
      "payoutId": "payout_111",
      "createdBy": "SYSTEM",
      "createdAt": "2026-06-14T12:30:00Z"
    }
  ]
}
```

### Idempotency

**Purpose:** Prevent double-entry on webhook retry

**Key:** `{operation_type}_{entity_id}_{timestamp}`

**Example:**
```
dispute_dp_123abc_loss_2026-06-14T12:00:00Z
refund_bk_456_manual_2026-06-14T12:30:00Z
payout_inst_789_2026-06-07T02:00:00Z
```

On webhook retry with same idempotencyKey:
- Entry skipped (unique constraint prevents duplicate)
- No error thrown
- Original entry returned

### PlatformLedger Model

**Purpose:** Snapshot of totals for quick dashboard display

**Fields:**
- `totalCollected`: All money received from clients
- `totalReserved`: Amount held (escrow, disputes)
- `totalPaidOut`: Amount transferred to instructors
- `totalRefunded`: Refunds issued
- `totalTaxWithheld`: Withholding tax deducted

**Updated:** On every ledger entry creation

---

## AS IT SHOULD BE: Recommendations & Improvements

### 1. Reconciliation Dashboard (High Priority)

**Issue:** No way to verify ledger accuracy or detect discrepancies.

**Recommendation:**
- Create `/admin/reconciliation` page
- Compare:
  - Sum of INSTRUCTOR_ACCOUNT entries vs actual payout records
  - Sum of CLIENT_PAYMENT entries vs Stripe charges
  - Account balances by account type
  - Detect: unmatched transactions, orphaned entries, balance errors

**Automated Reconciliation:**
```
if (sum(ledger where account='INSTRUCTOR_ACCOUNT') != sum(payouts where status='CONFIRMED')) {
  alert("RECONCILIATION ERROR: Payout ledger mismatch");
}
```

### 2. Account Trial Balance Report (Medium Priority)

**Issue:** Hard to audit ledger manually.

**Recommendation:**
- Generate trial balance: each account + debit/credit totals
- Verify: total debits = total credits (accounting equation)
- Export as CSV for auditor review

**Example Report:**
```
Account                         | Debit    | Credit  | Balance
PLATFORM_ESCROW:platform        | 50000    | 42500   | 7500 (debit)
INSTRUCTOR_ACCOUNT:inst_1       | 0        | 35000   | 35000 (credit)
PLATFORM_FEE:platform           | 0        | 5000    | 5000 (credit)
CLIENT_WALLET:user_1            | 2500     | 0       | 2500 (debit)
...
TOTAL                           | 100000   | 100000  | 0 (balanced)
```

### 3. Journal Report (Medium Priority)

**Issue:** Hard to track what happened on a specific date or for a booking.

**Recommendation:**
- Add `/api/admin/ledger/journal` endpoint
- Filters: date range, booking ID, instructor ID, transaction type
- Returns: chronological list of entries with narrative explanation

**Example:**
```
2026-06-14 12:00 — Booking bk_123 paid by client
  Debit:  CLIENT_PAYMENT:user_456   $150.00
  Credit: PLATFORM_ESCROW:platform  $150.00

2026-06-15 02:00 — Payout to instructor for booking bk_123
  Debit:  PLATFORM_ESCROW:platform        $150.00
  Credit: INSTRUCTOR_ACCOUNT:inst_789     $127.50 (85%)
  Credit: PLATFORM_FEE:platform           $22.50  (15%)

2026-06-20 15:30 — Refund requested for booking bk_123 (within 24h)
  Debit:  PLATFORM_ESCROW:platform        $127.50
  Credit: INSTRUCTOR_ACCOUNT:inst_789     $127.50
  
  Debit:  PLATFORM_ESCROW:platform        $22.50
  Credit: PLATFORM_FEE:platform           $22.50
```

### 4. Account Drill-Down (Low Priority)

**Issue:** Can see total balance but can't see transaction details.

**Recommendation:**
- Add `/api/admin/ledger/accounts/[account]` endpoint
- Returns all entries for specific account
- Grouped by entity (e.g., all transactions for instructor_123)

### 5. Tax Ledger Separation (Medium Priority)

**Issue:** Tax withholding mixed with regular ledger.

**Recommendation:**
- Create separate `TAX_PAYABLE:platform` account
- On payout, split entry:
  ```
  Debit:  PLATFORM_ESCROW:platform        $150.00
  Credit: INSTRUCTOR_ACCOUNT:inst_789     $79.50  (50% after tax)
  Credit: TAX_PAYABLE:platform            $70.50  (withholding tax)
  ```
- Track tax payable to ATO per month/quarter

### 6. Automated Audit Reports (Low Priority)

**Issue:** No audit trail for compliance/tax purposes.

**Recommendation:**
- Generate automatic reports:
  - Monthly: ledger summary, reconciliation, account balances
  - Quarterly: tax summary (withholding payable)
  - Annually: full year trial balance + journal
- Email to accounting team
- Store in S3 for record-keeping

### 7. Ledger API Pagination (Low Priority)

**Issue:** Large result sets slow API response.

**Recommendation:**
- Implement cursor-based pagination for ledger entries
- Default limit 50, max 200
- Example: `/api/admin/ledger?limit=100&cursor=ledger_xyz`

---

## Implementation Checklist

- [ ] Create `/admin/reconciliation` dashboard
- [ ] Add automatic reconciliation job (daily)
- [ ] Generate trial balance report endpoint
- [ ] Create journal report endpoint
- [ ] Add account drill-down endpoint
- [ ] Separate tax ledger entries
- [ ] Generate monthly audit reports
- [ ] Export ledger as CSV
- [ ] Add ledger pagination (cursor-based)
- [ ] Document account chart for accountants
- [ ] Set up automated ATO tax reporting
- [ ] Test double-entry integrity (debits = credits)

---

## Testing

### Test 1: Double-Entry Integrity

**Verify:** For every entry, total debits = total credits

```sql
SELECT 
  SUM(CASE WHEN debit_account != '' THEN amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN credit_account != '' THEN amount ELSE 0 END) as total_credits
FROM financial_ledger;
-- Should show: total_debits = total_credits
```

### Test 2: Idempotency

**Trigger:** Submit same webhook twice with same idempotencyKey

**Verify:**
1. First submission creates 2 entries (debit + credit)
2. Second submission: unique constraint prevents duplicate
3. No error thrown, system stable

### Test 3: Account Balance

**Setup:** Create booking → payout → refund

**Verify:**
1. CLIENT_PAYMENT balance matches client's payment
2. INSTRUCTOR_ACCOUNT balance = net payout
3. PLATFORM_FEE balance = commission earned
4. Sum of all account balances = 0 (except for active disputes/reserves)

---

## References

- **Schema Models:** `prisma/schema.prisma` → `FinancialLedger`, `LedgerEntry`, `PlatformLedger`
- **Service:** `lib/services/ledger-service.ts`
- **API Endpoint:** `app/api/admin/ledger/route.ts`
- **Double-Entry Accounting:** https://www.investopedia.com/terms/d/double-entry-bookkeeping.asp


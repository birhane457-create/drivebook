# Payment & Invoicing System Guide

## Overview
Complete payment and earnings tracking system for the DriveBook platform with Stripe integration.

## ✅ Completed Features

### 1. Earnings Dashboard (`/dashboard/earnings`)
**Location:** `app/dashboard/earnings/page.tsx`

**Features:**
- Total lifetime earnings display
- Monthly earnings comparison with growth rate
- Pending payouts tracking
- Upcoming bookings value projection
- Complete transaction history table
- Filter transactions by status (All/Completed/Pending)
- Download invoice button for each transaction

**Stats Cards:**
- Total Earnings (all time)
- This Month earnings with % growth
- Pending Payouts (awaiting processing)
- Upcoming Value (confirmed future bookings)

### 2. Earnings API Endpoint
**Location:** `app/api/instructor/earnings/route.ts`

**Returns:**
```json
{
  "totalEarnings": 1250.00,
  "pendingPayouts": 350.00,
  "completedPayouts": 900.00,
  "thisMonthEarnings": 450.00,
  "lastMonthEarnings": 380.00,
  "transactions": [...],
  "upcomingBookings": {
    "count": 5,
    "totalValue": 600.00
  }
}
```

### 3. Stripe Integration
**Location:** `lib/services/stripe.ts`

**Capabilities:**
- Create payment intents for bookings
- Create Stripe Connect accounts for instructors
- Process payouts to instructors
- Handle refunds
- Webhook signature verification

**Configuration:**
```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_COMMISSION_RATE=12.0
NEW_STUDENT_BONUS_RATE=8.0
```

### 4. Payment Service
**Location:** `lib/services/payment.ts`

**Features:**
- Calculate commission based on subscription tier
- Track first booking bonus (extra commission for new clients)
- Create transaction records
- Link transactions to bookings

### 5. Database Schema
**Transaction Model** (already exists in `prisma/schema.prisma`):
```prisma
model Transaction {
  id                String      @id @default(auto()) @map("_id") @db.ObjectId
  bookingId         String?     @db.ObjectId
  booking           Booking?    @relation(fields: [bookingId], references: [id])
  instructorId      String      @db.ObjectId
  instructor        Instructor  @relation(fields: [instructorId], references: [id])
  
  type              TransactionType
  amount            Float       // Total transaction amount
  platformFee       Float       // Amount platform takes
  instructorPayout  Float       // Amount instructor receives
  commissionRate    Float?      // % applied (for bookings)
  
  status            TransactionStatus @default(PENDING)
  paymentMethod     String?
  
  // Stripe Integration
  stripePaymentIntentId String?
  stripeChargeId    String?
  stripeRefundId    String?
  stripeTransferId  String?     // For payouts to instructor
  
  description       String?
  metadata          Json?
  
  processedAt       DateTime?
  failedAt          DateTime?
  failureReason     String?
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
}
```

## 🎯 Next Steps to Complete

### 1. Invoice Generation
Create PDF invoices for transactions:
- API endpoint: `/api/instructor/invoices/[transactionId]`
- Use library like `pdfkit` or `react-pdf`
- Include: Transaction details, instructor info, platform fee breakdown
- Download as PDF

### 2. Auto-Create Transactions
When bookings are completed, automatically create transaction records:
- Hook into booking completion (check-out)
- Calculate commission using PaymentService
- Create Transaction record
- Update booking with payment info

### 3. Admin Revenue Dashboard
**Location:** `/admin/revenue`
- Total platform revenue
- Revenue by month/week
- Top earning instructors
- Commission breakdown
- Pending vs completed payouts
- Export reports

### 4. Payout Management
**Location:** `/admin/payouts`
- View all pending payouts
- Process payouts to instructors
- Payout history
- Failed payout handling
- Bulk payout processing

### 5. Stripe Connect Onboarding
- Instructor onboarding flow
- Link Stripe Connect account
- Verify bank details
- Enable automatic payouts

### 6. Payment Flow for Clients
- Client payment page
- Stripe Elements integration
- Payment confirmation
- Receipt generation

## 📊 Commission Structure

### Default Rates
- **Platform Commission:** 12% of booking price
- **New Student Bonus:** +8% for first booking with new client
- **Total for first booking:** 20% commission

### Example Calculation
```
Booking Price: $100
Platform Fee (12%): $12
Instructor Payout: $88

First Booking with New Client:
Booking Price: $100
Platform Fee (20%): $20
Instructor Payout: $80
```

### Subscription Tiers
Commission rates can vary by instructor's subscription tier:
- **PRO:** 12% commission
- **BUSINESS:** 10% commission (lower rate for higher tier)

## 🔄 Payment Workflow

### 1. Booking Created
```
Client books lesson → Booking created (PENDING)
```

### 2. Payment Processing
```
Client pays → Stripe Payment Intent created
→ Payment successful → Booking status: CONFIRMED
→ Transaction created (PENDING)
```

### 3. Lesson Completion
```
Instructor checks out → Booking status: COMPLETED
→ Transaction status: COMPLETED
→ Funds held for payout
```

### 4. Payout
```
Weekly payout run → Transfer to instructor's Stripe Connect
→ Transaction updated with transfer ID
→ Instructor receives funds
```

## 🛠️ Installation & Setup

### 1. Install Dependencies
```bash
npm install stripe
```

### 2. Configure Environment Variables
Add to `.env`:
```env
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
PLATFORM_COMMISSION_RATE=12.0
NEW_STUDENT_BONUS_RATE=8.0
```

### 3. Set Up Stripe Webhooks
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
   - `transfer.failed`
4. Copy webhook secret to `.env`

### 4. Run Database Migration
```bash
npx prisma generate
npx prisma db push
```

## 📱 Mobile App Integration

### Earnings Screen (Future)
Create mobile earnings screen similar to web:
- `mobile/screens/EarningsScreen.tsx`
- API endpoint: `/api/instructor/earnings/mobile`
- Display stats and transaction history
- Download invoices

## 🔐 Security Considerations

1. **API Keys:** Never expose secret keys in client-side code
2. **Webhook Verification:** Always verify webhook signatures
3. **Amount Validation:** Validate amounts server-side
4. **Idempotency:** Use idempotency keys for payment operations
5. **Audit Trail:** Log all payment operations
6. **PCI Compliance:** Use Stripe Elements (never handle card data directly)

## 📈 Testing

### Test Mode
Currently configured for Stripe test mode:
- Use test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC
- Any postal code

### Test Scenarios
1. Successful payment
2. Failed payment
3. Refund processing
4. Payout to instructor
5. First booking bonus calculation

## 🆘 Troubleshooting

### Transaction Not Created
- Check if booking status is COMPLETED
- Verify PaymentService is called
- Check database logs

### Payout Failed
- Verify instructor has Stripe Connect account
- Check account verification status
- Review Stripe dashboard for errors

### Commission Calculation Wrong
- Verify instructor's subscription tier
- Check if first booking bonus applies
- Review commission rate settings

## 📞 Support

For payment-related issues:
1. Check Stripe Dashboard for detailed logs
2. Review transaction records in database
3. Check application logs for errors
4. Contact Stripe support for payment issues

## 🎉 Success Metrics

Track these KPIs:
- Total platform revenue
- Average commission per booking
- Payout processing time
- Failed payment rate
- Instructor earnings growth
- Client payment success rate

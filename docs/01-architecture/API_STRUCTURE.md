# API STRUCTURE

**Purpose**: Define API routes and endpoints  
**Owner**: Technical Team  
**Last Updated**: March 20, 2026  
**Scope**: Next.js API routes  

---

## API ORGANIZATION

```
app/api/
├── auth/                    # Authentication
├── bookings/                # Booking management
├── client/                  # Client operations
├── instructor/              # Instructor operations
├── admin/                   # Admin operations
├── analytics/               # Analytics
├── branding/                # Subdomain branding
├── stripe/                  # Payment webhooks
├── cron/                    # Scheduled tasks
└── test-email/              # Email diagnostics (admin only)
```

> All dynamic API routes must export `export const dynamic = 'force-dynamic'` to prevent Next.js from attempting static pre-rendering at build time.

---

## BOOKING APIS

### Create Booking
**POST** `/api/bookings`
- **Auth**: Instructor only
- **Purpose**: Instructor creates booking for client
- **Status**: CONFIRMED (no payment)

### Get Bookings
**GET** `/api/bookings`
- **Auth**: Instructor/Admin
- **Purpose**: List bookings
- **Filters**: status, date range

### Update Booking
**PATCH** `/api/bookings/[id]`
- **Auth**: Instructor/Admin
- **Purpose**: Edit booking details
- **Rule**: Frozen after startTime

### Confirm Booking
**POST** `/api/bookings/[id]/confirm`
- **Auth**: Instructor/Admin
- **Purpose**: Manual confirmation of PENDING bookings

### Cancel Booking
**POST** `/api/bookings/[id]/cancel`
- **Auth**: Client/Instructor/Admin
- **Purpose**: Cancel with refund policy
- **Refund**: 100%/50%/0% based on notice

### Reschedule Booking
**POST** `/api/bookings/[id]/reschedule`
- **Auth**: Instructor/Admin
- **Purpose**: Move booking to a new time slot
- **Rule**: Frozen after startTime

### Check-In
**POST** `/api/bookings/[id]/check-in`
- **Auth**: Instructor
- **Purpose**: Record lesson start

### Check-Out
**POST** `/api/bookings/[id]/check-out`
- **Auth**: Instructor/Client
- **Purpose**: Complete booking
- **Updates**: Status to COMPLETED, Transaction to COMPLETED

---

## CLIENT APIS

### Create Wallet Booking
**POST** `/api/client/bookings/create-bulk`
- **Auth**: Client only
- **Purpose**: Book one or more lessons with wallet credits
- **Status**: CONFIRMED (immediate)
- **Payment**: Deducted from wallet per booking
- **Note**: `booking.price` = 1hr × hourlyRate (never package total)

### Get Wallet
**GET** `/api/client/wallet`
- **Auth**: Client only
- **Purpose**: View wallet balance and transactions

### Wallet Summary
**GET** `/api/client/wallet/summary`
- **Auth**: Client only
- **Purpose**: Aggregated balance across all CONFIRMED transactions

### Add Wallet Funds (Stripe)
**POST** `/api/client/wallet-add`
- **Auth**: Client only
- **Purpose**: Top up wallet via Stripe PaymentIntent

### Wallet Top-Up Intent
**POST** `/api/client/wallet-topup-intent`
- **Auth**: Client only
- **Purpose**: Create Stripe PaymentIntent for wallet top-up

### Client Reschedule
**POST** `/api/client/bookings/[id]/reschedule`
- **Auth**: Client only
- **Purpose**: Client-initiated reschedule request

---

## PUBLIC APIS

### Create Public Booking (Bulk)
**POST** `/api/public/bookings/bulk`
- **Auth**: None (public)
- **Purpose**: Book package with Stripe payment (guest or logged-in)
- **Status**: PENDING_PAYMENT → CONFIRMED (via webhook)
- **Note**: Slot reserved with PENDING_PAYMENT status; expires after 10 min if payment not completed

---

## ADMIN APIS

### Wallet Management
**POST** `/api/admin/clients/[id]/wallet/add-credit`
- **Auth**: Admin only
- **Purpose**: Add credits to client wallet

**POST** `/api/admin/clients/[id]/wallet/deduct-credit`
- **Auth**: Admin only
- **Purpose**: Deduct credits from wallet

**GET** `/api/admin/clients/[id]/wallet`
- **Auth**: Admin only
- **Purpose**: View client wallet transactions

### Payout Management
**GET** `/api/admin/payouts`
- **Auth**: Admin only
- **Purpose**: List eligible payouts

**POST** `/api/admin/payouts/process`
- **Auth**: Admin only
- **Purpose**: Process single instructor payout

**POST** `/api/admin/payouts/process-all`
- **Auth**: Admin only
- **Purpose**: Batch process all eligible payouts

**POST** `/api/admin/payouts/resolve`
- **Auth**: Admin only
- **Purpose**: Manually resolve a disputed payout

### Instructor Management
**GET/POST** `/api/admin/instructors`
- **Auth**: Admin only
- **Purpose**: List and manage instructors

**POST** `/api/admin/instructors/[id]/approve`
- **Auth**: Admin only
- **Purpose**: Approve instructor application

**POST** `/api/admin/instructors/[id]/reject`
- **Auth**: Admin only
- **Purpose**: Reject instructor application

**POST** `/api/admin/instructors/[id]/suspend`
- **Auth**: Admin only
- **Purpose**: Suspend active instructor

### Pricing
**GET/POST** `/api/admin/pricing`
- **Auth**: Admin only
- **Purpose**: View and update platform pricing settings

### Settings
**GET/POST** `/api/admin/settings`
- **Auth**: Admin only
- **Purpose**: Platform-wide settings

---

## EMAIL APIS

### Test Email (Diagnostics)
**POST** `/api/test-email`
- **Auth**: ADMIN or SUPER_ADMIN only
- **Purpose**: Send a test email to verify SMTP configuration
- **Note**: POST only — not callable by GET, not triggered at build time
- **Security**: Returns 401 for non-admin sessions

---

## WEBHOOK APIS

### Stripe Webhook
**POST** `/api/stripe/webhook`
- **Auth**: Stripe signature
- **Purpose**: Handle payment confirmations
- **Events**: payment_intent.succeeded

---

## CRON APIS

### Cleanup Expired Bookings
**GET** `/api/cron/cleanup-expired-bookings`
- **Auth**: `Authorization: Bearer <CRON_SECRET>` header
- **Purpose**: Expire PENDING_PAYMENT bookings and PENDING wallet transactions older than 10 min; auto-complete checked-in lessons; mark no-shows
- **Schedule**: Every 5 minutes (configured in `vercel.json`)
- **Dynamic**: `export const dynamic = 'force-dynamic'`

---

## AUTHENTICATION

All APIs use NextAuth with role-based access:
- **Public**: No auth required
- **Client**: CLIENT role
- **Instructor**: INSTRUCTOR role
- **Admin**: ADMIN or SUPER_ADMIN role

---

## VALIDATION

All inputs validated with Zod schemas:
```typescript
const bookingSchema = z.object({
  startTime: z.string(),
  duration: z.number().min(30),
  price: z.number().min(0)
});
```

---

## ERROR HANDLING

Standard error responses:
```typescript
{
  error: "Error message",
  code: "ERROR_CODE",
  details: {}
}
```

---

## RATE LIMITING

- Financial operations: 10 req/min
- Booking actions: 20 req/min
- Public APIs: 30 req/min

---

## RELATED DOCUMENTS

- `../00-foundation/SYSTEM_PRINCIPLES.md` - Authorization rules
- `../00-foundation/STATE_MACHINE.md` - Booking states
- `DATABASE_SCHEMA.md` - Data models


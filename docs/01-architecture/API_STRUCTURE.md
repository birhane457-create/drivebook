# API STRUCTURE

**Purpose**: Define API routes and endpoints  
**Owner**: Technical Team  
**Last Updated**: March 4, 2026  
**Scope**: Next.js API routes  

---

## API ORGANIZATION

```
app/api/
├── auth/                    # Authentication
├── bookings/                # Booking management
├── client/                  # Client operations
├── admin/                   # Admin operations
├── stripe/                  # Payment webhooks
└── cron/                    # Scheduled tasks
```

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
- **Purpose**: Book with wallet credits
- **Status**: CONFIRMED (immediate)
- **Payment**: Deducted from wallet

### Get Wallet
**GET** `/api/client/wallet`
- **Auth**: Client only
- **Purpose**: View wallet balance

---

## PUBLIC APIS

### Create Public Booking
**POST** `/api/public/bookings`
- **Auth**: None (public)
- **Purpose**: Book with Stripe payment
- **Status**: PENDING → CONFIRMED (via webhook)

---

## ADMIN APIS

### Wallet Management
**POST** `/api/admin/clients/[id]/wallet/add-credit`
- **Auth**: Admin only
- **Purpose**: Add credits to client wallet

**POST** `/api/admin/clients/[id]/wallet/deduct-credit`
- **Auth**: Admin only
- **Purpose**: Deduct credits from wallet

### Payout Management
**GET** `/api/admin/payouts`
- **Auth**: Admin only
- **Purpose**: List eligible payouts

**POST** `/api/admin/payouts/process`
- **Auth**: Admin only
- **Purpose**: Process instructor payouts

---

## WEBHOOK APIS

### Stripe Webhook
**POST** `/api/stripe/webhook`
- **Auth**: Stripe signature
- **Purpose**: Handle payment confirmations
- **Events**: payment_intent.succeeded

---

## CRON APIS

### Auto-Cancel PENDING
**GET** `/api/cron/cleanup-pending`
- **Auth**: Cron secret
- **Purpose**: Cancel expired PENDING bookings
- **Schedule**: Every 5 minutes

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


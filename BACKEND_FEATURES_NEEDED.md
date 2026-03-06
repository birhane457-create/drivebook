# Backend Features Needed for AI Integration

## Current Status

### ✅ Already Implemented

1. **Smart Recommendations** - `/api/instructors/recommendations`
2. **Location Validation** - `/api/locations/validate`
3. **Package Pricing** - `/api/packages`
4. **Bulk Booking** - `/api/public/bookings/bulk`
5. **Password Auto-Generation** - Backend generates if not provided
6. **Availability Slots** - `/api/availability/slots`

### ⚠️ Needs Implementation

1. **10-Minute Time Slot Hold**
2. **OTP/Password via SMS**
3. **Payment Link Generation**
4. **Instructor Lookup by Name/Phone**

---

## Feature 1: 10-Minute Time Slot Hold

### What It Does

When user selects a time slot, it's "soft reserved" for 10 minutes while they complete payment.

### Implementation

**Add to `/api/availability/slots` response:**

```typescript
// When returning available slots
{
  slots: [
    {
      time: "09:00",
      available: true,
      canReserve: true
    }
  ]
}
```

**Add new endpoint: `/api/availability/reserve`**

```typescript
POST /api/availability/reserve
{
  instructorId: "inst_123",
  date: "2026-03-10",
  time: "09:00",
  duration: 60,
  clientEmail: "john@email.com"
}

Response:
{
  reserved: true,
  reservationId: "res_abc123",
  expiresAt: "2026-03-10T09:10:00Z", // 10 minutes from now
  message: "Time slot reserved for 10 minutes"
}
```

**Database:**

```prisma
model SlotReservation {
  id            String   @id @default(cuid())
  instructorId  String
  startTime     DateTime
  endTime       DateTime
  clientEmail   String
  expiresAt     DateTime
  status        String   // RESERVED, CONFIRMED, EXPIRED
  createdAt     DateTime @default(now())
}
```

**Cron Job:**

```javascript
// Every minute, expire old reservations
setInterval(async () => {
  await prisma.slotReservation.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      status: 'RESERVED'
    },
    data: { status: 'EXPIRED' }
  })
}, 60000)
```

---

## Feature 2: OTP/Password via SMS

### What It Does

After booking created, send password via SMS and email.

### Implementation

**Update `/api/public/bookings/bulk`:**

```typescript
// After creating booking
if (shouldSendPassword) {
  // Send SMS
  await smsService.send({
    to: data.accountHolderPhone,
    message: `Welcome to DriveBook! Your account password is: ${password}. Login at drivebook.com.au to manage your lessons.`
  });
  
  // Send Email
  await emailService.send({
    to: data.accountHolderEmail,
    subject: 'Welcome to DriveBook - Your Account Details',
    html: `
      <h1>Welcome to DriveBook!</h1>
      <p>Your account has been created successfully.</p>
      <p><strong>Email:</strong> ${data.accountHolderEmail}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p><a href="https://drivebook.com.au/login">Click here to login</a></p>
      <p>Please change your password after first login.</p>
    `
  });
}
```

**SMS Service (Twilio):**

```typescript
// lib/services/sms.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const smsService = {
  async send({ to, message }: { to: string; message: string }) {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
  }
};
```

---

## Feature 3: Payment Link Generation

### What It Does

After booking created, generate Stripe payment link and send to user.

### Implementation

**Update `/api/public/bookings/bulk` response:**

```typescript
// After creating booking
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(data.pricing.total * 100), // Convert to cents
  currency: 'aud',
  metadata: {
    bookingId: booking.id,
    clientEmail: data.accountHolderEmail
  }
});

const paymentLink = `https://drivebook.com.au/payment/${paymentIntent.id}`;

// Send payment link via email
await emailService.send({
  to: data.accountHolderEmail,
  subject: 'Complete Your DriveBook Booking',
  html: `
    <h1>Complete Your Booking</h1>
    <p>Your lesson with ${instructor.name} is reserved for 10 minutes.</p>
    <p><strong>Total:</strong> $${data.pricing.total}</p>
    <p><a href="${paymentLink}">Click here to complete payment</a></p>
    <p>Time slot expires in 10 minutes.</p>
  `
});

// Send payment link via SMS
await smsService.send({
  to: data.accountHolderPhone,
  message: `Complete your DriveBook booking: ${paymentLink} (expires in 10 min)`
});

return NextResponse.json({
  success: true,
  bookingId: booking.id,
  paymentLink: paymentLink,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000)
});
```

**Create Payment Page:**

```typescript
// app/payment/[intentId]/page.tsx
export default async function PaymentPage({ params }: { params: { intentId: string } }) {
  const intent = await stripe.paymentIntents.retrieve(params.intentId);
  
  return (
    <div>
      <h1>Complete Your Booking</h1>
      <StripeCheckout clientSecret={intent.client_secret} />
    </div>
  );
}
```

---

## Feature 4: Instructor Lookup by Name/Phone

### What It Does

Allow AI to find instructor by name or phone number.

### Implementation

**Add endpoint: `/api/instructors/lookup`**

```typescript
GET /api/instructors/lookup?query=Debesay
GET /api/instructors/lookup?query=0400123456

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }
  
  // Search by name or phone
  const instructor = await prisma.instructor.findFirst({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: query },
        { user: { email: query } }
      ],
      isActive: true,
      approvalStatus: 'APPROVED'
    },
    select: {
      id: true,
      name: true,
      hourlyRate: true,
      rating: true,
      profileImage: true,
      baseAddress: true,
      vehicleTypes: true,
      languages: true
    }
  });
  
  if (!instructor) {
    return NextResponse.json({ 
      found: false,
      message: 'Instructor not found' 
    }, { status: 404 });
  }
  
  return NextResponse.json({
    found: true,
    instructor
  });
}
```

**Update OpenAPI spec:**

```yaml
/instructors/lookup:
  get:
    summary: Find instructor by name or phone
    parameters:
      - name: query
        in: query
        type: string
        required: true
        description: Instructor name or phone number
    responses:
      '200':
        description: Instructor found
      '404':
        description: Instructor not found
```

---

## Priority Implementation Order

### Phase 1 (Critical - Do First)

1. **OTP/Password via SMS** ⭐ CRITICAL
   - Users need password to login
   - Estimated time: 2 hours

2. **Payment Link Generation** ⭐ CRITICAL
   - Users need to pay
   - Estimated time: 3 hours

### Phase 2 (Important - Do Soon)

3. **Instructor Lookup** ⭐ IMPORTANT
   - Better UX if user knows instructor
   - Estimated time: 1 hour

4. **10-Minute Time Slot Hold** ⭐ IMPORTANT
   - Prevents double booking
   - Estimated time: 4 hours

### Phase 3 (Nice to Have - Do Later)

5. **Rescheduling API**
6. **Cancellation API**
7. **Booking Lookup by Phone**

---

## Testing Checklist

### After Implementation

- [ ] SMS received with password
- [ ] Email received with password
- [ ] Payment link works
- [ ] Payment link expires after 10 minutes
- [ ] Booking status updates after payment
- [ ] Instructor lookup by name works
- [ ] Instructor lookup by phone works
- [ ] Time slot hold prevents double booking
- [ ] Expired reservations are cleaned up

---

## Environment Variables Needed

```env
# Twilio (for SMS)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+61400000000

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# Email (already configured)
RESEND_API_KEY=re_xxxxx
```

---

## Summary

### Already Working ✅
- Smart recommendations
- Location validation
- Package pricing
- Bulk booking
- Password auto-generation
- Availability slots

### Needs Implementation ⚠️
1. OTP/Password via SMS (2 hours) ⭐ CRITICAL
2. Payment link generation (3 hours) ⭐ CRITICAL
3. Instructor lookup (1 hour) ⭐ IMPORTANT
4. 10-minute slot hold (4 hours) ⭐ IMPORTANT

**Total Estimated Time:** 10 hours

**Priority:** Implement Phase 1 first (SMS + Payment) to make the system functional end-to-end.


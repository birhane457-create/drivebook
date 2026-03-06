# Backend Features Needed for AI Integration

## Current Status

### ✅ Already Implemented

1. **Smart Recommendations** - `/api/instructors/recommendations`
2. **Location Validation** - `/api/locations/validate`
3. **Package Pricing** - `/api/packages`
4. **Bulk Booking** - `/api/public/bookings/bulk`
5. **Password Auto-Generation** - Backend generates if not provided
6. **Availability Slots** - `/api/availability/slots`

### ⚠️ Needs Implementation (REVISED ARCHITECTURE)

1. **Booking Status & Expiry** - Add PENDING_PAYMENT, CONFIRMED, EXPIRED, CANCELLED
2. **Stripe Checkout Session** - Replace payment links with Checkout Sessions
3. **Payment Webhook** - Confirm bookings when payment succeeds
4. **SMS/Email Notifications** - Send password and payment link
5. **Booking Expiry Cron** - Auto-expire unpaid bookings after 10 minutes
6. **Booking Lookup** - Find bookings by phone number
7. **Instructor Lookup** - Find instructor by name/phone (optional enhancement)

---

## Feature 1: Booking Status & Expiry (CRITICAL)

### What It Does

Bookings start as PENDING_PAYMENT and expire after 10 minutes if not paid. This automatically releases the time slot without needing a separate reservation table.

### Implementation

**Update Booking Model:**

```prisma
model Booking {
  // ... existing fields
  status        String   @default("PENDING_PAYMENT") // PENDING_PAYMENT, CONFIRMED, EXPIRED, CANCELLED
  expiresAt     DateTime? // Set to now + 10 minutes for PENDING_PAYMENT bookings
  // ... rest of fields
}
```

**Update `/api/public/bookings/bulk`:**

```typescript
const booking = await prisma.booking.create({
  data: {
    // ... existing fields
    status: 'PENDING_PAYMENT',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    // ... rest of fields
  }
});
```

**Update `/api/availability/slots`:**

```typescript
// When checking availability, exclude bookings with these statuses:
const bookedSlots = await prisma.booking.findMany({
  where: {
    instructorId,
    date,
    status: {
      in: ['PENDING_PAYMENT', 'CONFIRMED'] // Both block the slot
    }
  }
});
```

**Cron Job (runs every minute):**

```typescript
// api/cron/expire-bookings/route.ts
export async function GET() {
  const expiredBookings = await prisma.booking.updateMany({
    where: {
      status: 'PENDING_PAYMENT',
      expiresAt: { lt: new Date() }
    },
    data: {
      status: 'EXPIRED'
    }
  });
  
  return NextResponse.json({ 
    expired: expiredBookings.count 
  });
}
```

**Setup Vercel Cron:**

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/expire-bookings",
    "schedule": "* * * * *"
  }]
}
```

---

## Feature 2: Stripe Checkout Session (CRITICAL)

### What It Does

Creates a Stripe Checkout Session (not payment link) with booking metadata. Returns checkout URL to send via SMS/email.

### Implementation

**Update `/api/public/bookings/bulk`:**

```typescript
// After creating booking
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{
    price_data: {
      currency: 'aud',
      product_data: {
        name: `${data.packageType} with ${instructor.name}`,
        description: `${data.hours} hours of driving lessons`
      },
      unit_amount: Math.round(data.pricing.total * 100) // Convert to cents
    },
    quantity: 1
  }],
  success_url: `https://drivebook.com.au/booking-success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `https://drivebook.com.au/booking-cancelled?booking_id=${booking.id}`,
  metadata: {
    bookingId: booking.id,
    clientEmail: data.accountHolderEmail,
    instructorId: data.instructorId
  },
  customer_email: data.accountHolderEmail,
  expires_at: Math.floor(Date.now() / 1000) + (10 * 60) // 10 minutes
});

return NextResponse.json({
  success: true,
  bookingId: booking.id,
  checkoutUrl: session.url,
  expiresAt: booking.expiresAt,
  total: data.pricing.total
});
```

**Why Checkout Session is Better:**
- Easier to pass bookingId via metadata
- Webhook integration is cleaner
- Built-in expiry handling
- Better mobile experience

---

## Feature 3: Payment Webhook (CRITICAL)

### What It Does

Stripe webhook confirms payment and updates booking status from PENDING_PAYMENT to CONFIRMED.

### Implementation

**Create webhook endpoint:**

```typescript
// app/api/payments/webhook/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;

    if (bookingId) {
      // Update booking status to CONFIRMED
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          expiresAt: null // No longer needs to expire
        }
      });

      // Send confirmation email/SMS
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { instructor: true }
      });

      if (booking) {
        await sendConfirmationNotifications(booking);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

**Configure in Stripe Dashboard:**
1. Go to Developers → Webhooks
2. Add endpoint: `https://drivebook.com.au/api/payments/webhook`
3. Select event: `checkout.session.completed`
4. Copy webhook secret to `.env`

---

## Feature 4: SMS & Email Notifications (CRITICAL)

### What It Does

After booking created, send password and checkout link via SMS and email.

### Implementation

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

**Update `/api/public/bookings/bulk`:**

```typescript
// After creating Stripe session
if (shouldSendPassword) {
  // Send SMS
  await smsService.send({
    to: data.accountHolderPhone,
    message: `DriveBook: Your account is ready!\n\nLogin: ${data.accountHolderEmail}\nPassword: ${password}\n\nComplete payment: ${session.url}\n\n(Link expires in 10 min)`
  });
  
  // Send Email
  await emailService.send({
    to: data.accountHolderEmail,
    subject: 'Complete Your DriveBook Booking',
    html: `
      <h1>Your DriveBook Account is Ready!</h1>
      <p>Your lesson with ${instructor.name} is reserved for 10 minutes.</p>
      
      <h2>Account Details</h2>
      <p><strong>Email:</strong> ${data.accountHolderEmail}</p>
      <p><strong>Password:</strong> ${password}</p>
      
      <h2>Complete Payment</h2>
      <p><strong>Total:</strong> $${data.pricing.total}</p>
      <a href="${session.url}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Pay Now
      </a>
      
      <p style="color: #666; margin-top: 20px;">
        ⏰ Time slot expires in 10 minutes
      </p>
    `
  });
}
```

---

## Feature 5: Booking Lookup (IMPORTANT)

### What It Does

Allow AI to find bookings by phone number for rescheduling/cancellation.

### Implementation

**Add endpoint:**

```typescript
// app/api/bookings/lookup/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone');
  
  if (!phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 });
  }
  
  const bookings = await prisma.booking.findMany({
    where: {
      clientPhone: phone,
      status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
      startTime: { gte: new Date() } // Only future bookings
    },
    include: {
      instructor: {
        select: {
          name: true,
          phone: true
        }
      }
    },
    orderBy: { startTime: 'asc' }
  });
  
  return NextResponse.json({ bookings });
}
```

---

## Feature 7: Cancellation Policy Check (IMPORTANT)

### What It Does

Returns cancellation policy for a booking based on time remaining. AI calls this before cancelling to inform user of fees.

### Implementation

**Add endpoint:**

```typescript
// app/api/bookings/[id]/cancellation-policy/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { instructor: true }
  });
  
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  
  const now = new Date();
  const lessonTime = new Date(booking.startTime);
  const hoursBeforeLesson = (lessonTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  let policy;
  
  if (hoursBeforeLesson > 48) {
    policy = {
      allowed: true,
      refundPercentage: 100,
      cancellationFee: 0,
      refundAmount: booking.price,
      feeAmount: 0,
      reason: 'more_than_48_hours'
    };
  } else if (hoursBeforeLesson > 24) {
    policy = {
      allowed: true,
      refundPercentage: 50,
      cancellationFee: 50,
      refundAmount: booking.price * 0.5,
      feeAmount: booking.price * 0.5,
      reason: 'between_24_and_48_hours'
    };
  } else {
    policy = {
      allowed: false,
      refundPercentage: 0,
      cancellationFee: 100,
      refundAmount: 0,
      feeAmount: booking.price,
      reason: 'less_than_24_hours'
    };
  }
  
  return NextResponse.json({
    bookingId: booking.id,
    hoursBeforeLesson: Math.round(hoursBeforeLesson * 10) / 10,
    policy,
    message: policy.allowed 
      ? `Cancellation allowed with ${policy.cancellationFee}% fee`
      : 'Cancellation not allowed within 24 hours'
  });
}
```

---

## Feature 8: Cancel Booking (IMPORTANT)

### What It Does

Cancels a booking and processes refund according to cancellation policy.

### Implementation

**Add endpoint:**

```typescript
// app/api/bookings/[id]/cancel/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { reason, notes } = body;
  
  const booking = await prisma.booking.findUnique({
    where: { id: params.id }
  });
  
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  
  // Check cancellation policy
  const now = new Date();
  const lessonTime = new Date(booking.startTime);
  const hoursBeforeLesson = (lessonTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  let refundPercentage = 0;
  
  if (hoursBeforeLesson > 48) {
    refundPercentage = 100;
  } else if (hoursBeforeLesson > 24) {
    refundPercentage = 50;
  } else if (reason === 'weather' || reason === 'safety') {
    // Exception: weather/safety always gets 100% refund
    refundPercentage = 100;
  } else {
    return NextResponse.json({
      error: 'Cancellation not allowed within 24 hours',
      policy: {
        hoursBeforeLesson,
        refundPercentage: 0
      }
    }, { status: 400 });
  }
  
  const refundAmount = booking.price * (refundPercentage / 100);
  
  // Update booking status
  await prisma.booking.update({
    where: { id: params.id },
    data: {
      status: 'CANCELLED',
      cancellationReason: reason,
      cancellationNotes: notes,
      cancelledAt: new Date(),
      refundAmount: refundAmount,
      refundPercentage: refundPercentage
    }
  });
  
  // Process refund to wallet
  await prisma.transaction.create({
    data: {
      clientId: booking.clientId,
      type: 'REFUND',
      amount: refundAmount,
      description: `Refund for cancelled booking ${booking.id}`,
      status: 'COMPLETED'
    }
  });
  
  return NextResponse.json({
    success: true,
    bookingId: booking.id,
    status: 'CANCELLED',
    refundAmount,
    refundPercentage,
    message: `Booking cancelled. $${refundAmount.toFixed(2)} refunded to your wallet.`
  });
}
```

---

## Feature 9: Reschedule Booking (IMPORTANT)

### What It Does

Reschedules a booking to a new date/time. Same cancellation policy applies.

### Implementation

**Add endpoint:**

```typescript
// app/api/bookings/[id]/reschedule/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { newDate, newTime, reason } = body;
  
  const booking = await prisma.booking.findUnique({
    where: { id: params.id }
  });
  
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  
  // Check if new slot is available
  const newStartTime = new Date(`${newDate}T${newTime}`);
  const newEndTime = new Date(newStartTime.getTime() + booking.duration * 60 * 60 * 1000);
  
  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      instructorId: booking.instructorId,
      status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
      startTime: { lte: newEndTime },
      endTime: { gte: newStartTime }
    }
  });
  
  if (conflictingBooking) {
    return NextResponse.json({
      error: 'Time slot not available',
      availableSlots: [] // TODO: fetch available slots
    }, { status: 400 });
  }
  
  // Check rescheduling policy (same as cancellation)
  const now = new Date();
  const oldLessonTime = new Date(booking.startTime);
  const hoursBeforeLesson = (oldLessonTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  let feePercentage = 0;
  
  if (hoursBeforeLesson <= 24) {
    return NextResponse.json({
      error: 'Rescheduling not allowed within 24 hours. Please cancel and create new booking.',
      policy: { hoursBeforeLesson }
    }, { status: 400 });
  } else if (hoursBeforeLesson <= 48) {
    feePercentage = 50;
  }
  
  const feeAmount = booking.price * (feePercentage / 100);
  
  // Update booking
  const updatedBooking = await prisma.booking.update({
    where: { id: params.id },
    data: {
      startTime: newStartTime,
      endTime: newEndTime,
      rescheduledFrom: booking.startTime,
      rescheduledAt: new Date(),
      reschedulingFee: feeAmount,
      reschedulingReason: reason
    }
  });
  
  return NextResponse.json({
    success: true,
    bookingId: booking.id,
    oldStartTime: booking.startTime,
    newStartTime: updatedBooking.startTime,
    feeApplied: feePercentage,
    feeAmount,
    message: feePercentage > 0
      ? `Lesson rescheduled. $${feeAmount.toFixed(2)} rescheduling fee applied.`
      : 'Lesson rescheduled successfully with no fee.'
  });
}
```

---

## Feature 10: Instructor Lookup (OPTIONAL)

### What It Does

Allow AI to find instructor by name or phone if user has a preference.

### Implementation

**Add endpoint:**

```typescript
// app/api/instructors/lookup/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }
  
  const instructor = await prisma.instructor.findFirst({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: query }
      ],
      isActive: true,
      approvalStatus: 'APPROVED'
    },
    select: {
      id: true,
      name: true,
      hourlyRate: true,
      rating: true,
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
  
  return NextResponse.json({ found: true, instructor });
}
```

---

## Priority Implementation Order (REVISED)

### Phase 1 (Critical - Must Have for Production)

1. **Booking Status & Expiry** ⭐ CRITICAL
   - Add status field and expiresAt to Booking model
   - Update booking creation to set PENDING_PAYMENT
   - Estimated time: 30 minutes

2. **Stripe Checkout Session** ⭐ CRITICAL
   - Replace payment link with Checkout Session
   - Pass bookingId in metadata
   - Estimated time: 1.5 hours

3. **Payment Webhook** ⭐ CRITICAL
   - Handle checkout.session.completed
   - Update booking status to CONFIRMED
   - Estimated time: 1 hour

4. **SMS & Email Notifications** ⭐ CRITICAL
   - Send password and checkout link
   - Twilio integration for SMS
   - Estimated time: 1.5 hours

5. **Booking Expiry Cron** ⭐ CRITICAL
   - Auto-expire unpaid bookings
   - Setup Vercel cron job
   - Estimated time: 1 hour

**Phase 1 Total: ~5.5 hours**

### Phase 2 (Important - Nice to Have)

6. **Booking Lookup** ⭐ IMPORTANT
   - Find bookings by phone
   - For rescheduling/cancellation
   - Estimated time: 30 minutes

7. **Cancellation Policy Endpoint** ⭐ IMPORTANT
   - Check cancellation eligibility and fees
   - Returns refund percentage based on time remaining
   - Estimated time: 1 hour

8. **Cancel Booking Endpoint** ⭐ IMPORTANT
   - Cancel booking with automatic refund
   - Apply cancellation policy rules
   - Estimated time: 1.5 hours

9. **Reschedule Booking Endpoint** ⭐ IMPORTANT
   - Reschedule to new date/time
   - Apply same cancellation policy
   - Estimated time: 1.5 hours

10. **Instructor Lookup** ⭐ OPTIONAL
   - Find instructor by name/phone
   - Better UX if user has preference
   - Estimated time: 30 minutes

**Phase 2 Total: ~5 hours**

### Phase 3 (Future Enhancements)

11. **Automatic Weather Detection**
12. **Instructor Approval Override**
13. **Refund to original payment method**

---

## Testing Checklist

### After Phase 1 Implementation

- [ ] Booking created with PENDING_PAYMENT status
- [ ] expiresAt set to 10 minutes from creation
- [ ] SMS received with password and checkout link
- [ ] Email received with password and checkout link
- [ ] Stripe Checkout Session opens correctly
- [ ] Payment completes successfully
- [ ] Webhook receives checkout.session.completed event
- [ ] Booking status updates to CONFIRMED after payment
- [ ] Booking expiresAt cleared after confirmation
- [ ] Cron job expires unpaid bookings after 10 minutes
- [ ] Expired bookings release time slots
- [ ] Availability endpoint excludes PENDING_PAYMENT and CONFIRMED bookings

### After Phase 2 Implementation

- [ ] Booking lookup by phone returns correct bookings
- [ ] Instructor lookup by name works
- [ ] Instructor lookup by phone works

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
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

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

**Phase 1 (Critical - 5.5 hours):**
1. Booking status & expiry (30 min) ⭐ CRITICAL
2. Stripe Checkout Session (1.5h) ⭐ CRITICAL
3. Payment webhook (1h) ⭐ CRITICAL
4. SMS & Email notifications (1.5h) ⭐ CRITICAL
5. Booking expiry cron (1h) ⭐ CRITICAL

**Phase 2 (Important - 1 hour):**
6. Booking lookup (30 min) ⭐ IMPORTANT
7. Instructor lookup (30 min) ⭐ OPTIONAL

**Total Estimated Time:** 10.5 hours (Phase 1: 5.5h + Phase 2: 5h)

**Architecture Improvement:** Using booking status instead of separate reservation table simplifies the system significantly.

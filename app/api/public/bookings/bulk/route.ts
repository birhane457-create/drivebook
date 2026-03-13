import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { bulkBookingRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';

const bulkBookingSchema = z.object({
  instructorId: z.string(),
  packageType: z.enum(['CUSTOM', 'PACKAGE_6', 'PACKAGE_10', 'PACKAGE_15']),
  hours: z.number(),
  includeTestPackage: z.boolean(),
  bookingType: z.enum(['now', 'later']),
  scheduledBookings: z.array(z.object({
    date: z.string(),
    time: z.string(),
    duration: z.number(),
    pickupLocation: z.string(),
    notes: z.string()
  })).optional(),
  registrationType: z.enum(['myself', 'someone-else']),
  // Account holder (always required)
  accountHolderName: z.string(),
  accountHolderEmail: z.string().email(),
  accountHolderPhone: z.string(),
  accountHolderPassword: z.string(),
  // Learner (only if someone-else)
  learnerName: z.string().optional(),
  learnerPhone: z.string().optional(),
  learnerRelationship: z.string().optional(),
  pricing: z.object({
    subtotal: z.number(),
    discount: z.number(),
    discountPercentage: z.number(),
    testPackage: z.number(),
    platformFee: z.number(),
    total: z.number()
  })
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = bulkBookingSchema.parse(body);

    // Rate limiting: limit bulk bookings per client/email/IP
    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
    const identifier = getRateLimitIdentifier(undefined, ip, `bulk-booking:${data.accountHolderEmail}:${data.instructorId}`);
    const rate = await checkRateLimitStrict(bulkBookingRateLimit, identifier);
    if (!rate.success) {
      return new NextResponse(JSON.stringify({ error: rate.error }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...(rate.headers || {}),
        },
      });
    }

    // Check if instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
      include: { user: true }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Create user account (always required now)
    let userId: string | undefined;
    const hashedPassword = await bcrypt.hash(data.accountHolderPassword, 10);
    
    const existingUser = await prisma.user.findUnique({
      where: { email: data.accountHolderEmail }
    });

    if (!existingUser) {
      const newUser = await prisma.user.create({
        data: {
          email: data.accountHolderEmail,
          password: hashedPassword,
          role: 'CLIENT'
        }
      });
      userId = newUser.id;
    } else {
      userId = existingUser.id;
    }

    // Determine client details based on registration type
    const clientName = data.registrationType === 'myself' 
      ? data.accountHolderName 
      : data.learnerName || data.accountHolderName;
    
    const clientPhone = data.registrationType === 'myself'
      ? data.accountHolderPhone
      : data.learnerPhone || data.accountHolderPhone;
    
    const clientEmail = data.accountHolderEmail;

    // (Drivebook schema doesn't track clients by instructor/email, so skip client lookup)
    // we still compute name/phone above and could persist a client record if needed.

    // Choose date/time from first scheduled slot or default to today
    let dateValue = new Date().toISOString().split('T')[0];
    let timeValue = '00:00';
    if (data.scheduledBookings && data.scheduledBookings.length > 0) {
      dateValue = data.scheduledBookings[0].date;
      timeValue = data.scheduledBookings[0].time;
    }

    // Create booking record with minimal schema fields
    const booking = await prisma.booking.create({
      data: {
        instructorId: data.instructorId,
        clientName,
        clientPhone,
        date: dateValue,
        time: timeValue,
        duration: data.hours * 60 // store minutes
      }
    });

    console.log('Booking created with id', booking.id);
    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      total: data.pricing.total
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Bulk booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

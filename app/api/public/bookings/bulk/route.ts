import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { calculateBulkCommissionDynamic } from '@/lib/config/packages';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

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
    
    // Normalize email: lowercase and trim
    const normalizedEmail = data.accountHolderEmail.toLowerCase().trim();
    
    // Check for existing user with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      // User already exists - prevent duplicate account creation
      return NextResponse.json({ 
        error: 'An account with this email already exists. Please login to your existing account instead.',
        code: 'EMAIL_EXISTS'
      }, { status: 409 });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(data.accountHolderPassword, 10);
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'CLIENT'
      }
    });
    userId = newUser.id;

    // NOTE: Welcome email will be sent by webhook after payment succeeds

    // Determine client details based on registration type
    const clientName = data.registrationType === 'myself' 
      ? data.accountHolderName 
      : data.learnerName || data.accountHolderName;
    
    const clientPhone = data.registrationType === 'myself'
      ? data.accountHolderPhone
      : data.learnerPhone || data.accountHolderPhone;
    
    const clientEmail = data.accountHolderEmail; // Always use account holder email

    // Create or find client
    let client = await prisma.client.findFirst({
      where: {
        instructorId: data.instructorId,
        email: clientEmail,
        name: clientName
      }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          instructorId: data.instructorId,
          userId,
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          preferredInstructorId: data.instructorId // Store selected instructor
        }
      });
    } else if (userId && !client.userId) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: { 
          userId,
          preferredInstructorId: data.instructorId // Update preferred instructor
        }
      });
    }

    // Check if this is first booking with this client
    const existingBookings = await prisma.booking.count({
      where: {
        instructorId: data.instructorId,
        clientId: client.id
      }
    });
    const isFirstBooking = existingBookings === 0;

    // Calculate commission using dynamic settings from database
    const commission = await calculateBulkCommissionDynamic(
      data.instructorId,
      data.pricing.total - data.pricing.platformFee,
      isFirstBooking,
      instructor.subscriptionTier
    );

    // Create bulk booking record
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 365); // 1 year (365 days) from now
    
    const booking = await prisma.booking.create({
      data: {
        instructorId: data.instructorId,
        clientId: client.id,
        bookingType: 'LESSON',
        status: 'PENDING',
        startTime: new Date(),
        endTime: new Date(),
        price: data.pricing.total,
        platformFee: data.pricing.platformFee,
        instructorPayout: commission.instructorPayout,
        commissionRate: commission.commissionRate,
        isFirstBooking,
        notes: `BULK PACKAGE: ${data.hours} hours${data.includeTestPackage ? ' + Test Package' : ''}\n\nPackage: ${data.packageType}\nDiscount: ${data.pricing.discountPercentage}%\nTest Package: ${data.includeTestPackage ? 'Yes' : 'No'}\nBooking Type: ${data.bookingType}\nRegistration Type: ${data.registrationType}\n${data.registrationType === 'someone-else' ? `Learner: ${data.learnerName}\nRelationship: ${data.learnerRelationship}\n` : ''}`,
        createdBy: 'client',
        // Package tracking
        isPackageBooking: true,
        packageHours: data.hours,
        packageHoursUsed: 0,
        packageHoursRemaining: data.hours,
        packageExpiryDate: expiryDate,
        packageStatus: 'active'
      }
    });

    // Create individual booking records for scheduled lessons (if "Book Now")
    if (data.bookingType === 'now' && data.scheduledBookings && data.scheduledBookings.length > 0) {
      for (const scheduledBooking of data.scheduledBookings) {
        const [hours, minutes] = scheduledBooking.time.split(':').map(Number);
        const startDateTime = new Date(scheduledBooking.date + 'T00:00:00');
        startDateTime.setHours(hours, minutes, 0, 0);
        
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + scheduledBooking.duration);

        // Check for conflicts before creating
        const conflictingBooking = await prisma.booking.findFirst({
          where: {
            instructorId: data.instructorId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            OR: [
              {
                AND: [
                  { startTime: { gte: startDateTime } },
                  { startTime: { lt: endDateTime } }
                ]
              },
              {
                AND: [
                  { endTime: { gt: startDateTime } },
                  { endTime: { lte: endDateTime } }
                ]
              },
              {
                AND: [
                  { startTime: { lte: startDateTime } },
                  { endTime: { gte: endDateTime } }
                ]
              }
            ]
          }
        });

        if (conflictingBooking) {
          // Rollback: delete the bulk booking
          await prisma.booking.delete({ where: { id: booking.id } });
          return NextResponse.json({ 
            error: `Time slot conflict: ${scheduledBooking.date} at ${scheduledBooking.time} is already booked. Please refresh and try again.` 
          }, { status: 409 });
        }

        // Create individual booking record to block the slot
        await prisma.booking.create({
          data: {
            instructorId: data.instructorId,
            clientId: client.id,
            bookingType: 'LESSON',
            status: 'PENDING',
            startTime: startDateTime,
            endTime: endDateTime,
            duration: scheduledBooking.duration / 60, // Convert minutes to hours
            price: 0, // Individual lessons don't have separate prices
            platformFee: 0,
            instructorPayout: 0,
            commissionRate: 0,
            pickupAddress: scheduledBooking.pickupLocation,
            notes: `Part of bulk package (${booking.id})\n${scheduledBooking.notes}`,
            createdBy: 'client',
            // Link to parent package
            parentBookingId: booking.id,
            isPackageBooking: false, // This is a child booking
            // Package tracking inherited from parent
            packageHoursRemaining: (scheduledBooking.duration / 60) // This booking's hours
          } as any
        });
      }
    }

    // Create transaction record
    await prisma.transaction.create({
      data: {
        bookingId: booking.id,
        instructorId: data.instructorId,
        type: 'BOOKING_PAYMENT',
        amount: data.pricing.total,
        platformFee: commission.totalPlatformRevenue,
        instructorPayout: commission.instructorPayout,
        commissionRate: commission.commissionRate,
        status: 'PENDING',
        description: `Bulk booking package: ${data.hours} hours`,
        metadata: {
          packageType: data.packageType,
          hours: data.hours,
          includeTestPackage: data.includeTestPackage,
          discount: data.pricing.discount,
          discountPercentage: data.pricing.discountPercentage,
          platformFee: data.pricing.platformFee,
          commissionBreakdown: commission
        }
      }
    });

    // NOTE: All emails (welcome, confirmation, instructor notification) will be sent by webhook after payment succeeds
    // This ensures emails are only sent when payment is actually processed

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      clientId: client.id,
      total: data.pricing.total,
      commission
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Bulk booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

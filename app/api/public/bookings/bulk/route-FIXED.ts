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
          phone: clientPhone
        }
      });
    } else if (userId && !client.userId) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: { userId }
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

    // Calculate commission
    const commission = await calculateBulkCommissionDynamic(
      data.instructorId,
      data.pricing.total - data.pricing.platformFee,
      isFirstBooking,
      instructor.subscriptionTier
    );

    // ✅ NEW APPROACH: Add to wallet instead of creating booking record
    // Get or create wallet for user
    let wallet = await prisma.clientWallet.findFirst({
      where: { userId }
    });

    if (!wallet) {
      wallet = await prisma.clientWallet.create({
        data: {
          userId: userId!,
          balance: 0,
          totalPaid: 0,
          totalSpent: 0,
          creditsRemaining: 0
        }
      });
    }

    // Generate a unique package purchase ID for tracking
    const packagePurchaseId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create wallet transaction for package purchase (PENDING until payment confirmed)
    const walletTransaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'credit', // Package purchase adds credit
        amount: data.pricing.total,
        description: `Package purchase: ${data.hours} hours${data.includeTestPackage ? ' + Test Package' : ''}`,
        status: 'pending', // Will be completed by webhook
        metadata: {
          packagePurchaseId,
          packageType: data.packageType,
          hours: data.hours,
          includeTestPackage: data.includeTestPackage,
          instructorId: data.instructorId,
          instructorName: instructor.name,
          discount: data.pricing.discount,
          discountPercentage: data.pricing.discountPercentage,
          platformFee: data.pricing.platformFee,
          registrationType: data.registrationType,
          learnerName: data.registrationType === 'someone-else' ? data.learnerName : null,
          learnerRelationship: data.registrationType === 'someone-else' ? data.learnerRelationship : null,
          expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
        }
      }
    });

    // Create transaction record for platform tracking
    const transaction = await prisma.transaction.create({
      data: {
        // No bookingId - this is a package purchase, not a booking
        instructorId: data.instructorId,
        type: 'BOOKING_PAYMENT', // Keep same type for compatibility
        amount: data.pricing.total,
        platformFee: commission.totalPlatformRevenue,
        instructorPayout: commission.instructorPayout,
        commissionRate: commission.commissionRate,
        status: 'PENDING',
        description: `Package purchase: ${data.hours} hours`,
        metadata: {
          packagePurchaseId,
          walletTransactionId: walletTransaction.id,
          packageType: data.packageType,
          hours: data.hours,
          includeTestPackage: data.includeTestPackage,
          discount: data.pricing.discount,
          discountPercentage: data.pricing.discountPercentage,
          platformFee: data.pricing.platformFee,
          commissionBreakdown: commission,
          isPackagePurchase: true // Flag to identify this as package purchase
        }
      }
    });

    // ✅ If "Book Now", create actual booking records for scheduled lessons
    const createdBookings: string[] = [];
    
    if (data.bookingType === 'now' && data.scheduledBookings && data.scheduledBookings.length > 0) {
      for (const scheduledBooking of data.scheduledBookings) {
        const [hours, minutes] = scheduledBooking.time.split(':').map(Number);
        const startDateTime = new Date(scheduledBooking.date + 'T00:00:00');
        startDateTime.setHours(hours, minutes, 0, 0);
        
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + scheduledBooking.duration);

        // Check for conflicts
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
          // Rollback: delete wallet transaction and platform transaction
          await prisma.walletTransaction.delete({ where: { id: walletTransaction.id } });
          await prisma.transaction.delete({ where: { id: transaction.id } });
          
          return NextResponse.json({ 
            error: `Time slot conflict: ${scheduledBooking.date} at ${scheduledBooking.time} is already booked. Please refresh and try again.` 
          }, { status: 409 });
        }

        // Calculate price for this booking (will be deducted from wallet after payment)
        const bookingHours = scheduledBooking.duration / 60;
        const bookingPrice = (data.pricing.total / data.hours) * bookingHours;

        // ✅ Create actual booking record (not package purchase)
        const booking = await prisma.booking.create({
          data: {
            instructorId: data.instructorId,
            clientId: client.id,
            userId, // ✅ Link to user account
            bookingType: 'LESSON',
            status: 'PENDING', // Will be confirmed after payment
            startTime: startDateTime,
            endTime: endDateTime,
            duration: bookingHours,
            price: bookingPrice,
            platformFee: (commission.totalPlatformRevenue / data.hours) * bookingHours,
            instructorPayout: (commission.instructorPayout / data.hours) * bookingHours,
            commissionRate: commission.commissionRate,
            pickupAddress: scheduledBooking.pickupLocation,
            notes: `From package: ${data.packageType}\n${scheduledBooking.notes}`,
            createdBy: 'client',
            // ✅ NO isPackageBooking flag - this is a real booking
            // ✅ NO parentBookingId - not needed with wallet system
            // Track that this will be paid from wallet
            paymentIntentId: `wallet_${packagePurchaseId}` // Temporary, will be updated by webhook
          } as any
        });

        createdBookings.push(booking.id);
      }
    }

    // NOTE: Emails will be sent by webhook after payment succeeds
    // Webhook will:
    // 1. Update wallet: creditsRemaining += amount, totalPaid += amount
    // 2. Update walletTransaction: status = 'completed'
    // 3. Update transaction: status = 'COMPLETED'
    // 4. Update bookings: status = 'CONFIRMED' (if any)
    // 5. Send welcome email
    // 6. Send package purchase confirmation email
    // 7. Send booking confirmations (if any)

    return NextResponse.json({
      success: true,
      packagePurchaseId,
      walletTransactionId: walletTransaction.id,
      transactionId: transaction.id,
      bookingIds: createdBookings,
      clientId: client.id,
      total: data.pricing.total,
      commission,
      message: data.bookingType === 'later' 
        ? 'Package purchase initiated. Complete payment to add credits to your wallet.'
        : `Package purchase initiated with ${createdBookings.length} scheduled lesson(s). Complete payment to confirm.`
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Bulk booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { bulkBookingRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import { notifyShortNoticeBookingRequest, notifyClientBookingPendingApproval } from '@/lib/services/notifications';
import { calculatePackagePriceDynamic, HOUR_PACKAGES } from '@/lib/config/packages';

const bulkBookingSchema = z.object({
  instructorId: z.string(),
  packageType: z.enum(['CUSTOM', 'PACKAGE_6', 'PACKAGE_10', 'PACKAGE_15']),
  hours: z.coerce.number(),
  includeTestPackage: z.boolean(),
  bookingType: z.enum(['now', 'later']),
  scheduledBookings: z.array(z.object({
    date: z.string(),
    time: z.string(),
    duration: z.number(),
    pickupLocation: z.string(),
    notes: z.string(),
    isShortNotice: z.boolean().optional().default(false),
  })).optional(),
  registrationType: z.enum(['myself', 'someone-else']),
  // Account holder (always required)
  accountHolderName: z.string(),
  accountHolderEmail: z.string().email(),
  accountHolderPhone: z.string(),
  accountHolderPassword: z.string().optional().default(''),
  // Learner (only if someone-else)
  learnerName: z.string().optional(),
  learnerPhone: z.string().optional(),
  learnerRelationship: z.string().optional(),
  pricing: z.object({
    subtotal: z.coerce.number(),
    discount: z.coerce.number(),
    discountPercentage: z.coerce.number(),
    testPackage: z.coerce.number(),
    platformFee: z.coerce.number(),
    total: z.coerce.number(),
    installments: z.coerce.number().optional()
  }).passthrough(),
  customPackageId: z.string().optional(), // instructor's fixed-price lesson package
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Bulk booking body:', JSON.stringify(body, null, 2));
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

    // Check if instructor exists and is active/approved
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
      select: {
        id: true,
        name: true,
        hourlyRate: true,
        userId: true,
        approvalStatus: true,
        status: true,
        isActive: true,
        subscriptionTier: true,
        lessonPackages: true,
      } as any,
    }) as any;

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    if ((instructor as any).approvalStatus && (instructor as any).approvalStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'Instructor is not available for bookings' }, { status: 403 });
    }

    if ((instructor as any).status === 'SUSPENDED' || (instructor as any).isActive === false) {
      return NextResponse.json({ error: 'Instructor is not available for bookings' }, { status: 403 });
    }

    // Create user account or link to existing
    let userId: string | undefined;
    
    const existingUser = await prisma.user.findUnique({
      where: { email: data.accountHolderEmail }
    });

    if (!existingUser) {
      // New user — require a password
      if (!data.accountHolderPassword || data.accountHolderPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      // New user — create account with provided password
      const hashedPassword = await bcrypt.hash(data.accountHolderPassword, 10);
      const newUser = await prisma.user.create({
        data: {
          email: data.accountHolderEmail,
          password: hashedPassword,
          role: 'CLIENT'
        }
      });
      userId = newUser.id;
    } else {
      // Existing user — just link booking to their account, no password change
      userId = existingUser.id;
    }

    // Determine client details based on registration type
    const clientName = data.registrationType === 'myself' 
      ? data.accountHolderName 
      : data.learnerName || data.accountHolderName;
    
    const clientPhone = data.registrationType === 'myself'
      ? data.accountHolderPhone
      : data.learnerPhone || data.accountHolderPhone;

    // Find or create a Client record linked to this instructor
    let clientId: string | undefined;
    const existingClient = await prisma.client.findFirst({
      where: { instructorId: data.instructorId, email: data.accountHolderEmail }
    });
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const newClient = await prisma.client.create({
        data: {
          instructorId: data.instructorId,
          userId: userId,
          name: clientName,
          email: data.accountHolderEmail,
          phone: clientPhone,
        }
      });
      clientId = newClient.id;
    }

    // ── Pricing ──────────────────────────────────────────────────────────────
    // Always calculate server-side — never trust client-submitted pricing.
    // The client sends pricing for display purposes only; we recalculate here.
    let serverPricing: Awaited<ReturnType<typeof calculatePackagePriceDynamic>>;

    if (data.customPackageId) {
      // Instructor's fixed-price lesson package — look up the price from DB
      const pkg = (instructor as any).lessonPackages?.find(
        (p: any) => p.id === data.customPackageId && p.isActive !== false
      );
      if (!pkg) {
        return NextResponse.json({ error: 'Selected package is no longer available' }, { status: 400 });
      }
      // Build pricing using the fixed package price — no platform bulk discount
      const { getPlatformPricing } = await import('@/lib/services/platform-pricing');
      const platformSettings = await getPlatformPricing();
      const afterDiscount = pkg.price; // fixed price, no discount
      const platformFee = (afterDiscount * platformSettings.platformFeePercentage) / 100;
      serverPricing = {
        subtotal: pkg.price,
        discount: 0,
        discountPercentage: 0,
        testPackage: 0,
        platformFee,
        total: afterDiscount + platformFee,
        installments: (afterDiscount + platformFee) / 4,
      };
    } else {
      serverPricing = await calculatePackagePriceDynamic(
        instructor.hourlyRate,
        data.hours,
        data.packageType,
        data.includeTestPackage
      );
    }

    // Validate client-submitted total is within 1 cent of server calculation
    // (floating point tolerance). If it differs, reject — prevents price manipulation.
    const clientTotal = data.pricing.total;
    if (Math.abs(clientTotal - serverPricing.total) > 0.01) {
      console.error('❌ Pricing mismatch:', { clientTotal, serverTotal: serverPricing.total });
      return NextResponse.json({
        error: 'Pricing has changed. Please refresh and try again.',
        serverTotal: serverPricing.total,
      }, { status: 409 });
    }

    // Use server-calculated pricing for all downstream operations
    const verifiedTotal = serverPricing.total;

    const isShortNotice = data.scheduledBookings?.[0]?.isShortNotice ?? false;
    const firstLessonDurationMinutes = data.scheduledBookings?.[0]?.duration ?? 60;
    const firstLessonDurationHours = firstLessonDurationMinutes / 60;
    const firstLessonPrice = parseFloat((instructor.hourlyRate * firstLessonDurationHours).toFixed(2));
    const PLATFORM_FEE_RATE = 0.036;
    const firstLessonPlatformFee = parseFloat((firstLessonPrice * PLATFORM_FEE_RATE).toFixed(2));
    const firstLessonPayout = parseFloat((firstLessonPrice - firstLessonPlatformFee).toFixed(2));

    // Choose date/time from first scheduled slot or default to tomorrow 9am
    let startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(9, 0, 0, 0);

    if (data.scheduledBookings && data.scheduledBookings.length > 0) {
      const slot = data.scheduledBookings[0];
      const [h, m] = slot.time.split(':').map(Number);
      startTime = new Date(slot.date);
      startTime.setHours(h, m, 0, 0);
    }

    const endTime = new Date(startTime.getTime() + firstLessonDurationMinutes * 60 * 1000);

    // ── Atomic slot claim ─────────────────────────────────────────────────────
    // On MongoDB we can't use SELECT FOR UPDATE, so we do the conflict check
    // AND the booking create inside a single transaction. If two requests race,
    // one will see the other's PENDING_PAYMENT row and throw SLOT_TAKEN.
    let booking: any;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // Re-check for conflicts inside the transaction
        const conflict = await tx.booking.findFirst({
          where: {
            instructorId: data.instructorId,
            status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } },
            ],
          },
        });
        if (conflict) throw new Error('SLOT_TAKEN');

        return tx.booking.create({
          data: {
            instructorId: data.instructorId,
            clientId: clientId,
            clientName,
            clientPhone,
            // Short-notice: PENDING (awaiting instructor approval before payment)
            // Normal: PENDING_PAYMENT (slot held while Stripe payment completes)
            status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
            startTime,
            endTime,
            duration: firstLessonDurationHours,
            price: firstLessonPrice,
            platformFee: firstLessonPlatformFee,
            instructorPayout: firstLessonPayout,
            pickupAddress: data.scheduledBookings?.[0]?.pickupLocation || null,
            notes: data.scheduledBookings?.[0]?.notes || null,
            isPackageBooking: data.hours > 1,
            packageHours: data.hours,
            packageHoursRemaining: data.hours - firstLessonDurationHours,
            packageTotalPaid: verifiedTotal,
            lockedHourlyRate: instructor.hourlyRate,
            lockedDiscountPct: serverPricing.discountPercentage,
          } as any,
        });
      });
    } catch (err: any) {
      if (err.message === 'SLOT_TAKEN') {
        return NextResponse.json({ error: 'This time slot is no longer available. Please choose another.' }, { status: 409 });
      }
      throw err;
    }

    console.log('Booking created with id', booking.id, '| first lesson price:', firstLessonPrice, '| package total (server-verified):', verifiedTotal, '| shortNotice:', isShortNotice);

    // For short-notice bookings: notify instructor urgently, notify client of pending status
    if (isShortNotice) {
      try {
        const instructorUser = instructor.userId
          ? await prisma.user.findUnique({ where: { id: instructor.userId }, select: { id: true } })
          : null;
        if (instructorUser) {
          await notifyShortNoticeBookingRequest(instructorUser.id, clientName, booking.id, startTime);
        }
        // Notify client their request is pending
        if (userId) {
          await notifyClientBookingPendingApproval(userId, instructor.name, booking.id, startTime);
        }
      } catch (notifErr) {
        console.error('Short-notice notification failed:', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      isShortNotice,
      // For short-notice: no payment yet — instructor must approve first
      // For normal: charge the full package amount via Stripe
      total: isShortNotice ? 0 : verifiedTotal,
      status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Bulk booking Zod error:', JSON.stringify(error.issues, null, 2));
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }
    console.error('Bulk booking error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

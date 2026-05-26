// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { bulkBookingRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import { notifyShortNoticeBookingRequest, notifyClientBookingPendingApproval, notifyBookingRequest, notifyClientBookingConfirmed } from '@/lib/services/notifications';
import { calculatePackagePriceDynamic, HOUR_PACKAGES } from '@/lib/config/packages';

const bulkBookingSchema = z.object({
  // Either instructorId or instructorQuery must be provided.
  // instructorId: resolved ID from search/recommendations (preferred)
  // instructorQuery: name or phone — backend resolves to ID (AI fallback)
  instructorId: z.string().optional(),
  instructorQuery: z.string().optional(),
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
  // Password is optional — backend auto-generates if not provided (AI voice flow)
  accountHolderPassword: z.string().optional().default(''),
  // Learner (only if someone-else)
  learnerName: z.string().optional(),
  learnerPhone: z.string().optional(),
  learnerRelationship: z.string().optional(),
  // Pricing is optional — if provided, server validates it; if omitted, server calculates only
  pricing: z.object({
    subtotal: z.coerce.number(),
    discount: z.coerce.number(),
    discountPercentage: z.coerce.number(),
    testPackage: z.coerce.number(),
    platformFee: z.coerce.number(),
    total: z.coerce.number(),
    installments: z.coerce.number().optional()
  }).passthrough().optional(),
  customPackageId: z.string().optional(), // instructor's fixed-price lesson package
}).refine(d => d.instructorId || d.instructorQuery, {
  message: 'Either instructorId or instructorQuery must be provided',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Bulk booking body:', JSON.stringify(body, null, 2));
    const data = bulkBookingSchema.parse(body);

    // Rate limiting: limit bulk bookings per client/email/IP
    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
    const identifier = getRateLimitIdentifier(undefined, ip, `bulk-booking:${data.accountHolderEmail}:${data.instructorId || data.instructorQuery}`);
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

    // ── Resolve instructorId from instructorQuery if needed ───────────────────
    // AI callers may send instructorQuery (name or phone) instead of instructorId.
    // We resolve it here so the rest of the handler always works with a concrete ID.
    let resolvedInstructorId = data.instructorId;

    if (!resolvedInstructorId && data.instructorQuery) {
      const query = data.instructorQuery.trim();
      // Try phone lookup first (digits only pattern)
      const isPhone = /^[\d\s\+\-\(\)]{7,}$/.test(query);
      if (isPhone) {
        const normalizedPhone = query.replace(/[\s\-\(\)]/g, '');
        const byPhone = await prisma.instructor.findFirst({
          where: { phone: normalizedPhone, isActive: true, approvalStatus: 'APPROVED' },
          select: { id: true },
        });
        resolvedInstructorId = byPhone?.id;
      }
      // Fall back to name search (case-insensitive contains)
      if (!resolvedInstructorId) {
        const byName = await prisma.instructor.findFirst({
          where: {
            name: { contains: query, mode: 'insensitive' },
            isActive: true,
            approvalStatus: 'APPROVED',
          },
          select: { id: true },
        });
        resolvedInstructorId = byName?.id;
      }
      if (!resolvedInstructorId) {
        return NextResponse.json(
          { error: `No active instructor found matching "${query}". Please search by location first.` },
          { status: 404 }
        );
      }
    }

    if (!resolvedInstructorId) {
      return NextResponse.json(
        { error: 'instructorId or instructorQuery is required' },
        { status: 400 }
      );
    }

    // Check if instructor exists and is active/approved
    const instructor = await prisma.instructor.findUnique({
      where: { id: resolvedInstructorId },
      select: {
        id: true,
        name: true,
        hourlyRate: true,
        userId: true,
        approvalStatus: true,
        isActive: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        lessonPackages: true,
      },
    }) as any;

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    if ((instructor as any).approvalStatus && (instructor as any).approvalStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'Instructor is not available for bookings' }, { status: 403 });
    }

    if ((instructor as any).approvalStatus === 'SUSPENDED' || (instructor as any).isActive === false) {
      return NextResponse.json({ error: 'Instructor is not available for bookings' }, { status: 403 });
    }

    // ── Subscription gate ─────────────────────────────────────────────────────
    // Inactive instructors cannot accept new bookings from the public.
    const subStatus = (instructor as any).subscriptionStatus as string | undefined;
    const trialEndsAt = (instructor as any).trialEndsAt ? new Date((instructor as any).trialEndsAt) : null;
    const trialExpired = trialEndsAt && trialEndsAt < new Date();
    const isAcceptingBookings =
      subStatus === 'ACTIVE' ||
      (subStatus === 'TRIAL' && !trialExpired);

    if (!isAcceptingBookings) {
      return NextResponse.json({
        error: 'This instructor is not currently accepting bookings.',
        code: 'INSTRUCTOR_INACTIVE',
      }, { status: 403 });
    }

    // Create user account or link to existing
    let userId: string | undefined;
    
    const existingUser = await prisma.user.findUnique({
      where: { email: data.accountHolderEmail }
    });

    if (!existingUser) {
      // New user — use provided password or auto-generate one
      // AI voice flow does not send a password — backend generates and sends via SMS/email
      let password = data.accountHolderPassword;
      if (!password || password.length < 6) {
        // Auto-generate a secure 10-char password
        password = Math.random().toString(36).slice(2, 7).toUpperCase() +
                   Math.random().toString(36).slice(2, 7) +
                   Math.floor(Math.random() * 90 + 10);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          email: data.accountHolderEmail,
          password: hashedPassword,
          role: 'CLIENT'
        }
      });
      userId = newUser.id;
      // TODO: Send auto-generated password to user via SMS/email
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
      where: { instructorId: resolvedInstructorId, email: data.accountHolderEmail }
    });
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const newClient = await prisma.client.create({
        data: {
          instructorId: resolvedInstructorId,
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
      // Instructor's fixed-price add-on — look up the price from DB
      const pkg = (instructor as any).lessonPackages?.find(
        (p: any) => p.id === data.customPackageId && p.isActive !== false
      );
      if (!pkg) {
        return NextResponse.json({ error: 'Selected package is no longer available' }, { status: 400 });
      }
      const { getPlatformPricing } = await import('@/lib/services/platform-pricing');
      const platformSettings = await getPlatformPricing();

      // Calculate standard package discount using the same source as the client (/api/public/pricing)
      const discountMap: Record<string, number> = {
        PACKAGE_6: platformSettings.package6Discount,
        PACKAGE_10: platformSettings.package10Discount,
        PACKAGE_15: platformSettings.package15Discount,
        CUSTOM: 0,
      };
      const discountPct = discountMap[data.packageType] ?? 0;
      const standardSubtotal = data.hours > 0 ? instructor.hourlyRate * data.hours : 0;
      const standardDiscount = (standardSubtotal * discountPct) / 100;
      const standardAfterDiscount = standardSubtotal - standardDiscount;

      const addonPrice = pkg.price; // fixed, no discount
      const combinedBeforeFee = standardAfterDiscount + addonPrice;
      const platformFee = (combinedBeforeFee * platformSettings.platformFeePercentage) / 100;
      serverPricing = {
        subtotal: standardSubtotal + addonPrice,
        discount: standardDiscount,
        discountPercentage: discountPct,
        testPackage: 0,
        platformFee,
        total: combinedBeforeFee + platformFee,
        installments: (combinedBeforeFee + platformFee) / 4,
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
    // If no pricing was submitted (AI voice flow), skip validation — use server total only.
    if (data.pricing) {
      const clientTotal = data.pricing.total;
      if (Math.abs(clientTotal - serverPricing.total) > 0.01) {
        console.error('❌ Pricing mismatch:', { clientTotal, serverTotal: serverPricing.total });
        return NextResponse.json({
          error: 'Pricing has changed. Please refresh and try again.',
          serverTotal: serverPricing.total,
        }, { status: 409 });
      }
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

    // For "book later" with no scheduled slots: no specific time is being claimed.
    // ── Book Later: wallet-only, no booking created ───────────────────────────
    // Student pays → wallet credited → books individual lessons from dashboard
    if (data.bookingType === 'later') {
      // Get or create wallet for this user
      let wallet = await prisma.clientWallet.upsert({
        where: { userId: userId! },
        update: {},
        create: { userId: userId! },
      });

      const walletTransaction = await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: verifiedTotal,
          type: 'CREDIT',
          description: `Package purchase: ${data.hours} hrs with ${instructor.name}`,
          status: 'PENDING',
        },
      });

      return NextResponse.json({
        success: true,
        transactionId: walletTransaction.id,
        total: verifiedTotal,
        bookingType: 'later',
      }, { status: 201 });
    }
    // ── Book Now: create booking + slot claim ─────────────────────────────────
    const hasScheduledSlot = data.scheduledBookings && data.scheduledBookings.length > 0;

    let startTime: Date | null = null;
    let endTime: Date | null = null;

    if (hasScheduledSlot) {
      const slot = data.scheduledBookings![0];
      const [h, m] = slot.time.split(':').map(Number);
      startTime = new Date(slot.date);
      startTime.setHours(h, m, 0, 0);
      endTime = new Date(startTime.getTime() + firstLessonDurationMinutes * 60 * 1000);
    }

    let booking: any;
    try {
      booking = await prisma.$transaction(async (tx) => {
        if (startTime && endTime) {
          const conflict = await tx.booking.findFirst({
            where: {
              instructorId: resolvedInstructorId,
              status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
              OR: [
                { startTime: { lte: startTime }, endTime: { gt: startTime } },
                { startTime: { lt: endTime }, endTime: { gte: endTime } },
                { startTime: { gte: startTime }, endTime: { lte: endTime } },
              ],
            },
          });
          if (conflict) throw new Error('SLOT_TAKEN');
        }

        return tx.booking.create({
          data: {
            instructorId: resolvedInstructorId,
            clientId: clientId,
            clientName,
            clientPhone,
            status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
            startTime: startTime ?? undefined,
            endTime: endTime ?? undefined,
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

    if (isShortNotice) {
      try {
        const instructorUser = instructor.userId
          ? await prisma.user.findUnique({ where: { id: instructor.userId }, select: { id: true } })
          : null;
        if (instructorUser) {
          await notifyShortNoticeBookingRequest(instructorUser.id, clientName, booking.id, startTime ?? new Date());
        }
        if (userId) {
          await notifyClientBookingPendingApproval(userId, instructor.name, booking.id, startTime ?? new Date());
        }
      } catch (notifErr) {
        console.error('Short-notice notification failed:', notifErr);
      }
    } else {
      // Normal booking — notify instructor a new booking was made
      try {
        const instructorUser = instructor.userId
          ? await prisma.user.findUnique({ where: { id: instructor.userId }, select: { id: true } })
          : null;
        if (instructorUser) {
          await notifyBookingRequest(instructorUser.id, clientName, booking.id, startTime ?? new Date());
        }
        if (userId) {
          await notifyClientBookingConfirmed(userId, instructor.name, booking.id, startTime ?? new Date());
        }
      } catch (notifErr) {
        console.error('Booking notification failed:', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      isShortNotice,
      total: isShortNotice ? 0 : verifiedTotal,
      status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
      // Generate Stripe Checkout URL for AI voice flow (no pricing submitted = AI caller)
      // Web flow uses /api/payments/create-intent + Stripe Elements instead
      ...((!data.pricing && !isShortNotice) && {
        checkoutUrl: `${process.env.NEXTAUTH_URL}/booking/${booking.id}/payment`,
      }),
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

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
  accountHolderPassword: z.string().optional(), // Optional - will be generated if not provided
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
      where: { id: data.instructorId }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // ✅ SMART HYBRID APPROACH: Check if user exists and their activity level
    let userId: string;
    let client: any;
    
    const existingUser = await prisma.user.findUnique({
      where: { email: data.accountHolderEmail },
      include: {
        wallet: {
          include: {
            transactions: {
              where: { status: 'CONFIRMED' }
            }
          }
        },
        clients: {
          include: {
            bookings: true
          }
        }
      }
    });

    if (existingUser) {
      // Check if user has any real activity
      const hasBookings = existingUser.clients.some(c => c.bookings.length > 0);
      const hasCredits = existingUser.wallet?.transactions.some(t => t.status === 'CONFIRMED');
      const hasActivity = hasBookings || hasCredits;
      
      // ✅ SECURITY: Only block if email is verified AND user has activity
      if (existingUser.emailVerified && hasActivity) {
        // User has verified email + activity - they should login to see existing data
        return NextResponse.json({ 
          error: 'Account exists with bookings',
          message: 'You already have an account with bookings or credits.',
          code: 'ACCOUNT_HAS_ACTIVITY',
          actions: [
            {
              label: 'Login to your account',
              url: '/login',
              primary: true
            },
            {
              label: 'Forgot password?',
              url: '/auth/forgot-password',
              primary: false
            }
          ],
          help: 'Please login to see your existing bookings and credits.'
        }, { status: 409 });
      }
      
      // ✅ ALLOW BOOKING if:
      // - Email not verified (might be someone else's typo)
      // - OR no activity (abandoned registration)
      userId = existingUser.id;
      
      // ✅ REFINEMENT #1: Find or create client for this instructor
      // Note: One user can have multiple clients (one per instructor)
      client = await prisma.client.findFirst({
        where: {
          userId: existingUser.id,
          instructorId: data.instructorId
        }
      });
      
      // Create client record if doesn't exist
      if (!client) {
        const clientName = data.registrationType === 'myself' 
          ? data.accountHolderName 
          : data.learnerName || data.accountHolderName;
        
        const clientPhone = data.registrationType === 'myself'
          ? data.accountHolderPhone
          : data.learnerPhone || data.accountHolderPhone;
        
        client = await prisma.client.create({
          data: {
            userId: existingUser.id,
            instructorId: data.instructorId,
            name: clientName,
            email: data.accountHolderEmail,
            phone: clientPhone
          }
        });
        
        console.log(`✅ Created new client for existing user: ${existingUser.email} → instructor ${data.instructorId}`);
      } else {
        console.log(`✅ Using existing client: ${client.id} for user ${existingUser.email}`);
      }
      
      console.log(`✅ Existing user (${existingUser.emailVerified ? 'verified' : 'unverified'}, ${hasActivity ? 'has activity' : 'no activity'}) booking: ${existingUser.email}`);
    } else {
      // Create new user account
      const password = data.accountHolderPassword || 
        Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate verification token
      const verificationToken = Math.random().toString(36).substring(2, 15) + 
        Math.random().toString(36).substring(2, 15);
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const newUser = await prisma.user.create({
        data: {
          email: data.accountHolderEmail,
          password: hashedPassword,
          role: 'CLIENT',
          emailVerified: false, // ✅ Not verified yet
          verificationToken,
          verificationTokenExpiry
        }
      });
      userId = newUser.id;

      // Determine client details based on registration type
      const clientName = data.registrationType === 'myself' 
        ? data.accountHolderName 
        : data.learnerName || data.accountHolderName;
      
      const clientPhone = data.registrationType === 'myself'
        ? data.accountHolderPhone
        : data.learnerPhone || data.accountHolderPhone;

      // Create Client record to link user to instructor
      client = await prisma.client.create({
        data: {
          userId: newUser.id,
          instructorId: data.instructorId,
          name: clientName,
          email: data.accountHolderEmail,
          phone: clientPhone
        }
      });
      
      // TODO: Send verification email
      // await emailService.sendVerificationEmail({
      //   to: data.accountHolderEmail,
      //   token: verificationToken,
      //   name: clientName
      // });
      
      console.log(`✅ New user created (unverified): ${newUser.email}`);
    }

    // Create or get wallet for the user
    let wallet = await prisma.clientWallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      wallet = await prisma.clientWallet.create({
        data: {
          userId
        }
      });
    }

    // IMPORTANT: Distinguish between package purchase and booking
    if (data.bookingType === 'later') {
      // PACKAGE PURCHASE ONLY - No booking created yet
      // User will schedule bookings later from their dashboard
      
      // Create wallet transaction for package purchase (PENDING until payment confirmed)
      const walletTransaction = await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: data.pricing.total,
          type: 'CREDIT',
          description: `Package: ${data.packageType} - ${data.hours} hours @ ${(data.pricing.total / data.hours).toFixed(2)}/hr`,
          status: 'PENDING' // Will be updated to CONFIRMED by webhook
        }
      });

      console.log('Package purchase created:', walletTransaction.id);
      return NextResponse.json({
        success: true,
        transactionId: walletTransaction.id,
        packageType: data.packageType,
        hours: data.hours,
        status: 'PENDING_PAYMENT',
        total: data.pricing.total,
        message: 'Package purchase created. Complete payment to add credits to your wallet.'
      }, { status: 201 });
      
    } else {
      // BOOKING NOW - Create booking records for scheduled lessons
      // Payment covers: Package purchase + Immediate bookings
      // Example: Buy 10hrs ($700) - Book 2hrs ($140) = $560 remaining
      
      if (!data.scheduledBookings || data.scheduledBookings.length === 0) {
        return NextResponse.json({ 
          error: 'Scheduled bookings required when bookingType is "now"' 
        }, { status: 400 });
      }

      // Calculate total hours being booked immediately
      const totalBookedMinutes = data.scheduledBookings.reduce((sum, slot) => sum + slot.duration, 0);
      const totalBookedHours = totalBookedMinutes / 60;
      const bookingCost = totalBookedHours * instructor.hourlyRate;
      const remainingHours = data.hours - totalBookedHours;
      const remainingAmount = remainingHours * instructor.hourlyRate;

      // ✅ P0 FIX #1: Wrap everything in transaction for atomicity and slot locking
      const result = await prisma.$transaction(async (tx) => {
        // ✅ P0 FIX #1: Check for slot conflicts INSIDE transaction (atomic)
        for (const slot of data.scheduledBookings!) {
          const startTime = new Date(`${slot.date}T${slot.time}`);
          const endTime = new Date(startTime.getTime() + (slot.duration * 60 * 1000));
          
          // Check if slot is already booked
          const conflict = await tx.booking.findFirst({
            where: {
              instructorId: data.instructorId,
              status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'PENDING'] },
              OR: [
                { AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }] },
                { AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
                { AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }] }
              ]
            }
          });
          
          if (conflict) {
            throw new Error(
              `Time slot ${slot.date} ${slot.time} is no longer available. Please choose a different time.`
            );
          }
        }
        
        // Create bookings for each scheduled slot
        const bookings = [];
        for (const slot of data.scheduledBookings!) {
          const startTime = new Date(`${slot.date}T${slot.time}`);
          const endTime = new Date(startTime.getTime() + (slot.duration * 60 * 1000));
          const slotHours = slot.duration / 60;
          const slotPrice = slotHours * instructor.hourlyRate;
          const slotPlatformFee = slotPrice * 0.036;
          
          const booking = await tx.booking.create({
            data: {
              instructorId: data.instructorId,
              clientId: client.id, // ✅ Links to user account
              // ✅ REFINEMENT #4: Store form data as snapshot (don't update client profile)
              clientName,          // From current form submission
              clientEmail: data.accountHolderEmail, // From current form
              clientPhone,         // From current form
              startTime,
              endTime,
              duration: slotHours,
              price: slotPrice,
              platformFee: slotPlatformFee,
              instructorPayout: slotPrice - slotPlatformFee,
              commissionRate: 12.0,
              status: 'PENDING_PAYMENT', // Will be CONFIRMED after payment
              pickupAddress: slot.pickupLocation,
              notes: slot.notes,
              bookingType: data.packageType,
              isPackageBooking: true,
              isGuestCheckout: true, // ✅ REFINEMENT #3: Mark as guest checkout
              packageHours: data.hours,
              packageHoursRemaining: remainingHours
            }
          });
          bookings.push(booking);
        }

        // Create TWO wallet transactions:
        // 1. CREDIT: Package purchase (full amount)
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: data.pricing.total,
            type: 'CREDIT',
            description: `Package: ${data.packageType} - ${data.hours} hours @ ${(data.pricing.total / data.hours).toFixed(2)}/hr`,
            status: 'PENDING' // Will be CONFIRMED by webhook
          }
        });

        // 2. DEBIT: Immediate booking charge
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: bookingCost,
            type: 'DEBIT',
            description: `Booked: ${totalBookedHours} hours (${bookings.length} ${bookings.length === 1 ? 'lesson' : 'lessons'}) - ${remainingHours} hours remaining`,
            status: 'PENDING' // Will be CONFIRMED by webhook
          }
        });
        
        return { bookings };
      });

      console.log(`✅ P0 FIX #1: Package + Bookings created atomically: ${data.hours}hrs (${data.pricing.total}) - ${totalBookedHours}hrs booked (${bookingCost}) = ${remainingHours}hrs remaining (${remainingAmount})`);
      
      // ✅ Detect "verified but no activity" case
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isVerifiedButNoActivity = user?.emailVerified && !hasBookings && !hasCredits;
      
      // ✅ REFINEMENT #2: Security flag for unauthenticated bookings
      const isGuestCheckout = true; // This endpoint is always guest (no session)
      
      return NextResponse.json({
        success: true,
        bookingIds: result.bookings.map(b => b.id),
        packageType: data.packageType,
        packageHours: data.hours,
        bookedHours: totalBookedHours,
        remainingHours: remainingHours,
        remainingAmount: remainingAmount,
        status: 'PENDING_PAYMENT',
        total: data.pricing.total,
        message: `Package purchased (${data.hours}hrs). ${result.bookings.length} lessons scheduled (${totalBookedHours}hrs). ${remainingHours}hrs remaining in wallet.`,
        // ✅ Security: Don't expose full client history for guest checkouts
        isGuestCheckout,
        // ✅ Hint for frontend to show password reset option
        userHint: isVerifiedButNoActivity ? {
          type: 'VERIFIED_NO_ACTIVITY',
          message: 'Since you\'ve verified this email before, you can reset your password to access your booking history.',
          action: {
            label: 'Reset Password',
            url: '/auth/forgot-password'
          }
        } : undefined
      }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Bulk booking error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { bulkBookingRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import { notifyShortNoticeBookingRequest, notifyClientBookingPendingApproval, notifyBookingRequest, notifyClientBookingConfirmed } from '@/lib/services/notifications';
import { getDisplayName } from '@/lib/utils/account';
import { calculatePackagePriceDynamic } from '@/lib/config/packages';
import crypto from 'crypto';
import { invalidateAvailabilityCache } from '@/lib/services/availability';
import { resolveTimezone, timezoneFromState } from '@/lib/utils/timezone';

// P0-2 FIX: Define constant here (was missing — caused key.length > undefined to always be false)
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

const bulkBookingSchema = z.object({
  // Either instructorId or instructorQuery must be provided.
  // instructorId: resolved ID from search/recommendations (preferred)
  // instructorQuery: name or phone — backend resolves to ID (AI fallback)
  instructorId: z.string().optional(),
  instructorQuery: z.string().optional(),
  packageType: z.enum(['CUSTOM', 'PACKAGE_6', 'PACKAGE_10', 'PACKAGE_15']),
  hours: z.coerce.number(),
  includeTestPackage: z.boolean().default(false),
  bookingType: z.enum(['now', 'later']),
  scheduledBookings: z.array(z.object({
    date: z.string(),
    time: z.string(),
    duration: z.number(),
    // pickupLocation accepts any spoken or typed address.
    // pickupValidated: false means geocoding failed or was skipped — instructor confirms later.
    // An empty string is also accepted (Buy Later flow has no pickup address).
    pickupLocation: z.string().default(''),
    // Optional flag from voice AI — set to false when validateLocation() failed.
    // Stored on the booking so the instructor dashboard can flag it for manual follow-up.
    pickupValidated: z.boolean().optional().default(true),
    notes: z.string().default(''),
    // isShortNotice is computed server-side from startTime vs now — ignored if sent by caller
    isShortNotice: z.boolean().optional(),
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
}).refine(d => d.instructorId || d.instructorQuery, {
  message: 'Either instructorId or instructorQuery must be provided',
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // Sanitize spoken email format from voice AI
    // Handles: "john 1 2 3 at gmail dot com" → "john123@gmail.com"
    //          "john on 23 at g mail dot com" → best effort normalisation
    if (rawBody.accountHolderEmail && typeof rawBody.accountHolderEmail === 'string') {
      let e = rawBody.accountHolderEmail.trim().toLowerCase();
      if (!e.includes('@')) {
        // Step 1: replace spoken "at" with @
        e = e.replace(/\s+at\s+/gi, '@');
        // Step 2: replace spoken "dot" with .
        e = e.replace(/\s+dot\s+/gi, '.');
        // Step 3: remove all remaining spaces (handles digit spacing and stray words)
        e = e.replace(/\s+/g, '');
        // Step 4: clean up common STT artifacts (e.g. "gmail" split as "g mail")
        e = e.replace(/\bgmail\b/gi, 'gmail')
             .replace(/\byahoo\b/gi, 'yahoo')
             .replace(/\boutlook\b/gi, 'outlook')
             .replace(/\bhotmail\b/gi, 'hotmail');
        rawBody.accountHolderEmail = e;
      }
    }

    // Normalize phone: remove spaces (e.g. "0 4 7 0 2 7 5 3 0 5" → "0470275305")
    if (rawBody.accountHolderPhone && typeof rawBody.accountHolderPhone === 'string') {
      rawBody.accountHolderPhone = rawBody.accountHolderPhone.replace(/\s+/g, '');
    }
    if (rawBody.learnerPhone && typeof rawBody.learnerPhone === 'string') {
      rawBody.learnerPhone = rawBody.learnerPhone.replace(/\s+/g, '');
    }

    const body = rawBody;
    const data = bulkBookingSchema.parse(body);
    // P2-1 FIX: Do not log full request body — it contains PII (name, email, phone)
    logger.info('Bulk booking request:', { packageType: data.packageType, hours: data.hours, instructorId: data.instructorId ?? data.instructorQuery, bookingType: data.bookingType });

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
    //  Idempotency-Key deduplication
    // Twilio retries, AI retries, browser double-clicks reuse the same key.
    // On match, replay stored response without creating a duplicate booking.
    const idempotencyKey = req.headers.get('Idempotency-Key')?.trim() ?? null;
    if (idempotencyKey) {
      if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        return NextResponse.json({ error: 'Idempotency-Key too long' }, { status: 400 });
      }
      const existing = await (prisma as any).bookingIdempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });
      if (existing) {
        if (existing.email !== data.accountHolderEmail) {
          return NextResponse.json({ error: 'Idempotency-Key does not match account' }, { status: 409 });
        }
        return NextResponse.json(existing.response, { status: 201 });
      }
    }

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
        businessName: true,
        accountType: true,
        paymentMode: true,
        hourlyRate: true,
        userId: true,
        approvalStatus: true,
        isActive: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        acceptingBookings: true,
        testPackagePrice: true,
        timezone: true,
        state: true,
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

    // FIX #14: Instructor self-service pause check.
    // acceptingBookings defaults to true — false means the instructor has paused new bookings.
    if ((instructor as any).acceptingBookings === false) {
      return NextResponse.json({
        error: 'This instructor is not currently accepting new bookings.',
        code: 'INSTRUCTOR_PAUSED',
      }, { status: 403 });
    }

    // ── Payment mode guard (phase 2 safety net) ───────────────────────────────
    // DIRECT payment mode (school pays directly to their own Stripe) is not yet implemented.
    // This guard prevents any account accidentally set to DIRECT from breaking the payment flow.
    // Remove this block in phase 2 when Direct Charges are implemented.
    if ((instructor as any).paymentMode === 'DIRECT') {
      console.error(`[bulk-booking] instructor ${instructor.id} has paymentMode=DIRECT which is not yet implemented`);
      return NextResponse.json({
        error: 'Direct payment mode is not yet available. Please contact support.',
        code: 'PAYMENT_MODE_NOT_IMPLEMENTED',
      }, { status: 503 });
    }

    // Create user account or link to existing
    // ── Account Creation (Fixed: Prevents Duplicates) ──────────────────────────────────────
    // ISSUE: Two simultaneous requests with same email could create duplicate accounts
    // FIX: Use upsert with findUnique to prevent race condition
    // Strategy: Try to find existing user first, then create with unique constraint fallback
    
    let userId: string;
    
    try {
      // First, query to check if user exists
      let existingUser = await prisma.user.findUnique({
        where: { email: data.accountHolderEmail }
      });

      if (!existingUser) {
        // New user — use provided password or auto-generate one
        // AI voice flow does not send a password — backend generates and sends via SMS/email
        let password = data.accountHolderPassword;
        if (!password || password.length < 6) {
          // P0-3 FIX: Use cryptographically secure random bytes instead of Math.random()
          password = randomBytes(12).toString('base64url');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // P3-1 FIX (ACCOUNT DUPLICATES): Use findUnique + error handling to prevent duplicates
        // If another request creates user between findUnique and create, we catch unique violation
        try {
          const newUser = await prisma.user.create({
            data: {
              email: data.accountHolderEmail,
              password: hashedPassword,
              role: 'CLIENT'
            }
          });
          userId = newUser.id;
          
          // TASK 3 FIX: Magic link password delivery
          // Instead of sending auto-generated password, send setup link where user sets their own password.
          // Benefits:
          //   - User controls password (feels secure)
          //   - Works even if SMS fails (only link delivery matters)
          //   - Clear feedback (user sees "Check email for setup link")
          //   - Link expires in 24 hours (security)
          const isAutoGenerated = !data.accountHolderPassword || data.accountHolderPassword.length < 6;
          if (isAutoGenerated) {
            // Generate setup token (24-hour expiry)
            const resetToken = crypto.randomUUID();
            const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            // Store reset token in user record
            await prisma.user.update({
              where: { id: newUser.id },
              data: { resetToken, resetTokenExpiry }
            });
            
            const setupLink = `${process.env.NEXTAUTH_URL}/set-password?token=${resetToken}`;
            
            // Send setup link via BOTH email and SMS — voice bookings may have wrong email,
            // so SMS to the confirmed phone number is the reliable delivery channel.
            // Student can correct their email after logging in via the SMS link.
            let emailDeliverySuccess = false;
            
            // Send setup link via email (may fail if email was misheard)
            try {
              const { emailService } = await import('@/lib/services/email');
              await emailService.sendGenericEmail({
                from: 'DriveBook Team <hello@drivebook.com.au>',
                to: data.accountHolderEmail,
                subject: '🔐 Set up your DriveBook account',
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                      .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
                      .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; }
                      .button:hover { background-color: #1d4ed8; }
                      .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
                      .expiry-notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1 style="margin: 0;">🔐 Welcome to DriveBook</h1>
                      </div>
                      <div class="content">
                        <p>Hi ${data.accountHolderName},</p>
                        <p>Your DriveBook account has been created! To get started, set your password by clicking the button below:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="${setupLink}" class="button">Set Your Password</a>
                        </div>

                        <div class="info-box">
                          <p style="margin: 0;"><strong>🔒 What happens next:</strong></p>
                          <ol style="margin: 10px 0; padding-left: 20px;">
                            <li>Click the button above or copy the link below</li>
                            <li>Create a password (your choice, not auto-generated)</li>
                            <li>Log in to your account</li>
                            <li>Proceed with your lesson booking</li>
                          </ol>
                        </div>

                        <div class="expiry-notice">
                          <strong>⏰ Link expires in 24 hours</strong><br/>
                          If this link expires, you can request a new one from the login page or contact your instructor.
                        </div>

                        <p style="color: #6b7280; font-size: 14px; word-break: break-all;">
                          Or copy this link: <br/><code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${setupLink}</code>
                        </p>
                        
                        <div class="footer">
                          <p>DriveBook - Your Driving Instructor Platform</p>
                          <p style="font-size: 12px; color: #9ca3af;">
                            Account: ${data.accountHolderEmail}
                          </p>
                        </div>
                      </div>
                    </div>
                  </body>
                  </html>
                `,
              });
              emailDeliverySuccess = true;
            } catch (emailErr) {
              logger.error('Failed to send password setup email', {
                error: emailErr instanceof Error ? emailErr.message : String(emailErr),
              });
            }
            
            // Optional: Send SMS with link (if SMS service available)
            // SMS is the reliable delivery channel for voice bookings — phone number confirmed on call
            let smsDeliverySuccess = true;
            try {
              const { smsService } = await import('@/lib/services/sms');
              await smsService.sendSMS({
                to: data.accountHolderPhone,
                message: `DriveBook: Set up your account & complete payment here: ${setupLink}\n\nIf your email was incorrect, you can update it after logging in.`,
              });
            } catch (smsErr) {
              logger.info('SMS setup link delivery failed', {
                error: smsErr instanceof Error ? smsErr.message : String(smsErr),
              });
              smsDeliverySuccess = false;
            }
            
            // FIX: If both email AND SMS failed, send fallback reset link
            if (!emailDeliverySuccess && !smsDeliverySuccess) {
              try {
                logger.warn('Both email and SMS delivery failed. Sending fallback reset password link.');
                
                // Generate reset token for fallback
                const resetToken = crypto.randomUUID();
                const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
                
                await prisma.user.update({
                  where: { id: newUser.id },
                  data: { resetToken, resetTokenExpiry }
                });
                
                const resetLink = `${process.env.NEXTAUTH_URL}/set-password?token=${resetToken}`;
                
                // Send fallback email with reset link
                const { emailService } = await import('@/lib/services/email');
                await emailService.sendGenericEmail({
                  from: 'DriveBook Account Verification <verification@drivebook.com.au>',
                  to: data.accountHolderEmail,
                  subject: '🔐 DriveBook Password Reset (Fallback Link)',
                  html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
                        .content { background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; }
                        .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
                        .button:hover { background-color: #1d4ed8; }
                        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <div class="header">
                          <h1 style="margin: 0;">⚠️ Backup Password Reset</h1>
                        </div>
                        <div class="content">
                          <p>Hi ${data.accountHolderName},</p>
                          <p>We couldn't deliver your initial setup link, but we're sending this backup link instead.</p>
                          <p><strong>Click the button below to set your password:</strong></p>
                          <div style="text-align: center;">
                            <a href="${resetLink}" class="button">Reset Your Password</a>
                          </div>
                          <p style="color: #6b7280; font-size: 14px;">
                            Or copy this link: <br/><code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${resetLink}</code>
                          </p>
                          <p style="color: #dc2626;">
                            ⏰ <strong>This link expires in 24 hours</strong>
                          </p>
                        </div>
                        <div class="footer">
                          <p>DriveBook - Your Driving Instructor Platform</p>
                          <p>Account: ${data.accountHolderEmail}</p>
                        </div>
                      </div>
                    </body>
                    </html>
                  `,
                });
                logger.info('Fallback reset password email sent successfully.');
              } catch (fallbackErr) {
                logger.error('Failed to send fallback reset password email', {
                  error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
                });
              }
            }
          }
        } catch (createErr: any) {
          // If unique constraint violation on email (another request created between find & create)
          if (createErr.code === 'P2002' && createErr.meta?.target?.includes('email')) {
            logger.info('Race condition detected: User created between find and create. Using existing account.');
            // Fetch the user that was just created by the other request
            existingUser = await prisma.user.findUnique({
              where: { email: data.accountHolderEmail }
            });
            if (!existingUser) {
              // Should not happen, but safety net
              throw new Error('User not found after unique constraint error');
            }
            userId = existingUser.id;
          } else {
            throw createErr;
          }
        }
      } else {
        // Existing user — just link booking to their account, no password change
        userId = existingUser.id;
      }
    } catch (error: any) {
      logger.error('Account creation error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Failed to create or retrieve account. Please try again.' },
        { status: 500 }
      );
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

    serverPricing = await calculatePackagePriceDynamic(
      instructor.hourlyRate,
      data.hours,
      data.packageType,
      data.includeTestPackage,
      instructor.testPackagePrice ?? 0
    );

    // Validate client-submitted total is within 1 cent of server calculation
    // (floating point tolerance). If it differs, reject — prevents price manipulation.
    // If no pricing was submitted (AI voice flow), skip validation — use server total only.
    if (data.pricing) {
      const clientTotal = data.pricing.total;
      if (Math.abs(clientTotal - serverPricing.total) > 0.01) {
        logger.error('❌ Pricing mismatch:', { clientTotal, serverTotal: serverPricing.total });
        return NextResponse.json({
          error: 'Pricing has changed. Please refresh and try again.',
          serverTotal: serverPricing.total,
        }, { status: 409 });
      }
    }

    // Use server-calculated pricing for all downstream operations
    const verifiedTotal = serverPricing.total;

    // ── Validate scheduled bookings don't exceed purchased hours ──────────────
    // CRITICAL: Prevent overbooking (user pays for 1h but tries to book 2h)
    if (data.scheduledBookings && data.scheduledBookings.length > 0) {
      const totalScheduledMinutes = data.scheduledBookings.reduce((sum, booking) => sum + booking.duration, 0);
      const totalScheduledHours = totalScheduledMinutes / 60;
      if (totalScheduledHours > data.hours) {
        logger.warn('❌ Overbooking attempt:', { 
          purchasedHours: data.hours, 
          scheduledHours: totalScheduledHours,
          email: data.accountHolderEmail
        });
        return NextResponse.json({
          error: `You can only book ${data.hours} hour(s), but scheduled ${totalScheduledHours.toFixed(1)} hour(s). Please reduce your bookings.`,
          code: 'BOOKING_HOURS_EXCEED_PACKAGE',
          maxHours: data.hours,
          scheduledHours: totalScheduledHours,
        }, { status: 400 });
      }
    }

    const firstLessonDurationMinutes = data.scheduledBookings?.[0]?.duration ?? 60;
    const firstLessonDurationHours = firstLessonDurationMinutes / 60;
    const firstLessonPrice = parseFloat((instructor.hourlyRate * firstLessonDurationHours).toFixed(2));
    
    // MEDIUM-10 FIX: Get platform fee rate from DB instead of hardcoding
    const { getCommissionRate, getPlatformFeeRate } = await import('@/lib/services/platform-pricing');
    const platformFeeRate = await getPlatformFeeRate();
    const firstLessonPlatformFee = parseFloat((firstLessonPrice * (platformFeeRate / 100)).toFixed(2));

    // Lock commission rate at booking creation time — never re-fetch at payout time.
    // If the platform rate changes after this booking is created, the instructor
    // receives the rate that was in effect when the student paid. Immutable from here.
    const commissionRatePct = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC');
    const commissionRateDecimal = commissionRatePct / 100;
    const firstLessonPayout = parseFloat((firstLessonPrice * (1 - commissionRateDecimal)).toFixed(2));

    // ── Book Later: wallet-only, no booking created ───────────────────────────
    // P1-1 FIX: Do NOT create a WalletTransaction here — payment hasn't happened yet.
    // Creating PENDING here then returning success: true causes two problems:
    //   1. The client UI may show "you have credit" before payment is confirmed
    //   2. The 10-minute cleanup cron expires the PENDING transaction, leaving
    //      the user with no credit even after a successful payment
    // Correct flow: create a Stripe Checkout Session, redirect student to the URL,
    // and only credit the wallet in the Stripe webhook (checkout.session.completed).
    // Using Checkout (not raw PaymentIntent) so we get a hosted URL the voice AI
    // can SMS to the student — a raw client_secret cannot be sent over SMS.
    if (data.bookingType === 'later') {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });

        const baseUrl = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'aud',
                unit_amount: Math.round(verifiedTotal * 100),
                product_data: {
                  name: `DriveBook Lesson Package — ${data.hours} Hours`,
                  description: `With ${instructor.name}. Valid for 12 months from purchase.`,
                },
              },
            },
          ],
          metadata: {
            type: 'wallet_credit',
            userId: userId!,
            instructorId: resolvedInstructorId,
            hours: String(data.hours),
            packageType: data.packageType,
          },
          success_url: `${baseUrl}/client-dashboard/wallet?payment=success&verify_email=1&uid=${userId}`,
          cancel_url:  `${baseUrl}/client-dashboard/wallet?payment=cancelled`,
          // Pre-fill email so returning students don't have to type it again
          customer_email: data.accountHolderEmail,
        });

        return NextResponse.json({
          success: true,
          bookingType: 'later',
          total: verifiedTotal,
          // checkoutUrl is the hosted Stripe page.
          // The hybrid server (main-app-proxy.js) detects bookingType=later and SMS's
          // this URL to the student's phone automatically.
          checkoutUrl: session.url,
          paymentIntentId: session.payment_intent as string | null,
        }, { status: 201 });
      } catch (stripeErr) {
        logger.error('Stripe Checkout Session creation failed for book-later', {
          error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
        return NextResponse.json({ error: 'Failed to initialise payment' }, { status: 500 });
      }
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

    // isShortNotice is computed server-side — never trust caller input.
    // Rule: lesson starts within 2 hours of now → requires instructor approval first.
    const isShortNotice = startTime
      ? (startTime.getTime() - Date.now()) < 2 * 60 * 60 * 1000
      : false;

    let booking: any;
    try {
      // Create slot reservation to hold the time
      const slotExpiresAt = new Date();
      slotExpiresAt.setMinutes(slotExpiresAt.getMinutes() + 10);

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

          // Create slot reservation to hold during payment
          await tx.slotReservation.create({
            data: {
              instructorId: resolvedInstructorId,
              // Use the request idempotency key as sessionId if available, else generate one.
              // This lets the client release the server-side reservation using the same key
              // if the user abandons before payment — without a real sessionId the only
              // cleanup path was the 10-minute cron expiry.
              sessionId: idempotencyKey ?? `bulk-${Date.now()}`,
              startTime,
              endTime,
              expiresAt: slotExpiresAt,
            },
          });
        }

        const newBooking = await tx.booking.create({
          data: {
            instructorId: resolvedInstructorId,
            clientId: clientId,
            clientName,
            clientPhone,
            status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
            startTime: startTime ?? undefined,
            endTime: endTime ?? undefined,
            duration: firstLessonDurationMinutes,
            price: firstLessonPrice,
            platformFee: firstLessonPlatformFee,
            instructorPayout: firstLessonPayout,
            // Lock commission rate at booking time — immutable even if platform rates change later.
            // Payout service uses this stored value, never re-fetches the live rate.
            commissionRate: commissionRateDecimal,
            pickupAddress: data.scheduledBookings?.[0]?.pickupLocation || null,
            notes: data.scheduledBookings?.[0]?.notes || null,
            isPackageBooking: data.hours > 1,
            packageHours: data.hours,
            packageHoursRemaining: data.hours - firstLessonDurationHours,
            packageTotalPaid: verifiedTotal,
            lockedHourlyRate: instructor.hourlyRate,
            lockedDiscountPct: serverPricing.discountPercentage,
            // Secure payment token — required alongside bookingId to access payment page
            paymentToken: crypto.randomUUID(),
          } as any,
        });

        // P2-8 FIX: Persist idempotency key inside the same transaction as booking.create.
        // Previously stored outside/after the transaction — a crash between create and upsert
        // would allow a retry with the same key to create a second booking.
        // The @unique constraint on key means a concurrent duplicate throws P2002 (caught below).
        if (idempotencyKey) {
          const checkoutUrl = !isShortNotice
            ? `${process.env.NEXTAUTH_URL}/booking/${newBooking.id}/payment?token=${(newBooking as any).paymentToken}`
            : undefined;
          const idemResponse: Record<string, any> = {
            success: true,
            bookingId: newBooking.id,
            isShortNotice,
            total: isShortNotice ? 0 : verifiedTotal,
            status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
            ...(checkoutUrl ? { checkoutUrl } : {}),
          };
          await (tx as any).bookingIdempotencyKey.upsert({
            where: { key: idempotencyKey },
            update: {},
            create: {
              key: idempotencyKey,
              email: data.accountHolderEmail,
              bookingId: newBooking.id,
              response: idemResponse,
            },
          });
        }

        return newBooking;
      });
    } catch (err: any) {
      if (err.message === 'SLOT_TAKEN') {
        return NextResponse.json({ error: 'This time slot is no longer available. Please choose another.' }, { status: 409 });
      }
      if (err.code === 'P2002' && err.meta?.target?.includes('key')) {
        // Concurrent duplicate idempotency key — replay stored response
        const stored = await (prisma as any).bookingIdempotencyKey.findUnique({
          where: { key: idempotencyKey! },
        });
        if (stored) return NextResponse.json(stored.response, { status: 201 });
      }
      throw err;
    }

    logger.info('Booking created', {
      bookingId: booking.id,
      firstLessonPrice,
      verifiedTotal,
      shortNotice: isShortNotice,
    });

    // Invalidate availability cache for this instructor+date so the next availability
    // query reflects the newly created booking immediately.
    if (booking.startTime) {
      invalidateAvailabilityCache(
        resolvedInstructorId,
        (booking.startTime as Date).toISOString().slice(0, 10)
      );
    }

    // ── Create PDA Test Booking if included ───────────────────────────────────
    // If user selected "include PDA test package", create PDATestBooking linked to this booking
    if (data.includeTestPackage) {
      try {
        // Get instructor's PDA configs
        const instructor_with_pda = await prisma.instructor.findUnique({
          where: { id: resolvedInstructorId },
          select: {
            pdaConfigs: {
              where: { isActive: true },
              include: { testCentres: { include: { testCentre: true } } }
            }
          }
        });

        const pdaConfigs = instructor_with_pda?.pdaConfigs ?? [];
        if (pdaConfigs.length > 0) {
          const pdaConfig = pdaConfigs[0]; // Use first active config
          
          // Use first active test centre
          const firstActiveJoin = pdaConfig.testCentres.find((j: any) => j?.testCentre?.isActive !== false);
          const testCentre = firstActiveJoin?.testCentre as any;
          if (testCentre) {
            
            // Create PDA test booking linked to parent booking
            const pdaTest = await prisma.pDATestBooking.create({
              data: {
                instructorId: resolvedInstructorId,
                clientId: clientId,
                configId: pdaConfig.id,
                testCentreId: testCentre.id,
                testDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now (TBD by client)
                testTime: 'TBD', // Client selects time later
                price: pdaConfig.price,
                discountPercent: pdaConfig.discountPercent,
                status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
                parentBookingId: booking.id // Link to main booking
              }
            });
            
            logger.info('PDA test booking created:', { pdaTestId: pdaTest.id, parentBookingId: booking.id });
          }
        }
      } catch (pdaErr) {
        // Log but don't fail — PDA test booking failure shouldn't cancel the main booking
        logger.error('Failed to create PDA test booking', {
          error: pdaErr instanceof Error ? pdaErr.message : String(pdaErr),
        });
      }
    }

    // ── Send Booking Notification Email to Student ───────────────────────────
    // FIX: Bulk bookings now send email notification (was previously missing)
    // Email includes: lesson details, wallet top-up info, password setup link
    if (startTime && endTime && !isShortNotice) {
      try {
        const { emailService } = await import('@/lib/services/email');

        // Format lesson details for email
        const dateStr = startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
        
        const timeStr = startTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const durationHours = firstLessonDurationHours;
        const lessonPrice = firstLessonPrice;
        
        // Calculate top-up amount including platform fee
        const platformFeeAmount = firstLessonPlatformFee;
        const topUpAmount = Math.round((lessonPrice + platformFeeAmount) * 100) / 100;

        // Determine action URL based on account status
        const clientUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { resetToken: true, resetTokenExpiry: true }
        });
        
        const isNewAccount = !!(clientUser?.resetToken && clientUser.resetTokenExpiry && clientUser.resetTokenExpiry > new Date());
        const actionUrl = isNewAccount
          ? `${process.env.NEXTAUTH_URL}/set-password?token=${clientUser!.resetToken}`
          : `${process.env.NEXTAUTH_URL}/login`;
        
        const actionLabel = isNewAccount ? 'Set Password & Top Up →' : 'Log In & Top Up →';

        await emailService.sendGenericEmail({
          from: 'DriveBook Bookings <bookings@drivebook.com.au>',
          to: data.accountHolderEmail,
          subject: `📅 ${(instructor as any).name} booked a lesson for you — top up to confirm`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .lesson-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
                .cta-box { background: #eff6ff; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin:0;font-size:24px;">📅 Lesson Booked for You</h1>
                </div>
                <div class="content">
                  <p>Hi ${data.accountHolderName},</p>
                  ${data.registrationType === 'myself' 
                    ? `<p>You have successfully booked a driving lesson with <strong>${(instructor as any).name}</strong>.</p>`
                    : `<p><strong>${(instructor as any).name}</strong> has booked a driving lesson for you.</p>`
                  }
                  <div class="lesson-box">
                    <h3 style="margin-top:0;">Lesson Details</h3>
                    <p style="margin:5px 0;"><strong>Date:</strong> ${dateStr}</p>
                    <p style="margin:5px 0;"><strong>Time:</strong> ${timeStr}</p>
                    <p style="margin:5px 0;"><strong>Duration:</strong> ${durationHours} hour${durationHours !== 1 ? 's' : ''}</p>
                    <p style="margin:5px 0;"><strong>Cost:</strong> $${lessonPrice.toFixed(2)}</p>
                  </div>
                  <div class="cta-box">
                    <h3 style="margin-top:0;">Top up your wallet to confirm</h3>
                    <p>You need <strong>$${topUpAmount.toFixed(2)}</strong> in your DriveBook wallet to confirm this booking.</p>
                    <a href="${actionUrl}" class="button">${actionLabel}</a>
                  </div>
                  <p style="color:#6b7280;font-size:14px;">Once your wallet is topped up, the booking will be confirmed automatically.</p>
                  <div class="footer"><p><strong>DriveBook</strong> — Your Driving Instructor Platform</p></div>
                </div>
              </div>
            </body>
            </html>
          `
        });

        logger.info('Booking notification email sent:', { bookingId: booking.id, email: data.accountHolderEmail });
      } catch (emailErr) {
        logger.error('Booking notification email failed (non-critical)', {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
        // Don't fail the booking if email fails — booking is already created
      }
    }

    if (isShortNotice) {
      try {
        const instructorUser = instructor.userId
          ? await prisma.user.findUnique({ where: { id: instructor.userId }, select: { id: true } })
          : null;
        if (instructorUser) {
          await notifyShortNoticeBookingRequest(instructorUser.id, clientName, booking.id, startTime ?? new Date());
        }
        if (userId) {
          await notifyClientBookingPendingApproval(userId, instructor.name, booking.id, startTime ?? new Date(), instructor);
        }
      } catch (notifErr) {
        logger.error('Short-notice notification failed', {
          error: notifErr instanceof Error ? notifErr.message : String(notifErr),
        });
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
          await notifyClientBookingConfirmed(userId, instructor.name, booking.id, startTime ?? new Date(), instructor);
        }
      } catch (notifErr) {
        logger.error('Booking notification failed', {
          error: notifErr instanceof Error ? notifErr.message : String(notifErr),
        });
      }
    }

    // FIX #12: Audit log on public booking creation — previously missing.
    // Required for dispute resolution ("I never made that booking").
    try {
      await prisma.auditLog.create({
        data: {
          action: 'BOOKING_CREATED',
          actorId: userId ?? 'GUEST',
          actorRole: 'CLIENT',
          targetType: 'BOOKING',
          targetId: booking.id,
          success: true,
          metadata: {
            instructorId: resolvedInstructorId,
            clientName,
            clientPhone,
            startTime: startTime?.toISOString() ?? null,
            price: booking.price,
            isShortNotice,
            source: 'public_bulk',
          },
        },
      });
    } catch (auditErr) {
      logger.error('Audit log failed for booking creation', {
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    // Persist idempotency response so retries get same result
    const checkoutUrl = (!isShortNotice)
      ? `${process.env.NEXTAUTH_URL}/booking/${booking.id}/payment?token=${(booking as any).paymentToken}`
      : undefined;

    // ── Voice-friendly summary block ─────────────────────────────────────────
    // Backend is the source of truth for these values — AI should not calculate them.
    //   instructor:       name to read aloud in confirmation
    //   package:          human label e.g. "10 Hour Package"
    //   packageHours:     total hours purchased
    //   scheduledHours:   hours consumed by lessons booked in this call
    //   scheduledLessons: number of lessons actually scheduled (for multi-lesson voice flow)
    //   remainingHours:   hours still available after this booking
    //   firstLesson:      pre-formatted instructor-local time e.g. "Monday 10:00 AM"
    //   paymentRequired:  false for short-notice (instructor approves first)
    //   slotHeldMinutes:  how long the SlotReservation holds before expiry
    //   pickupVerified:   false when address was spoken but geocoding failed
    const lessonDisplayTz = instructor?.timezone
      ? resolveTimezone(instructor.timezone)
      : timezoneFromState(instructor?.state);
    const firstLessonDisplay = startTime
      ? startTime.toLocaleString('en-AU', {
          weekday: 'long',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: lessonDisplayTz,
        })
      : null;

    const packageLabels: Record<string, string> = {
      PACKAGE_6:  '6 Hour Package',
      PACKAGE_10: '10 Hour Package',
      PACKAGE_15: '15 Hour Package',
      CUSTOM:     'Custom Package',
    };

    // Count lessons scheduled in this request (voice flow books one at a time,
    // but the field is accurate even if scheduledBookings[] grows in Phase 2).
    const scheduledLessons = data.scheduledBookings?.length ?? (startTime ? 1 : 0);
    const scheduledHours   = scheduledLessons * firstLessonDurationHours;
    const remainingHours   = data.hours - scheduledHours;

    const responsePayload: Record<string, any> = {
      success: true,
      bookingId: booking.id,
      bookingType: 'now',
      isShortNotice,
      total: isShortNotice ? 0 : verifiedTotal,
      status: isShortNotice ? 'PENDING' : 'PENDING_PAYMENT',
      includeTestPackage: data.includeTestPackage,
      ...(checkoutUrl ? { checkoutUrl } : {}),
      // voice — all fields the AI needs to read after booking, grouped under one key.
      // Web and mobile clients can ignore this object.
      voice: {
        instructor:       instructor.name,
        package:          packageLabels[data.packageType] ?? data.packageType,
        packageHours:     data.hours,
        scheduledHours:   Math.round(scheduledHours * 10) / 10,
        scheduledLessons,
        remainingHours:   Math.round(remainingHours * 10) / 10,
        firstLesson:      firstLessonDisplay,
        paymentRequired:  !isShortNotice,
        slotHeldMinutes:  10,
        pickupVerified:   data.scheduledBookings?.[0]?.pickupValidated !== false,
        // Pre-assembled confirmation string the AI reads verbatim.
        // Avoids template construction in the prompt.
        // Uses getDisplayName — for BUSINESS accounts the school name is read, not the owner's personal name.
        confirmation: isShortNotice
          ? `${getDisplayName(instructor)} needs to approve this booking first. You will be notified within a few minutes.`
          : `Your ${packageLabels[data.packageType] ?? data.packageType} with ${getDisplayName(instructor)} is reserved for 10 minutes. A payment link has been sent to your phone.`,
      },
    };
    // (Idempotency key was already persisted inside the $transaction above)
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Bulk booking Zod error', { issues: error.issues });
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }
    logger.error('Bulk booking error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

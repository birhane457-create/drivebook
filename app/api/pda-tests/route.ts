// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation';
import { emailService } from '@/lib/services/email';
import { getWalletBalance } from '@/lib/services/wallet-helpers';
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger';
import { getPlatformPricing, getCommissionRate } from '@/lib/services/platform-pricing';

export const dynamic = 'force-dynamic';

const scheduleSchema = z.object({
  clientId:         z.string(),
  testDate:         z.string(),             // YYYY-MM-DD
  testTime:         z.string(),             // HH:mm
  testCentreId:     z.string().optional(),
  testCenterName:   z.string().optional(),
  testCenterAddress:z.string().optional(),
  price:            z.number().min(0).optional(),
  notes:            z.string().optional(),
});

// ── GET — list all PDA test bookings for this instructor ──────────────────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        bookingType: 'PDA_TEST',
        deletedAt: null,
      } as any,
      include: { client: true },
      orderBy: { startTime: 'desc' },
    });

    const tests = bookings.map((b: any) => ({
      id:               b.id,
      testDate:         b.startTime,
      testTime:         b.startTime ? new Date(b.startTime).toISOString().slice(11, 16) : '',
      testCenterName:   b.notes?.includes('|') ? b.notes.split('|')[0] : (b.pickupAddress || 'Test Centre'),
      testCenterAddress:b.notes?.includes('|') ? b.notes.split('|')[1] : (b.pickupAddress || ''),
      result:           b.instructorNotes?.startsWith('RESULT:')
                          ? b.instructorNotes.split(':')[1]?.trim() ?? 'PENDING'
                          : 'PENDING',
      instructorNotes:  b.instructorNotes || '',
      price:            b.price,
      platformFee:      b.platformFee,
      instructorPayout: b.instructorPayout,
      commissionRate:   b.commissionRate,
      status:           b.status,
      isPaid:           b.isPaid,
      client:           b.client
                          ? { name: b.client.name, phone: b.client.phone, email: b.client.email }
                          : { name: b.clientName || 'Unknown', phone: b.clientPhone || '', email: '' },
    }));

    return NextResponse.json(tests);
  } catch (error) {
    console.error('PDA tests fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch PDA tests' }, { status: 500 });
  }
}

// ── POST — schedule a PDA test (full platform payment flow) ──────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Subscription guard
    const subCheck = await requireActiveSubscription(session.user.id);
    if (!subCheck.valid) {
      return NextResponse.json({ error: subCheck.message, requiresSubscription: true }, { status: 403 });
    }

    // Fetch instructor + approval check
    const instructorRecord = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: {
        approvalStatus: true,
        testPackagePrice: true,
        testPackageDuration: true,
        name: true,
        subscriptionTier: true,
      },
    });
    if (!instructorRecord || instructorRecord.approvalStatus !== 'APPROVED') {
      return NextResponse.json({
        error: 'Your account is pending approval. You can schedule PDA tests once approved.',
        requiresApproval: true,
      }, { status: 403 });
    }

    const body = await req.json();
    const data = scheduleSchema.parse(body);

    // ── Resolve test centre ──────────────────────────────────────────────────
    let centreName    = data.testCenterName    || '';
    let centreAddress = data.testCenterAddress || '';

    if (data.testCentreId) {
      const centre = await (prisma as any).testCentre.findUnique({ where: { id: data.testCentreId } });
      if (!centre) return NextResponse.json({ error: 'Test centre not found' }, { status: 404 });
      centreName    = centre.name;
      centreAddress = `${centre.address}, ${centre.suburb} ${centre.state}`;
    }
    if (!centreName || !centreAddress) {
      return NextResponse.json({ error: 'Test centre is required' }, { status: 400 });
    }

    // ── Verify client belongs to this instructor ─────────────────────────────
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, instructorId: session.user.instructorId },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    if (!client.userId) {
      return NextResponse.json({
        error: 'Client account not set up. Please remove and re-add this client.',
        noAccount: true,
      }, { status: 422 });
    }

    // ── Platform pricing — live from DB, same as regular bookings ────────────
    const pricing    = await getPlatformPricing();
    const feeRate    = pricing.platformFeePercentage / 100;             // e.g. 0.036
    const commRate   = await getCommissionRate(instructorRecord.subscriptionTier ?? 'BASIC'); // e.g. 15
    const commRateFraction = commRate / 100;                            // e.g. 0.15

    // ── Price & duration ─────────────────────────────────────────────────────
    const price = data.price !== undefined
      ? data.price
      : (instructorRecord.testPackagePrice ?? 0);

    // platformFee = processing fee passed to platform (3.6% on top of lesson price)
    const platformFee      = parseFloat((price * feeRate).toFixed(2));
    // instructorPayout = what instructor earns after platform commission on the lesson price
    const instructorPayout = parseFloat((price * (1 - commRateFraction)).toFixed(2));

    const durationMinutes = (instructorRecord.testPackageDuration && instructorRecord.testPackageDuration > 0)
      ? instructorRecord.testPackageDuration
      : 165;

    // ── Build UTC datetimes ──────────────────────────────────────────────────
    const startTime = new Date(`${data.testDate}T${data.testTime}:00.000Z`);
    if (isNaN(startTime.getTime())) {
      return NextResponse.json({ error: 'Invalid date or time format' }, { status: 400 });
    }
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    if (startTime < new Date()) {
      return NextResponse.json({ error: 'Test date and time must be in the future' }, { status: 400 });
    }

    // ── Wallet balance check — database ledger, not a cached field ──────────
    // getWalletBalance() computes from WalletTransaction records (the source of truth).
    // This pre-check is an optimistic fast path — the definitive check is inside
    // the Prisma transaction below, preventing any race condition.
    const { balance } = await getWalletBalance(client.userId);

    // Shared booking data for both paths
    const bookingData = {
      instructorId:     session.user.instructorId,
      clientId:         data.clientId,
      clientName:       client.name,
      clientPhone:      client.phone,
      bookingType:      'PDA_TEST',
      startTime,
      endTime,
      duration:         durationMinutes,
      price,
      platformFee,
      instructorPayout,
      commissionRate:   commRateFraction,
      pickupAddress:    centreAddress,
      notes:            `${centreName}|${centreAddress}`,
      instructorNotes:  'RESULT: PENDING',
      source:           'platform',
      createdBy:        'instructor',
      originalStartTime:startTime,
    };

    // Shared slot conflict check query
    const conflictWhere = {
      instructorId: session.user.instructorId,
      status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
      OR: [
        { AND: [{ startTime: { gte: startTime } }, { startTime: { lt: endTime } }] },
        { AND: [{ endTime: { gt: startTime } }, { endTime: { lte: endTime } }] },
        { AND: [{ startTime: { lte: startTime } }, { endTime: { gte: endTime } }] },
      ],
    };

    // ═══════════════════════════════════════════════════════════════════════
    // PATH A — Insufficient wallet → PENDING_PAYMENT + top-up email
    // ═══════════════════════════════════════════════════════════════════════
    if (balance < price) {
      let pendingBooking;
      try {
        pendingBooking = await prisma.$transaction(async (tx) => {
          if (await tx.booking.findFirst({ where: conflictWhere })) throw new Error('SLOT_CONFLICT');
          return tx.booking.create({
            data: { ...bookingData, isPaid: false, status: 'PENDING_PAYMENT' } as any,
            include: { client: true },
          });
        });
      } catch (txErr) {
        if ((txErr as Error).message === 'SLOT_CONFLICT') {
          return NextResponse.json({ error: 'Time slot already booked. Please select a different time.' }, { status: 409 });
        }
        throw txErr;
      }

      // Send top-up email
      try {
        const shortfall    = parseFloat((price - balance).toFixed(2));
        const topUpAmount  = parseFloat((shortfall / (1 - feeRate)).toFixed(2));
        const baseUrl      = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';
        const topUpUrl     = `${baseUrl}/client-dashboard/wallet?topup=${topUpAmount.toFixed(2)}`;
        const clientUser   = await prisma.user.findUnique({
          where: { id: client.userId },
          select: { resetToken: true, resetTokenExpiry: true },
        });
        const isNewAccount = !!(clientUser?.resetToken && clientUser.resetTokenExpiry && clientUser.resetTokenExpiry > new Date());
        const actionUrl    = isNewAccount ? `${baseUrl}/reset-password?token=${clientUser!.resetToken}` : topUpUrl;
        const actionLabel  = isNewAccount ? 'Set Password & Top Up →' : 'Top Up Wallet →';
        const testDateDisplay = new Date(`${data.testDate}T12:00:00.000Z`)
          .toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Perth' });

        await emailService.sendGenericEmail({
          to: client.email,
          subject: `📋 ${instructorRecord.name} scheduled a PDA test for you — top up to confirm`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;color:#111827">
              <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);color:white;padding:28px 32px;border-radius:10px 10px 0 0">
                <h1 style="margin:0;font-size:22px">🚗 PDA Test Booked for You</h1>
              </div>
              <div style="background:#f9fafb;padding:28px 32px;border-radius:0 0 10px 10px">
                <p>Hi ${client.name},</p>
                <p><strong>${instructorRecord.name}</strong> has scheduled a PDA driving test for you.</p>
                <div style="background:white;padding:18px;margin:16px 0;border-radius:8px;border-left:4px solid #2563eb">
                  <p style="margin:4px 0"><strong>Date:</strong> ${testDateDisplay}</p>
                  <p style="margin:4px 0"><strong>Time:</strong> ${data.testTime} (AWST)</p>
                  <p style="margin:4px 0"><strong>Test Centre:</strong> ${centreName}</p>
                  <p style="margin:4px 0"><strong>Address:</strong> ${centreAddress}</p>
                  <p style="margin:4px 0"><strong>Cost:</strong> $${price.toFixed(2)}</p>
                </div>
                <div style="background:#eff6ff;padding:18px;margin:16px 0;border-radius:8px;text-align:center">
                  <p style="margin:0 0 12px;font-weight:600">Top up your wallet to confirm this booking</p>
                  <table style="margin:0 auto 16px;border-collapse:collapse;font-size:14px;text-align:left">
                    <tr><td style="padding:3px 12px 3px 0;color:#6b7280">PDA test cost</td><td style="padding:3px 0;font-weight:600">$${price.toFixed(2)}</td></tr>
                    <tr><td style="padding:3px 12px 3px 0;color:#6b7280">Processing fee (${(feeRate * 100).toFixed(1)}%)</td><td style="padding:3px 0">$${(topUpAmount - shortfall).toFixed(2)}</td></tr>
                    <tr style="border-top:1px solid #bfdbfe"><td style="padding:6px 12px 3px 0;font-weight:700">Amount to add</td><td style="padding:6px 0;font-weight:700;color:#1d4ed8">$${topUpAmount.toFixed(2)}</td></tr>
                  </table>
                  <a href="${actionUrl}" style="display:inline-block;background:#2563eb;color:white;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">${actionLabel}</a>
                </div>
                <p style="color:#6b7280;font-size:13px">Once your wallet is topped up, the booking confirms automatically.</p>
              </div>
            </div>`,
        });
      } catch (emailErr) {
        console.error('PDA top-up email failed (non-critical):', emailErr);
      }

      try {
        await logBookingAction({
          bookingId: pendingBooking.id,
          action: AuditAction.BOOKING_CREATED,
          actorId: session.user.instructorId,
          actorRole: ActorRole.INSTRUCTOR,
          metadata: { bookingType: 'PDA_TEST', clientId: data.clientId, price, platformFee, instructorPayout, pendingPayment: true },
        });
      } catch { /* non-critical */ }

      return NextResponse.json({
        success: true,
        booking: pendingBooking,
        pendingPayment: true,
        message: `PDA test scheduled. An email has been sent to ${client.email} to top up their wallet and confirm.`,
      }, { status: 201 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PATH B — Sufficient wallet → deduct + CONFIRMED
    // ═══════════════════════════════════════════════════════════════════════
    let confirmedBooking;
    try {
      confirmedBooking = await prisma.$transaction(async (tx) => {
        // Slot conflict check inside transaction (prevents TOCTOU race)
        if (await tx.booking.findFirst({ where: conflictWhere })) throw new Error('SLOT_CONFLICT');

        // Re-verify balance inside transaction — authoritative ledger check, not client-side read
        const wallet = await tx.clientWallet.findUnique({ where: { userId: client.userId! } });
        if (!wallet) throw new Error('Wallet not found');
        const txns  = await tx.walletTransaction.findMany({ where: { walletId: wallet.id, status: 'CONFIRMED' } });
        const txBal = txns.reduce((sum: number, t: any) => t.type === 'CREDIT' ? sum + t.amount : sum - t.amount, 0);
        if (txBal < price) throw new Error('INSUFFICIENT_BALANCE');

        // ── Atomic wallet deduction ──────────────────────────────────────────
        // 1. Update stored balance field (performance cache — kept in sync with ledger)
        await tx.clientWallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: price } },
        });
        // 2. Create ledger entry
        await tx.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'DEBIT',
            amount:      price,
            description: `PDA test — ${centreName} on ${data.testDate} at ${data.testTime}`,
            status:      'CONFIRMED',
          } as any,
        });

        const now = new Date();

        // Create booking as CONFIRMED
        const newBooking = await tx.booking.create({
          data: { ...bookingData, isPaid: true, paidAt: now, status: 'CONFIRMED' } as any,
          include: { client: true },
        });

        // Create transaction record for financial ledger / revenue reporting
        await (tx as any).transaction.create({
          data: {
            bookingId:       newBooking.id,
            instructorId:    session.user.instructorId,
            type:            'BOOKING_PAYMENT',
            amount:          price,
            platformFee,
            instructorPayout,
            commissionRate:  commRateFraction,
            status:          'COMPLETED',
            description:     `PDA test booking — ${centreName}`,
            metadata:        { bookingType: 'PDA_TEST', centreName, testDate: data.testDate, testTime: data.testTime },
          },
        });

        return newBooking;
      });
    } catch (txErr) {
      if ((txErr as Error).message === 'SLOT_CONFLICT') {
        return NextResponse.json({ error: 'Time slot already booked. Please select a different time.' }, { status: 409 });
      }
      if ((txErr as Error).message === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json({ error: 'Insufficient wallet balance. Please ask the client to top up.' }, { status: 422 });
      }
      throw txErr;
    }

    // Audit
    try {
      await logBookingAction({
        bookingId: confirmedBooking.id,
        action: AuditAction.BOOKING_CREATED,
        actorId: session.user.instructorId,
        actorRole: ActorRole.INSTRUCTOR,
        metadata: { bookingType: 'PDA_TEST', clientId: data.clientId, price, platformFee, instructorPayout, commissionRate: commRateFraction, status: 'CONFIRMED' },
      });
      await (prisma as any).auditLog.create({
        data: {
          action:     'BOOKING_CREATED',
          actorId:    session.user.id!,
          actorRole:  'INSTRUCTOR',
          targetType: 'BOOKING',
          targetId:   confirmedBooking.id,
          success:    true,
          metadata:   { bookingType: 'PDA_TEST', centreName, centreAddress, price, platformFee, instructorPayout, commissionRate: commRateFraction, status: 'CONFIRMED' },
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-critical):', auditErr);
    }

    // FinancialLedger — deterministic idempotency key: `booking-${id}-payment`
    try {
      const { recordBookingPayment } = await import('@/lib/services/ledger-operations');
      await recordBookingPayment({
        bookingId: confirmedBooking.id,
        userId:    client.userId,
        instructorId: session.user.instructorId,
        totalAmount:      price,
        platformFee:      platformFee,
        instructorPayout: instructorPayout,
        createdBy: session.user.instructorId,
      });
    } catch (ledgerErr: any) {
      if (!ledgerErr?.message?.includes('idempotency')) {
        console.error('[Ledger] PDA booking payment failed (non-critical):', ledgerErr?.message);
      }
    }

    // Send wallet receipt email (non-critical)
    try {
      const { sendWalletLessonReceipt } = await import('@/lib/services/receipt-email');
      const walletAfterResult = await getWalletBalance(client.userId);
      await sendWalletLessonReceipt({
        clientName:          client.name,
        clientEmail:         client.email,
        receiptId:           confirmedBooking.id,
        bookedAt:            new Date(),
        instructorName:      instructorRecord.name,
        lessonDate:          startTime,
        durationHours:       parseFloat((durationMinutes / 60).toFixed(2)),
        hourlyRate:          instructorRecord.testPackagePrice ?? price,
        lessonCost:          price,
        walletBalanceBefore: walletAfterResult.balance + price,
        walletBalanceAfter:  walletAfterResult.balance,
        bookedBy:            'instructor',
        bookingId:           confirmedBooking.id,
      });
    } catch (receiptErr) {
      console.error('PDA receipt email failed (non-critical):', receiptErr);
    }

    return NextResponse.json({ success: true, booking: confirmedBooking }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('PDA test schedule error:', error);
    return NextResponse.json({ error: 'Failed to schedule PDA test' }, { status: 500 });
  }
}

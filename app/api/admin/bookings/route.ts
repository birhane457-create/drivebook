import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCommissionRate } from '@/lib/services/platform-pricing';
import { resolveTimezone, timezoneFromState, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { validateStateTransition } from '@/lib/services/booking-state-machine';

export const dynamic = 'force-dynamic';

async function getAdminSession() {
  return getServerSession(authOptions);
}

// GET â€” list all bookings with filters
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  const deny = await requirePermission(session, PERM.OPERATIONS_BOOKINGS_VIEW);
  if (deny) return deny;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: any = { deletedAt: null }
    if (status && status !== 'all') where.status = status
    if (from || to) {
      where.startTime = {}
      if (from) where.startTime.gte = new Date(from)
      if (to) where.startTime.lte = new Date(to + 'T23:59:59')
    }
    // Push search into Prisma where â€” avoids the 200-row cap miss
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
        { provider: { name: { contains: search, mode: 'insensitive' } } },
        { id: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get total count for pagination
    const total = await prisma.booking.count({ where })

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: limit,
      skip,
      select: {
        id: true, startTime: true, endTime: true, status: true,
        bookingType: true, price: true, platformFee: true, providerPayout: true,
        pickupAddress: true, dropoffAddress: true, notes: true,
        isPaid: true, duration: true,
        customerName: true, customerPhone: true,
        provider: { select: { id: true, name: true, phone: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    }) as any[]

    const filtered = bookings // search already applied in DB

    const now = new Date();
    // C-11 fix: stats use full-DB counts, not .filter() on the page slice.
    // The old approach gave wrong counts on page 2+.
    const [confirmedCount, pendingCount, completedCount, cancelledCount, noShowCount, endedConfirmedCount] = await Promise.all([
      prisma.booking.count({ where: { ...where, status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { ...where, status: 'PENDING' } }),
      prisma.booking.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.booking.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.booking.count({ where: { ...where, status: 'NO_SHOW' } }),
      prisma.booking.count({ where: { ...where, status: 'CONFIRMED', endTime: { lte: now } } as any }),
    ]);
    const stats = {
      total,
      confirmed: confirmedCount,
      pending: pendingCount,
      completed: completedCount,
      cancelled: cancelledCount,
      noShow: noShowCount,
      endedConfirmed: endedConfirmedCount,
    };

    return NextResponse.json({
      bookings: filtered,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin bookings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH â€” update booking status (mark complete, no-show, etc.)
export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  const deny = await requirePermission(session, PERM.OPERATIONS_BOOKINGS_CANCEL);
  if (deny) return deny;
  const adminId = session!.user!.id!;

  try {
    const { bookingId, status, noShowParty } = await req.json();
    if (!bookingId || !status) return NextResponse.json({ error: 'bookingId and status required' }, { status: 400 });

    const allowed = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING'];
    if (!allowed.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    // FIX #4: Validate state transition before update
    const currentBooking = await prisma.booking.findUnique({ 
      where: { id: bookingId },
      select: { status: true }
    });
    
    if (currentBooking) {
      const transitionResult = validateStateTransition(
        currentBooking.status as any,
        status as any,
        { isAdmin: true, allowAdminOverride: true }
      );
      
      if (!transitionResult.valid) {
        return NextResponse.json({ 
          error: transitionResult.error,
          requiresOverride: transitionResult.requiresAdminOverride,
        }, { status: 422 });
      }
    }

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status } as any,
      select: { id: true, status: true, transactions: { select: { id: true } } },
    });

    // If marking NO_SHOW, store party on the booking AND tag the transaction description
    if (status === 'NO_SHOW' && noShowParty) {
      // Write to proper field
      await (prisma as any).booking.update({
        where: { id: bookingId },
        data: { noShowParty },
      });

      // Also tag transaction description for backward compat with payouts dispute detection
      const txnId = (booking as any).transactions?.[0]?.id;
      if (txnId) {
        const partyLabel = noShowParty === 'provider' ? 'INSTRUCTOR_NO_SHOW'
          : noShowParty === 'customer' ? 'CLIENT_NO_SHOW'
          : 'DISPUTED';
        await (prisma as any).transaction.update({
          where: { id: txnId },
          data: { description: `[${partyLabel}] No-show recorded by admin` },
        });
      }
    }

    // AuditLog â€” every admin booking status change is recorded
    await prisma.auditLog.create({
      data: {
        action: status === 'COMPLETED' ? 'BOOKING_COMPLETED'
          : status === 'NO_SHOW' ? 'BOOKING_NO_SHOW'
          : status === 'CANCELLED' ? 'BOOKING_CANCELLED'
          : `BOOKING_STATUS_${status}`,
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'BOOKING',
        targetId: bookingId,
        success: true,
        metadata: { status, noShowParty: noShowParty ?? null } as any,
      },
    });

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Admin booking PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST â€” admin creates a booking on behalf of a client
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  const deny = await requirePermission(session, PERM.OPERATIONS_BOOKINGS_VIEW);
  if (deny) return deny;

  try {
    const { customerId, providerId, startTime, endTime, notes } = await req.json();

    if (!customerId || !providerId || !startTime || !endTime) {
      return NextResponse.json({ error: 'customerId, providerId, startTime, endTime are required' }, { status: 400 });
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    const [client, instructor] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, phone: true, userId: true, email: true } }),
      prisma.provider.findUnique({ where: { id: providerId }, select: { id: true, name: true, hourlyRate: true, subscriptionTier: true, timezone: true, state: true } }),
    ]);

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!instructor) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    if (!client.userId) return NextResponse.json({ error: 'Client has no DriveBook account' }, { status: 422 });

    const durationHours = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);
    // Always calculate server-side â€” never accept client-supplied price
    const lessonPrice = parseFloat((instructor.hourlyRate * durationHours).toFixed(2));
    const { getPlatformFeeRate } = await import('@/lib/services/platform-pricing');
    const platformFeeRate = await getPlatformFeeRate();
    const platformFee = parseFloat((lessonPrice * (platformFeeRate / 100)).toFixed(2));
    const commissionRatePct = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC');
    const commissionRate = commissionRatePct / 100;
    const providerPayout = parseFloat((lessonPrice * (1 - commissionRate)).toFixed(2));

    // FIX #3: Balance check moved INSIDE transaction (prevents TOCTOU race)
    // Previously: check outside transaction → two concurrent bookings could overdraw
    // Now: query + validate + deduct all atomic inside single transaction
    const booking = await prisma.$transaction(async (tx) => {
      const wallet = await tx.clientWallet.findUnique({ 
        where: { userId: client.userId! },
        select: { id: true, balance: true }
      });
      
      if (!wallet) {
        throw Object.assign(new Error('Wallet not found'), { code: 'WALLET_NOT_FOUND' });
      }

      // Re-check balance INSIDE transaction (authoritative check)
      const balance = Number(wallet.balance);
      if (balance < lessonPrice) {
        throw Object.assign(
          new Error(`Insufficient balance. Client has $${balance.toFixed(2)}, needs $${lessonPrice.toFixed(2)}`),
          { code: 'INSUFFICIENT_BALANCE', balance, required: lessonPrice }
        );
      }

      // Now safe to deduct
      // Deduct from stored balance field
      await tx.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: lessonPrice } },
      });

      const adminBookingTz = instructor?.timezone
        ? resolveTimezone(instructor.timezone)
        : timezoneFromState(instructor?.state);

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: lessonPrice,
          description: `Lesson booking (admin) â€” ${newStart.toLocaleDateString('en-AU', { timeZone: adminBookingTz })}`,
          status: 'CONFIRMED',
        },
      });

      const newBooking = await tx.booking.create({
        data: {
          providerId,
          customerId,
          customerName: client.name,
          customerPhone: client.phone,
          startTime: newStart,
          endTime: newEnd,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          providerPayout,
          commissionRate,
          isPaid: true,
          paidAt: new Date(),
          notes: notes || `Booked by admin`,
          status: 'CONFIRMED',
          createdBy: 'admin',
          originalStartTime: newStart,
        } as any,
      });

      return newBooking;
    });

    return NextResponse.json({ success: true, booking }, { status: 201 });
  } catch (error: any) {
    console.error('Admin create booking error:', error);
    
    // FIX #3: Handle specific transaction error codes
    if (error?.code === 'WALLET_NOT_FOUND') {
      return NextResponse.json({ error: 'Client wallet not found' }, { status: 404 });
    }
    
    if (error?.code === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({
        error: error.message,
        insufficientBalance: true,
        balance: error.balance,
        required: error.required,
      }, { status: 422 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCommissionRate } from '@/lib/services/platform-pricing';

export const dynamic = 'force-dynamic';

async function getAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? user : null;
}

// GET — list all bookings with filters
export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

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
    // Push search into Prisma where — avoids the 200-row cap miss
    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { email: { contains: search, mode: 'insensitive' } } },
        { instructor: { name: { contains: search, mode: 'insensitive' } } },
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
        bookingType: true, price: true, platformFee: true, instructorPayout: true,
        pickupAddress: true, dropoffAddress: true, notes: true,
        isPaid: true, duration: true,
        clientName: true, clientPhone: true,
        instructor: { select: { id: true, name: true, phone: true } },
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

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

// PATCH — update booking status (mark complete, no-show, etc.)
export async function PATCH(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const { bookingId, status, noShowParty } = await req.json();
    if (!bookingId || !status) return NextResponse.json({ error: 'bookingId and status required' }, { status: 400 });

    const allowed = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING'];
    if (!allowed.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

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
        const partyLabel = noShowParty === 'instructor' ? 'INSTRUCTOR_NO_SHOW'
          : noShowParty === 'client' ? 'CLIENT_NO_SHOW'
          : 'DISPUTED';
        await (prisma as any).transaction.update({
          where: { id: txnId },
          data: { description: `[${partyLabel}] No-show recorded by admin` },
        });
      }
    }

    // AuditLog — every admin booking status change is recorded
    await prisma.auditLog.create({
      data: {
        action: status === 'COMPLETED' ? 'BOOKING_COMPLETED'
          : status === 'NO_SHOW' ? 'BOOKING_NO_SHOW'
          : status === 'CANCELLED' ? 'BOOKING_CANCELLED'
          : `BOOKING_STATUS_${status}`,
        actorId: admin.id,
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

// POST — admin creates a booking on behalf of a client
export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const { clientId, instructorId, startTime, endTime, notes } = await req.json();

    if (!clientId || !instructorId || !startTime || !endTime) {
      return NextResponse.json({ error: 'clientId, instructorId, startTime, endTime are required' }, { status: 400 });
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    const [client, instructor] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, phone: true, userId: true, email: true } }),
      prisma.instructor.findUnique({ where: { id: instructorId }, select: { id: true, name: true, hourlyRate: true, subscriptionTier: true } }),
    ]);

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!instructor) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    if (!client.userId) return NextResponse.json({ error: 'Client has no DriveBook account' }, { status: 422 });

    const durationHours = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);
    // Always calculate server-side — never accept client-supplied price
    const lessonPrice = parseFloat((instructor.hourlyRate * durationHours).toFixed(2));
    const { getPlatformFeeRate } = await import('@/lib/services/platform-pricing');
    const platformFeeRate = await getPlatformFeeRate();
    const platformFee = parseFloat((lessonPrice * (platformFeeRate / 100)).toFixed(2));
    const commissionRatePct = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC');
    const commissionRate = commissionRatePct / 100;
    const instructorPayout = parseFloat((lessonPrice * (1 - commissionRate)).toFixed(2));

    // Wallet check — use stored balance field (source of truth for display)
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: client.userId },
      select: { balance: true },
    });
    const balance = wallet ? Number(wallet.balance) : 0;
    if (balance < lessonPrice) {
      return NextResponse.json({
        error: `Insufficient balance. Client has $${balance.toFixed(2)}, needs $${lessonPrice.toFixed(2)}`,
        insufficientBalance: true,
        balance,
        required: lessonPrice,
      }, { status: 422 });
    }

    const booking = await prisma.$transaction(async (tx) => {
      const wallet = await tx.clientWallet.findUnique({ where: { userId: client.userId! } });
      if (!wallet) throw new Error('Wallet not found');

      // Deduct from stored balance field
      await tx.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: lessonPrice } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: lessonPrice,
          description: `Lesson booking (admin) — ${newStart.toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })}`,
          status: 'CONFIRMED',
        },
      });

      const newBooking = await tx.booking.create({
        data: {
          instructorId,
          clientId,
          clientName: client.name,
          clientPhone: client.phone,
          startTime: newStart,
          endTime: newEnd,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          instructorPayout,
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
  } catch (error) {
    console.error('Admin create booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to + 'T23:59:59');
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: 200,
      select: {
        id: true, startTime: true, endTime: true, status: true,
        bookingType: true, price: true, platformFee: true, instructorPayout: true,
        pickupAddress: true, dropoffAddress: true, notes: true,
        isPaid: true, duration: true,
        clientName: true, clientPhone: true,
        instructor: { select: { id: true, name: true, phone: true } },
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    // Client-side search filter (MongoDB doesn't support case-insensitive contains easily)
    const filtered = search
      ? bookings.filter(b => {
          const q = search.toLowerCase();
          return (
            (b.clientName || '').toLowerCase().includes(q) ||
            (b.client?.name || '').toLowerCase().includes(q) ||
            (b.client?.email || '').toLowerCase().includes(q) ||
            (b.instructor?.name || '').toLowerCase().includes(q) ||
            b.id.toLowerCase().includes(q)
          );
        })
      : bookings;

    const now = new Date();
    // Stats
    const stats = {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
      pending: bookings.filter(b => b.status === 'PENDING').length,
      completed: bookings.filter(b => b.status === 'COMPLETED').length,
      cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
      noShow: bookings.filter(b => b.status === 'NO_SHOW').length,
      // Lessons that have ended but are still CONFIRMED (eligible for payout)
      endedConfirmed: bookings.filter(b => b.status === 'CONFIRMED' && b.endTime != null && new Date(b.endTime) <= now).length,
    };

    return NextResponse.json({ bookings: filtered, stats });
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

    // If marking NO_SHOW, tag the transaction with who didn't show so Payouts can surface it
    if (status === 'NO_SHOW' && noShowParty) {
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
    const { clientId, instructorId, startTime, endTime, notes, price } = await req.json();

    if (!clientId || !instructorId || !startTime || !endTime) {
      return NextResponse.json({ error: 'clientId, instructorId, startTime, endTime are required' }, { status: 400 });
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    const [client, instructor] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, phone: true, userId: true, email: true } }),
      prisma.instructor.findUnique({ where: { id: instructorId }, select: { id: true, name: true, hourlyRate: true } }),
    ]);

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!instructor) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    if (!client.userId) return NextResponse.json({ error: 'Client has no DriveBook account' }, { status: 422 });

    const durationHours = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);
    const lessonPrice = price ?? parseFloat((instructor.hourlyRate * durationHours).toFixed(2));
    const platformFee = parseFloat((lessonPrice * 0.036).toFixed(2));
    const instructorPayout = parseFloat((lessonPrice * 0.85).toFixed(2));

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
          description: `Lesson booking (admin) — ${newStart.toLocaleDateString('en-AU')}`,
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
          commissionRate: 0.15,
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

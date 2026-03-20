import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // --- ELIGIBLE: lesson has ended, booking is CONFIRMED/COMPLETED (paid, delivered), transaction PENDING ---
    // Note: bookings stay CONFIRMED after payment — they are not separately marked COMPLETED.
    // Eligible = endTime has passed + booking not cancelled/no-show.
    const eligibleTransactions = await (prisma as any).transaction.findMany({
      where: {
        status: 'PENDING',
        type: 'BOOKING_PAYMENT',
        booking: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          endTime: { lte: now },
          deletedAt: null,
        },
      },
      include: {
        booking: {
          select: {
            id: true, startTime: true, endTime: true, status: true,
            duration: true, price: true, pickupAddress: true,
            clientName: true, clientPhone: true, notes: true,
            instructor: { select: { id: true, name: true, phone: true, stripeAccountId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // --- WITHHELD: cancelled bookings with partial/no refund (instructor still owed something) ---
    const cancelledTransactions = await (prisma as any).transaction.findMany({
      where: {
        status: 'PENDING',
        type: 'BOOKING_PAYMENT',
        booking: {
          status: { in: ['CANCELLED', 'NO_SHOW'] },
          deletedAt: null,
        },
      },
      include: {
        booking: {
          select: {
            id: true, startTime: true, endTime: true, status: true,
            duration: true, price: true, clientName: true, clientPhone: true,
            notes: true, isPackageBooking: true, pickupAddress: true,
            instructor: { select: { id: true, name: true, phone: true } },
            client: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // --- DISPUTES: transactions flagged in description ---
    const disputedTransactions = await (prisma as any).transaction.findMany({
      where: {
        status: 'PENDING',
        description: { contains: 'dispute', mode: 'insensitive' },
      },
      include: {
        booking: {
          select: {
            id: true, startTime: true, endTime: true, status: true,
            duration: true, price: true, clientName: true, clientPhone: true,
            notes: true, isPackageBooking: true, pickupAddress: true,
            instructor: { select: { id: true, name: true, phone: true } },
            client: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group eligible by instructor
    const byInstructor = new Map<string, any>();
    for (const t of eligibleTransactions) {
      const iid = t.instructorId;
      if (!byInstructor.has(iid)) {
        byInstructor.set(iid, {
          instructorId: iid,
          instructorName: t.booking.instructor.name,
          instructorPhone: t.booking.instructor.phone,
          stripeAccountId: t.booking.instructor.stripeAccountId,
          totalAmount: 0,
          transactionCount: 0,
          transactions: [],
        });
      }
      const g = byInstructor.get(iid);
      g.totalAmount += t.instructorPayout;
      g.transactionCount += 1;
      g.transactions.push({
        id: t.id,
        bookingId: t.bookingId,
        amount: t.amount,
        platformFee: t.platformFee,
        instructorPayout: t.instructorPayout,
        commissionRate: t.commissionRate,
        createdAt: t.createdAt,
        bookingDate: t.booking.startTime,
        bookingEndDate: t.booking.endTime,
        duration: t.booking.duration,
        clientName: t.booking.clientName,
        pickupAddress: t.booking.pickupAddress,
        description: t.description,
      });
    }

    const pendingPayouts = Array.from(byInstructor.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const totalPending = pendingPayouts.reduce((s, p) => s + p.totalAmount, 0);

    // Completed this month
    const completedAgg = await (prisma as any).transaction.aggregate({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: startOfMonth },
        type: 'BOOKING_PAYMENT',
      },
      _sum: { instructorPayout: true },
    });

    // No-show stats
    const noShowCount = await prisma.booking.count({
      where: { status: 'NO_SHOW', deletedAt: null } as any,
    });

    const cancelledCount = await prisma.booking.count({
      where: { status: 'CANCELLED', deletedAt: null } as any,
    });

    // Withheld amounts grouped by instructor
    const withheldByInstructor = new Map<string, any>();
    for (const t of cancelledTransactions) {
      const iid = t.instructorId;
      if (!withheldByInstructor.has(iid)) {
        withheldByInstructor.set(iid, {
          instructorId: iid,
          instructorName: t.booking.instructor.name,
          totalWithheld: 0,
          transactions: [],
        });
      }
      const g = withheldByInstructor.get(iid);
      g.totalWithheld += t.instructorPayout;
      g.transactions.push({
        id: t.id,
        bookingId: t.bookingId,
        bookingStatus: t.booking.status,
        amount: t.amount,
        platformFee: t.platformFee,
        instructorPayout: t.instructorPayout,
        bookingDate: t.booking.startTime,
        bookingEndDate: t.booking.endTime,
        duration: t.booking.duration,
        clientName: t.booking.clientName || t.booking.client?.name,
        clientPhone: t.booking.clientPhone || null,
        clientEmail: t.booking.client?.email || null,
        instructorPhone: t.booking.instructor?.phone || null,
        pickupAddress: t.booking.pickupAddress || null,
        notes: t.booking.notes || null,
        isPackageBooking: t.booking.isPackageBooking || false,
        description: t.description,
      });
    }

    return NextResponse.json({
      pendingPayouts,
      totalPending,
      completedThisMonth: completedAgg._sum.instructorPayout || 0,
      withheld: Array.from(withheldByInstructor.values()),
      totalWithheld: cancelledTransactions.reduce((s: number, t: any) => s + t.instructorPayout, 0),
      disputes: disputedTransactions.map((t: any) => ({
        id: t.id,
        bookingId: t.bookingId,
        instructorId: t.instructorId,
        instructorName: t.booking?.instructor?.name,
        instructorPhone: t.booking?.instructor?.phone || null,
        clientName: t.booking?.clientName || t.booking?.client?.name,
        clientPhone: t.booking?.clientPhone || null,
        clientEmail: t.booking?.client?.email || null,
        amount: t.amount,
        platformFee: t.platformFee,
        instructorPayout: t.instructorPayout,
        description: t.description,
        bookingDate: t.booking?.startTime,
        bookingEndDate: t.booking?.endTime,
        duration: t.booking?.duration,
        bookingStatus: t.booking?.status,
        pickupAddress: t.booking?.pickupAddress || null,
        notes: t.booking?.notes || null,
        isPackageBooking: t.booking?.isPackageBooking || false,
      })),
      stats: {
        noShowCount,
        cancelledCount,
        eligibleCount: eligibleTransactions.length,
        withheldCount: cancelledTransactions.length,
        disputeCount: disputedTransactions.length,
      },
    });
  } catch (error) {
    console.error('Payouts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}

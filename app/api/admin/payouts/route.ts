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
    const bufferCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Transactions already covered by an active or paid payout
    const coveredTxIds = await prisma.payoutTransaction.findMany({
      where: { payout: { status: { in: ['PAID', 'PROCESSING', 'PENDING_TRANSFER', 'SENT', 'ON_HOLD'] } } },
      select: { transactionId: true },
    });
    const excludeIds = coveredTxIds.map((p) => p.transactionId);

    const eligibleTransactions = await prisma.transaction.findMany({
      where: {
        status: 'SETTLED',
        type: 'BOOKING_PAYMENT',
        id: excludeIds.length ? { notIn: excludeIds } : undefined,
        booking: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          endTime: { lte: bufferCutoff },
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

    // WITHHELD: cancelled/no-show bookings with SETTLED transactions
    const cancelledTransactions = await prisma.transaction.findMany({
      where: {
        status: 'SETTLED',
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

    // DISPUTES: transactions flagged in description
    const disputedTransactions = await prisma.transaction.findMany({
      where: {
        status: 'SETTLED',
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

    // PENDING_TRANSFER payouts (bank/manual — approved, awaiting admin to send)
    const pendingTransferPayouts = await prisma.payout.findMany({
      where: { status: 'PENDING_TRANSFER' },
      orderBy: { updatedAt: 'asc' },
      include: {
        transactions: { select: { transactionId: true } },
      },
    });

    // SENT payouts (admin recorded bank ref, awaiting confirmation)
    const sentPayouts = await prisma.payout.findMany({
      where: { status: 'SENT' },
      orderBy: { sentAt: 'asc' },
      include: {
        transactions: { select: { transactionId: true } },
      },
    });

    // Enrich pending/sent with instructor name
    const manualPayoutInstructorIds = [
      ...pendingTransferPayouts.map((p) => p.instructorId),
      ...sentPayouts.map((p) => p.instructorId),
    ];
    const manualInstructors = manualPayoutInstructorIds.length
      ? await prisma.instructor.findMany({
          where: { id: { in: manualPayoutInstructorIds } },
          select: { id: true, name: true, phone: true, bankBsb: true, bankAccount: true, bankAccountName: true },
        })
      : [];
    const manualInstructorMap = new Map(manualInstructors.map((i) => [i.id, i]));

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
    const completedAgg = await prisma.payout.aggregate({
      where: { status: 'PAID', paidAt: { gte: startOfMonth } },
      _sum: { netAmount: true },
    });

    // Failed payouts
    const failedPayouts = await prisma.payout.findMany({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true, payoutRef: true, instructorId: true, netAmount: true,
        failureReason: true, retryCount: true, updatedAt: true,
      },
    });

    const noShowCount = await prisma.booking.count({
      where: { status: 'NO_SHOW', deletedAt: null } as any,
    });
    const cancelledCount = await prisma.booking.count({
      where: { status: 'CANCELLED', deletedAt: null } as any,
    });

    // Withheld grouped by instructor
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
      completedThisMonth: completedAgg._sum.netAmount || 0,
      failedPayouts,
      // Manual transfer queues
      pendingTransferPayouts: pendingTransferPayouts.map((p) => {
        const inst = manualInstructorMap.get(p.instructorId);
        return {
          id: p.id,
          payoutRef: p.payoutRef,
          instructorId: p.instructorId,
          instructorName: inst?.name ?? 'Unknown',
          instructorPhone: inst?.phone ?? null,
          bankBsb: inst?.bankBsb ?? null,
          bankAccount: inst?.bankAccount ?? null,
          bankAccountName: inst?.bankAccountName ?? null,
          grossAmount: p.grossAmount,
          taxWithheld: p.taxWithheld,
          netAmount: p.netAmount,
          payoutMethod: p.payoutMethod,
          transactionCount: p.transactions.length,
          createdAt: p.createdAt,
        };
      }),
      sentPayouts: sentPayouts.map((p) => {
        const inst = manualInstructorMap.get(p.instructorId);
        return {
          id: p.id,
          payoutRef: p.payoutRef,
          instructorId: p.instructorId,
          instructorName: inst?.name ?? 'Unknown',
          instructorPhone: inst?.phone ?? null,
          bankBsb: inst?.bankBsb ?? null,
          bankAccount: inst?.bankAccount ?? null,
          bankAccountName: inst?.bankAccountName ?? null,
          grossAmount: p.grossAmount,
          taxWithheld: p.taxWithheld,
          netAmount: p.netAmount,
          payoutMethod: p.payoutMethod,
          bankReference: p.bankReference,
          sentAt: p.sentAt,
          sentBy: p.sentBy,
          transactionCount: p.transactions.length,
          createdAt: p.createdAt,
        };
      }),
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
        pendingTransferCount: pendingTransferPayouts.length,
        sentCount: sentPayouts.length,
      },
    });
  } catch (error) {
    console.error('Payouts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}

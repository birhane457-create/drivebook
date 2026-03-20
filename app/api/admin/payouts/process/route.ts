import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instructorId, transactionIds } = await req.json();
    if (!instructorId) return NextResponse.json({ error: 'instructorId required' }, { status: 400 });

    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { name: true, phone: true },
    });
    if (!instructor) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });

    const now = new Date();

    // Build where clause — booking endTime has passed, CONFIRMED or COMPLETED (not cancelled)
    const where: any = {
      instructorId,
      status: 'PENDING',
      type: 'BOOKING_PAYMENT',
      booking: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: { lte: now },
        deletedAt: null,
      },
    };
    if (transactionIds?.length) where.id = { in: transactionIds };

    const transactions = await (prisma as any).transaction.findMany({ where });

    if (!transactions.length) {
      return NextResponse.json({ error: 'No eligible transactions for payout' }, { status: 400 });
    }

    const totalPayout = transactions.reduce((s: number, t: any) => s + t.instructorPayout, 0);
    const ids = transactions.map((t: any) => t.id);

    // Mark transactions COMPLETED — store payout reference in description
    const payoutRef = `PAYOUT-${Date.now()}`;
    await (prisma as any).transaction.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'COMPLETED',
        description: `Paid out ${payoutRef} by ${session.user.email || session.user.id}`,
      },
    });

    // SMS instructor
    if (instructor.phone) {
      try {
        await smsService.sendSMS({
          to: instructor.phone,
          message: `DriveBook: Payout of $${totalPayout.toFixed(2)} processed for ${transactions.length} lesson(s). Ref: ${payoutRef}`,
        });
      } catch (e) {
        console.error('SMS failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      instructorName: instructor.name,
      transactionCount: transactions.length,
      totalPayout,
      payoutRef,
      message: `Payout of $${totalPayout.toFixed(2)} processed for ${instructor.name}`,
    });
  } catch (error) {
    console.error('Payout process error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

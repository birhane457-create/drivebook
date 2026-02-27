import { NextRequest, NextResponse } from 'next/server';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Validate mobile token
    const auth = await validateMobileToken(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create wallet
    let wallet = await prisma.clientWallet.findUnique({
      where: { userId: auth.user!.id },
      include: {
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    } as any);

    if (!wallet) {
      wallet = await prisma.clientWallet.create({
        data: {
          userId: auth.user!.id,
          balance: 0,
          totalPaid: 0,
          totalSpent: 0,
          creditsRemaining: 0,
        },
        include: {
          transactions: true,
        },
      } as any);
    }

    // Get client records
    const clientRecords = await prisma.client.findMany({
      where: { userId: auth.user!.id },
      select: { id: true },
    });

    const clientIds = clientRecords.map((c) => c.id);

    // Get paid bookings
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: auth.user!.id },
          { clientId: { in: clientIds } },
        ],
        status: { in: ['COMPLETED', 'CONFIRMED'] },
        isPaid: true,
      },
      include: {
        instructor: {
          select: {
            name: true,
          },
        },
      },
    } as any);

    const totalSpent = bookings.reduce((sum: number, b) => sum + (b.price || 0), 0);
    const creditsRemaining = (wallet as any).totalPaid - totalSpent;

    // Calculate total hours
    const totalBookedHours = bookings.reduce((sum: number, b) => {
      const hours =
        b.duration ||
        (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) /
          (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    // Update wallet
    await prisma.clientWallet.update({
      where: { id: (wallet as any).id },
      data: {
        totalSpent,
        creditsRemaining,
      },
    });

    return NextResponse.json({
      id: (wallet as any).id,
      balance: (wallet as any).balance,
      totalPaid: (wallet as any).totalPaid,
      totalSpent,
      creditsRemaining,
      totalBookedHours,
      transactions: (wallet as any).transactions.map((t: any) => ({
        id: t.id,
        date: t.createdAt,
        amount: t.amount,
        description: t.description,
        status: t.status,
        type: t.type,
      })),
    });
  } catch (error) {
    console.error('Error fetching client wallet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

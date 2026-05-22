import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        instructor: {
          select: {
            id: true,
            name: true,
            approvalStatus: true,
            subscriptionTier: true,
            abn: true,
            abnVerified: true,
            withholdingTaxRate: true,
          },
        },
        wallet: {
          select: {
            balance: true,
            transactions: {
              select: { id: true },
              where: { status: 'CONFIRMED' },
            },
          },
        },
        clients: {
          select: {
            id: true,
            bookings: { select: { id: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const bookingCount = user.clients.reduce((sum, c) => sum + c.bookings.length, 0);
    const walletBalance = user.wallet?.balance ?? 0;
    const txCount = user.wallet?.transactions?.length ?? 0;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      instructor: user.instructor || null,
      wallet: user.wallet ? { balance: walletBalance, transactionCount: txCount } : null,
      bookingCount,
      // Expose the first client record ID for wallet credit operations
      clientId: user.clients.length > 0 ? user.clients[0].id : null,
    });
  } catch (error) {
    console.error('Admin get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

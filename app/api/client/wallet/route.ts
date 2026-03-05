import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get or create wallet
    let wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: {
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!wallet) {
      wallet = await prisma.clientWallet.create({
        data: {
          userId: user.id,
          balance: 0,
          creditsRemaining: 0,
          totalPaid: 0,
          totalSpent: 0
        },
        include: {
          transactions: true
        }
      });
    }

    // Calculate from wallet transactions
    const transactions = wallet.transactions || [];
    
    // Total Credits Added = all credits (money paid by user)
    const totalPaid = transactions
      .filter(t => t.type.toUpperCase() === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Total Spent = all debits (booking charges)
    const totalSpent = transactions
      .filter(t => t.type.toUpperCase() === 'DEBIT')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Calculate actual remaining balance
    const creditsRemaining = totalPaid - totalSpent;

    // Get all confirmed/completed bookings for this user to calculate hours
    const clientRecords = await prisma.client.findMany({
      where: { userId: user.id },
      select: { id: true }
    });

    const clientIds = clientRecords.map(c => c.id);

    const bookings = await prisma.booking.findMany({
      where: {
        clientId: { in: clientIds },
        status: { in: ['COMPLETED', 'CONFIRMED', 'PENDING'] }
      }
    });

    // Calculate total booked hours
    const totalBookedHours = bookings.reduce((sum, b) => {
      const hours = b.duration || (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    return NextResponse.json({
      id: wallet.id,
      balance: creditsRemaining,
      totalPaid: Number(totalPaid),
      totalSpent: Number(totalSpent),
      creditsRemaining: creditsRemaining,
      totalBookedHours,
      transactions: wallet.transactions,
      bookingsCount: bookings.length
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

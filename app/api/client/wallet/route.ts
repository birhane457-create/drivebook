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

    // Get or create wallet (no stored balance fields – everything is derived from transactions)
    let wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: {
        // Fetch ALL confirmed transactions — no take limit, balance must be exact
        transactions: {
          where: { status: 'CONFIRMED' },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!wallet) {
      wallet = await prisma.clientWallet.create({
        data: {
          userId: user.id
        },
        include: {
          transactions: {
            where: { status: 'CONFIRMED' },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    }

    // Calculate from wallet transactions (only CONFIRMED)
    const transactions = wallet.transactions || [];
    
    // Total Credits Added = all CONFIRMED credits (money paid by user)
    const totalPaid = transactions
      .filter(t => t.type.toUpperCase() === 'CREDIT' && t.status === 'CONFIRMED')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Total Spent = all CONFIRMED debits (booking charges)
    const totalSpent = transactions
      .filter(t => t.type.toUpperCase() === 'DEBIT' && t.status === 'CONFIRMED')
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
      transactions: wallet.transactions.slice(0, 10), // last 10 for display only
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

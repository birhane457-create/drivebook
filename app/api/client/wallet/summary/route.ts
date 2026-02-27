import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      include: {
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }
        },
        bookings: {
          include: { instructor: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get wallet or create default
    const wallet = user.wallet;
    const bookings = user.bookings || [];
    
    if (!wallet) {
      return NextResponse.json({
        wallet: {
          totalPaid: 0,
          totalSpent: 0,
          creditsRemaining: 0,
          transactionCount: 0,
          lastUpdated: new Date(),
          accountStatus: 'zero-balance'
        },
        recentTransactions: [],
        summary: {
          packagesCount: 0,
          activePackagesCount: 0,
          totalHoursRemaining: 0,
          completedLessons: bookings.filter((b: any) => b.status === 'COMPLETED').length
        }
      });
    }

    // Calculate from wallet transactions
    const transactions = wallet.transactions || [];
    const totalPaid = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalSpent = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const creditsRemaining = wallet.balance;

    const totalBookedHours = bookings.reduce((sum: number, b: any) => {
      const duration = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    return NextResponse.json({
      wallet: {
        totalPaid: Number(totalPaid),
        totalSpent: Number(totalSpent),
        creditsRemaining: Number(creditsRemaining),
        transactionCount: transactions.length,
        lastUpdated: wallet.updatedAt,
        accountStatus: creditsRemaining > 0 ? 'active' : creditsRemaining === 0 ? 'zero-balance' : 'negative'
      },
      recentTransactions: transactions.map((t: any) => ({
        id: t.id,
        date: t.createdAt,
        description: t.description,
        amount: t.type === 'CREDIT' ? t.amount : -t.amount,
        type: t.type,
        status: 'completed'
      })),
      summary: {
        packagesCount: Math.ceil(bookings.filter((b: any) => b.status !== 'CANCELLED').length / 2),
        activePackagesCount: bookings.filter((b: any) => b.status === 'PENDING' || b.status === 'CONFIRMED').length,
        totalHoursRemaining: Math.max(0, totalBookedHours),
        completedLessons: bookings.filter((b: any) => b.status === 'COMPLETED').length
      }
    });

  } catch (error) {
    console.error('Get wallet summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
      include: {
        wallet: {
          include: {
            // Fetch ALL confirmed transactions for accurate balance calculation.
            // No take limit — a capped query would produce a wrong balance.
            transactions: {
              where: { status: 'CONFIRMED' },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        clients: {
          include: { 
            bookings: {
              include: { instructor: true }
            }
          }
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
    
    // Get bookings from all client records
    const bookings = user.clients?.flatMap(c => c.bookings) || [];
    
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
      .filter((t: any) => t.type === 'CREDIT' && t.status === 'CONFIRMED')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    
    const totalSpent = transactions
      .filter((t: any) => t.type === 'DEBIT' && t.status === 'CONFIRMED')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    
    // ✅ P0 FIX #2: Calculate balance from transactions (single source of truth)
    const creditsRemaining = totalPaid - totalSpent;

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
      recentTransactions: transactions.slice(0, 10).map((t: any) => ({
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

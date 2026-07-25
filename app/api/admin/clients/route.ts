import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin role — use session role directly (authOptions ensures correct decoding)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url)

    // C-10 fix: stats=true returns DB-level aggregates instead of page-slice calculations.
    // The credits page was calling GET /api/admin/clients (25 rows) and summing totals
    // client-side — giving wrong numbers for platforms with more than 25 clients.
    if (searchParams.get('stats') === 'true') {
      const [walletAgg, debitAgg, positiveCount, zeroCount, negativeCount, totalClients] = await Promise.all([
        prisma.clientWallet.aggregate({ _sum: { balance: true } }),
        prisma.walletTransaction.aggregate({
          where: { type: 'DEBIT', status: 'CONFIRMED' },
          _sum: { amount: true },
        }),
        prisma.clientWallet.count({ where: { balance: { gt: 0 } } }),
        prisma.clientWallet.count({ where: { balance: 0 } }),
        prisma.clientWallet.count({ where: { balance: { lt: 0 } } }),
        prisma.client.count(),
      ]);
      return NextResponse.json({
        stats: {
          totalWalletBalance: Number(walletAgg._sum.balance ?? 0),
          totalDebitAmount: Number(debitAgg._sum.amount ?? 0),
          clientsWithPositiveBalance: positiveCount,
          clientsWithZeroBalance: zeroCount,
          clientsWithNegativeBalance: negativeCount,
          totalClients,
        },
      });
    }

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const skip = (page - 1) * limit

    // Get total count
    const total = await prisma.client.count()

    // Get all clients with wallet data
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        userId: true,
        instructorId: true,
        bookings: {
          select: { id: true, status: true, price: true }
        },
        user: {
          select: {
            wallet: {
              select: {
                balance: true,
                transactions: {
                  select: { amount: true, type: true, description: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    // Format response with calculations
    const formattedUsers = clients.map((client: any) => {
      const wallet = client.user?.wallet;
      const transactions = wallet?.transactions || [];
      const bookings = client.bookings || [];
      
      // Count all CREDIT transactions to wallet (manual adds, refunds, etc)
      const walletCredits = transactions
        .filter((t: any) => 
          t.type.toUpperCase() === 'CREDIT' && 
          !t.description?.toLowerCase().includes('duration reduction') &&
          !t.description?.toLowerCase().includes('refund') &&
          !t.description?.toLowerCase().includes('cancel')
        )
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      // Count booking payments (money paid for bookings)
      const bookingPayments = bookings
        .filter((b: any) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
        .reduce((sum: number, b: any) => sum + (b.price || 0), 0);
      
      // Total paid = wallet credits + booking payments
      const totalPaid = walletCredits + bookingPayments;
      
      // Net Booking Costs = booking charges minus cancellation refunds
      const bookingCharges = transactions
        .filter((t: any) => 
          t.type.toUpperCase() === 'DEBIT' && 
          !t.description?.toLowerCase().includes('duration increase')
        )
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
      
      const cancellationRefunds = transactions
        .filter((t: any) => 
          t.type.toUpperCase() === 'CREDIT' && 
          (t.description?.toLowerCase().includes('refund') || 
           t.description?.toLowerCase().includes('cancel'))
        )
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
      
      const totalSpent = bookingCharges - cancellationRefunds;
      
      const balance = wallet?.balance || 0;
      const totalBookings = bookings.length;

      return {
        id: client.id,
        userId: client.userId,
        name: client.name,
        email: client.email,
        createdAt: client.createdAt,
        totalPaid: Number(totalPaid),
        totalSpent: Number(totalSpent),
        creditsRemaining: Number(balance),
        bookingCount: totalBookings,
        status: balance > 0 ? 'active' : balance === 0 ? 'zero-balance' : 'negative'
      };
    });

    return NextResponse.json({
      clients: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin clients fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

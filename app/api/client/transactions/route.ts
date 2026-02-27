import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

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
              take: 100
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

    if (!user.wallet) {
      return NextResponse.json({
        transactions: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0
        }
      });
    }

    // Format transactions
    const transactions = user.wallet.transactions.map(t => ({
      id: t.id,
      date: t.createdAt,
      description: t.description,
      amount: t.type === 'CREDIT' || t.type === 'REFUND' ? t.amount : -t.amount,
      type: t.type,
      status: t.status || 'completed',
      displayAmount: `${t.type === 'CREDIT' || t.type === 'REFUND' ? '+' : '-'}$${Math.abs(t.amount).toFixed(2)}`
    }));

    // Pagination
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 100);
    const total = transactions.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(start, start + limit);

    return NextResponse.json({
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

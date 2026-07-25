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

    // Issue 6 fix: ensure only CLIENT role can access their own wallet
    if (session.user.role !== 'CLIENT') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
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
    });

    if (!wallet) {
      wallet = await prisma.clientWallet.create({
        data: { userId: user.id },
      });
    }

    // NF-05: Compute balance via aggregate — avoids loading every transaction ever created.
    // getWalletBalance() from wallet-helpers would be ideal but requires a refetch;
    // aggregate is cheaper and equivalent for a single endpoint.
    const creditAgg = await prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, status: 'CONFIRMED', type: 'CREDIT' },
      _sum: { amount: true },
    });
    const debitAgg = await prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, status: 'CONFIRMED', type: 'DEBIT' },
      _sum: { amount: true },
    });

    const totalPaid = Number(creditAgg._sum.amount ?? 0);
    const totalSpent = Number(debitAgg._sum.amount ?? 0);
    const creditsRemaining = totalPaid - totalSpent;

    // Recent transactions for display — capped at 20, no need to load all
    const recentTransactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, status: 'CONFIRMED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // NF-06: removed totalBookedHours — it was computed here but never rendered in the wallet UI

    return NextResponse.json({
      id: wallet.id,
      balance: creditsRemaining,
      totalPaid: Number(totalPaid),
      totalSpent: Number(totalSpent),
      creditsRemaining: creditsRemaining,
      transactions: recentTransactions.slice(0, 10), // last 10 for display
      bookingsCount: 0, // removed — was computing totalBookedHours which is unused
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

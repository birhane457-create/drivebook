import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { TransactionType } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    
    // Check admin role
    const admin = await prisma.user.findUnique({
      where: { email: session?.user?.email || '' },
      select: { role: true, id: true }
    });

    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { amount, reason } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // The ID could be either a client ID or user ID
    // Try to find client first, then get user
    let userId: string | null = null;
    
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: { userId: true }
    });
    
    if (client) {
      userId = client.userId;
    } else {
      // Maybe it's a user ID directly
      userId = params.id;
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Client has no associated user account' }, { status: 404 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update or create wallet
    const wallet = await prisma.clientWallet.upsert({
      where: { userId: user.id },
      update: { 
        balance: { increment: amount }
      },
      create: {
        userId: user.id,
        balance: amount
      }
    });

    // Create wallet transaction record
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: amount,
        description: reason || `Manual credit added by admin`,
        status: 'COMPLETED'
      }
    });

    // Create ledger entry
    // Note: LedgerEntry model not available, using wallet transactions only

    return NextResponse.json({
      success: true,
      message: `Added $${amount} to ${user?.email}'s wallet`,
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance)
      }
    });
  } catch (error) {
    console.error('Add credit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

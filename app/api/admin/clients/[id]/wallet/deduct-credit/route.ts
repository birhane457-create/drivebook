import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, reason } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Find user by client ID or user ID
    let user = await prisma.user.findUnique({
      where: { id: params.id },
      include: { clients: true }
    });

    if (!user) {
      const client = await prisma.client.findUnique({
        where: { id: params.id },
        include: { user: { include: { clients: true } } }
      });
      user = client?.user || null;
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create wallet
    let wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id }
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Check if wallet has enough balance
    if (wallet.balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // Deduct from wallet balance
    await prisma.clientWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: amount }
      }
    });

    // Create wallet transaction
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: 'DEBIT',
        description: reason || 'Manual deduction by admin',
        status: 'completed'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deduct credit error:', error);
    return NextResponse.json(
      { error: 'Failed to deduct credit' },
      { status: 500 }
    );
  }
}

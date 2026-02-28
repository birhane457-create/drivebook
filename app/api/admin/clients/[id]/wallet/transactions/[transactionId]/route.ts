import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
// PATCH - Edit transaction
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, description } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get the transaction
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: params.transactionId }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Calculate the difference
    const amountDiff = amount - transaction.amount;

    // Update transaction
    await prisma.walletTransaction.update({
      where: { id: params.transactionId },
      data: {
        amount,
        description: description || transaction.description
      }
    });

    // Adjust wallet balance based on transaction type
    if (amountDiff !== 0) {
      const wallet = await prisma.clientWallet.findUnique({
        where: { id: transaction.walletId }
      });

      if (wallet) {
        const balanceAdjustment = transaction.type === 'CREDIT' || transaction.type === 'REFUND'
          ? amountDiff
          : -amountDiff;

        await prisma.clientWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: balanceAdjustment }
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Edit transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to edit transaction' },
      { status: 500 }
    );
  }
}

// DELETE - Delete transaction
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the transaction
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: params.transactionId }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Delete transaction
    await prisma.walletTransaction.delete({
      where: { id: params.transactionId }
    });

    // Adjust wallet balance
    const wallet = await prisma.clientWallet.findUnique({
      where: { id: transaction.walletId }
    });

    if (wallet) {
      const balanceAdjustment = transaction.type === 'CREDIT' || transaction.type === 'REFUND'
        ? -transaction.amount
        : transaction.amount;

      await prisma.clientWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: balanceAdjustment }
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}

/**
 * Wallet Helper Functions
 * 
 * ✅ P0 FIX #2: Single source of truth for wallet balance
 * All balance calculations are done from WalletTransaction records
 * This prevents drift between stored and calculated values
 */

import { prisma } from '@/lib/prisma';

/**
 * Calculate wallet balance from transactions
 * This is the ONLY way to get wallet balance
 */
export async function getWalletBalance(userId: string): Promise<{
  totalPaid: number;
  totalSpent: number;
  balance: number;
}> {
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        where: { status: 'CONFIRMED' }
      }
    }
  });

  if (!wallet) {
    return { totalPaid: 0, totalSpent: 0, balance: 0 };
  }

  const totalPaid = wallet.transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = wallet.transactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalPaid - totalSpent;

  return { totalPaid, totalSpent, balance };
}

/**
 * Get or create wallet for user
 */
export async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.clientWallet.findUnique({
    where: { userId }
  });

  if (!wallet) {
    wallet = await prisma.clientWallet.create({
      data: { userId }
    });
  }

  return wallet;
}

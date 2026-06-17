/**
 * Wallet Helper Functions
 *
 * SOURCE OF TRUTH: Wallet balance is ALWAYS derived from WalletTransaction records.
 * The `ClientWallet.balance` stored field is kept in sync as a performance cache
 * but is NEVER the authoritative source. Always use getWalletBalance() to read.
 *
 * Write pattern (enforced everywhere):
 *   1. Create WalletTransaction (CREDIT or DEBIT, status: CONFIRMED)
 *   2. Update ClientWallet.balance with matching increment/decrement
 *   Both steps MUST be inside the same $transaction to prevent drift.
 */

import { prisma } from '@/lib/prisma'

/**
 * Calculate wallet balance from WalletTransaction ledger records.
 * This is the ONLY authoritative way to read balance.
 * The stored ClientWallet.balance field is a cache — do not trust it directly.
 */
export async function getWalletBalance(userId: string): Promise<{
  totalPaid: number
  totalSpent: number
  balance: number
}> {
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        where: { status: 'CONFIRMED' },
      },
    },
  })

  if (!wallet) {
    return { totalPaid: 0, totalSpent: 0, balance: 0 }
  }

  const totalPaid = wallet.transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalSpent = wallet.transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0)

  const balance = totalPaid - totalSpent

  return { totalPaid, totalSpent, balance }
}

/**
 * Get or create wallet for user.
 */
export async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.clientWallet.findUnique({ where: { userId } })
  if (!wallet) {
    wallet = await prisma.clientWallet.create({ data: { userId } })
  }
  return wallet
}

/**
 * Reconcile the stored ClientWallet.balance field against the ledger.
 *
 * Returns the discrepancy (storedBalance - ledgerBalance).
 * If non-zero, corrects the stored field.
 *
 * Call this:
 *   - In the admin wallet audit endpoint
 *   - Before any large payout calculation
 *   - As a scheduled cron (weekly)
 *
 * Never throws — logs and returns drift amount even if correction fails.
 */
export async function reconcileWalletBalance(userId: string): Promise<{
  userId: string
  storedBalance: number
  ledgerBalance: number
  drift: number
  corrected: boolean
}> {
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId },
    include: { transactions: { where: { status: 'CONFIRMED' } } },
  })

  if (!wallet) {
    return { userId, storedBalance: 0, ledgerBalance: 0, drift: 0, corrected: false }
  }

  const totalPaid   = wallet.transactions.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
  const totalSpent  = wallet.transactions.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
  const ledgerBalance  = totalPaid - totalSpent
  const storedBalance  = Number(wallet.balance)
  const drift          = parseFloat((storedBalance - ledgerBalance).toFixed(2))

  if (Math.abs(drift) < 0.01) {
    // Within floating-point rounding tolerance — no correction needed
    return { userId, storedBalance, ledgerBalance, drift: 0, corrected: false }
  }

  // Drift detected — correct the stored field and log it
  try {
    await prisma.$transaction(async (tx) => {
      await tx.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: ledgerBalance },
      })

      // Audit trail for the correction
      await (tx as any).auditLog.create({
        data: {
          action: 'WALLET_BALANCE_CORRECTED',
          actorId: 'SYSTEM',
          actorRole: 'SYSTEM',
          targetType: 'CLIENT_WALLET',
          targetId: wallet.id,
          metadata: { userId, storedBalance, ledgerBalance, drift },
          success: true,
        },
      })
    })

    console.warn(`[wallet] Balance drift corrected for user ${userId}: stored=${storedBalance} ledger=${ledgerBalance} drift=${drift}`)
    return { userId, storedBalance, ledgerBalance, drift, corrected: true }
  } catch (err) {
    console.error(`[wallet] Balance correction failed for user ${userId}:`, err)
    return { userId, storedBalance, ledgerBalance, drift, corrected: false }
  }
}


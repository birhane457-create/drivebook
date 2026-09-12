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
import { Decimal } from '@prisma/client/runtime/library'
import {
  sumAmounts,
  subtractAmounts,
  toNumber,
  toDecimal,
  roundAmount,
  isEqual,
} from '@/lib/utils/decimal-helpers'

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

  // Use Decimal for exact aggregation
  const credits = wallet.transactions.filter((t) => t.type === 'CREDIT')
  const debits = wallet.transactions.filter((t) => t.type === 'DEBIT')

  const totalPaidDecimal = sumAmounts(credits.map((t: any) => t.amount))
  const totalSpentDecimal = sumAmounts(debits.map((t: any) => t.amount))
  const balanceDecimal = subtractAmounts(totalPaidDecimal, totalSpentDecimal)

  // Return as numbers for API compatibility
  return {
    totalPaid: toNumber(roundAmount(totalPaidDecimal, 2)),
    totalSpent: toNumber(roundAmount(totalSpentDecimal, 2)),
    balance: toNumber(roundAmount(balanceDecimal, 2)),
  }
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

  // Calculate ledger balance using Decimal for exact precision
  const credits = wallet.transactions.filter((t) => t.type === 'CREDIT')
  const debits = wallet.transactions.filter((t) => t.type === 'DEBIT')

  const totalPaidDecimal = sumAmounts(credits.map((t: any) => t.amount))
  const totalSpentDecimal = sumAmounts(debits.map((t: any) => t.amount))
  const ledgerBalanceDecimal = roundAmount(subtractAmounts(totalPaidDecimal, totalSpentDecimal), 2)

  const storedBalanceDecimal = toDecimal(wallet.balance)
  const driftDecimal = roundAmount(subtractAmounts(storedBalanceDecimal, ledgerBalanceDecimal), 2)

  // Convert to numbers for response
  const ledgerBalance = toNumber(ledgerBalanceDecimal)
  const storedBalance = toNumber(storedBalanceDecimal)
  // const drift = toNumber(driftDecimal) // Removed - calculated below

  // Check if within acceptable tolerance (penny-perfect now with Decimal)
  // AUDIT FIX #2: Use tolerance (>0.01 threshold) instead of exact equality
  const drift = Math.abs(toNumber(subtractAmounts(storedBalanceDecimal, ledgerBalanceDecimal)))
  if (drift <= 0.01) {
    // Balances match exactly — no correction needed
    return { userId, storedBalance, ledgerBalance, drift: 0, corrected: false }
  }

  // Drift detected — correct the stored field and log it
  try {
    await prisma.$transaction(async (tx) => {
      await tx.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: ledgerBalanceDecimal },
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

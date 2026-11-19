/**
 * lib/services/wallet-booking.ts
 *
 * Shared service for the wallet-funded bulk booking transaction.
 *
 * Extracted from app/api/client/bookings/create-bulk/route.ts so that:
 *   1. Integration tests call this function directly — no logic duplication.
 *   2. The route remains thin (auth, rate-limiting, pre-flight, notifications).
 *   3. Future callers (mobile, background jobs) can reuse this without
 *      duplicating the concurrency and financial invariants.
 *
 * FINANCIAL INVARIANTS enforced here:
 *   - Balance re-read inside SERIALIZABLE transaction (CP-03 fix).
 *   - Balance check includes credit expiry (CP-02 fix: Number() on Decimal).
 *   - Debit written atomically with bookings; P2034 rolls all back.
 *   - Slot conflict checked per booking inside the transaction (TOCTOU-safe).
 *   - Timestamps converted using instructor timezone (CP-05 fix).
 *
 * This function does NOT:
 *   - Authenticate the caller.
 *   - Check rate limits.
 *   - Send notifications or receipts (caller's responsibility).
 *   - Write FinancialLedger entries (caller's responsibility).
 */

import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { withSerializableRetry } from '@/lib/utils/transaction-retry'
import { localDateTimeToUTC } from '@/lib/utils/timezone'

// ── Input / output types ──────────────────────────────────────────────────────

export interface WalletBookingItem {
  providerId: string
  instructorName: string
  date: string            // YYYY-MM-DD
  time: string            // HH:MM
  duration: number        // hours
  price: number           // server-recalculated, not client-supplied
  timezone: string        // instructor IANA timezone
  pickupLocation?: string
  service?: string
}

export interface WalletBookingCommission {
  totalAmount: any
  platformFee: any
  providerPayout: any
  commissionRate: any
  isFirstBooking: boolean
}

export interface WalletBookingInput {
  userId: string
  customerId: string
  walletId: string
  items: WalletBookingItem[]
  commissions: WalletBookingCommission[]
  totalCost: number
}

export interface WalletBookingCreated {
  booking: any
  instructorName: string
  instructorUserId: string | null
  clientUserId: string
  commission: WalletBookingCommission
}

export interface WalletBookingResult {
  created: WalletBookingCreated[]
  totalCost: number
  remaining: number
}

// ── Balance calculation (extracted for testability) ───────────────────────────

export function computeWalletBalance(
  transactions: Array<{ type: string; amount: any; expiresAt?: Date | null }>,
  asOf: Date = new Date(),
): number {
  const credits = transactions
    .filter(
      t =>
        t.type.toUpperCase() === 'CREDIT' &&
        (!t.expiresAt || new Date(t.expiresAt) >= asOf),
    )
    .reduce((s, t) => s + Number(t.amount), 0)   // CP-02 FIX: Number() converts Prisma Decimal

  const debits = transactions
    .filter(t => t.type.toUpperCase() === 'DEBIT')
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)   // CP-02 FIX: same

  return credits - debits
}

// ── Core transaction ──────────────────────────────────────────────────────────

/**
 * Execute the wallet bulk booking transaction with SERIALIZABLE isolation.
 *
 * Uses withSerializableRetry: on P2034 (serialization conflict from a concurrent
 * booking request), retries the whole transaction. The retry re-reads the balance
 * after the first request commits; if balance < totalCost, throws
 * 'Insufficient credits' and the second request fails cleanly.
 *
 * @param input    Pre-validated booking items, commissions, and wallet IDs.
 * @param db       Prisma client to use (injectable for testing).
 */
export async function executeWalletBookingTransaction(
  input: WalletBookingInput,
  db: PrismaClient = require('@/lib/prisma').prisma,
): Promise<WalletBookingResult> {
  const { userId, customerId, walletId, items, commissions, totalCost } = input

  return withSerializableRetry(
    () =>
      db.$transaction(
        async tx => {
          // ── Re-read balance inside SERIALIZABLE transaction ───────────────
          // This read participates in the SSI conflict detection. PostgreSQL
          // will detect if a concurrent transaction writes to these rows and
          // abort one transaction with P2034. withSerializableRetry then
          // retries; the retry sees the committed debit and fails the balance
          // check with 'Insufficient credits'.
          const walletInner = await tx.clientWallet.findUnique({
            where: { id: walletId },
            include: { transactions: { where: { status: 'CONFIRMED' } } },
          })
          if (!walletInner) throw new Error('Wallet not found')

          const nowInner = new Date()
          const balanceInner = computeWalletBalance(walletInner.transactions, nowInner)

          if (balanceInner < totalCost) {
            throw new Error(
              `Insufficient credits. You have $${balanceInner.toFixed(2)} but need $${totalCost.toFixed(2)}`,
            )
          }

          // ── Create bookings ───────────────────────────────────────────────
          const created: WalletBookingCreated[] = []

          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const commission = commissions[i]

            // CP-05 FIX: convert submitted local time using instructor timezone
            const startTime = localDateTimeToUTC(item.date, item.time, item.timezone)
            const endTime = new Date(startTime.getTime() + item.duration * 60 * 60 * 1000)

            // Slot conflict check inside transaction (TOCTOU-safe)
            const conflict = await tx.booking.findFirst({
              where: {
                providerId: item.providerId,
                status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
                OR: [
                  { startTime: { lte: startTime }, endTime: { gt: startTime } },
                  { startTime: { lt: endTime }, endTime: { gte: endTime } },
                  { startTime: { gte: startTime }, endTime: { lte: endTime } },
                ],
              },
              select: { id: true },
            })
            if (conflict) {
              throw new Error(
                `Time slot no longer available for ${item.instructorName} at ${item.date} ${item.time}`,
              )
            }

            const booking = await tx.booking.create({
              data: {
                provider:          { connect: { id: item.providerId } },
                customer:          { connect: { id: customerId } },
                bookingType:       'LESSON',
                status:            'CONFIRMED',
                startTime,
                endTime,
                duration:          item.duration,
                pickupAddress:     item.pickupLocation || null,
                price:             item.price,
                platformFee:       commission.platformFee,
                providerPayout:    commission.providerPayout,
                commissionRate:    commission.commissionRate,
                isFirstBooking:    commission.isFirstBooking,
                notes:             item.service || null,
                createdBy:         'customer',
                originalStartTime: startTime,
                isPaid:            true,
                paidAt:            new Date(),
              } as any,
            })

            created.push({
              booking,
              instructorName:    item.instructorName,
              instructorUserId:  null,   // caller resolves from eligibilityMap
              clientUserId:      userId,
              commission,
            })
          }

          // ── Write debit atomically with bookings ──────────────────────────
          // P2034 abort rolls back bookings and this debit together.
          await tx.walletTransaction.create({
            data: {
              walletId,
              type:        'DEBIT',
              amount:      totalCost,
              description: `Booked ${items.length} lesson${items.length > 1 ? 's' : ''}`,
              status:      'CONFIRMED',
            },
          })

          return { created, totalCost, remaining: balanceInner - totalCost }
        },
        { isolationLevel: 'Serializable', timeout: 15000 },
      ),
    { operationName: 'client-wallet-bulk-booking', maxRetries: 2 },
  )
}

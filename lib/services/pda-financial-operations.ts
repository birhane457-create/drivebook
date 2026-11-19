import { createHash } from 'crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withSerializableRetry } from '@/lib/utils/transaction-retry'
import { recordPdaFundsRefund } from '@/lib/services/ledger-operations'
import { AccountType, buildAccount } from '@/lib/services/ledger'
import { getLocalDateKey, localDateTimeToUTC, resolveTimezone } from '@/lib/utils/timezone'

export class PdaRefundConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdaRefundConflictError'
  }
}

function stableRefundWalletTransactionId(idempotencyKey: string): string {
  return `pda-refund-${createHash('sha256').update(idempotencyKey).digest('hex')}`
}

function includesPdaBooking(metadata: Prisma.JsonValue, pdaBookingId: string): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const ids = (metadata as Prisma.JsonObject).pdaBookingIds
  return Array.isArray(ids) && ids.includes(pdaBookingId)
}

async function loadRefund(idempotencyKey: string, db: PrismaClient) {
  return db.pDARefund.findUnique({
    where: { idempotencyKey },
    include: { pdaBooking: true, refundWalletTransaction: true },
  })
}

async function finishPdaRefund(refundId: string, db: PrismaClient) {
  const refund = await db.pDARefund.findUnique({
    where: { id: refundId },
    include: {
      pdaBooking: { include: { customer: { select: { userId: true } } } },
      originalWalletTransaction: true,
      refundWalletTransaction: true,
    },
  })
  if (!refund) throw new Error('PDA refund record not found')
  if (refund.amount.isZero()) return
  if (!refund.refundWalletTransaction || !refund.pdaBooking.customer.userId) {
    throw new Error('PDA refund is missing its wallet or customer reference')
  }

  await recordPdaFundsRefund({
    refundId: refund.id,
    pdaBookingId: refund.pdaBookingId,
    customerId: refund.pdaBooking.customerId,
    userId: refund.pdaBooking.customer.userId,
    providerId: refund.pdaBooking.providerId,
    originalWalletTransactionId: refund.originalWalletTransactionId,
    refundWalletTransactionId: refund.refundWalletTransactionId!,
    amount: refund.amount,
    currency: refund.currency,
    createdBy: refund.pdaBooking.customer.userId,
  })

  await withSerializableRetry(
    () => db.$transaction(async tx => {
      await tx.pDARefund.update({
        where: { id: refund.id },
        data: { status: 'COMPLETED' },
      })
      const aggregate = await tx.pDARefund.aggregate({
        where: { pdaBookingId: refund.pdaBookingId, status: 'COMPLETED' },
        _sum: { amount: true },
      })
      const totalRefunded = aggregate._sum.amount ?? new Prisma.Decimal(0)
      const financialStatus = totalRefunded.greaterThanOrEqualTo(refund.pdaBooking.price)
        ? 'REFUNDED'
        : 'PARTIALLY_REFUNDED'
      await tx.pDATestBooking.update({
        where: { id: refund.pdaBookingId },
        data: { financialStatus },
      })
    }, { isolationLevel: 'Serializable' }),
    { operationName: 'pda-wallet-refund-completion', maxRetries: 2 },
  )
}

async function calculateCancellationRefund(
  booking: {
    testDate: Date
    testTime: string
    price: Prisma.Decimal
    provider: { timezone: string | null }
  },
  db: PrismaClient,
) {
  const settings = await db.platformSettings.findFirst({
    select: { lateCancellationWindowHours: true },
  })
  const lateWindowHours = Number(settings?.lateCancellationWindowHours ?? 24)
  const fullRefundWindow = lateWindowHours * 2
  const date = getLocalDateKey(booking.testDate, resolveTimezone(booking.provider.timezone))
  const start = localDateTimeToUTC(
    date,
    booking.testTime.padStart(5, '0'),
    resolveTimezone(booking.provider.timezone),
  )
  const hoursNotice = (start.getTime() - Date.now()) / 3_600_000

  if (hoursNotice < lateWindowHours) return new Prisma.Decimal(0)
  if (hoursNotice < fullRefundWindow) return booking.price.div(2).toDecimalPlaces(2)
  return booking.price
}

export async function cancelPdaBooking(params: {
  pdaBookingId: string
  userId: string
  idempotencyKey: string
  reason?: string
}, db: PrismaClient = prisma) {
  const existing = await loadRefund(params.idempotencyKey, db)
  if (existing) {
    if (existing.pdaBookingId !== params.pdaBookingId) {
      throw new PdaRefundConflictError('Idempotency key was already used for another PDA booking')
    }
    if (existing.status === 'PENDING') await finishPdaRefund(existing.id, db)
    const updated = await db.pDATestBooking.findUniqueOrThrow({
      where: { id: params.pdaBookingId },
      select: { status: true, financialStatus: true },
    })
    return {
      ...updated,
      refundAmount: existing.amount.toNumber(),
      replayed: true,
    }
  }

  const booking = await db.pDATestBooking.findUnique({
    where: { id: params.pdaBookingId },
    include: {
      customer: { select: { id: true, userId: true } },
      walletTransaction: true,
      provider: { select: { timezone: true } },
    },
  })
  if (!booking) throw new Error('PDA booking not found')
  if (booking.customer.userId !== params.userId) {
    throw new Error('PDA booking does not belong to this customer')
  }
  if (booking.status === 'CANCELLED') throw new PdaRefundConflictError('PDA booking is already cancelled')
  if (booking.status === 'COMPLETED') throw new PdaRefundConflictError('Completed PDA bookings cannot be cancelled')
  if (!['HELD', 'PARTIALLY_REFUNDED'].includes(booking.financialStatus)) {
    throw new PdaRefundConflictError('PDA funds are not in a refundable financial state')
  }
  if (!booking.walletTransaction || booking.walletTransaction.type !== 'DEBIT' || booking.walletTransaction.status !== 'CONFIRMED') {
    throw new Error('Original PDA wallet debit is missing or unconfirmed')
  }

  const refundAmount = await calculateCancellationRefund(booking, db)
  const refundWalletTransactionId = refundAmount.greaterThan(0)
    ? stableRefundWalletTransactionId(params.idempotencyKey)
    : null

  let refundId: string
  let replayed = false
  try {
    const refund = await withSerializableRetry(
      () => db.$transaction(async tx => {
        const replay = await tx.pDARefund.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        })
        if (replay) {
          if (replay.pdaBookingId !== params.pdaBookingId) {
            throw new PdaRefundConflictError('Idempotency key was already used for another PDA booking')
          }
          replayed = true
          return replay
        }

        const current = await tx.pDATestBooking.findUnique({
          where: { id: params.pdaBookingId },
          include: {
            customer: { select: { userId: true } },
            walletTransaction: true,
            provider: { select: { timezone: true } },
          },
        })
        if (!current || current.customer.userId !== params.userId) {
          throw new Error('PDA booking does not belong to this customer')
        }
        if (current.status === 'CANCELLED') {
          throw new PdaRefundConflictError('PDA booking is already cancelled')
        }
        if (current.status === 'COMPLETED') {
          throw new PdaRefundConflictError('Completed PDA bookings cannot be cancelled')
        }
        if (!['HELD', 'PARTIALLY_REFUNDED'].includes(current.financialStatus)) {
          throw new PdaRefundConflictError('PDA funds are not in a refundable financial state')
        }
        if (
          !current.walletTransaction ||
          current.walletTransaction.id !== booking.walletTransactionId ||
          current.walletTransaction.status !== 'CONFIRMED'
        ) {
          throw new Error('Original PDA wallet debit changed during cancellation')
        }

        const previous = await tx.pDARefund.aggregate({
          where: { pdaBookingId: current.id },
          _sum: { amount: true },
        })
        const remaining = current.price.minus(previous._sum.amount ?? new Prisma.Decimal(0))
        if (refundAmount.greaterThan(remaining)) {
          throw new PdaRefundConflictError('PDA refund exceeds the remaining held amount')
        }

        await tx.pDATestBooking.update({
          where: { id: current.id },
          data: {
            status: 'CANCELLED',
            updatedAt: new Date(),
            notes: params.reason
              ? `${current.notes ?? ''}\nCancellation: ${params.reason}`.trim()
              : current.notes,
          },
        })

        if (refundAmount.greaterThan(0)) {
          await tx.walletTransaction.create({
            data: {
              id: refundWalletTransactionId!,
              walletId: current.walletTransaction.walletId,
              type: 'CREDIT',
              amount: refundAmount,
              description: `PDA cancellation refund for booking ${current.id}`,
              status: 'CONFIRMED',
              bookingId: current.id,
              metadata: {
                type: 'PDA_REFUND',
                pdaBookingId: current.id,
                originalWalletTransactionId: current.walletTransaction.id,
                idempotencyKey: params.idempotencyKey,
                currency: current.currency,
              },
            },
          })
        }

        return tx.pDARefund.create({
          data: {
            idempotencyKey: params.idempotencyKey,
            pdaBookingId: current.id,
            originalWalletTransactionId: current.walletTransaction.id,
            refundWalletTransactionId,
            amount: refundAmount,
            currency: current.currency,
            reason: params.reason,
            status: refundAmount.greaterThan(0) ? 'PENDING' : 'NO_REFUND',
          },
        })
      }, { isolationLevel: 'Serializable', timeout: 15000 }),
      { operationName: 'pda-wallet-cancellation-refund', maxRetries: 2 },
    )
    refundId = refund.id
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')) {
      throw error
    }
    const replay = await loadRefund(params.idempotencyKey, db)
    if (!replay || replay.pdaBookingId !== params.pdaBookingId) throw error
    refundId = replay.id
    replayed = true
  }

  const refund = await db.pDARefund.findUniqueOrThrow({ where: { id: refundId } })
  if (refund.status === 'PENDING') await finishPdaRefund(refund.id, db)
  const updated = await db.pDATestBooking.findUniqueOrThrow({
    where: { id: params.pdaBookingId },
    select: { status: true, financialStatus: true },
  })
  return {
    ...updated,
    refundAmount: refund.amount.toNumber(),
    replayed,
  }
}

export async function getPdaFundsHeldReconciliation(db: PrismaClient = prisma) {
  const bookings = await db.pDATestBooking.findMany({
    where: {
      OR: [
        { walletTransactionId: { not: null } },
        { financialStatus: { not: 'PENDING' } },
      ],
    },
    include: {
      customer: { select: { userId: true } },
      walletTransaction: {
        select: { id: true, walletId: true, type: true, status: true, amount: true, metadata: true },
      },
      refunds: {
        include: {
          refundWalletTransaction: {
            select: { id: true, walletId: true, type: true, status: true, amount: true },
          },
        },
      },
      financialLedgerEntries: {
        where: { entryType: { in: ['PDA_FUNDS_HELD', 'PDA_REFUND'] } },
        select: {
          amount: true,
          entryType: true,
          debitAccount: true,
          creditAccount: true,
          walletTransactionId: true,
          customerId: true,
          userId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const pdaAllocationsByDebit = new Map<string, Prisma.Decimal>()
  for (const booking of bookings) {
    const debit = booking.walletTransaction
    if (
      debit?.type === 'DEBIT' &&
      debit.status === 'CONFIRMED' &&
      includesPdaBooking(debit.metadata, booking.id)
    ) {
      pdaAllocationsByDebit.set(
        debit.id,
        (pdaAllocationsByDebit.get(debit.id) ?? new Prisma.Decimal(0)).plus(booking.price),
      )
    }
  }

  let totalPaid = new Prisma.Decimal(0)
  let totalRefunded = new Prisma.Decimal(0)
  let ledgerHeld = new Prisma.Decimal(0)
  let ledgerRefunded = new Prisma.Decimal(0)
  const discrepancies: Array<Record<string, unknown>> = []

  for (const booking of bookings) {
    const paid = booking.walletTransaction?.type === 'DEBIT' &&
      booking.walletTransaction.status === 'CONFIRMED' &&
      includesPdaBooking(booking.walletTransaction.metadata, booking.id)
    const refunds = booking.refunds.filter(refund =>
      refund.refundWalletTransaction?.type === 'CREDIT' &&
      refund.refundWalletTransaction.status === 'CONFIRMED',
    )
    const refundsUseOriginalWallet = refunds.every(
      refund => refund.refundWalletTransaction?.walletId === booking.walletTransaction?.walletId,
    )
    const walletRefunded = refunds.reduce(
      (sum, refund) => sum.plus(refund.refundWalletTransaction!.amount),
      new Prisma.Decimal(0),
    )
    const heldEntries = booking.financialLedgerEntries.filter(entry => entry.entryType === 'PDA_FUNDS_HELD')
    const refundEntries = booking.financialLedgerEntries.filter(entry => entry.entryType === 'PDA_REFUND')
    const allocated = heldEntries.reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0))
    const ledgerRefund = refundEntries.reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0))
    const expected = paid ? booking.price.minus(walletRefunded) : new Prisma.Decimal(0)
    const actual = allocated.minus(ledgerRefund)
    const customerWalletAccount = booking.customer.userId
      ? buildAccount(AccountType.CLIENT_WALLET, booking.customer.userId)
      : null
    const pdaFundsHeldAccount = buildAccount(AccountType.PDA_FUNDS_HELD)
    const heldEntriesValid = customerWalletAccount !== null &&
      heldEntries.length === 1 &&
      heldEntries.every(entry =>
        entry.debitAccount === customerWalletAccount &&
        entry.creditAccount === pdaFundsHeldAccount &&
        entry.walletTransactionId === booking.walletTransactionId &&
        entry.customerId === booking.customerId &&
        entry.userId === booking.customer.userId,
      )
    const refundEntriesValid = customerWalletAccount !== null &&
      refundEntries.length === refunds.length &&
      refundEntries.every(entry =>
        entry.debitAccount === pdaFundsHeldAccount &&
        entry.creditAccount === customerWalletAccount &&
        entry.walletTransactionId === booking.walletTransactionId &&
        entry.customerId === booking.customerId &&
        entry.userId === booking.customer.userId,
      )
    const pdaAllocation = booking.walletTransaction
      ? pdaAllocationsByDebit.get(booking.walletTransaction.id) ?? new Prisma.Decimal(0)
      : new Prisma.Decimal(0)
    const debitCoversPdaAllocation = !!booking.walletTransaction &&
      booking.walletTransaction.amount.greaterThanOrEqualTo(pdaAllocation)

    if (paid) totalPaid = totalPaid.plus(booking.price)
    totalRefunded = totalRefunded.plus(walletRefunded)
    ledgerHeld = ledgerHeld.plus(allocated)
    ledgerRefunded = ledgerRefunded.plus(ledgerRefund)

    const expectedStatus = !paid
      ? 'PENDING'
      : expected.isZero()
        ? 'REFUNDED'
        : walletRefunded.greaterThan(0)
          ? 'PARTIALLY_REFUNDED'
          : 'HELD'
    if (
      !paid ||
      !allocated.equals(booking.price) ||
      !ledgerRefund.equals(walletRefunded) ||
      !actual.equals(expected) ||
      !refundsUseOriginalWallet ||
      !heldEntriesValid ||
      !refundEntriesValid ||
      !debitCoversPdaAllocation ||
      booking.financialStatus !== expectedStatus
    ) {
      discrepancies.push({
        pdaBookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        walletTransactionId: booking.walletTransactionId,
        currency: booking.currency,
        amount: booking.price.toFixed(2),
        walletDebitAmount: booking.walletTransaction?.amount.toFixed(2) ?? null,
        pdaAllocationsOnDebit: pdaAllocation.toFixed(2),
        expectedHeld: expected.toFixed(2),
        ledgerHeld: actual.toFixed(2),
        financialStatus: booking.financialStatus,
        expectedFinancialStatus: expectedStatus,
      })
    }
  }

  return {
    currency: 'AUD',
    totalPaid: totalPaid.toFixed(2),
    totalRefunded: totalRefunded.toFixed(2),
    expectedFundsHeld: totalPaid.minus(totalRefunded).toFixed(2),
    ledgerFundsHeld: ledgerHeld.minus(ledgerRefunded).toFixed(2),
    discrepancyCount: discrepancies.length,
    discrepancies,
  }
}

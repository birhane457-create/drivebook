import { createHash } from 'crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  readWalletBookingIdempotencyState,
  WalletBookingInput,
  WalletBookingResponseBody,
} from '@/lib/services/wallet-booking'
import {
  recordBookingPayment,
  recordPdaFundsHeld,
} from '@/lib/services/ledger-operations'

type Idempotency = NonNullable<WalletBookingInput['idempotency']>

function stableTransactionId(bookingId: string): string {
  return `wallet-booking-${createHash('sha256').update(bookingId).digest('hex')}`
}

function pdaIdsFromMetadata(metadata: Prisma.JsonValue): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const ids = (metadata as Prisma.JsonObject).pdaBookingIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

async function findWalletTransactionForPda(
  userId: string,
  pdaBookingId: string,
  db: PrismaClient,
) {
  const wallet = await db.clientWallet.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!wallet) throw new Error('Wallet not found while recovering PDA financial records')

  const debits = await db.walletTransaction.findMany({
    where: { walletId: wallet.id, type: 'DEBIT', status: 'CONFIRMED' },
    select: { id: true, metadata: true },
    orderBy: { createdAt: 'desc' },
  })
  const debit = debits.find(item => pdaIdsFromMetadata(item.metadata).includes(pdaBookingId))
  if (!debit) throw new Error(`Original wallet debit not found for PDA booking ${pdaBookingId}`)
  return debit.id
}

export async function completeWalletBookingFinancialRecords(params: {
  idempotency: Idempotency
  userId: string
  responseBody: WalletBookingResponseBody
  walletTransactionId?: string | null
}, db: PrismaClient = prisma): Promise<void> {
  const record = await db.bookingIdempotencyKey.findUnique({
    where: { key: params.idempotency.key },
  })
  if (!record) throw new Error('Wallet booking idempotency record not found during financial recovery')

  const stored = readWalletBookingIdempotencyState(record, params.idempotency)
  if (stored.financialRecordsStatus === 'COMPLETED') return
  if (JSON.stringify(stored.body) !== JSON.stringify(params.responseBody)) {
    throw new Error('Wallet booking response changed during financial recovery')
  }

  const lessonIds = stored.body.bookings.map(booking => booking.id)
  const lessons = lessonIds.length
    ? await db.booking.findMany({
        where: { id: { in: lessonIds }, customer: { userId: params.userId } },
        select: {
          id: true,
          customerId: true,
          providerId: true,
          price: true,
          providerPayout: true,
          platformFee: true,
          commissionRate: true,
          isFirstBooking: true,
          customer: { select: { userId: true } },
        },
      })
    : []
  if (lessons.length !== lessonIds.length) {
    throw new Error('A committed lesson booking was not found for financial recovery')
  }

  for (const booking of lessons) {
    const total = new Prisma.Decimal(booking.price)
    const payout = new Prisma.Decimal(booking.providerPayout)
    const ledgerFee = total.minus(payout).toDecimalPlaces(2)
    const userId = booking.customer?.userId
    if (!userId) throw new Error(`Customer account not found for booking ${booking.id}`)

    await recordBookingPayment({
      bookingId: booking.id,
      userId,
      providerId: booking.providerId,
      totalAmount: total,
      platformFee: ledgerFee,
      providerPayout: payout,
      createdBy: userId,
    })

    const existingTransaction = await db.transaction.findFirst({
      where: { bookingId: booking.id, type: 'BOOKING_PAYMENT' },
      select: { id: true },
    })
    if (!existingTransaction) {
      const id = stableTransactionId(booking.id)
      await db.transaction.upsert({
        where: { id },
        create: {
          id,
          bookingId: booking.id,
          providerId: booking.providerId,
          type: 'BOOKING_PAYMENT',
          amount: total,
          platformFee: booking.platformFee,
          providerPayout: payout,
          commissionRate: booking.commissionRate,
          status: 'COMPLETED',
          description: `Booking payment - ${booking.isFirstBooking ? 'First booking' : 'Repeat booking'}`,
          metadata: { isFirstBooking: booking.isFirstBooking },
        },
        update: {},
      })
    }
  }

  const pdaIds = stored.body.pdaBookings.map(booking => booking.id)
  const pdaBookings = pdaIds.length
    ? await db.pDATestBooking.findMany({
        where: { id: { in: pdaIds }, customer: { userId: params.userId } },
        select: {
          id: true,
          customerId: true,
          providerId: true,
          price: true,
          currency: true,
          financialStatus: true,
          walletTransactionId: true,
        },
      })
    : []
  if (pdaBookings.length !== pdaIds.length) {
    throw new Error('A committed PDA booking was not found for financial recovery')
  }

  let walletTransactionId = stored.walletTransactionId ?? params.walletTransactionId ?? null
  for (const booking of pdaBookings) {
    walletTransactionId ??= booking.walletTransactionId
    walletTransactionId ??= await findWalletTransactionForPda(params.userId, booking.id, db)

    const debit = await db.walletTransaction.findUnique({
      where: { id: walletTransactionId },
      select: { id: true, type: true, status: true, metadata: true, wallet: { select: { userId: true } } },
    })
    if (
      !debit ||
      debit.type !== 'DEBIT' ||
      debit.status !== 'CONFIRMED' ||
      debit.wallet.userId !== params.userId ||
      !pdaIdsFromMetadata(debit.metadata).includes(booking.id)
    ) {
      throw new Error(`Original wallet debit does not match PDA booking ${booking.id}`)
    }

    await recordPdaFundsHeld({
      pdaBookingId: booking.id,
      customerId: booking.customerId,
      userId: params.userId,
      providerId: booking.providerId,
      walletTransactionId: debit.id,
      amount: booking.price,
      currency: booking.currency,
      createdBy: params.userId,
    })

    if (booking.financialStatus === 'PENDING') {
      await db.pDATestBooking.updateMany({
        where: { id: booking.id, financialStatus: 'PENDING' },
        data: { financialStatus: 'HELD', walletTransactionId: debit.id },
      })
    }
  }

  await db.bookingIdempotencyKey.update({
    where: { key: params.idempotency.key },
    data: {
      response: {
        requestFingerprint: params.idempotency.requestFingerprint,
        body: stored.body,
        walletTransactionId,
        financialRecordsStatus: 'COMPLETED',
      },
    },
  })
}

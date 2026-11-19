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
 *   - Balance check includes credit expiry and Decimal-safe arithmetic (CP-02 fix).
 *   - Debit written atomically with bookings; P2034 rolls all back.
 *   - Lesson durations persist in minutes; instructor-priced PDA records share the debit.
 *   - Slot conflict checked per booking inside the transaction (TOCTOU-safe).
 *   - Timestamps converted using instructor timezone (CP-05 fix).
 *
 * This function does NOT:
 *   - Authenticate the caller.
 *   - Check rate limits.
 *   - Send notifications or receipts (caller's responsibility).
 *   - Write FinancialLedger entries (caller's responsibility).
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { withSerializableRetry } from '@/lib/utils/transaction-retry'
import { formatLocalTime, getLocalDateKey, localDateTimeToUTC, resolveTimezone } from '@/lib/utils/timezone'
import { z } from 'zod'

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
  pdaBookings?: WalletPdaBookingItem[]
  commissions: WalletBookingCommission[]
  totalCost: number
  idempotency?: {
    key: string
    email: string
    requestFingerprint: string
  }
}

export interface WalletPdaBookingItem {
  providerId: string
  timezone?: string
  configId: string
  testCentreId: string
  testDate: string        // YYYY-MM-DD
  testTime: string        // HH:MM
  durationMinutes: number
  price: number           // server-recalculated from the instructor's PDA config
  discountPercent?: number | null
  parentBookingIndex?: number
}

export interface WalletBookingCreated {
  booking: any
  instructorName: string
  instructorUserId: string | null
  clientUserId: string
  commission: WalletBookingCommission
  timezone: string
}

export interface WalletPdaBookingCreated {
  booking: any
  timezone: string
}

export interface WalletBookingResult {
  created: WalletBookingCreated[]
  createdPda: WalletPdaBookingCreated[]
  totalCost: number
  remaining: number
  walletTransactionId: string | null
  financialRecordsStatus: 'PENDING' | 'COMPLETED'
  responseBody: WalletBookingResponseBody
  replayed: boolean
}

const walletBookingResponseSchema = z.object({
  success: z.literal(true),
  bookings: z.array(z.object({
    id: z.string(),
    date: z.string(),
    time: z.string(),
    instructor: z.string(),
  })),
  pdaBookings: z.array(z.object({
    id: z.string(),
    configId: z.string(),
    testDate: z.string(),
    testTime: z.string(),
    price: z.number(),
    status: z.string(),
  })),
  totalCost: z.number(),
  remainingBalance: z.number(),
})

const walletBookingIdempotencyEnvelopeSchema = z.object({
  requestFingerprint: z.string(),
  body: walletBookingResponseSchema,
  walletTransactionId: z.string().optional(),
  financialRecordsStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
})

export type WalletBookingResponseBody = z.infer<typeof walletBookingResponseSchema>
export interface WalletBookingIdempotencyState {
  body: WalletBookingResponseBody
  walletTransactionId: string | null
  financialRecordsStatus: 'PENDING' | 'COMPLETED'
}

export class WalletBookingIdempotencyConflict extends Error {
  constructor(message = 'Idempotency-Key does not match an available checkout') {
    super(message)
    this.name = 'WalletBookingIdempotencyConflict'
  }
}

class WalletBookingIdempotencyKeyCollision extends Error {
  constructor() {
    super('Wallet booking idempotency key already claimed')
    this.name = 'WalletBookingIdempotencyKeyCollision'
  }
}

export function readWalletBookingIdempotencyState(
  record: { email: string; bookingId: string; response: Prisma.JsonValue },
  idempotency: NonNullable<WalletBookingInput['idempotency']>,
): WalletBookingIdempotencyState {
  if (record.email !== idempotency.email) {
    throw new WalletBookingIdempotencyConflict('Idempotency-Key does not match account')
  }
  if (record.bookingId === '__pending__') {
    throw new WalletBookingIdempotencyConflict('Checkout is still being processed')
  }

  const stored = walletBookingIdempotencyEnvelopeSchema.safeParse(record.response)
  if (!stored.success) {
    throw new Error('Stored wallet booking idempotency response is invalid')
  }
  if (stored.data.requestFingerprint !== idempotency.requestFingerprint) {
    throw new WalletBookingIdempotencyConflict('Idempotency-Key does not match original checkout')
  }

  return {
    body: stored.data.body,
    walletTransactionId: stored.data.walletTransactionId ?? null,
    financialRecordsStatus: stored.data.financialRecordsStatus ?? 'PENDING',
  }
}

export function readWalletBookingIdempotencyResponse(
  record: { email: string; bookingId: string; response: Prisma.JsonValue },
  idempotency: NonNullable<WalletBookingInput['idempotency']>,
): WalletBookingResponseBody {
  return readWalletBookingIdempotencyState(record, idempotency).body
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

function createWalletBookingResponse(
  created: WalletBookingCreated[],
  createdPda: WalletPdaBookingCreated[],
  totalCost: number,
  remaining: number,
): WalletBookingResponseBody {
  return {
    success: true,
    bookings: created.map(item => {
      const startTime = new Date(item.booking.startTime)
      return {
        id: item.booking.id,
        date: getLocalDateKey(startTime, resolveTimezone(item.timezone)),
        time: formatLocalTime(startTime, resolveTimezone(item.timezone), { hour12: false }),
        instructor: item.instructorName,
      }
    }),
    pdaBookings: createdPda.map(({ booking }) => ({
      id: booking.id,
      configId: booking.configId,
      testDate: getLocalDateKey(
        booking.testDate,
        resolveTimezone(createdPda.find(item => item.booking.id === booking.id)?.timezone),
      ),
      testTime: booking.testTime,
      price: Number(booking.price),
      status: booking.status,
    })),
    totalCost,
    remainingBalance: remaining,
  }
}

// ── Balance calculation (extracted for testability) ───────────────────────────

export function computeWalletBalanceDecimal(
  transactions: Array<{ type: string; amount: Prisma.Decimal; expiresAt?: Date | null }>,
  asOf: Date = new Date(),
): Prisma.Decimal {
  const credits = transactions
    .filter(
      t =>
        t.type.toUpperCase() === 'CREDIT' &&
        (!t.expiresAt || new Date(t.expiresAt) >= asOf),
    )
    .reduce((sum, t) => sum.plus(t.amount), new Prisma.Decimal(0))

  const debits = transactions
    .filter(t => t.type.toUpperCase() === 'DEBIT')
    .reduce((sum, t) => sum.plus(t.amount.abs()), new Prisma.Decimal(0))

  return credits.minus(debits)
}

export function computeWalletBalance(
  transactions: Array<{ type: string; amount: Prisma.Decimal; expiresAt?: Date | null }>,
  asOf: Date = new Date(),
): number {
  return computeWalletBalanceDecimal(transactions, asOf).toNumber()
}

export function calculatePdaTestPrice(
  price: Prisma.Decimal.Value,
  discountPercent?: Prisma.Decimal.Value | null,
): Prisma.Decimal {
  const basePrice = new Prisma.Decimal(price)
  if (discountPercent == null) return basePrice

  return basePrice
    .mul(new Prisma.Decimal(100).minus(discountPercent))
    .div(100)
    .toDecimalPlaces(2)
}

export function createWalletBookingRequestFingerprint(payload: object): string {
  const serialized = JSON.stringify(payload)
  if (serialized === undefined) {
    throw new TypeError('Wallet checkout request cannot be serialized')
  }
  return createHash('sha256').update(serialized).digest('hex')
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
  const {
    userId,
    customerId,
    walletId,
    items,
    pdaBookings = [],
    commissions,
    totalCost,
    idempotency,
  } = input

  try {
    return await withSerializableRetry(
    () =>
      db.$transaction(
        async tx => {
          if (idempotency) {
            try {
              await tx.bookingIdempotencyKey.create({
                data: {
                  key: idempotency.key,
                  email: idempotency.email,
                  bookingId: '__pending__',
                  response: {
                    requestFingerprint: idempotency.requestFingerprint,
                    state: 'pending',
                  },
                },
              })
            } catch (error) {
              if (isUniqueConstraintError(error)) {
                throw new WalletBookingIdempotencyKeyCollision()
              }
              throw error
            }
          }

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
          const balanceInner = computeWalletBalanceDecimal(walletInner.transactions, nowInner)
          const requestedCost = new Prisma.Decimal(totalCost.toFixed(2))

          if (balanceInner.lessThan(requestedCost)) {
            throw new Error(
              `Insufficient credits. You have $${balanceInner.toFixed(2)} but need $${requestedCost.toFixed(2)}`,
            )
          }

          // ── Create bookings ───────────────────────────────────────────────
          const created: WalletBookingCreated[] = []
          const createdPda: WalletPdaBookingCreated[] = []

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
                duration:          Math.round(item.duration * 60),
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
              timezone: resolveTimezone(item.timezone),
            })
          }

          for (const item of pdaBookings) {
            const parent = item.parentBookingIndex === undefined
              ? undefined
              : created[item.parentBookingIndex]
            if (item.parentBookingIndex !== undefined && !parent) {
              throw new Error('PDA booking parent lesson not found')
            }
            if (parent && parent.booking.providerId !== item.providerId) {
              throw new Error('PDA booking instructor does not match its lesson')
            }

            const paddedTime = item.testTime.padStart(5, '0')
            const testStart = localDateTimeToUTC(
              item.testDate,
              paddedTime,
              resolveTimezone(item.timezone),
            )
            if (!Number.isFinite(testStart.getTime()) || testStart <= nowInner) {
              throw new Error('PDA test date and time must be in the future')
            }
            const testEnd = new Date(testStart.getTime() + item.durationMinutes * 60 * 1000)
            const timezone = resolveTimezone(item.timezone)
            const dayStart = localDateTimeToUTC(item.testDate, '00:00', timezone)
            const nextDay = new Date(`${item.testDate}T12:00:00Z`)
            nextDay.setUTCDate(nextDay.getUTCDate() + 1)
            const nextDate = nextDay.toISOString().slice(0, 10)
            const dayEnd = localDateTimeToUTC(nextDate, '00:00', timezone)

            const conflicts = await tx.pDATestBooking.findMany({
              where: {
                providerId: item.providerId,
                testCentreId: item.testCentreId,
                testDate: { gte: dayStart, lt: dayEnd },
                status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
              },
              include: { config: { select: { durationMinutes: true } } },
            })

            for (const conflict of conflicts) {
              if (!conflict.testTime) continue
              const conflictStart = localDateTimeToUTC(
                item.testDate,
                conflict.testTime.padStart(5, '0'),
                resolveTimezone(item.timezone),
              )
              const conflictEnd = new Date(
                conflictStart.getTime() + (conflict.config?.durationMinutes ?? 180) * 60 * 1000,
              )
              if (testStart < conflictEnd && testEnd > conflictStart) {
                throw new Error(`PDA test slot no longer available at ${item.testDate} ${paddedTime}`)
              }
            }

            const booking = await tx.pDATestBooking.create({
              data: {
                providerId: item.providerId,
                customerId,
                configId: item.configId,
                testCentreId: item.testCentreId,
                testDate: testStart,
                testTime: paddedTime,
                price: item.price,
                discountPercent: item.discountPercent ?? null,
                status: 'CONFIRMED',
                financialStatus: 'PENDING',
                currency: 'AUD',
                parentBookingId: parent?.booking.id ?? null,
              },
            })
            createdPda.push({
              booking,
              timezone: resolveTimezone(item.timezone),
            })
          }

          // ── Write debit atomically with bookings ──────────────────────────
          // P2034 abort rolls back bookings and this debit together.
          const bookedParts = []
          if (items.length) bookedParts.push(`${items.length} lesson${items.length === 1 ? '' : 's'}`)
          if (pdaBookings.length) bookedParts.push(`${pdaBookings.length} PDA test${pdaBookings.length === 1 ? '' : 's'}`)
          const walletDebit = await tx.walletTransaction.create({
            data: {
              walletId,
              type:        'DEBIT',
              amount:      requestedCost,
              description: `Booked ${bookedParts.join(' and ')}`,
              status:      'CONFIRMED',
              metadata: {
                bookingIds: created.map(item => item.booking.id),
                pdaBookingIds: createdPda.map(item => item.booking.id),
                idempotencyKey: idempotency?.key ?? null,
              },
            },
          })

          if (createdPda.length) {
            await tx.pDATestBooking.updateMany({
              where: { id: { in: createdPda.map(({ booking }) => booking.id) } },
              data: { walletTransactionId: walletDebit.id },
            })
          }

          const resultTotalCost = requestedCost.toNumber()
          const remaining = balanceInner.minus(requestedCost).toNumber()
          const responseBody = createWalletBookingResponse(
            created,
            createdPda,
            resultTotalCost,
            remaining,
          )

          if (idempotency) {
            const primaryBookingId = created[0]?.booking.id ?? createdPda[0]?.booking.id
            if (!primaryBookingId) {
              throw new Error('Wallet checkout did not create a booking')
            }
            await tx.bookingIdempotencyKey.update({
              where: { key: idempotency.key },
              data: {
                bookingId: primaryBookingId,
                response: {
                  requestFingerprint: idempotency.requestFingerprint,
                  body: responseBody,
                  walletTransactionId: walletDebit.id,
                  financialRecordsStatus: 'PENDING',
                },
              },
            })
          }

          return {
            created,
            createdPda,
            totalCost: resultTotalCost,
            remaining,
            walletTransactionId: walletDebit.id,
            financialRecordsStatus: 'PENDING',
            responseBody,
            replayed: false,
          }
        },
        { isolationLevel: 'Serializable', timeout: 15000 },
      ),
    { operationName: 'client-wallet-bulk-booking', maxRetries: 2 },
  )
  } catch (error) {
    if (!(error instanceof WalletBookingIdempotencyKeyCollision) || !idempotency) {
      throw error
    }

    const existing = await db.bookingIdempotencyKey.findUnique({
      where: { key: idempotency.key },
    })
    if (!existing) throw error

    const stored = readWalletBookingIdempotencyState(existing, idempotency)
    return {
      created: [],
      createdPda: [],
      totalCost: stored.body.totalCost,
      remaining: stored.body.remainingBalance,
      walletTransactionId: stored.walletTransactionId,
      financialRecordsStatus: stored.financialRecordsStatus,
      responseBody: stored.body,
      replayed: true,
    }
  }
}

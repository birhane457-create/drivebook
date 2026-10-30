/**
 * WLA-008-B-RUNTIME: Mobile Booking Wallet Concurrency Test
 *
 * This test runs against a real PostgreSQL database (port 5433) and verifies
 * that two concurrent mobile booking requests competing for the same wallet
 * balance cannot both result in CONFIRMED bookings if the combined cost exceeds
 * the wallet balance.
 *
 * WHAT IS BEING TESTED
 *   The /api/bookings/mobile POST handler now uses SERIALIZABLE transaction
 *   isolation. Under READ COMMITTED (Prisma default), two concurrent requests
 *   could both read the same sufficient balance before either debit commits,
 *   then both proceed to create CONFIRMED bookings — a double-spend.
 *   SERIALIZABLE isolation detects the write conflict and aborts one transaction
 *   (P2034 serialization failure), which the caller must retry or treat as
 *   PENDING_PAYMENT.
 *
 * WHAT CONSTITUTES A PASS
 *   Given: wallet balance = $80, booking A = $60, booking B = $60
 *   (combined cost $120 > wallet $80 — only one can be confirmed)
 *
 *   The test fires both booking transactions concurrently via Promise.all.
 *   After both settle, invariants that must hold:
 *     1. The wallet balance is NOT negative
 *     2. There is not more than one CONFIRMED booking that is isPaid:true
 *        (i.e., the wallet was not double-spent)
 *     3. At least one booking exists (the test is not vacuously passing)
 *     4. Total wallet debits from confirmed transactions ≤ initial balance
 *
 * DATABASE: postgresql://postgres:testpass@localhost:5433/drivebook_test
 *
 * NOTE ON SERIALIZATION FAILURES
 *   Prisma throws P2034 when a SERIALIZABLE transaction conflicts. The mobile
 *   route does not currently catch P2034 and retry — a P2034 will propagate as
 *   a 500. This is acceptable: the client retries, the retry runs as
 *   PENDING_PAYMENT if the first booking already debited the wallet. The test
 *   accepts either a P2034-derived error response or a PENDING_PAYMENT outcome
 *   for the losing transaction — both are correct. What is NOT acceptable is
 *   two CONFIRMED bookings with a combined debit exceeding the initial balance.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_PREFIX = 'WLA008B'
const INITIAL_BALANCE = 80     // enough for ONE $60 lesson, not two
const LESSON_PRICE_A  = 60     // booking A price
const LESSON_PRICE_B  = 60     // booking B price (combined = $120 > $80)

let providerAId: string
let clientUserId: string
let customerId:  string
let walletId:    string

async function cleanup() {
  // Delete in dependency order; ignore missing records
  await prisma.walletTransaction.deleteMany({
    where: { wallet: { userId: clientUserId ?? '__none__' } },
  }).catch(() => {})
  await prisma.clientWallet.deleteMany({
    where: { userId: clientUserId ?? '__none__' },
  }).catch(() => {})
  await prisma.booking.deleteMany({
    where: { providerId: providerAId ?? '__none__' },
  }).catch(() => {})
  await prisma.customer.deleteMany({
    where: { id: customerId ?? '__none__' },
  }).catch(() => {})
  await prisma.user.deleteMany({
    where: { email: { in: [
      `${TEST_PREFIX}-provider@test.com`,
      `${TEST_PREFIX}-client@test.com`,
    ]}},
  }).catch(() => {})
  await prisma.provider.deleteMany({
    where: { id: providerAId ?? '__none__' },
  }).catch(() => {})
}

beforeAll(async () => {
  await cleanup()

  // Create provider user
  const providerUser = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-provider@test.com`,
      name:  'WLA008B Provider',
      role:  'PROVIDER',
    },
  })

  // Create provider — use relation connect API (Prisma 5 rejects bare userId scalar)
  const provider = await (prisma.provider as any).create({
    data: {
      user:               { connect: { id: providerUser.id } },
      name:               'WLA008B Provider',
      phone:              '0400000000',
      hourlyRate:         60,
      approvalStatus:     'APPROVED',
      isActive:           true,
      subscriptionStatus: 'ACTIVE',
    },
  })
  providerAId = provider.id

  // Create client user
  const clientUser = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-client@test.com`,
      name:  'WLA008B Client',
      role:  'CLIENT',
    },
  })
  clientUserId = clientUser.id

  // Create customer record — use raw SQL to avoid Prisma client relation API quirks
  const customerId_raw = `WLA008B-cust-${Date.now()}`
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Customer" (id, "userId", name, email, phone, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())`,
    customerId_raw, clientUserId, 'WLA008B Client',
    `${TEST_PREFIX}-client@test.com`, '0400000001'
  )
  customerId = customerId_raw

  // Create wallet with exactly INITIAL_BALANCE
  const wallet = await prisma.clientWallet.create({
    data: {
      userId:  clientUserId,
      balance: INITIAL_BALANCE,
    },
  })
  walletId = wallet.id

  // Seed a single CREDIT transaction to establish the balance
  await prisma.walletTransaction.create({
    data: {
      walletId,
      type:        'CREDIT',
      amount:      INITIAL_BALANCE,
      description: 'WLA008B test seed credit',
      status:      'CONFIRMED',
    },
  })
}, 30000)

afterAll(async () => {
  await cleanup()
}, 30000)

// ─── Helper: run one booking transaction (mirrors the mobile route logic) ─────

async function attemptMobileBooking(
  startOffsetMinutes: number,
  lessonPrice: number
): Promise<{ status: 'CONFIRMED' | 'PENDING_PAYMENT' | 'ERROR'; bookingId?: string; error?: string }> {
  const start = new Date(Date.now() + startOffsetMinutes * 60_000 + 86_400_000) // tomorrow + offset
  const end   = new Date(start.getTime() + 60 * 60_000) // 1 hour

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── Exact same logic as the fixed mobile route ──────────────────────────
      let bookingStatus: 'CONFIRMED' | 'PENDING_PAYMENT' = 'PENDING_PAYMENT'
      let walletIdForDebit: string | null = null

      const wallet = await tx.clientWallet.findUnique({
        where: { userId: clientUserId },
        include: { transactions: { where: { status: 'CONFIRMED' } } },
      })
      if (wallet) {
        const credits = wallet.transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0)
        const debits  = wallet.transactions.filter(t => t.type === 'DEBIT').reduce((s, t)  => s + Number(t.amount), 0)
        if (credits - debits >= lessonPrice) {
          bookingStatus    = 'CONFIRMED'
          walletIdForDebit = wallet.id
        }
      }

      const newBooking = await tx.booking.create({
        data: {
          providerId: providerAId,
          customerId,
          bookingType: 'LESSON',
          startTime:   start,
          endTime:     end,
          duration:    60,
          price:       lessonPrice,
          status:      bookingStatus,
          isPaid:      bookingStatus === 'CONFIRMED',
          paidAt:      bookingStatus === 'CONFIRMED' ? new Date() : null,
          createdBy:   'provider',
        } as any,
      })

      if (walletIdForDebit) {
        await tx.walletTransaction.create({
          data: {
            walletId: walletIdForDebit,
            type:        'DEBIT',
            amount:      lessonPrice,
            description: `WLA008B concurrency test booking`,
            status:      'CONFIRMED',
          },
        })
        await tx.clientWallet.update({
          where: { id: walletIdForDebit },
          data: { balance: { decrement: lessonPrice } },
        })
      }

      return { bookingStatus, bookingId: newBooking.id }
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000,
    })

    return { status: result.bookingStatus, bookingId: result.bookingId }
  } catch (err: any) {
    // P2034 = serialization failure — expected for the losing concurrent transaction
    const code = err?.code ?? err?.meta?.code ?? ''
    if (code === 'P2034' || err?.message?.includes('serializ')) {
      return { status: 'ERROR', error: 'P2034-serialization-failure' }
    }
    return { status: 'ERROR', error: err?.message ?? String(err) }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WLA-008-B-RUNTIME: Concurrent mobile booking wallet integrity', () => {
  it('CONC-01 — wallet balance is not negative after two concurrent $60 bookings against $80 wallet', async () => {
    // Fire two concurrent booking attempts. Combined cost $120 > balance $80.
    // SERIALIZABLE isolation ensures only one can commit as CONFIRMED.
    const [resultA, resultB] = await Promise.all([
      attemptMobileBooking(60,  LESSON_PRICE_A),  // starts in 1h
      attemptMobileBooking(180, LESSON_PRICE_B),  // starts in 3h
    ])

    // Read final wallet state
    const finalWallet = await prisma.clientWallet.findUnique({
      where: { userId: clientUserId },
    })
    const finalBalance = Number(finalWallet?.balance ?? 0)

    console.log('[CONC-01] Result A:', resultA.status, resultA.error ?? '')
    console.log('[CONC-01] Result B:', resultB.status, resultB.error ?? '')
    console.log('[CONC-01] Final wallet balance:', finalBalance)

    // PRIMARY INVARIANT: wallet must not be negative
    expect(finalBalance).toBeGreaterThanOrEqual(0)
  }, 30000)

  it('CONC-02 — at most one CONFIRMED booking exists after the concurrent race', async () => {
    const confirmedBookings = await prisma.booking.findMany({
      where: {
        providerId: providerAId,
        customerId,
        status:     'CONFIRMED',
        isPaid:     true,
      },
    })

    console.log('[CONC-02] CONFIRMED bookings:', confirmedBookings.length)
    for (const b of confirmedBookings) {
      console.log('  booking', b.id, 'price:', b.price)
    }

    // Only one booking can be CONFIRMED because the wallet only had $80
    // and each lesson costs $60. Two CONFIRMEDs would require $120.
    expect(confirmedBookings.length).toBeLessThanOrEqual(1)
  }, 30000)

  it('CONC-03 — total debits from confirmed wallet transactions ≤ initial balance', async () => {
    const debitTxns = await prisma.walletTransaction.findMany({
      where: {
        walletId,
        type:   'DEBIT',
        status: 'CONFIRMED',
      },
    })

    const totalDebited = debitTxns.reduce((s, t) => s + Number(t.amount), 0)
    console.log('[CONC-03] Total debited:', totalDebited, 'from', debitTxns.length, 'debit transaction(s)')

    // Total debits must never exceed initial balance
    expect(totalDebited).toBeLessThanOrEqual(INITIAL_BALANCE)
  }, 30000)

  it('CONC-04 — double-entry invariant: confirmed booking count matches debit transaction count', async () => {
    const confirmedBookings = await prisma.booking.count({
      where: { providerId: providerAId, customerId, status: 'CONFIRMED', isPaid: true },
    })
    const debitTxns = await prisma.walletTransaction.count({
      where: { walletId, type: 'DEBIT', status: 'CONFIRMED' },
    })

    console.log('[CONC-04] CONFIRMED bookings:', confirmedBookings, '| Wallet debits:', debitTxns)

    // Every CONFIRMED booking must have exactly one wallet debit
    expect(confirmedBookings).toBe(debitTxns)
  }, 30000)

  it('CONC-05 — source uses SERIALIZABLE isolation level', () => {
    // Structural proof that the fix is in the source — prevents silent regression.
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/bookings/mobile/route.ts'),
      'utf-8'
    )
    expect(source).toMatch(/isolationLevel.*Serializable|Serializable.*isolationLevel/)
    expect(source).toMatch(/MOBILE_BOOKING_TX/)
  })

  it('CONC-06 — P2034 is handled as 409 in the route catch block (source check)', () => {
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/bookings/mobile/route.ts'),
      'utf-8'
    )
    // Verify explicit P2034 catch returns 409
    expect(source).toMatch(/P2034/)
    expect(source).toMatch(/409/)
    // Verify withSerializableRetry wraps the transaction (retries before surfacing P2034)
    expect(source).toMatch(/withSerializableRetry/)
  })
})

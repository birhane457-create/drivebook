/**
 * WLA-008-B-RUNTIME: Mobile Booking Wallet Concurrency Test
 *
 * Runs against real PostgreSQL (127.0.0.1:5433 / drivebook_test).
 *
 * THREE TEST GROUPS
 *
 * Group 1 — CONC-01..CONC-07: Concurrent transaction integrity
 *   Two booking attempts fire concurrently against a $80 wallet where
 *   each lesson costs $60 (combined $120 > $80). SERIALIZABLE isolation
 *   ensures exactly one CONFIRMED booking and one debit.
 *
 *   The helper (attemptMobileBooking) replicates the route's transaction
 *   logic with SERIALIZABLE isolation but intentionally does NOT call
 *   withSerializableRetry. This tests the isolation property directly:
 *   one transaction wins, the other gets P2034 and is recorded as ERROR.
 *   The tests then assert:
 *     - At least one booking was committed (non-vacuous)
 *     - Exactly one booking is CONFIRMED and isPaid
 *     - Wallet balance = initial − one lesson price (no double-spend)
 *     - Debit count equals confirmed booking count (double-entry)
 *
 * Group 2 — RETRY-01..RETRY-04: withSerializableRetry behavioral tests
 *   Tests the retry utility directly: P2034 → retry → success; P2034
 *   exhausted → rethrow; non-P2034 → immediate rethrow; success → pass-through.
 *
 * Group 3 — HTTP-01..HTTP-02: Route HTTP response tests
 *   Verifies that the route returns HTTP 409 on exhausted P2034, and HTTP
 *   201 on a successful booking, using the actual route handler with mocked
 *   Prisma.
 *
 * DATABASE: postgresql://postgres:testpass@127.0.0.1:5433/drivebook_test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

// ─── Fixture globals ─────────────────────────────────────────────────────────

const TEST_PREFIX = 'WLA008B'
const INITIAL_BALANCE = 80   // enough for ONE $60 lesson, not two
const LESSON_PRICE_A  = 60
const LESSON_PRICE_B  = 60  // combined $120 > $80

let providerAId: string
let clientUserId: string
let customerId:   string
let walletId:     string

// ─── Fixture setup / teardown ────────────────────────────────────────────────

async function cleanup() {
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

  const providerUser = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-provider@test.com`,
      name:  'WLA008B Provider',
      role:  'PROVIDER',
    },
  })

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

  const clientUser = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-client@test.com`,
      name:  'WLA008B Client',
      role:  'CLIENT',
    },
  })
  clientUserId = clientUser.id

  // Raw INSERT avoids Prisma client relation-API quirk for Customer.userId
  const customerId_raw = `WLA008B-cust-${Date.now()}`
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Customer" (id, "userId", name, email, phone, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())`,
    customerId_raw, clientUserId, 'WLA008B Client',
    `${TEST_PREFIX}-client@test.com`, '0400000001'
  )
  customerId = customerId_raw

  const wallet = await prisma.clientWallet.create({
    data: { userId: clientUserId, balance: INITIAL_BALANCE },
  })
  walletId = wallet.id

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

// ─── Helper: one booking attempt (mirrors route logic, tests isolation) ───────
//
// This helper deliberately uses prisma.$transaction with SERIALIZABLE isolation
// directly, WITHOUT withSerializableRetry. The intent is to test the isolation
// property in isolation: one tx wins, the other gets P2034 immediately.
// The retry helper is tested separately in Group 2 (RETRY-*).

type AttemptResult =
  | { status: 'CONFIRMED'; bookingId: string }
  | { status: 'PENDING_PAYMENT'; bookingId: string }
  | { status: 'P2034' }
  | { status: 'ERROR'; error: string }

async function attemptMobileBooking(
  startOffsetMinutes: number,
  lessonPrice: number
): Promise<AttemptResult> {
  const start = new Date(Date.now() + startOffsetMinutes * 60_000 + 86_400_000)
  const end   = new Date(start.getTime() + 60 * 60_000)

  try {
    const result = await prisma.$transaction(async (tx) => {
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
            type:    'DEBIT',
            amount:  lessonPrice,
            description: 'WLA008B concurrency test booking',
            status:  'CONFIRMED',
          },
        })
        await tx.clientWallet.update({
          where: { id: walletIdForDebit },
          data:  { balance: { decrement: lessonPrice } },
        })
      }

      return { bookingStatus, bookingId: newBooking.id }
    }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 })

    return { status: result.bookingStatus, bookingId: result.bookingId }
  } catch (err: any) {
    const code = err?.code ?? ''
    if (code === 'P2034') return { status: 'P2034' }
    return { status: 'ERROR', error: err?.message ?? String(err) }
  }
}

// ─── Group 1: Concurrent transaction integrity ───────────────────────────────

describe('WLA-008-B-RUNTIME: Concurrent mobile booking wallet integrity', () => {
  let resultA: AttemptResult
  let resultB: AttemptResult

  // Run the race once; subsequent tests read shared state.
  beforeAll(async () => {
    ;[resultA, resultB] = await Promise.all([
      attemptMobileBooking(60,  LESSON_PRICE_A),
      attemptMobileBooking(180, LESSON_PRICE_B),
    ])
    console.log('[CONC] Result A:', resultA.status)
    console.log('[CONC] Result B:', resultB.status)
  }, 30000)

  it('CONC-01 — at least one booking was committed (non-vacuous)', async () => {
    // If both attempts fail entirely (e.g. both ERROR), all the balance/debit
    // checks would trivially pass against an empty database state. This test
    // guards against that: at least one tx must have committed a booking row.
    const totalBookings = await prisma.booking.count({
      where: { providerId: providerAId, customerId },
    })
    console.log('[CONC-01] Total booking rows:', totalBookings)
    expect(totalBookings).toBeGreaterThanOrEqual(1)
  }, 30000)

  it('CONC-02 — exactly one CONFIRMED (isPaid) booking exists — no double-spend', async () => {
    const confirmedBookings = await prisma.booking.findMany({
      where: { providerId: providerAId, customerId, status: 'CONFIRMED', isPaid: true },
    })
    console.log('[CONC-02] CONFIRMED bookings:', confirmedBookings.length)
    for (const b of confirmedBookings) {
      console.log('  booking', b.id, 'price:', b.price)
    }
    // Exactly one: not zero (at least one winner), not two (no double-spend)
    expect(confirmedBookings.length).toBe(1)
  }, 30000)

  it('CONC-03 — the losing result is PENDING_PAYMENT or P2034 (never a second CONFIRMED)', async () => {
    // The loser either committed as PENDING_PAYMENT (balance insufficient at
    // the time of its own read) or was aborted by P2034 and retried as ERROR.
    const confirmedBookings = await prisma.booking.count({
      where: { providerId: providerAId, customerId, status: 'CONFIRMED', isPaid: true },
    })
    const loser = resultA.status === 'CONFIRMED' ? resultB : resultA
    console.log('[CONC-03] Loser status:', loser.status)
    expect(confirmedBookings).toBe(1)
    expect(['PENDING_PAYMENT', 'P2034']).toContain(loser.status)
  }, 30000)

  it('CONC-04 — wallet balance equals initial minus exactly one lesson price', async () => {
    const finalWallet = await prisma.clientWallet.findUnique({
      where: { userId: clientUserId },
    })
    const finalBalance = Number(finalWallet?.balance ?? -999)
    console.log('[CONC-04] Final wallet balance:', finalBalance)
    // $80 − $60 = $20 — not $20−$60=−$40 (double-spend), not $80 (nothing happened)
    expect(finalBalance).toBe(INITIAL_BALANCE - LESSON_PRICE_A)
  }, 30000)

  it('CONC-05 — total confirmed debits equal one lesson price', async () => {
    const debitTxns = await prisma.walletTransaction.findMany({
      where: { walletId, type: 'DEBIT', status: 'CONFIRMED' },
    })
    const totalDebited = debitTxns.reduce((s, t) => s + Number(t.amount), 0)
    console.log('[CONC-05] Total debited:', totalDebited, 'from', debitTxns.length, 'debit(s)')
    expect(debitTxns.length).toBe(1)
    expect(totalDebited).toBe(LESSON_PRICE_A)
  }, 30000)

  it('CONC-06 — double-entry: confirmed booking count equals debit transaction count', async () => {
    const confirmedBookings = await prisma.booking.count({
      where: { providerId: providerAId, customerId, status: 'CONFIRMED', isPaid: true },
    })
    const debitCount = await prisma.walletTransaction.count({
      where: { walletId, type: 'DEBIT', status: 'CONFIRMED' },
    })
    console.log('[CONC-06] Confirmed bookings:', confirmedBookings, '| Debits:', debitCount)
    expect(confirmedBookings).toBe(debitCount)
  }, 30000)

  it('CONC-07 — source: SERIALIZABLE isolation + withSerializableRetry + P2034→409 present', () => {
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    const src = readFileSync(resolve(process.cwd(), 'app/api/bookings/mobile/route.ts'), 'utf-8')
    expect(src).toMatch(/isolationLevel.*Serializable|Serializable.*isolationLevel/)
    expect(src).toMatch(/MOBILE_BOOKING_TX/)
    expect(src).toMatch(/withSerializableRetry/)
    expect(src).toMatch(/P2034/)
    expect(src).toMatch(/409/)
  })
})

// ─── Group 2 and Group 3 (RETRY-*, HTTP-*) live in wla-008-b-mobile-route-http.test.ts


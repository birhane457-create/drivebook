import { randomUUID } from 'crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  createWalletBookingRequestFingerprint,
  executeWalletBookingTransaction,
  WalletBookingIdempotencyConflict,
} from '@/lib/services/wallet-booking'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

type Fixture = {
  userId: string
  email: string
  walletId: string
  customerId: string
  providerId: string
}

class Deferred {
  readonly promise: Promise<void>
  private resolvePromise!: () => void

  constructor() {
    this.promise = new Promise(resolve => {
      this.resolvePromise = resolve
    })
  }

  resolve() {
    this.resolvePromise()
  }
}

describe.skipIf(!testDatabaseUrl)('Client wallet checkout idempotency — PostgreSQL', () => {
  let db: PrismaClient
  let fixture: Fixture

  async function createFixture(): Promise<Fixture> {
    const user = await db.user.create({
      data: {
        email: `CPUX_IDEM_${randomUUID()}@test.invalid`,
        name: 'Client idempotency test',
        role: 'CLIENT',
      },
    })
    const wallet = await db.clientWallet.create({ data: { userId: user.id } })
    await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: 200,
        status: 'CONFIRMED',
        description: 'Client idempotency test credit',
      },
    })
    const customer = await db.customer.create({
      data: {
        user: { connect: { id: user.id } },
        name: 'Client idempotency test',
        email: `CPUX_IDEM_${randomUUID()}@test.invalid`,
        phone: '0400000000',
      },
    })
    const provider = await db.provider.create({
      data: {
        name: 'Client idempotency test instructor',
        phone: '0400000000',
        hourlyRate: 60,
        approvalStatus: 'APPROVED',
        isActive: true,
      },
    })

    return {
      userId: user.id,
      email: user.email,
      walletId: wallet.id,
      customerId: customer.id,
      providerId: provider.id,
    }
  }

  async function cleanupFixture() {
    if (!fixture) return
    await db.bookingIdempotencyKey.deleteMany({
      where: { key: { startsWith: `client-wallet:${fixture.userId}:` } },
    })
    await db.booking.deleteMany({ where: { customerId: fixture.customerId } })
    await db.walletTransaction.deleteMany({ where: { walletId: fixture.walletId } })
    await db.customer.deleteMany({ where: { id: fixture.customerId } })
    await db.provider.deleteMany({ where: { id: fixture.providerId } })
    await db.clientWallet.deleteMany({ where: { id: fixture.walletId } })
    await db.user.deleteMany({ where: { id: fixture.userId } })
  }

  async function readBalance(): Promise<number> {
    const transactions = await db.walletTransaction.findMany({
      where: { walletId: fixture.walletId, status: 'CONFIRMED' },
      select: { type: true, amount: true },
    })
    const credits = transactions
      .filter(transaction => transaction.type === 'CREDIT')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    const debits = transactions
      .filter(transaction => transaction.type === 'DEBIT')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    return credits - debits
  }

  async function logPostgresVersion() {
    const [row] = await db.$queryRaw<Array<{ version: string }>>`SELECT version() AS version`
    console.log(`PostgreSQL version: ${row.version}`)
  }

  function makeInput(
    key: string,
    time: string,
    withMismatchedPda = false,
  ) {
    const payload = {
      cart: [{
        providerId: fixture.providerId,
        instructorName: 'Client idempotency test instructor',
        date: '2099-01-02',
        time,
        duration: 1,
        price: 60,
      }],
      pdaBookings: withMismatchedPda
        ? [{
            providerId: 'different-provider',
            configId: 'unused-before-association-validation',
            testCentreId: 'unused-before-association-validation',
            testDate: '2099-01-02',
            testTime: '12:00',
            durationMinutes: 60,
            price: 100,
            parentBookingIndex: 0,
          }]
        : [],
    }

    return {
      userId: fixture.userId,
      customerId: fixture.customerId,
      walletId: fixture.walletId,
      items: payload.cart.map(item => ({
        ...item,
        timezone: 'Australia/Perth',
      })),
      pdaBookings: payload.pdaBookings,
      commissions: [{
        totalAmount: 60,
        platformFee: 6,
        providerPayout: 54,
        commissionRate: 0.1,
        isFirstBooking: false,
      }],
      totalCost: withMismatchedPda ? 160 : 60,
      idempotency: {
        key: `client-wallet:${fixture.userId}:${key}`,
        email: fixture.email,
        requestFingerprint: createWalletBookingRequestFingerprint(payload),
      },
    }
  }

  it('creates one checkout for simultaneous duplicate submissions and replays a later retry', async () => {
    db = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } })
    fixture = await createFixture()

    const firstClient = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } })
    const secondClient = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } })
    const bothKeyClaimsReached = new Deferred()
    let keyClaimCount = 0
    const synchronizeClaim: Prisma.Middleware = async (params, next) => {
      if (params.model === 'BookingIdempotencyKey' && params.action === 'create') {
        keyClaimCount++
        if (keyClaimCount === 2) bothKeyClaimsReached.resolve()
        await bothKeyClaimsReached.promise
      }
      return next(params)
    }
    firstClient.$use(synchronizeClaim)
    secondClient.$use(synchronizeClaim)

    try {
      await logPostgresVersion()
      const balanceBefore = await readBalance()
      expect(balanceBefore).toBe(200)
      const key = randomUUID()
      const input = makeInput(key, '10:00')
      const [first, second] = await Promise.all([
        executeWalletBookingTransaction(input, firstClient),
        executeWalletBookingTransaction(input, secondClient),
      ])

      expect([first.replayed, second.replayed].sort()).toEqual([false, true])
      expect(first.responseBody).toEqual(second.responseBody)

      const retry = await executeWalletBookingTransaction(input, firstClient)
      expect(retry.replayed).toBe(true)
      expect(retry.responseBody).toEqual(first.responseBody)

      await expect(
        executeWalletBookingTransaction(makeInput(key, '11:00'), firstClient),
      ).rejects.toBeInstanceOf(WalletBookingIdempotencyConflict)

      const bookings = await db.booking.findMany({
        where: { customerId: fixture.customerId },
      })
      const debits = await db.walletTransaction.findMany({
        where: { walletId: fixture.walletId, type: 'DEBIT', status: 'CONFIRMED' },
      })
      const idempotencyRecords = await db.bookingIdempotencyKey.findMany({
        where: { key: input.idempotency.key },
      })

      expect(bookings).toHaveLength(1)
      expect(debits).toHaveLength(1)
      expect(Number(debits[0].amount)).toBe(60)
      expect(idempotencyRecords).toHaveLength(1)
      const balanceAfter = await readBalance()
      expect(balanceAfter).toBe(140)

      console.log(
        `CP-UX-IDEM-01 PostgreSQL evidence: keyClaims=${keyClaimCount}; bookings=${bookings.length}; walletDebitLedgerEntries=${debits.length}; balanceBefore=$${balanceBefore.toFixed(2)}; balanceAfter=$${balanceAfter.toFixed(2)}; sameKeyReplay=PASS; changedContent=CONFLICT; retries=1`,
      )
    } finally {
      await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()])
      await cleanupFixture()
      await db.$disconnect()
    }
  })

  it('rolls back a lesson and idempotency claim when combined checkout fails before debit', async () => {
    db = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } })
    fixture = await createFixture()

    try {
      await logPostgresVersion()
      const balanceBefore = await readBalance()
      expect(balanceBefore).toBe(200)
      const input = makeInput(randomUUID(), '14:00', true)
      await expect(executeWalletBookingTransaction(input, db)).rejects.toThrow(
        'PDA booking instructor does not match its lesson',
      )

      const bookings = await db.booking.findMany({
        where: { customerId: fixture.customerId },
      })
      const debits = await db.walletTransaction.findMany({
        where: { walletId: fixture.walletId, type: 'DEBIT', status: 'CONFIRMED' },
      })
      const idempotencyRecords = await db.bookingIdempotencyKey.findMany({
        where: { key: input.idempotency.key },
      })

      expect(bookings).toHaveLength(0)
      expect(debits).toHaveLength(0)
      expect(idempotencyRecords).toHaveLength(0)
      const balanceAfter = await readBalance()
      expect(balanceAfter).toBe(balanceBefore)
      console.log(
        `CP-UX-IDEM-02 PostgreSQL rollback evidence: bookings=${bookings.length}; walletDebitLedgerEntries=${debits.length}; idempotencyRecords=${idempotencyRecords.length}; balanceBefore=$${balanceBefore.toFixed(2)}; balanceAfter=$${balanceAfter.toFixed(2)}`,
      )
    } finally {
      await cleanupFixture()
      await db.$disconnect()
    }
  })
})

/**
 * CP-03 Regression Tests — Concurrent wallet spending
 *
 * GROUP 1 — CONC-01..07: PostgreSQL SERIALIZABLE isolation
 *   Two simultaneous transactions attempt to debit $60 against an $80 wallet.
 *   Under SERIALIZABLE, PostgreSQL aborts one (P2034). Tests assert:
 *     - exactly one committed transaction
 *     - exactly one DEBIT row
 *     - balance is $20 (not negative)
 *   These tests exercise the isolation primitive directly (no retry wrapper),
 *   proving the database-level guarantee independently of the application.
 *
 * GROUP 2 — RETRY-01..05: withSerializableRetry production helper
 *   Tests call withSerializableRetry() — the same helper the route uses.
 *   These cover:
 *     RETRY-01: P2034 is retried; second attempt succeeds
 *     RETRY-02: Insufficient funds inside SERIALIZABLE → not retried → rejected
 *     RETRY-03: P2034 exhausted after maxRetries → rethrown
 *     RETRY-04: Non-P2034 error → rethrown immediately (no retry)
 *     RETRY-05: Booking + debit both roll back on throw inside SERIALIZABLE tx
 *
 * DATABASE: Japan Supabase direct connection (port 5432, SERIALIZABLE supported)
 *           postgresql://postgres.zzntmozvppyzeaqautpi:...@...5432/postgres
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { withSerializableRetry } from '@/lib/utils/transaction-retry'

const TEST_PREFIX = 'CP03'

const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

// ── Fixture helpers ───────────────────────────────────────────────────────────

type Fixture = { userId: string; walletId: string; creditTxId: string }

async function createFixture(initialCredit: number): Promise<Fixture> {
  const user = await testPrisma.user.create({
    data: { email: `${TEST_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.invalid`, name: 'CP03', role: 'CLIENT' },
  })
  const wallet = await testPrisma.clientWallet.create({ data: { userId: user.id } })
  const tx = await testPrisma.walletTransaction.create({
    data: { walletId: wallet.id, type: 'CREDIT', amount: initialCredit, status: 'CONFIRMED', description: 'CP03 credit' },
  })
  return { userId: user.id, walletId: wallet.id, creditTxId: tx.id }
}

async function cleanup(fixture: Fixture) {
  if (!fixture) return
  await testPrisma.walletTransaction.deleteMany({ where: { walletId: fixture.walletId } })
  await testPrisma.clientWallet.deleteMany({ where: { id: fixture.walletId } })
  await testPrisma.user.deleteMany({ where: { id: fixture.userId } })
}

async function readBalance(walletId: string): Promise<number> {
  const rows = await testPrisma.walletTransaction.findMany({
    where: { walletId, status: 'CONFIRMED' }, select: { type: true, amount: true },
  })
  const credits = rows.filter(t => t.type.toUpperCase() === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0)
  const debits  = rows.filter(t => t.type.toUpperCase() === 'DEBIT' ).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  return credits - debits
}

// ── Core: attempt a serializable debit (mirrors route logic, no retry wrapper) ──

type TxOutcome = { status: 'committed'; debitId: string } | { status: 'aborted'; error: string }

async function attemptSerializableDebit(walletId: string, debitAmount: number): Promise<TxOutcome> {
  try {
    const id = await testPrisma.$transaction(
      async (tx) => {
        const w = await tx.clientWallet.findUnique({
          where: { id: walletId }, include: { transactions: { where: { status: 'CONFIRMED' } } },
        })
        if (!w) throw new Error('Wallet not found')
        const credits = w.transactions.filter((t: any) => t.type.toUpperCase() === 'CREDIT').reduce((s: number, t: any) => s + Number(t.amount), 0)
        const debits  = w.transactions.filter((t: any) => t.type.toUpperCase() === 'DEBIT' ).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
        if (credits - debits < debitAmount) throw new Error(`Insufficient credits`)
        const d = await tx.walletTransaction.create({
          data: { walletId, type: 'DEBIT', amount: debitAmount, status: 'CONFIRMED', description: 'CP03 test' },
        })
        return d.id
      },
      { isolationLevel: 'Serializable', timeout: 10000 },
    )
    return { status: 'committed', debitId: id }
  } catch (err: any) {
    return { status: 'aborted', error: err?.message ?? String(err) }
  }
}

// ── GROUP 1: PostgreSQL isolation ─────────────────────────────────────────────

describe('CP-03 Group 1 — SERIALIZABLE isolation (concurrent $60 debits on $80 wallet)', () => {
  let fixture: Fixture
  let outcomes: TxOutcome[]

  beforeAll(async () => {
    fixture  = await createFixture(80)
    outcomes = await Promise.all([
      attemptSerializableDebit(fixture.walletId, 60),
      attemptSerializableDebit(fixture.walletId, 60),
    ])
  })
  afterAll(() => cleanup(fixture))

  it('CP03-CONC-01: at least one transaction committed (non-vacuous)', () => {
    expect(outcomes.filter(o => o.status === 'committed').length).toBeGreaterThanOrEqual(1)
  })

  it('CP03-CONC-02: at most one transaction committed (no double-spend)', () => {
    expect(outcomes.filter(o => o.status === 'committed').length).toBeLessThanOrEqual(1)
  })

  it('CP03-CONC-03: exactly one DEBIT row in the database', async () => {
    const debits = await testPrisma.walletTransaction.findMany({
      where: { walletId: fixture.walletId, type: 'DEBIT', status: 'CONFIRMED' },
    })
    expect(debits.length).toBe(1)
  })

  it('CP03-CONC-04: wallet balance is exactly $20 (not negative)', async () => {
    expect(await readBalance(fixture.walletId)).toBe(20)
  })

  it('CP03-CONC-05: aborted transaction returns a recognisable error', () => {
    const aborted = outcomes.filter(o => o.status === 'aborted')
    expect(aborted.length).toBeGreaterThanOrEqual(1)
    for (const a of aborted) {
      if (a.status !== 'aborted') continue
      expect(
        a.error.includes('P2034') ||
        a.error.includes('serializ') ||
        a.error.includes('Insufficient') ||
        a.error.includes('could not serialize')
      ).toBe(true)
    }
  })
})

describe('CP-03 Group 1 — boundary: balance exactly equals debit', () => {
  let fixture: Fixture
  beforeAll(async () => { fixture = await createFixture(60) })
  afterAll(() => cleanup(fixture))

  it('CP03-CONC-06: single debit equal to balance succeeds', async () => {
    const o = await attemptSerializableDebit(fixture.walletId, 60)
    expect(o.status).toBe('committed')
    expect(await readBalance(fixture.walletId)).toBe(0)
  })
})

describe('CP-03 Group 1 — debit exceeds balance', () => {
  let fixture: Fixture
  beforeAll(async () => { fixture = await createFixture(40) })
  afterAll(() => cleanup(fixture))

  it('CP03-CONC-07: single debit exceeding balance is rejected; no debit row written', async () => {
    const o = await attemptSerializableDebit(fixture.walletId, 60)
    expect(o.status).toBe('aborted')
    if (o.status === 'aborted') expect(o.error).toMatch(/Insufficient/i)
    const debits = await testPrisma.walletTransaction.findMany({
      where: { walletId: fixture.walletId, type: 'DEBIT' },
    })
    expect(debits.length).toBe(0)
    expect(await readBalance(fixture.walletId)).toBe(40)
  })
})

// ── GROUP 2: withSerializableRetry production helper ──────────────────────────

describe('CP-03 Group 2 — withSerializableRetry production helper', () => {

  // RETRY-01: P2034 on first attempt → retried → second attempt succeeds
  it('CP03-RETRY-01: P2034 on first call causes a retry; second call succeeds', async () => {
    let attempts = 0
    const result = await withSerializableRetry(
      async () => {
        attempts++
        if (attempts === 1) {
          // Simulate a serialization failure on the first attempt
          const err = Object.assign(new Error('Serialization failure'), {
            code: 'P2034',
            clientVersion: '5.22.0',
          })
          // withSerializableRetry checks instanceof PrismaClientKnownRequestError;
          // set the prototype to match
          Object.setPrototypeOf(err, (await import('@prisma/client/runtime/library')).PrismaClientKnownRequestError.prototype)
          throw err
        }
        return 'success-on-retry'
      },
      { operationName: 'cp03-retry-01-test', maxRetries: 2 },
    )
    expect(result).toBe('success-on-retry')
    expect(attempts).toBe(2)
  })

  // RETRY-02: Insufficient funds inside SERIALIZABLE → not retried → rejected
  it('CP03-RETRY-02: Insufficient credits error is not retried', async () => {
    let attempts = 0
    await expect(
      withSerializableRetry(
        async () => {
          attempts++
          throw new Error('Insufficient credits. You have $40.00 but need $60.00')
        },
        { operationName: 'cp03-retry-02-test', maxRetries: 2 },
      )
    ).rejects.toThrow('Insufficient credits')
    // Should not retry — insufficient funds is a business error, not serialization
    expect(attempts).toBe(1)
  })

  // RETRY-03: P2034 exhausted → rethrown after maxRetries
  it('CP03-RETRY-03: P2034 exhausted after maxRetries is rethrown', async () => {
    let attempts = 0
    const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/library')

    await expect(
      withSerializableRetry(
        async () => {
          attempts++
          const err = new PrismaClientKnownRequestError('Serialization failure', {
            code: 'P2034', clientVersion: '5.22.0',
          })
          throw err
        },
        { operationName: 'cp03-retry-03-test', maxRetries: 2 },
      )
    ).rejects.toMatchObject({ code: 'P2034' })
    expect(attempts).toBe(3)   // 1 original + 2 retries
  })

  // RETRY-04: Non-P2034 error → rethrown immediately with no retry
  it('CP03-RETRY-04: non-serialization errors are rethrown immediately', async () => {
    let attempts = 0
    await expect(
      withSerializableRetry(
        async () => {
          attempts++
          throw new Error('Some unrelated database error')
        },
        { operationName: 'cp03-retry-04-test', maxRetries: 2 },
      )
    ).rejects.toThrow('Some unrelated database error')
    expect(attempts).toBe(1)
  })

  // RETRY-05: booking + debit both roll back when tx throws inside SERIALIZABLE
  it('CP03-RETRY-05: booking row and debit row both roll back on transaction failure', async () => {
    const fixture = await createFixture(100)

    // Create a provider + customer for booking
    const provUser = await testPrisma.user.create({
      data: { email: `cp03r5_prov_${Date.now()}@test.invalid`, name: 'CP03 Prov', role: 'INSTRUCTOR' },
    })
    const provider = await testPrisma.provider.create({
      data: {
        user: { connect: { id: provUser.id } },
        name: 'CP03 Prov', phone: '0400000000', hourlyRate: 50,
        approvalStatus: 'APPROVED', isActive: true, subscriptionStatus: 'ACTIVE', subscriptionTier: 'STANDARD',
      } as any,
    })
    const customer = await testPrisma.customer.create({
      data: {
        user: { connect: { id: fixture.userId } },
        name: 'CP03 Customer', email: `cp03r5_cust_${Date.now()}@test.invalid`, phone: '0400000000',
      } as any,
    })

    let bookingIdCreatedInsideTx: string | null = null

    await expect(
      withSerializableRetry(
        () => testPrisma.$transaction(
          async (tx) => {
            // Create a booking
            const booking = await tx.booking.create({
              data: {
                provider:  { connect: { id: provider.id } },
                customer:  { connect: { id: customer.id } },
                bookingType: 'LESSON', status: 'CONFIRMED',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                endTime:   new Date(Date.now() + 25 * 60 * 60 * 1000),
                duration: 1, price: 50, createdBy: 'customer',
                isPaid: true, paidAt: new Date(),
              } as any,
            })
            bookingIdCreatedInsideTx = booking.id

            // Create a debit
            await tx.walletTransaction.create({
              data: { walletId: fixture.walletId, type: 'DEBIT', amount: 50, status: 'CONFIRMED', description: 'CP03 rollback test' },
            })

            // Throw deliberately — simulates a constraint violation or business error
            // after both rows were written but before commit
            throw new Error('Deliberate failure to test rollback')
          },
          { isolationLevel: 'Serializable', timeout: 10000 },
        ),
        { operationName: 'cp03-retry-05-test', maxRetries: 0 },
      )
    ).rejects.toThrow('Deliberate failure to test rollback')

    // Booking must not exist in DB
    if (bookingIdCreatedInsideTx) {
      const booking = await testPrisma.booking.findUnique({ where: { id: bookingIdCreatedInsideTx } })
      expect(booking).toBeNull()
    }

    // Debit must not exist in DB
    const debits = await testPrisma.walletTransaction.findMany({
      where: { walletId: fixture.walletId, type: 'DEBIT' },
    })
    expect(debits.length).toBe(0)

    // Balance unchanged
    expect(await readBalance(fixture.walletId)).toBe(100)

    // Cleanup
    await testPrisma.customer.delete({ where: { id: customer.id } })
    await testPrisma.provider.delete({ where: { id: provider.id } })
    await testPrisma.user.delete({ where: { id: provUser.id } })
    await cleanup(fixture)
  })
})

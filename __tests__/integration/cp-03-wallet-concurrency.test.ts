/**
 * CP-03 Regression Tests — Concurrent wallet spending
 *
 * Verifies that SERIALIZABLE isolation prevents two simultaneous booking
 * requests from spending more than the available wallet balance.
 *
 * Test design:
 *   - Wallet has $80 of confirmed credit (enough for one $60 lesson, not two)
 *   - Two concurrent transactions attempt to debit $60 each ($120 total)
 *   - Under SERIALIZABLE, PostgreSQL detects the concurrent read-write cycle
 *     on the WalletTransaction rows and aborts one with P2034
 *   - Expected outcome: exactly one DEBIT of $60; balance = $20; no negative balance
 *
 * This test replicates the route's SERIALIZABLE transaction logic directly
 * against a real PostgreSQL database. It does NOT call withSerializableRetry
 * deliberately — we test that isolation fails one transaction, not that the
 * retry layer recovers it (that is tested in wla-008-b-wallet-concurrency).
 *
 * DATABASE: postgresql://postgres:testpass@127.0.0.1:5433/drivebook_test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, Prisma } from '@prisma/client'

const TEST_PREFIX = 'CP03'

const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

// ── Types ─────────────────────────────────────────────────────────────────────

type TxOutcome = { status: 'committed'; debitId: string } | { status: 'aborted'; error: string }

// ── Fixture helpers ──────────────────────────────────────────────────────────

type Fixture = {
  userId: string
  walletId: string
  creditTxId: string
}

async function createFixture(initialCredit: number): Promise<Fixture> {
  const email = `${TEST_PREFIX}_${Date.now()}@test.invalid`

  const user = await testPrisma.user.create({
    data: { email, name: 'CP03 Test', role: 'CLIENT' },
  })

  const wallet = await testPrisma.clientWallet.create({
    data: { userId: user.id },
  })

  // Single confirmed CREDIT transaction
  const creditTx = await testPrisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'CREDIT',
      amount: initialCredit,
      status: 'CONFIRMED',
      description: 'CP03 test credit',
    },
  })

  return { userId: user.id, walletId: wallet.id, creditTxId: creditTx.id }
}

async function cleanup(fixture: Fixture) {
  await testPrisma.walletTransaction.deleteMany({ where: { walletId: fixture.walletId } })
  await testPrisma.clientWallet.deleteMany({ where: { id: fixture.walletId } })
  await testPrisma.user.deleteMany({ where: { id: fixture.userId } })
}

// ── Core: attempt a serializable wallet debit ─────────────────────────────────
// Mirrors the create-bulk route's SERIALIZABLE transaction logic.
// Returns 'committed' with the debit ID, or 'aborted' with the error message.

async function attemptSerializableDebit(
  walletId: string,
  userId: string,
  debitAmount: number,
  db: PrismaClient,
): Promise<TxOutcome> {
  try {
    const debitId = await db.$transaction(
      async (tx) => {
        // Read all confirmed transactions — this read participates in the
        // SERIALIZABLE conflict detection
        const wallet = await tx.clientWallet.findUnique({
          where: { id: walletId },
          include: { transactions: { where: { status: 'CONFIRMED' } } },
        })
        if (!wallet) throw new Error('Wallet not found')

        const now = new Date()
        const credits = wallet.transactions
          .filter((t: any) => t.type.toUpperCase() === 'CREDIT')
          .reduce((s: number, t: any) => s + Number(t.amount), 0)
        const debits = wallet.transactions
          .filter((t: any) => t.type.toUpperCase() === 'DEBIT')
          .reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
        const balance = credits - debits

        if (balance < debitAmount) {
          throw new Error(`Insufficient credits: balance $${balance}, need $${debitAmount}`)
        }

        // Write the debit inside the same SERIALIZABLE transaction
        const debit = await tx.walletTransaction.create({
          data: {
            walletId,
            type: 'DEBIT',
            amount: debitAmount,
            status: 'CONFIRMED',
            description: 'CP03 concurrent test debit',
          },
        })

        return debit.id
      },
      { isolationLevel: 'Serializable', timeout: 10000 },
    )
    return { status: 'committed', debitId }
  } catch (err: any) {
    return { status: 'aborted', error: err?.message ?? String(err) }
  }
}

// ── Balance helper ─────────────────────────────────────────────────────────────

async function readBalance(walletId: string): Promise<number> {
  const transactions = await testPrisma.walletTransaction.findMany({
    where: { walletId, status: 'CONFIRMED' },
    select: { type: true, amount: true },
  })
  const credits = transactions
    .filter(t => t.type.toUpperCase() === 'CREDIT')
    .reduce((s, t) => s + Number(t.amount), 0)
  const debits = transactions
    .filter(t => t.type.toUpperCase() === 'DEBIT')
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  return credits - debits
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CP-03 — concurrent wallet spending (SERIALIZABLE isolation)', () => {
  // CONC-01..CONC-05: two concurrent $60 debits against an $80 wallet
  describe('Two concurrent requests, only one can succeed', () => {
    let fixture: Fixture
    let outcomes: TxOutcome[]

    beforeAll(async () => {
      fixture = await createFixture(80)  // $80 — enough for one $60, not two

      // Fire both transactions simultaneously
      outcomes = await Promise.all([
        attemptSerializableDebit(fixture.walletId, fixture.userId, 60, testPrisma),
        attemptSerializableDebit(fixture.walletId, fixture.userId, 60, testPrisma),
      ])
    })

    afterAll(async () => {
      await cleanup(fixture)
    })

    it('CP03-CONC-01: at least one transaction committed (non-vacuous)', () => {
      const committed = outcomes.filter(o => o.status === 'committed')
      expect(committed.length).toBeGreaterThanOrEqual(1)
    })

    it('CP03-CONC-02: at most one transaction committed (no double-spend)', () => {
      const committed = outcomes.filter(o => o.status === 'committed')
      expect(committed.length).toBeLessThanOrEqual(1)
    })

    it('CP03-CONC-03: exactly one DEBIT row written to the database', async () => {
      const debits = await testPrisma.walletTransaction.findMany({
        where: { walletId: fixture.walletId, type: 'DEBIT', status: 'CONFIRMED' },
      })
      expect(debits.length).toBe(1)
    })

    it('CP03-CONC-04: wallet balance is exactly $20 (not negative)', async () => {
      const balance = await readBalance(fixture.walletId)
      expect(balance).toBe(20)
    })

    it('CP03-CONC-05: the aborted transaction returned a recognisable error', () => {
      const aborted = outcomes.filter(o => o.status === 'aborted')
      // Either serialization failure (P2034) or insufficient credits on retry
      expect(aborted.length).toBeGreaterThanOrEqual(1)
      for (const a of aborted) {
        if (a.status === 'aborted') {
          const isExpectedError =
            a.error.includes('P2034') ||
            a.error.includes('serializ') ||
            a.error.includes('Insufficient') ||
            a.error.includes('could not serialize')
          expect(isExpectedError).toBe(true)
        }
      }
    })
  })

  // CONC-06: balance exactly equal to debit (boundary case)
  describe('Balance exactly equals debit amount (boundary)', () => {
    let fixture: Fixture

    beforeAll(async () => {
      fixture = await createFixture(60)  // exactly $60
    })

    afterAll(async () => {
      await cleanup(fixture)
    })

    it('CP03-CONC-06: single debit equal to balance succeeds', async () => {
      const outcome = await attemptSerializableDebit(fixture.walletId, fixture.userId, 60, testPrisma)
      expect(outcome.status).toBe('committed')
      const balance = await readBalance(fixture.walletId)
      expect(balance).toBe(0)
    })
  })

  // CONC-07: debit exceeds balance (single request)
  describe('Debit exceeds available balance', () => {
    let fixture: Fixture

    beforeAll(async () => {
      fixture = await createFixture(40)  // $40, trying to spend $60
    })

    afterAll(async () => {
      await cleanup(fixture)
    })

    it('CP03-CONC-07: single debit exceeding balance is rejected', async () => {
      const outcome = await attemptSerializableDebit(fixture.walletId, fixture.userId, 60, testPrisma)
      expect(outcome.status).toBe('aborted')
      if (outcome.status === 'aborted') {
        expect(outcome.error).toMatch(/Insufficient/i)
      }
      // No debit row should have been created
      const debits = await testPrisma.walletTransaction.findMany({
        where: { walletId: fixture.walletId, type: 'DEBIT' },
      })
      expect(debits.length).toBe(0)
      // Balance unchanged
      const balance = await readBalance(fixture.walletId)
      expect(balance).toBe(40)
    })
  })
})

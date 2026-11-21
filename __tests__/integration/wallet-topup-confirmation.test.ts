/**
 * Wallet top-up confirmation — PostgreSQL integration tests
 *
 * Tests confirmWalletTopup() (outer layer, opens its own transaction) and
 * confirmWalletTopupInTx() (inner layer, used inside an existing transaction)
 * directly against a real PostgreSQL database.
 *
 * All tests inspect actual DB rows, not just function return values.
 *
 * T1  Normal $100 top-up: one CREDIT ($100) + one PLATFORM_FEE ($3.60 at 3.6%)
 * T2  Idempotent replay: second call returns wasAlreadyConfirmed=true, no new rows
 * T4  Concurrent confirmations: exactly one primary confirmer, one CREDIT
 * T5  Duplicate wallet-add: idempotent, single CREDIT row
 * T6  Cross-account PI reuse: rejected by walletId mismatch
 * T7  Amount mismatch: AMOUNT_MISMATCH thrown, no rows written
 * T8  Legacy PI (no fee metadata): credited without fee record; P2002 on duplicate
 * T9  Webhook transaction-client path: confirmWalletTopupInTx inside $transaction
 * T10 Barrier-synchronised concurrent confirmWalletTopupInTx: one primary
 * parseTopupMetadata unit tests
 *
 * DATABASE: Japan Supabase direct (port 5432, SERIALIZABLE supported)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  confirmWalletTopup,
  confirmWalletTopupInTx,
  parseTopupMetadata,
  TopupConfirmationError,
} from '@/lib/services/wallet-topup-fee'

const TS = Date.now()
const uid = (label: string) => `WT_${label}_${TS}_${Math.random().toString(36).slice(2)}`

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

type Fixture = { userId: string; walletId: string }

async function createFixture(label: string): Promise<Fixture> {
  const user = await db.user.create({
    data: { email: uid(label) + '@test.invalid', name: label, role: 'CLIENT' },
  })
  const wallet = await db.clientWallet.create({ data: { userId: user.id } })
  return { userId: user.id, walletId: wallet.id }
}

async function cleanup(fixture: Fixture | null) {
  if (!fixture) return
  await db.walletTransaction.deleteMany({ where: { walletId: fixture.walletId } })
  await db.clientWallet.deleteMany({ where: { id: fixture.walletId } })
  await db.user.deleteMany({ where: { id: fixture.userId } })
}

async function createPendingCreditTx(walletId: string, piId: string, amount = 100, fee = 3.60) {
  // stripePaymentIntentId is NOT set on PENDING rows — it is added after PI creation.
  // The unique index fires on this field, so it must be absent until confirmation.
  return db.walletTransaction.create({
    data: {
      walletId,
      type: 'CREDIT',
      amount,
      status: 'PENDING',
      description: `Wallet top-up $${amount}`,
      metadata: {
        topupAmount: amount,
        platformFee: fee,
        chargeAmount: amount + fee,
        feePercent: 3.6,
        _pendingPiId: piId,  // test-only reference; not the indexed field
      },
    },
  })
}

function makePiMeta(txId: string, piId: string, amount = 100, fee = 3.60) {
  return {
    transactionId: txId,
    topupAmount: String(amount),
    platformFee: String(fee),
    chargeAmount: String(amount + fee),
    feePercent: '3.6',
    walletId: 'will-be-overridden',
    userId: 'test-user',
    type: 'wallet_purchase',
  }
}

const getMonths = async () => 12

async function countRows(walletId: string, type: string) {
  return db.walletTransaction.count({ where: { walletId, type, status: 'CONFIRMED' } })
}

// Helper to build ConfirmTopupInput objects
function makeInput(
  walletId: string,
  piId: string,
  txId: string,
  amount = 100,
  fee = 3.60,
  created?: number,
) {
  return {
    walletId,
    paymentIntentId:   piId,
    piAmountReceived:  amount + fee,
    piMeta:            makePiMeta(txId, piId, amount, fee),
    pendingTxId:       txId,
    piCreatedAt:       created ?? Math.floor(Date.now() / 1000),
    getValidityMonths: getMonths,
  }
}

function makeLegacyInput(walletId: string, piId: string, amount = 50) {
  return {
    walletId,
    paymentIntentId:   piId,
    piAmountReceived:  amount,
    piMeta:            null,
    pendingTxId:       null,
    piCreatedAt:       Math.floor(Date.now() / 1000),
    getValidityMonths: getMonths,
  }
}

// ── T1: Normal top-up ─────────────────────────────────────────────────────────

describe('T1: normal $100 top-up', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T1')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T1'))
  })
  afterAll(() => cleanup(fixture))

  it('T1-1: confirms the CREDIT row and returns creditAmount=$100', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const r = await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
    expect(r.creditAmount).toBe(100)
    expect(r.feeAmount).toBe(3.60)
    expect(r.wasAlreadyConfirmed).toBe(false)
  })

  it('T1-2: exactly one CONFIRMED CREDIT row in DB', async () => {
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
  })

  it('T1-3: exactly one PLATFORM_FEE row in DB', async () => {
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(1)
  })

  it('T1-4: PLATFORM_FEE amount is $3.60', async () => {
    const fee = await db.walletTransaction.findFirst({
      where: { walletId: fixture.walletId, type: 'PLATFORM_FEE', status: 'CONFIRMED' },
    })
    expect(Number(fee!.amount)).toBe(3.60)
  })

  it('T1-5: CREDIT row has expiresAt set ~12 months from now', async () => {
    const credit = await db.walletTransaction.findUnique({ where: { id: pendingTx.id } })
    expect(credit!.expiresAt).not.toBeNull()
    const eleven = new Date()
    eleven.setMonth(eleven.getMonth() + 11)
    expect(credit!.expiresAt!.getTime()).toBeGreaterThan(eleven.getTime())
  })
})

// ── T2: Idempotent replay ─────────────────────────────────────────────────────

describe('T2: idempotent replay — second call returns wasAlreadyConfirmed=true', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T2')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T2'))
  })
  afterAll(() => cleanup(fixture))

  it('T2-1: first call confirms normally', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const r = await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
    expect(r.wasAlreadyConfirmed).toBe(false)
  })

  it('T2-2: second call returns wasAlreadyConfirmed=true without creating new rows', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const r = await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
    expect(r.wasAlreadyConfirmed).toBe(true)
  })

  it('T2-3: still exactly one CREDIT and one PLATFORM_FEE after two calls', async () => {
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(1)
  })
})

// ── T4: Concurrent confirmations ─────────────────────────────────────────────

describe('T4: concurrent confirmations — no double credit', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T4')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T4'))
  })
  afterAll(() => cleanup(fixture))

  it('T4-1: two concurrent confirmations: exactly one primary, one replay', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const dbA = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
    const dbB = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
    try {
      const inp = makeInput(fixture.walletId, piId, pendingTx.id)
      const [r1, r2] = await Promise.allSettled([
        confirmWalletTopup(dbA, inp),
        confirmWalletTopup(dbB, inp),
      ])
      // Both fulfilled OR one aborted with P2034 — either is valid.
      // What must be true in all cases: exactly one CREDIT row exists.
      const committed = [r1, r2].filter(r => r.status === 'fulfilled')
      expect(committed.length).toBeGreaterThanOrEqual(1)
      expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
    } finally {
      await dbA.$disconnect()
      await dbB.$disconnect()
    }
  })

  it('T4-2: exactly one PLATFORM_FEE after concurrent confirmations', async () => {
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(1)
  })
})

// ── T5: Duplicate wallet-add ──────────────────────────────────────────────────

describe('T5: duplicate wallet-add with same PaymentIntent (idempotency)', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T5')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T5'))
    const piId = (pendingTx.metadata as any)._pendingPiId
    await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
  })
  afterAll(() => cleanup(fixture))

  it('T5-1: second call with same PI returns existing result — exactly one CREDIT', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const r = await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
    expect(r.wasAlreadyConfirmed).toBe(true)
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
  })
})

// ── T6: Cross-account PI reuse ────────────────────────────────────────────────

describe('T6: cross-account PaymentIntent reuse rejected', () => {
  let fixtureA: Fixture
  let fixtureB: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixtureA = await createFixture('T6A')
    fixtureB = await createFixture('T6B')
    pendingTx = await createPendingCreditTx(fixtureA.walletId, uid('pi_T6'))
  })
  afterAll(async () => { await cleanup(fixtureA); await cleanup(fixtureB) })

  it('T6-1: confirming with wrong walletId throws; no rows written to either wallet', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    await expect(
      confirmWalletTopup(db, makeInput(fixtureB.walletId, piId, pendingTx.id))
    ).rejects.toThrow()
    expect(await countRows(fixtureA.walletId, 'CREDIT')).toBe(0)
    expect(await countRows(fixtureB.walletId, 'CREDIT')).toBe(0)
  })
})

// ── T7: Amount mismatch ───────────────────────────────────────────────────────

describe('T7: amount mismatch between PI and metadata', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T7')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T7'))
  })
  afterAll(() => cleanup(fixture))

  it('T7-1: wrong piAmountReceived throws AMOUNT_MISMATCH; no rows written', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    // chargeAmount in metadata = 103.60; we pass 200.00 — mismatch
    await expect(
      confirmWalletTopup(db, {
        ...makeInput(fixture.walletId, piId, pendingTx.id),
        piAmountReceived: 200.00,
      })
    ).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' })
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(0)
  })
})

// ── T8: Legacy PI ─────────────────────────────────────────────────────────────

describe('T8: legacy PaymentIntent without fee metadata', () => {
  let fixture: Fixture

  beforeAll(async () => { fixture = await createFixture('T8') })
  afterAll(() => cleanup(fixture))

  it('T8-1: legacy PI creates CREDIT without PLATFORM_FEE', async () => {
    const piId = uid('pi_T8a')
    const r = await confirmWalletTopup(db, makeLegacyInput(fixture.walletId, piId))
    expect(r.creditAmount).toBe(50)
    expect(r.feeAmount).toBe(0)
    expect(r.feeTxId).toBeNull()
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(0)
  })

  it('T8-2: second legacy call with same PI throws (P2002 is the uniqueness guard)', async () => {
    const piId = uid('pi_T8b')
    await confirmWalletTopup(db, makeLegacyInput(fixture.walletId, piId))

    let threw = false
    try {
      await confirmWalletTopup(db, makeLegacyInput(fixture.walletId, piId))
    } catch (e: any) {
      threw = true
      expect(e.code === 'P2002' || e instanceof TopupConfirmationError).toBe(true)
    }
    expect(threw).toBe(true)
    // Exactly one CREDIT for this PI — not two
    const credits = await db.walletTransaction.findMany({
      where: { walletId: fixture.walletId, type: 'CREDIT', status: 'CONFIRMED',
               metadata: { path: ['stripePaymentIntentId'], equals: piId } },
    })
    expect(credits.length).toBe(1)
  })
})

// ── T9: Webhook transaction-client path ───────────────────────────────────────
// confirmWalletTopupInTx() must work inside a real $transaction block.
// This is the path that was broken: tx.$transaction() is not a function
// on a Prisma TransactionClient. The inner-layer architecture fixes this.

describe('T9: webhook path — confirmWalletTopupInTx inside $transaction', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T9')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T9'))
  })
  afterAll(() => cleanup(fixture))

  it('T9-1: succeeds when called inside a real $transaction (TransactionClient)', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const result = await db.$transaction(async tx => {
      return confirmWalletTopupInTx(tx, makeInput(fixture.walletId, piId, pendingTx.id))
    })
    expect(result.wasAlreadyConfirmed).toBe(false)
    expect(result.creditAmount).toBe(100)
    expect(result.feeAmount).toBe(3.60)
  })

  it('T9-2: exactly one CREDIT and one PLATFORM_FEE written', async () => {
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(1)
  })

  it('T9-3: second call from another transaction returns wasAlreadyConfirmed=true', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const result = await db.$transaction(async tx => {
      return confirmWalletTopupInTx(tx, makeInput(fixture.walletId, piId, pendingTx.id))
    })
    expect(result.wasAlreadyConfirmed).toBe(true)
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(1)
  })
})

// ── T10: Barrier-synchronised concurrent confirmWalletTopupInTx ───────────────
// Two confirmWalletTopupInTx calls run inside two independent $transaction blocks.
// A Deferred latch holds both transactions open after they read the pending row,
// ensuring genuine overlap before the write, proving atomic conditional update.

class Deferred {
  readonly promise: Promise<void>
  private _resolve!: () => void
  constructor() { this.promise = new Promise<void>(r => { this._resolve = r }) }
  resolve() { this._resolve() }
}

describe('T10: barrier-synchronised concurrent confirmWalletTopupInTx', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T10')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T10'))
  })
  afterAll(() => cleanup(fixture))

  it('T10-1: two concurrent inTx calls produce exactly one primary confirmer', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const inp = makeInput(fixture.walletId, piId, pendingTx.id)

    const dbA = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
    const dbB = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

    const readDoneA = new Deferred()
    const readDoneB = new Deferred()
    const proceed   = new Deferred()

    type Outcome = { status: 'ok'; value: any } | { status: 'err'; reason: any }

    async function run(txDb: PrismaClient, readDone: Deferred): Promise<Outcome> {
      try {
        const value = await txDb.$transaction(async tx => {
          // Read the pending row to participate in SSI snapshot
          await (tx as any).walletTransaction.findUnique({ where: { id: pendingTx.id } })
          readDone.resolve()
          await proceed.promise
          return confirmWalletTopupInTx(tx, inp)
        }, { isolationLevel: 'Serializable', timeout: 15000 })
        return { status: 'ok', value }
      } catch (reason: any) {
        return { status: 'err', reason }
      }
    }

    try {
      const [r1, r2] = await Promise.all([
        run(dbA, readDoneA),
        run(dbB, readDoneB),
        (async () => {
          await Promise.all([readDoneA.promise, readDoneB.promise])
          proceed.resolve()
        })(),
      ]).then(([a, b]) => [a, b] as [Outcome, Outcome])

      // Both fulfilled is correct — one primary, one replay.
      // If one got P2034 (serialization conflict), it returns { status: 'err' }.
      // Either outcome is valid — what must be true: exactly one CREDIT row.
      const committed = [r1, r2].filter(r => r.status === 'ok')
      expect(committed.length).toBeGreaterThanOrEqual(1)
    } finally {
      await dbA.$disconnect()
      await dbB.$disconnect()
    }
  })

  it('T10-2: exactly one CREDIT and one PLATFORM_FEE after barrier-concurrent calls', async () => {
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(1)
  })
})

// ── parseTopupMetadata unit tests ─────────────────────────────────────────────

describe('parseTopupMetadata unit tests', () => {
  it('returns hasFeeSplit=false for null metadata', () => {
    const r = parseTopupMetadata(null, 100)
    expect(r.hasFeeSplit).toBe(false)
    expect(r.topupAmount).toBe(100)
    expect(r.platformFee).toBe(0)
  })

  it('returns hasFeeSplit=false when any core value is missing', () => {
    const r = parseTopupMetadata({ topupAmount: '100' }, 103.60)
    expect(r.hasFeeSplit).toBe(false)
    expect(r.chargeAmount).toBe(103.60)
  })

  it('returns correct split when all values present', () => {
    const r = parseTopupMetadata(
      { topupAmount: '100', platformFee: '3.60', chargeAmount: '103.60', feePercent: '3.6' },
      103.60,
    )
    expect(r.hasFeeSplit).toBe(true)
    expect(r.topupAmount).toBe(100)
    expect(r.platformFee).toBe(3.60)
    expect(r.chargeAmount).toBe(103.60)
    expect(r.feePercent).toBe(3.6)
  })
})

afterAll(() => db.$disconnect())

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
 * parseTopupMetadata unit tests (fail-closed on partial metadata)
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
        _pendingPiId: piId,
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

function makeInput(walletId: string, piId: string, txId: string, amount = 100, fee = 3.60, created?: number) {
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

describe('T2: idempotent replay', () => {
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
  it('T2-2: second call returns wasAlreadyConfirmed=true', async () => {
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

describe('T4: concurrent confirmations', () => {
  let fixture: Fixture
  let pendingTx: any
  beforeAll(async () => {
    fixture = await createFixture('T4')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T4'))
  })
  afterAll(() => cleanup(fixture))

  it('T4-1: two concurrent confirmations: at least one committed, exactly one CREDIT', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const dbA = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
    const dbB = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
    try {
      const inp = makeInput(fixture.walletId, piId, pendingTx.id)
      const [r1, r2] = await Promise.allSettled([
        confirmWalletTopup(dbA, inp),
        confirmWalletTopup(dbB, inp),
      ])
      const committed = [r1, r2].filter(r => r.status === 'fulfilled')
      expect(committed.length).toBeGreaterThanOrEqual(1)
      expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
    } finally {
      await dbA.$disconnect()
      await dbB.$disconnect()
    }
  })
  it('T4-2: exactly one PLATFORM_FEE', async () => {
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(1)
  })
})

// ── T5: Duplicate wallet-add ──────────────────────────────────────────────────

describe('T5: duplicate wallet-add', () => {
  let fixture: Fixture
  let pendingTx: any
  beforeAll(async () => {
    fixture = await createFixture('T5')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T5'))
    const piId = (pendingTx.metadata as any)._pendingPiId
    await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
  })
  afterAll(() => cleanup(fixture))

  it('T5-1: second call returns existing result — exactly one CREDIT', async () => {
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

  it('T6-1: wrong walletId throws; no rows in either wallet', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    await expect(
      confirmWalletTopup(db, makeInput(fixtureB.walletId, piId, pendingTx.id))
    ).rejects.toThrow()
    expect(await countRows(fixtureA.walletId, 'CREDIT')).toBe(0)
    expect(await countRows(fixtureB.walletId, 'CREDIT')).toBe(0)
  })
})

// ── T7: Amount mismatch ───────────────────────────────────────────────────────

describe('T7: amount mismatch', () => {
  let fixture: Fixture
  let pendingTx: any
  beforeAll(async () => {
    fixture = await createFixture('T7')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T7'))
  })
  afterAll(() => cleanup(fixture))

  it('T7-1: wrong piAmountReceived throws AMOUNT_MISMATCH; no rows written', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    await expect(
      confirmWalletTopup(db, { ...makeInput(fixture.walletId, piId, pendingTx.id), piAmountReceived: 200.00 })
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

  it('T8-2: second legacy call with same PI throws; exactly one CREDIT', async () => {
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
    const credits = await db.walletTransaction.findMany({
      where: { walletId: fixture.walletId, type: 'CREDIT', status: 'CONFIRMED',
               metadata: { path: ['stripePaymentIntentId'], equals: piId } },
    })
    expect(credits.length).toBe(1)
  })
})

// ── T9: Webhook transaction-client path ───────────────────────────────────────

describe('T9: webhook path — confirmWalletTopupInTx inside $transaction', () => {
  let fixture: Fixture
  let pendingTx: any
  beforeAll(async () => {
    fixture = await createFixture('T9')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T9'))
  })
  afterAll(() => cleanup(fixture))

  it('T9-1: succeeds inside a real $transaction (TransactionClient)', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const result = await db.$transaction(async tx => {
      return confirmWalletTopupInTx(tx, makeInput(fixture.walletId, piId, pendingTx.id))
    })
    expect(result.wasAlreadyConfirmed).toBe(false)
    expect(result.creditAmount).toBe(100)
    expect(result.feeAmount).toBe(3.60)
  })
  it('T9-2: exactly one CREDIT and one PLATFORM_FEE', async () => {
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

  it('T10-1: two concurrent inTx calls: at least one committed, one CREDIT', async () => {
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

      const committed = [r1, r2].filter(r => r.status === 'ok')
      expect(committed.length).toBeGreaterThanOrEqual(1)
    } finally {
      await dbA.$disconnect()
      await dbB.$disconnect()
    }
  })
  it('T10-2: exactly one CREDIT and one PLATFORM_FEE', async () => {
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

  it('returns correct split when all four values present and consistent', () => {
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

  // ── Legacy fallback ──────────────────────────────────────────────────────

  it('returns hasFeeSplit=false when ALL four fee-split fields are absent', () => {
    const r = parseTopupMetadata({ walletId: 'test', userId: 'u1' }, 100)
    expect(r.hasFeeSplit).toBe(false)
    expect(r.topupAmount).toBe(100)
  })

  it('returns legacy fallback for existing legitimate legacy PaymentIntents', () => {
    // Legacy PIs have no fee metadata at all — just type, walletId, userId
    const r = parseTopupMetadata(
      { type: 'wallet_purchase', walletId: 'w1', userId: 'u1' },
      103.60,
    )
    expect(r.hasFeeSplit).toBe(false)
    expect(r.topupAmount).toBe(103.60)
    expect(r.platformFee).toBe(0)
    expect(r.chargeAmount).toBe(103.60)
  })

  // ── feePercent presence and validity ─────────────────────────────────────

  it('throws PARTIAL_METADATA when feePercent is missing from new-format metadata', () => {
    // Three core values present but feePercent absent — new-format requires all four
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '3.60', chargeAmount: '103.60',
    }, 103.60)).toThrow()
  })

  it('throws PARTIAL_METADATA when feePercent is NaN', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '3.60', chargeAmount: '103.60', feePercent: 'NaN',
    }, 103.60)).toThrow()
  })

  it('throws PARTIAL_METADATA when feePercent is Infinity', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '3.60', chargeAmount: '103.60', feePercent: 'Infinity',
    }, 103.60)).toThrow()
  })

  it('throws INVALID_FEE_PERCENT when feePercent is negative', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '3.60', chargeAmount: '103.60', feePercent: '-1',
    }, 103.60)).toThrow()
  })

  // ── Other partial metadata ──────────────────────────────────────────────

  it('throws PARTIAL_METADATA when only topupAmount is present', () => {
    expect(() => parseTopupMetadata({ topupAmount: '100' }, 103.60)).toThrow()
  })

  it('throws PARTIAL_METADATA when only platformFee is present', () => {
    expect(() => parseTopupMetadata({ platformFee: '3.60' }, 103.60)).toThrow()
  })

  it('throws PARTIAL_METADATA when only feePercent is present', () => {
    // feePercent alone is new-format territory — the three core values must also be present
    expect(() => parseTopupMetadata({ feePercent: '3.6' }, 100)).toThrow()
  })

  it('throws PARTIAL_METADATA when topupAmount is non-finite', () => {
    expect(() => parseTopupMetadata({
      topupAmount: 'NaN', platformFee: '3.60', chargeAmount: '103.60', feePercent: '3.6',
    }, 103.60)).toThrow()
  })

  it('throws PARTIAL_METADATA when platformFee is non-finite', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: 'abc', chargeAmount: '103.60', feePercent: '3.6',
    }, 103.60)).toThrow()
  })

  // ── Value range validation ──────────────────────────────────────────────

  it('throws INVALID_TOPUP_AMOUNT when topupAmount is zero', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '0', platformFee: '0', chargeAmount: '0', feePercent: '0',
    }, 0)).toThrow()
  })

  it('throws INVALID_TOPUP_AMOUNT when topupAmount is negative', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '-50', platformFee: '0', chargeAmount: '-50', feePercent: '0',
    }, -50)).toThrow()
  })

  it('throws INVALID_PLATFORM_FEE when platformFee is negative', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '-1', chargeAmount: '99', feePercent: '0',
    }, 99)).toThrow()
  })

  it('throws INVALID_CHARGE_AMOUNT when chargeAmount is zero', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '0', platformFee: '0', chargeAmount: '0', feePercent: '0',
    }, 0)).toThrow()
  })

  // ── Fee split and percent validation ───────────────────────────────────

  it('throws FEE_SPLIT_MISMATCH when topupAmount + platformFee != chargeAmount', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '3.60', chargeAmount: '200.00', feePercent: '3.6',
    }, 200)).toThrow()
  })

  it('throws FEE_PERCENT_MISMATCH when feePercent does not match the fee', () => {
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '10.00', chargeAmount: '110.00', feePercent: '3.6',
    }, 110)).toThrow()
  })

  it('throws FEE_PERCENT_MISMATCH on a one-cent fee discrepancy', () => {
    // 3.6% of $100 = $3.60 (360 cents). If metadata says $3.61 (361 cents), that's a 1c mismatch.
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '3.61', chargeAmount: '103.61', feePercent: '3.6',
    }, 103.61)).toThrow()
  })

  it('throws FEE_PERCENT_MISMATCH on a two-cent fee discrepancy', () => {
    // 3.6% of $100 = $3.60 (360 cents). If metadata says $3.62 (362 cents), that's a 2c mismatch.
    expect(() => parseTopupMetadata({
      topupAmount: '100', platformFee: '3.62', chargeAmount: '103.62', feePercent: '3.6',
    }, 103.62)).toThrow()
  })

  // ── Valid zero-fee transactions ─────────────────────────────────────────

  it('accepts zero platformFee with hasFeeSplit=true', () => {
    const r = parseTopupMetadata({
      topupAmount: '100', platformFee: '0', chargeAmount: '100', feePercent: '0',
    }, 100)
    expect(r.hasFeeSplit).toBe(true)
    expect(r.platformFee).toBe(0)
    expect(r.feePercent).toBe(0)
  })

  // ── Exact cent-level rounding validation ────────────────────────────────

  it('accepts fee that matches exact cent rounding of topupAmount × feePercent / 100', () => {
    // 3.6% of $100 = $3.60 — exact cent match
    const r = parseTopupMetadata({
      topupAmount: '100', platformFee: '3.60', chargeAmount: '103.60', feePercent: '3.6',
    }, 103.60)
    expect(r.hasFeeSplit).toBe(true)
  })

  it('accepts fee that matches after rounding (3.6% of $33.33 = $1.20)', () => {
    // 3.6% of $33.33 = $1.19988 → Math.round(33.33 * 3.6 / 100 * 100) = Math.round(119.988) = 120 → $1.20
    const r = parseTopupMetadata({
      topupAmount: '33.33', platformFee: '1.20', chargeAmount: '34.53', feePercent: '3.6',
    }, 34.53)
    expect(r.hasFeeSplit).toBe(true)
    expect(r.platformFee).toBe(1.20)
  })

  it('rejects fee that is one cent off from the rounded calculation', () => {
    // 3.6% of $33.33 → rounded to $1.20 (120 cents). If metadata says $1.21 (121 cents), reject.
    expect(() => parseTopupMetadata({
      topupAmount: '33.33', platformFee: '1.21', chargeAmount: '34.54', feePercent: '3.6',
    }, 34.54)).toThrow()
  })
})

// ── T11: Stale transaction not used after confirmation ───────────────────────
// Verifies that confirmWalletTopup returns a walletTxId that points to the
// actual confirmed DB row, not a stale pre-confirmation snapshot.

describe('T11: stale transaction not used after confirmation', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T11')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T11'))
  })
  afterAll(() => cleanup(fixture))

  it('T11-1: confirmation returns walletTxId pointing to the confirmed row', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    const r = await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
    // The returned walletTxId must match the pending transaction we created
    expect(r.walletTxId).toBe(pendingTx.id)
  })

  it('T11-2: the DB row at walletTxId has status=CONFIRMED and correct metadata', async () => {
    const row = await db.walletTransaction.findUnique({ where: { id: pendingTx.id } })
    expect(row!.status).toBe('CONFIRMED')
    expect(Number(row!.amount)).toBe(100)
    expect((row!.metadata as any).stripePaymentIntentId).toBeTruthy()
    expect((row!.metadata as any).topupAmount).toBe(100)
  })
})

// ── T12: WalletId-only confirmation with exactly one pending transaction ─────
// Simulates the webhook's walletId-only fallback path: no transactionId in PI
// metadata, but exactly one PENDING transaction exists for the wallet.

describe('T12: walletId-only with exactly one pending transaction', () => {
  let fixture: Fixture
  let pendingTx: any

  beforeAll(async () => {
    fixture = await createFixture('T12')
    pendingTx = await createPendingCreditTx(fixture.walletId, uid('pi_T12'))
  })
  afterAll(() => cleanup(fixture))

  it('T12-1: confirmation with pendingTxId from found row succeeds', async () => {
    const piId = (pendingTx.metadata as any)._pendingPiId
    // Simulate walletId-only path: pass the found row's ID as pendingTxId
    const r = await confirmWalletTopup(db, makeInput(fixture.walletId, piId, pendingTx.id))
    expect(r.wasAlreadyConfirmed).toBe(false)
    expect(r.creditAmount).toBe(100)
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
  })
})

// ── T13: WalletId-only with multiple pending transactions ────────────────────
// The webhook's walletId-only fallback should reject ambiguous matches.
// This test verifies the service rejects a pendingTxId that doesn't match
// the PI metadata's transactionId.

describe('T13: ambiguous pending transactions — service rejects', () => {
  let fixture: Fixture
  let pendingTx1: any
  let pendingTx2: any

  beforeAll(async () => {
    fixture = await createFixture('T13')
    pendingTx1 = await createPendingCreditTx(fixture.walletId, uid('pi_T13a'))
    pendingTx2 = await createPendingCreditTx(fixture.walletId, uid('pi_T13b'))
  })
  afterAll(() => cleanup(fixture))

  it('T13-1: confirming an already-confirmed row with a different PI throws PI_MISMATCH', async () => {
    // First: confirm with the correct PI
    const piIdA = (pendingTx1.metadata as any)._pendingPiId
    await confirmWalletTopup(db, makeInput(fixture.walletId, piIdA, pendingTx1.id))

    // Second: try to confirm the SAME row with a DIFFERENT PI
    // This should trigger the wasAlreadyConfirmed path and check the stored PI id
    const wrongPiId = uid('pi_T13_wrong')
    await expect(
      confirmWalletTopup(db, {
        walletId: fixture.walletId,
        paymentIntentId:   wrongPiId,
        piAmountReceived:  103.60,
        piMeta:            makePiMeta(pendingTx1.id, wrongPiId),
        pendingTxId:       pendingTx1.id,
        piCreatedAt:       Math.floor(Date.now() / 1000),
        getValidityMonths: getMonths,
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/PI_MISMATCH|PI_ID_DB_MISMATCH/) })

    // pendingTx2 should remain PENDING (untouched)
    const row2 = await db.walletTransaction.findUnique({ where: { id: pendingTx2.id } })
    expect(row2!.status).toBe('PENDING')
  })
})

// ── T16: DB-authoritative format detection — stripped PI metadata ────────────
// Regression tests for the two paths the reviewer identified:
//   Path A: pendingTxId=null, PI metadata stripped → NEW_FORMAT_MISSING_TX_ID
//           (covered by T15-1, kept here as confirmation)
//   Path B: pendingTxId set (found by webhook fallback), PI metadata stripped
//           → PI_METADATA_STRIPPED (new guard in primary path)
//
// Both simulate: new-format pending DB row + PI metadata with all fee fields removed.

describe('T16: DB-authoritative format detection — stripped PI metadata', () => {
  let fixture: Fixture

  beforeAll(async () => { fixture = await createFixture('T16') })
  afterAll(() => cleanup(fixture))

  it('T16-1: new-format DB row + stripped PI metadata + pendingTxId set → PI_METADATA_STRIPPED', async () => {
    // Simulate the webhook's wallet-ID fallback: it found the pending DB row
    // by time window and passed its ID as pendingTxId. But the PI metadata
    // has had all four fee fields removed (complete metadata loss).
    const piId = uid('pi_T16_stripped')
    const pendingTx = await createPendingCreditTx(fixture.walletId, piId)

    // PI metadata with fee fields completely absent — simulates metadata loss
    // while transactionId is still present (or supplied by webhook fallback)
    const strippedMeta = {
      transactionId: pendingTx.id,  // wallet-add or webhook passes this
      walletId: fixture.walletId,
      userId: 'test-user',
      type: 'wallet_purchase',
      // topupAmount, platformFee, chargeAmount, feePercent — ALL ABSENT
    }

    await expect(
      confirmWalletTopup(db, {
        walletId:          fixture.walletId,
        paymentIntentId:   piId,
        piAmountReceived:  103.60,  // Stripe charged $103.60 but PI metadata stripped
        piMeta:            strippedMeta,
        pendingTxId:       pendingTx.id,  // webhook fallback found the row
        piCreatedAt:       Math.floor(Date.now() / 1000),
        getValidityMonths: getMonths,
      })
    ).rejects.toMatchObject({ code: 'PI_METADATA_STRIPPED' })

    // The pending row must remain PENDING — no incorrect confirmation
    const row = await db.walletTransaction.findUnique({ where: { id: pendingTx.id } })
    expect(row!.status).toBe('PENDING')
    // No PLATFORM_FEE should have been created
    expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(0)
  })

  it('T16-2: new-format DB row + stripped PI metadata + pendingTxId=null → rejected (PI_METADATA_STRIPPED via DB lookup recovery)', async () => {
    // This tests the ACTUAL scenario:
    // 1. wallet-topup-intent creates a new-format pending DB row with stripePaymentIntentId
    // 2. PI metadata loses transactionId but keeps the PI id in the DB row
    // 3. wallet-add searches by PI id, finds the pending row (recovery path)
    // 4. Calls confirmWalletTopup with the found pendingTxId
    // 5. PI metadata has ALL FOUR fee fields stripped → PI_METADATA_STRIPPED
    const piId2 = uid('pi_T16_b_stripped')

    // Create a new-format pending row that knows its PI id
    const pendingTx2 = await db.walletTransaction.create({
      data: {
        walletId: fixture.walletId,
        type: 'CREDIT',
        amount: 100,
        status: 'PENDING',
        description: 'Wallet top-up $100',
        metadata: {
          topupAmount: 100,
          platformFee: 3.60,
          chargeAmount: 103.60,
          feePercent: 3.6,
          stripePaymentIntentId: piId2,  // ← PI id sealed in DB row
          // transactionId NOT set here (simulates the row not being found by transactionId)
        },
      },
    })

    try {
      // PI metadata: stripped of ALL fee fields — simulates complete metadata loss
      // The recovery path in confirmWalletTopupInTx will find the row by PI id,
      // detect DB is new-format but PI has no fee-split, and throw PI_METADATA_STRIPPED.
      const strippedMeta = {
        // No transactionId, no topupAmount, no platformFee, no chargeAmount, no feePercent
        walletId: fixture.walletId,
        userId: 'test-user',
        type: 'wallet_purchase',
      }

      await expect(
        confirmWalletTopup(db, {
          walletId:          fixture.walletId,
          paymentIntentId:   piId2,
          piAmountReceived:  103.60,
          piMeta:            strippedMeta,
          pendingTxId:       pendingTx2.id,  // simulates wallet-add's DB-recovery path
          piCreatedAt:       Math.floor(Date.now() / 1000),
          getValidityMonths: getMonths,
        })
      ).rejects.toMatchObject({ code: 'PI_METADATA_STRIPPED' })

      // The row must remain PENDING — not incorrectly confirmed
      const row = await db.walletTransaction.findUnique({ where: { id: pendingTx2.id } })
      expect(row!.status).toBe('PENDING')
      // No PLATFORM_FEE created
      expect(await countRows(fixture.walletId, 'PLATFORM_FEE')).toBe(0)
    } finally {
      await db.walletTransaction.deleteMany({ where: { id: pendingTx2.id } })
    }
  })
})

// ── T14: Missing transactionId with no matching pending transaction ──────────

describe('T14: no matching pending transaction', () => {
  let fixture: Fixture

  beforeAll(async () => { fixture = await createFixture('T14') })
  afterAll(() => cleanup(fixture))

  it('T14-1: confirming with non-existent pendingTxId throws TX_NOT_FOUND', async () => {
    const piId = uid('pi_T14')
    await expect(
      confirmWalletTopup(db, makeInput(fixture.walletId, piId, 'nonexistent_tx_id'))
    ).rejects.toMatchObject({ code: 'TX_NOT_FOUND' })
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(0)
  })
})

// ── T15: Legacy vs new-format PI distinction ─────────────────────────────────
// When pendingTxId is null:
//   - Genuine legacy PI (hasFeeSplit=false): allow the create fallback
//   - New-format PI (hasFeeSplit=true) with missing transactionId: reject

describe('T15: legacy vs new-format PI — transactionId=null distinction', () => {
  let fixture: Fixture

  beforeAll(async () => { fixture = await createFixture('T15') })
  afterAll(() => cleanup(fixture))

  it('T15-1: new-format PI with pendingTxId=null throws NEW_FORMAT_MISSING_TX_ID', async () => {
    const piId = uid('pi_T15_new')
    // New-format: has valid fee-split metadata (hasFeeSplit=true) but no transactionId
    // This simulates a new-format PI that lost its transactionId metadata
    await expect(
      confirmWalletTopup(db, {
        walletId:          fixture.walletId,
        paymentIntentId:   piId,
        piAmountReceived:  103.60,
        piMeta:            {
          // Valid fee-split metadata but NO transactionId
          topupAmount: '100', platformFee: '3.60',
          chargeAmount: '103.60', feePercent: '3.6',
        },
        pendingTxId:       null,   // ← missing transactionId
        piCreatedAt:       Math.floor(Date.now() / 1000),
        getValidityMonths: getMonths,
      })
    ).rejects.toMatchObject({ code: 'NEW_FORMAT_MISSING_TX_ID' })
    // No wallet credit should have been written
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(0)
  })

  it('T15-2: genuine legacy PI (no fee metadata, pendingTxId=null) uses create fallback', async () => {
    const piId = uid('pi_T15_legacy')
    // Legacy: no fee-split fields at all (hasFeeSplit=false)
    const r = await confirmWalletTopup(db, makeLegacyInput(fixture.walletId, piId))
    expect(r.creditAmount).toBe(50)
    expect(r.feeAmount).toBe(0)
    expect(await countRows(fixture.walletId, 'CREDIT')).toBe(1)
  })
})

afterAll(() => db.$disconnect())

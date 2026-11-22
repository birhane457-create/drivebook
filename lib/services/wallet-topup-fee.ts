/**
 * lib/services/wallet-topup-fee.ts
 *
 * Single authority for wallet top-up fee metadata interpretation and
 * confirmation.
 *
 * TWO-LAYER ARCHITECTURE
 * ──────────────────────
 * confirmWalletTopupInTx(tx, ...)
 *   Inner layer. Accepts a Prisma TransactionClient.
 *   Contains all business logic: state transition, PI verification,
 *   PLATFORM_FEE idempotency.
 *   Called by both wallet-add (via confirmWalletTopup) and the webhook
 *   (directly, inside its own existing transaction).
 *
 * confirmWalletTopup(db, ...)
 *   Outer layer. Accepts a PrismaClient (root client only).
 *   Opens a SERIALIZABLE transaction, then calls confirmWalletTopupInTx.
 *   Used by wallet-add.
 *
 * This separation prevents nested transactions: the webhook already has
 * an open transaction and must call the inner layer directly. wallet-add
 * has no open transaction and uses the outer layer.
 *
 * Policy (2026-11-05): every wallet funding event attracts the platform
 * fee (platformFeePercentage from PlatformSettings). No fee is charged
 * when wallet credits are spent on a lesson booking.
 */

import { Prisma, PrismaClient } from '@prisma/client'

// ── Metadata types ────────────────────────────────────────────────────────────

export interface TopupMetadata {
  topupAmount:  number
  platformFee:  number
  chargeAmount: number
  feePercent:   number
  hasFeeSplit:  boolean
}

export function parseTopupMetadata(
  meta: Record<string, string> | null | undefined,
  fallback: number,
): TopupMetadata {
  if (!meta) {
    return { topupAmount: fallback, platformFee: 0, chargeAmount: fallback, feePercent: 0, hasFeeSplit: false }
  }

  const rawTopup   = meta.topupAmount   != null ? parseFloat(meta.topupAmount)   : NaN
  const rawFee     = meta.platformFee   != null ? parseFloat(meta.platformFee)   : NaN
  const rawCharge  = meta.chargeAmount  != null ? parseFloat(meta.chargeAmount)  : NaN
  const rawPercent = meta.feePercent    != null ? parseFloat(meta.feePercent)    : NaN

  // ── Legacy fallback ──────────────────────────────────────────────────────
  // Return the fallback ONLY when ALL four fee-split fields are absent.
  // If any field is present, we are in new-format territory and all must be valid.
  const anyPresent = meta.topupAmount != null || meta.platformFee != null
                  || meta.chargeAmount != null || meta.feePercent != null
  if (!anyPresent) {
    return { topupAmount: fallback, platformFee: 0, chargeAmount: fallback, feePercent: 0, hasFeeSplit: false }
  }

  // ── Fail-closed validation for new-format metadata ──────────────────────
  // All four values must be present and finite.
  if (!Number.isFinite(rawTopup) || !Number.isFinite(rawFee)
      || !Number.isFinite(rawCharge) || !Number.isFinite(rawPercent)) {
    throw new TopupConfirmationError(
      'PaymentIntent metadata contains non-finite or missing fee split values',
      'PARTIAL_METADATA',
    )
  }

  // topupAmount must be positive (student is adding money to their wallet).
  if (rawTopup <= 0) {
    throw new TopupConfirmationError(
      `Invalid topupAmount: ${rawTopup} — must be positive`,
      'INVALID_TOPUP_AMOUNT',
    )
  }

  // platformFee must be non-negative (zero is valid for fee-free promotions).
  if (rawFee < 0) {
    throw new TopupConfirmationError(
      `Invalid platformFee: ${rawFee} — must be non-negative`,
      'INVALID_PLATFORM_FEE',
    )
  }

  // chargeAmount must be positive (student paid something to Stripe).
  if (rawCharge <= 0) {
    throw new TopupConfirmationError(
      `Invalid chargeAmount: ${rawCharge} — must be positive`,
      'INVALID_CHARGE_AMOUNT',
    )
  }

  // feePercent must be present, finite (already checked above) and non-negative.
  // Do NOT silently replace a missing feePercent with zero.
  if (rawPercent < 0) {
    throw new TopupConfirmationError(
      `Invalid feePercent: ${rawPercent} — must be non-negative`,
      'INVALID_FEE_PERCENT',
    )
  }

  // topupAmount + platformFee must equal chargeAmount to the cent.
  const sumCents = Math.round((rawTopup + rawFee) * 100)
  const chargeCents = Math.round(rawCharge * 100)
  if (sumCents !== chargeCents) {
    throw new TopupConfirmationError(
      `Fee split does not add up: topupAmount ${rawTopup} + platformFee ${rawFee} = ${sumCents / 100}, but chargeAmount = ${chargeCents / 100}`,
      'FEE_SPLIT_MISMATCH',
    )
  }

  // ── Fee percent validation: exact cent-level ─────────────────────────────
  // The original platform fee calculation (wallet-topup-intent/route.ts) is:
  //   platformFee = parseFloat((topupAmount * feePercent / 100).toFixed(2))
  // This rounds to the nearest cent. We validate at the same cent precision
  // — no tolerance. If the metadata fee and the calculated fee differ by even
  // one cent, the metadata is inconsistent and must be rejected.
  //
  // A zero feePercent is valid when platformFee is also zero (fee-free promotion).
  const expectedFeeCents = Math.round(rawTopup * rawPercent / 100 * 100)
  const actualFeeCents = Math.round(rawFee * 100)
  if (expectedFeeCents !== actualFeeCents) {
    throw new TopupConfirmationError(
      `platformFee ${rawFee} (${actualFeeCents}c) does not match feePercent ${rawPercent}% of topupAmount ${rawTopup} (expected ${expectedFeeCents}c)`,
      'FEE_PERCENT_MISMATCH',
    )
  }

  return {
    topupAmount:  rawTopup,
    platformFee:  rawFee,
    chargeAmount: rawCharge,
    feePercent:   rawPercent,
    hasFeeSplit:  true,
  }
}

// ── Result and error types ────────────────────────────────────────────────────

export interface TopupConfirmResult {
  walletTxId:          string
  creditAmount:        number
  feeTxId:             string | null
  feeAmount:           number
  wasAlreadyConfirmed: boolean
}

export class TopupConfirmationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'TopupConfirmationError'
  }
}

// ── Shared input type ─────────────────────────────────────────────────────────

export interface ConfirmTopupInput {
  walletId:         string
  paymentIntentId:  string
  piAmountReceived: number
  piMeta:           Record<string, string> | null | undefined
  pendingTxId:      string | null
  piCreatedAt:      number
  getValidityMonths: () => Promise<number>
}

// ── INNER LAYER: works inside an existing transaction ─────────────────────────

/**
 * confirmWalletTopupInTx — the business logic layer.
 *
 * Accepts a Prisma TransactionClient. Does not open a new transaction.
 * Call this from inside an existing $transaction block (e.g. the webhook).
 *
 * @param tx    Prisma.TransactionClient from the caller's $transaction.
 * @param input Confirmation parameters.
 */
export async function confirmWalletTopupInTx(
  tx: Prisma.TransactionClient,
  input: ConfirmTopupInput,
): Promise<TopupConfirmResult> {
  const { walletId, paymentIntentId, piAmountReceived, piMeta, pendingTxId, piCreatedAt, getValidityMonths } = input

  const topupMeta = parseTopupMetadata(piMeta, piAmountReceived)

  // Validate: Stripe received chargeAmount (topupAmount + platformFee).
  const expectedCents = Math.round(topupMeta.chargeAmount * 100)
  const receivedCents = Math.round(piAmountReceived * 100)
  if (receivedCents !== expectedCents) {
    throw new TopupConfirmationError(
      `Amount mismatch: expected ${expectedCents} cents, received ${receivedCents} cents`,
      'AMOUNT_MISMATCH',
    )
  }

  const { topupAmount: creditAmount, platformFee: feeAmount, feePercent, hasFeeSplit } = topupMeta

  const months = await getValidityMonths()
  const paymentDate = new Date(piCreatedAt * 1000)
  paymentDate.setMonth(paymentDate.getMonth() + months)
  const expiresAt = paymentDate

  let walletTx: any
  let wasAlreadyConfirmed = false

  if (pendingTxId) {
    // PRIMARY PATH: load the pending row FIRST to establish format from DB evidence.
    // The DB row was written by wallet-topup-intent and is the authoritative record
    // of what was intended — independent of any PI metadata that may have been lost.
    const pendingRow = await (tx as any).walletTransaction.findUnique({ where: { id: pendingTxId } })

    if (!pendingRow) {
      throw new TopupConfirmationError(`Wallet transaction ${pendingTxId} not found`, 'TX_NOT_FOUND')
    }

    // Classify the pending row's format from its own metadata.
    // A DB row is new-format if it carries the four fee-split fields with valid values.
    const dbMeta = pendingRow.metadata as Record<string, unknown> | null ?? {}
    const dbTopupAmount = dbMeta.topupAmount != null ? Number(dbMeta.topupAmount) : NaN
    const dbPlatformFee = dbMeta.platformFee != null ? Number(dbMeta.platformFee) : NaN
    const dbFeePercent  = dbMeta.feePercent  != null ? Number(dbMeta.feePercent)  : NaN
    const dbIsNewFormat = Number.isFinite(dbTopupAmount) && dbTopupAmount > 0
                       && Number.isFinite(dbPlatformFee) && dbPlatformFee >= 0
                       && Number.isFinite(dbFeePercent)  && dbFeePercent >= 0

    // Cross-check: if the DB row says new-format, the PI metadata must also be new-format.
    // If PI metadata has been stripped (hasFeeSplit=false) but the DB row is new-format,
    // reject — this is the metadata-loss attack surface the reviewer identified.
    if (dbIsNewFormat && !topupMeta.hasFeeSplit) {
      throw new TopupConfirmationError(
        `Pending transaction ${pendingTxId} has new-format DB metadata (topupAmount=${dbTopupAmount}, ` +
        `feePercent=${dbFeePercent}%) but the PaymentIntent ${paymentIntentId} carries no fee-split metadata. ` +
        `This indicates PI metadata loss. Manual reconciliation required.`,
        'PI_METADATA_STRIPPED',
      )
    }

    // Cross-check: PI metadata amounts must agree with the DB row amounts.
    // The DB row is the sealed record — it cannot have been tampered with by the caller.
    // Compare all four monetary/pricing fields in integer cents.
    if (dbIsNewFormat && topupMeta.hasFeeSplit) {
      const dbChargeAmount = dbMeta.chargeAmount != null ? Number(dbMeta.chargeAmount) : NaN

      const checks: Array<[string, number, number]> = [
        ['topupAmount',  Math.round(dbTopupAmount * 100), Math.round(topupMeta.topupAmount * 100)],
        ['platformFee',  Math.round(dbPlatformFee * 100), Math.round(topupMeta.platformFee * 100)],
        ['feePercent',   Math.round(dbFeePercent  * 1000), Math.round(topupMeta.feePercent  * 1000)],
        ['chargeAmount', Math.round(dbChargeAmount * 100), Math.round(topupMeta.chargeAmount * 100)],
        // The pending row's stored amount is the wallet credit amount (topupAmount).
        // Compare it against the PI-derived topupAmount to catch amount mismatches.
        ['pendingRowAmount', Math.round(Number(pendingRow.amount) * 100), Math.round(topupMeta.topupAmount * 100)],
      ]

      for (const [field, dbCents, piCents] of checks) {
        if (!Number.isFinite(dbCents) || !Number.isFinite(piCents)) continue // skip if DB field absent
        if (dbCents !== piCents) {
          throw new TopupConfirmationError(
            `DB row ${field} (${dbCents}c) does not match PI metadata ${field} (${piCents}c) ` +
            `for transaction ${pendingTxId}`,
            'AMOUNT_DB_PI_MISMATCH',
          )
        }
      }

      // Verify the pending row's stored PaymentIntent ID matches the one being confirmed.
      // wallet-topup-intent seals this after PI creation; mismatch means wrong PI.
      const dbPiId = (dbMeta as any).stripePaymentIntentId as string | undefined
      if (dbPiId && dbPiId !== paymentIntentId) {
        throw new TopupConfirmationError(
          `Pending transaction ${pendingTxId} was created for PaymentIntent ${dbPiId} ` +
          `but is being confirmed with PaymentIntent ${paymentIntentId}`,
          'PI_ID_DB_MISMATCH',
        )
      }
    }

    // Atomically transition the PENDING row.
    const updated = await (tx as any).walletTransaction.updateMany({
      where: {
        id:       pendingTxId,
        walletId,           // ownership guard
        type:     'CREDIT', // type guard
        status:   'PENDING',// state guard — only transition from PENDING
      },
      data: {
        status:   'CONFIRMED',
        expiresAt,
        metadata: {
          topupAmount:           creditAmount,
          chargeAmount:          topupMeta.chargeAmount,
          platformFee:           feeAmount,
          feePercent,
          stripePaymentIntentId: paymentIntentId,
          type:                  'wallet_topup',
          verifiedAmount:        true,
        },
      },
    })

    walletTx = await (tx as any).walletTransaction.findUnique({ where: { id: pendingTxId } })

    if (!walletTx) {
      throw new TopupConfirmationError(`Wallet transaction ${pendingTxId} not found after update`, 'TX_NOT_FOUND')
    }

    if (updated.count === 0) {
      // Another path already confirmed this row. Verify its integrity before
      // treating this as a valid idempotent replay.
      wasAlreadyConfirmed = true

      if (walletTx.walletId !== walletId) {
        throw new TopupConfirmationError(
          `Transaction ${pendingTxId} belongs to a different wallet`,
          'WALLET_MISMATCH',
        )
      }
      if (walletTx.type !== 'CREDIT') {
        throw new TopupConfirmationError(
          `Transaction ${pendingTxId} is not a CREDIT row (type: ${walletTx.type})`,
          'WRONG_TYPE',
        )
      }
      if (walletTx.status !== 'CONFIRMED') {
        throw new TopupConfirmationError(
          `Transaction ${pendingTxId} is in unexpected state: ${walletTx.status}`,
          'WRONG_STATUS',
        )
      }

      const storedPiId = (walletTx.metadata as any)?.stripePaymentIntentId
      if (hasFeeSplit) {
        // New-format: PI id must be present and must match.
        if (!storedPiId) {
          throw new TopupConfirmationError(
            `Confirmed new-format transaction ${pendingTxId} has no stored PaymentIntent ID`,
            'PI_MISSING',
          )
        }
        if (storedPiId !== paymentIntentId) {
          throw new TopupConfirmationError(
            `Transaction ${pendingTxId} was confirmed for a different PaymentIntent`,
            'PI_MISMATCH',
          )
        }
      } else {
        // Legacy: PI id may or may not be stored; if present, it must match.
        if (storedPiId && storedPiId !== paymentIntentId) {
          throw new TopupConfirmationError(
            `Legacy transaction ${pendingTxId} was confirmed for a different PaymentIntent`,
            'PI_MISMATCH',
          )
        }
      }
    }
  } else {
    // LEGACY FALLBACK: PI has no transactionId metadata.
    //
    // Allowed ONLY for genuinely legacy PaymentIntents (pre-policy, hasFeeSplit=false).
    // A new-format PaymentIntent (hasFeeSplit=true) must always carry transactionId.
    if (topupMeta.hasFeeSplit) {
      throw new TopupConfirmationError(
        `New-format PaymentIntent ${paymentIntentId} has valid fee-split metadata but no transactionId. ` +
        `This indicates metadata loss between PI creation and webhook delivery. ` +
        `Manual reconciliation required.`,
        'NEW_FORMAT_MISSING_TX_ID',
      )
    }

    // Genuine legacy PI: create a new CREDIT row.
    walletTx = await (tx as any).walletTransaction.create({
      data: {
        walletId,
        type:        'CREDIT',
        amount:      creditAmount,
        status:      'CONFIRMED',
        description: `Wallet top-up $${creditAmount.toFixed(2)} (legacy)`,
        expiresAt,
        metadata: {
          stripePaymentIntentId: paymentIntentId,
          type:          'wallet_topup',
          verifiedAmount: true,
          topupAmount:   creditAmount,
          chargeAmount:  topupMeta.chargeAmount,
          platformFee:   feeAmount,
          feePercent,
        },
      },
    })
  }

  // PLATFORM_FEE — idempotent: raw SQL check + DB unique index.
  let feeTxId: string | null = null
  if (hasFeeSplit && feeAmount > 0) {
    const feeRows = await (tx as any).$queryRaw(
      Prisma.sql`SELECT id FROM "WalletTransaction" WHERE "walletId" = ${walletId} AND type = 'PLATFORM_FEE' AND metadata->>'platformFeeForPiId' = ${paymentIntentId} LIMIT 1`
    ) as Array<{ id: string }>

    if (feeRows.length === 0) {
      const feeTx = await (tx as any).walletTransaction.create({
        data: {
          walletId,
          type:        'PLATFORM_FEE',
          amount:      feeAmount,
          status:      'CONFIRMED',
          description: `DriveBook platform fee — ${feePercent}% on $${creditAmount.toFixed(2)} top-up`,
          metadata: {
            platformFeeForPiId: paymentIntentId,
            type:               'wallet_topup_fee',
            topupWalletTxId:    walletTx.id,
            creditAmount,
            chargeAmount:       topupMeta.chargeAmount,
            feePercent,
            nonRefundable:      true,
          },
        },
      })
      feeTxId = feeTx.id
    } else {
      feeTxId = feeRows[0].id
    }
  }

  return {
    walletTxId:          walletTx.id,
    creditAmount,
    feeTxId,
    feeAmount:           hasFeeSplit ? feeAmount : 0,
    wasAlreadyConfirmed,
  } satisfies TopupConfirmResult
}

// ── OUTER LAYER: opens its own transaction ────────────────────────────────────

/**
 * confirmWalletTopup — the transaction-opening layer.
 *
 * Accepts a PrismaClient (root client). Opens a SERIALIZABLE transaction,
 * then calls confirmWalletTopupInTx.
 *
 * Used by wallet-add, which has no open transaction.
 * Do NOT call this from inside an existing $transaction block.
 *
 * @param db    PrismaClient root client (not a transaction client).
 * @param input Confirmation parameters.
 */
export async function confirmWalletTopup(
  db: PrismaClient,
  input: ConfirmTopupInput,
): Promise<TopupConfirmResult> {
  return db.$transaction(
    tx => confirmWalletTopupInTx(tx, input),
    { isolationLevel: 'Serializable', timeout: 15000 },
  )
}

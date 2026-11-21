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

  if (!Number.isFinite(rawTopup) || !Number.isFinite(rawFee) || !Number.isFinite(rawCharge)) {
    return { topupAmount: fallback, platformFee: 0, chargeAmount: fallback, feePercent: 0, hasFeeSplit: false }
  }

  return {
    topupAmount:  rawTopup,
    platformFee:  rawFee,
    chargeAmount: rawCharge,
    feePercent:   Number.isFinite(rawPercent) ? rawPercent : 0,
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
    // PRIMARY PATH: atomically transition the PENDING row.
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
      throw new TopupConfirmationError(`Wallet transaction ${pendingTxId} not found`, 'TX_NOT_FOUND')
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

      // Fix reviewer issue 2: for new-format transactions (post-policy), the PI id
      // in metadata is mandatory. A confirmed row with no stored PI id on the
      // new-format path is anomalous — reject it. Legacy rows (hasFeeSplit=false)
      // are explicitly exempted because they were confirmed before the PI id was
      // stored in metadata.
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
    // LEGACY FALLBACK: PI has no transactionId metadata. Create a new CREDIT row.
    // The unique index on stripePaymentIntentId prevents duplicates; P2002 is handled
    // by the caller.
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

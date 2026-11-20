/**
 * lib/services/wallet-topup-fee.ts
 *
 * Single authority for wallet top-up fee metadata interpretation and
 * confirmation. Both the wallet-add route and the Stripe webhook delegate
 * to confirmWalletTopup() — a single function that owns every step of
 * confirming a pending top-up transaction.
 *
 * Policy (2026-11-05): every wallet funding event attracts the platform
 * fee (platformFeePercentage from PlatformSettings). No fee is charged
 * when wallet credits are spent on a lesson booking.
 *
 * Legacy PaymentIntents created before this policy carry no fee metadata.
 * parseTopupMetadata() falls back to treating the full PI amount as both
 * the topup amount and the charge amount (zero platform fee) so those
 * top-ups are credited correctly without code changes.
 */

import type { PrismaClient } from '@prisma/client'

// ── Metadata types ────────────────────────────────────────────────────────────

export interface TopupMetadata {
  /** Amount to credit to the wallet (what the student requested). */
  topupAmount: number
  /** DriveBook's non-refundable fee. 0 for legacy top-ups. */
  platformFee: number
  /** Total amount charged to the student's card (topupAmount + platformFee). */
  chargeAmount: number
  /** Fee percentage used (e.g. 3.6). 0 for legacy top-ups. */
  feePercent: number
  /** True when fee metadata was present (post-policy). False for legacy. */
  hasFeeSplit: boolean
}

/**
 * Parse wallet top-up fee metadata from a Stripe PaymentIntent's metadata object.
 *
 * @param meta     PaymentIntent.metadata (Stripe string-string map)
 * @param fallback Amount to use as chargeAmount when metadata is absent (PI amount_received)
 */
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

  // All three core values must be finite numbers for the split to be valid
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

// ── Confirmation result ───────────────────────────────────────────────────────

export interface TopupConfirmResult {
  walletTxId:   string
  creditAmount: number
  feeTxId:      string | null
  feeAmount:    number
  /** True when this call confirmed the transaction; false when already done. */
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

// ── Shared confirmation service ───────────────────────────────────────────────

/**
 * Confirm a wallet top-up transaction.
 *
 * Both wallet-add and the Stripe webhook call this function. It owns:
 *   1. Locating the original PENDING transaction by ID or by PI metadata.
 *   2. Verifying the found row belongs to the expected wallet, is type CREDIT,
 *      and that its stored PI id matches the current PaymentIntent.
 *   3. Atomically transitioning PENDING → CONFIRMED (conditional updateMany).
 *   4. Creating the PLATFORM_FEE row idempotently (guarded by findFirst).
 *
 * On idempotent replay (transaction already CONFIRMED) it returns the
 * existing row without throwing, so the caller can safely return 200.
 *
 * @param db               Prisma client or transaction client.
 * @param walletId         The wallet that must own the transaction.
 * @param paymentIntentId  Stripe PaymentIntent ID (pi_xxx).
 * @param piAmountReceived Stripe amount_received in dollars (not cents).
 * @param piMeta           Stripe PaymentIntent.metadata.
 * @param pendingTxId      transactionId from PI metadata (may be null for legacy PIs).
 * @param piCreatedAt      Stripe PaymentIntent.created (Unix timestamp in seconds).
 * @param getValidityMonths Function that returns credit validity in months.
 */
export async function confirmWalletTopup(
  db: PrismaClient,
  walletId: string,
  paymentIntentId: string,
  piAmountReceived: number,
  piMeta: Record<string, string> | null | undefined,
  pendingTxId: string | null,
  piCreatedAt: number,
  getValidityMonths: () => Promise<number>,
): Promise<TopupConfirmResult> {

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

  return db.$transaction(async tx => {
    const months = await getValidityMonths()
    const paymentDate = new Date(piCreatedAt * 1000)
    paymentDate.setMonth(paymentDate.getMonth() + months)
    const expiresAt = paymentDate

    let walletTx: any
    let wasAlreadyConfirmed = false

    if (pendingTxId) {
      // PRIMARY PATH: atomically transition the specific PENDING row.
      // updateMany with { status: 'PENDING' } in WHERE is the guard —
      // only one concurrent caller can win; the other sees count=0.
      const updated = await (tx as any).walletTransaction.updateMany({
        where: {
          id:       pendingTxId,
          walletId: walletId,     // ownership guard — must belong to this wallet
          type:     'CREDIT',     // type guard — must be a CREDIT row
          status:   'PENDING',    // state guard — only transition from PENDING
        },
        data: {
          status:   'CONFIRMED',
          expiresAt,
          metadata: {
            topupAmount:          creditAmount,
            chargeAmount:         topupMeta.chargeAmount,
            platformFee:          feeAmount,
            feePercent,
            stripePaymentIntentId: paymentIntentId,
            type:                 'wallet_topup',
            verifiedAmount:       true,
          },
        },
      })

      walletTx = await (tx as any).walletTransaction.findUnique({
        where: { id: pendingTxId },
      })

      if (!walletTx) {
        throw new TopupConfirmationError(
          `Wallet transaction ${pendingTxId} not found`,
          'TX_NOT_FOUND',
        )
      }

      if (updated.count === 0) {
        // Another path already confirmed this transaction (concurrent request or
        // webhook arrived first). Verify the row is in a valid confirmed state
        // before treating this as a successful idempotent replay.
        wasAlreadyConfirmed = true

        // Fix A: explicitly verify the already-confirmed row is valid.
        // A zero update count alone does not prove correct prior confirmation.
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
        if (storedPiId && storedPiId !== paymentIntentId) {
          throw new TopupConfirmationError(
            `Transaction ${pendingTxId} was confirmed for a different PaymentIntent`,
            'PI_MISMATCH',
          )
        }
      }
    } else {
      // LEGACY FALLBACK: PI has no transactionId metadata (created before this fix).
      // Create a new CREDIT row. The unique index on stripePaymentIntentId prevents
      // duplicates; a P2002 from a concurrent call is handled by the caller.
      walletTx = await (tx as any).walletTransaction.create({
        data: {
          walletId,
          type:     'CREDIT',
          amount:   creditAmount,
          status:   'CONFIRMED',
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

    // PLATFORM_FEE — idempotent: findFirst before insert, plus DB unique index.
    let feeTxId: string | null = null
    if (hasFeeSplit && feeAmount > 0) {
      // Use raw SQL to check for existing PLATFORM_FEE row.
      // Avoids Prisma P2019 (JSON path filter requires scalar filter in some PG versions).
      // The unique index (WalletTransaction_platformFee_pi_unique) provides DB-level protection.
      const { Prisma: PrismaRaw } = await import('@prisma/client');
      const feeRows = await (tx as any).$queryRaw(
        PrismaRaw.sql`SELECT id FROM "WalletTransaction" WHERE "walletId" = ${walletId} AND type = 'PLATFORM_FEE' AND metadata->>'platformFeeForPiId' = ${paymentIntentId} LIMIT 1`
      ) as Array<{ id: string }>;
      const existingFee = feeRows.length > 0 ? feeRows[0] : null;
      if (!existingFee) {
        const feeTx = await (tx as any).walletTransaction.create({
          data: {
            walletId,
            type:   'PLATFORM_FEE',
            amount: feeAmount,
            status: 'CONFIRMED',
            description: `DriveBook platform fee — ${feePercent}% on $${creditAmount.toFixed(2)} top-up`,
            metadata: {
              platformFeeForPiId: paymentIntentId,  // separate key — avoids conflict with CREDIT unique index
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
        feeTxId = existingFee.id
      }
    }

    return {
      walletTxId:          walletTx.id,
      creditAmount,
      feeTxId,
      feeAmount:           hasFeeSplit ? feeAmount : 0,
      wasAlreadyConfirmed,
    } satisfies TopupConfirmResult
  }) as Promise<TopupConfirmResult>
}

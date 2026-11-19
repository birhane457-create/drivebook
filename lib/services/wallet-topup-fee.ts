/**
 * lib/services/wallet-topup-fee.ts
 *
 * Single authority for wallet top-up fee metadata interpretation.
 *
 * Both wallet-add and the Stripe webhook need to extract topupAmount,
 * platformFee, and chargeAmount from a PaymentIntent's metadata. This
 * module centralises that logic so the two paths are guaranteed identical.
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

/**
 * Canonical payable amount calculation.
 *
 * Single source of truth for how much a booking should charge and how much
 * the webhook should expect. Used by:
 *   - app/api/payments/create-intent/route.ts  (charges Stripe)
 *   - app/api/stripe/webhook/route.ts          (validates amount_received)
 *   - app/api/public/bookings/[id]/payment-summary/route.ts (displays total)
 *
 * BLOCKER-001: before this helper, create-intent used booking.price while
 * the webhook used packageTotalPaid || booking.price. Package bookings were
 * charged the first-lesson rate and then rejected by the webhook for an
 * amount mismatch. Every path must now call this function so the values
 * can never diverge again.
 */

export interface PayableAmountSource {
  /** Full package price paid by the customer (package bookings only; null otherwise) */
  packageTotalPaid?: number | string | null;
  /** Per-lesson / single-lesson price */
  price: number | string;
}

/**
 * The amount a customer pays for this booking.
 *
 * Rules:
 *   - Package booking: packageTotalPaid (the Stripe charge covers the whole package)
 *   - Single lesson:    price
 *
 * Returns a JS number regardless of whether Prisma returned a Float or Decimal.
 */
export function getPayableAmount(booking: PayableAmountSource): number {
  const pkgTotal = booking.packageTotalPaid != null ? Number(booking.packageTotalPaid) : NaN;
  if (Number.isFinite(pkgTotal) && pkgTotal > 0) {
    return pkgTotal;
  }
  return Number(booking.price ?? 0);
}

/**
 * The amount the webhook should expect to receive from Stripe.
 * Must always equal getPayableAmount() for the same booking.
 */
export function getExpectedWebhookAmount(booking: PayableAmountSource): number {
  return getPayableAmount(booking);
}

/**
 * Cents value for Stripe API calls (Stripe expects integer cents).
 */
export function getPayableAmountCents(booking: PayableAmountSource): number {
  return Math.round(getPayableAmount(booking) * 100);
}

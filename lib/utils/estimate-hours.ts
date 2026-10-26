/**
 * estimateHours — informational estimate of how many lessons a wallet balance
 * might cover at a given instructor's current hourly rate.
 *
 * Policy (PACKAGE-ACCOUNTING-POLICY.md §5, 2026-10-18):
 *   - The estimate is informational only.
 *   - It does not reserve, lock, or guarantee any number of hours.
 *   - The actual entitlement is the dollar credit in the wallet.
 *   - The estimate changes when the wallet balance or the instructor's
 *     current rate changes.
 *   - Booking a lesson secures the price for that booking; future bookings
 *     may use a changed rate.
 *
 * @param balanceDollars  Current wallet credit balance (authoritative dollar amount)
 * @param currentRateDollarsPerHour  Instructor's current hourly rate for new bookings
 * @returns Formatted estimate string, e.g. "Approx. 8.8 hrs at $80/hr"
 *          Returns empty string if rate is zero or not provided.
 */
export function estimateHours(
  balanceDollars: number,
  currentRateDollarsPerHour: number
): string {
  if (!currentRateDollarsPerHour || currentRateDollarsPerHour <= 0) return '';
  const hrs = balanceDollars / currentRateDollarsPerHour;
  return `Approx. ${hrs.toFixed(1)} hrs at $${currentRateDollarsPerHour.toFixed(0)}/hr`;
}

/**
 * estimateHoursValue — the raw numeric estimate (hours), for testing.
 */
export function estimateHoursValue(
  balanceDollars: number,
  currentRateDollarsPerHour: number
): number {
  if (!currentRateDollarsPerHour || currentRateDollarsPerHour <= 0) return 0;
  return balanceDollars / currentRateDollarsPerHour;
}

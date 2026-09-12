/**
 * Idempotency Key Configuration
 * 
 * FIX #5 (BOOKING_FLOW_AUDIT): Standardize idempotency key length across all endpoints
 * 
 * Context:
 * - Payment audit established 255-char limit for transaction keys
 * - Booking endpoints were using inconsistent 128-char limit
 * - Schema supports up to 255 chars (String field, no explicit length)
 * 
 * Decision: Use 255 chars (matches payment pipeline, generous for UUIDs + prefixes)
 * 
 * Standard format:  `${context}-${uuid}`
 * Examples:
 * - `booking-bulk-550e8400-e29b-41d4-a716-446655440000`
 * - `wallet-topup-7c9e6679-7425-40de-944b-e07fc1f90ae7`
 * - `package-confirm-123e4567-e89b-12d3-a456-426614174000`
 */

export const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

export const IDEMPOTENCY_KEY_PREFIXES = {
  BOOKING_SINGLE: 'booking-single',
  BOOKING_BULK: 'booking-bulk',
  PACKAGE_CONFIRM: 'package-confirm',
  WALLET_TOPUP: 'wallet-topup',
  WALLET_DEBIT: 'wallet-debit',
  REFUND: 'refund',
} as const;

/**
 * Generate idempotency key with standard format
 */
export function generateIdempotencyKey(prefix: string, uuid?: string): string {
  const id = uuid || crypto.randomUUID();
  return `${prefix}-${id}`;
}
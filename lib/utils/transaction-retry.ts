/**
 * SERIALIZABLE transaction retry helper
 *
 * PostgreSQL aborts a SERIALIZABLE transaction when it detects a
 * serialization conflict (concurrent transaction would violate isolation).
 * Prisma surfaces this as PrismaClientKnownRequestError with code P2034.
 *
 * This helper retries the ENTIRE transaction callback on P2034.
 * All other errors (business errors, constraint violations, unknown DB errors)
 * are re-thrown immediately without retry.
 *
 * Usage:
 *   const result = await withSerializableRetry(
 *     (tx) => prisma.$transaction(async (tx) => { ... }, SERIALIZABLE_TX),
 *     { operationName: 'create-booking' }
 *   )
 */

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { logger } from '@/lib/logger'

/** Prisma error code for serialization / write conflict. Confirmed for Prisma 5.x. */
const SERIALIZATION_ERROR_CODE = 'P2034'

/**
 * Known business-level error strings thrown inside transactions.
 * These must NEVER be retried — a retry would re-execute the callback
 * from the top, re-running balance checks, slot checks, etc., which
 * could change the outcome in unexpected ways or silently change the
 * result on retry.
 *
 * If the business logic itself decides "SLOT_TAKEN" then that decision
 * was made with the correct read snapshot; retrying would only give the
 * same or a worse result.
 */
const NON_RETRYABLE_MESSAGES = new Set([
  'SLOT_TAKEN',
  'SLOT_CONFLICT',
  'SLOT_ALREADY_BOOKED',
  'INSUFFICIENT_BALANCE',
  'WALLET_INSUFFICIENT',
  'Wallet not found',
])

function isSerializationError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError &&
    error.code === SERIALIZATION_ERROR_CODE
  )
}

function isNonRetryableBusinessError(error: unknown): boolean {
  if (error instanceof Error) {
    return NON_RETRYABLE_MESSAGES.has(error.message)
  }
  return false
}

/**
 * Compute exponential backoff with full jitter.
 * Base: 50 ms. Max: 400 ms.
 * Stays well within an API response window.
 */
function backoffMs(attempt: number): number {
  const base = 50
  const cap = 400
  const exp = Math.min(cap, base * Math.pow(2, attempt))
  return Math.floor(Math.random() * exp)
}

export interface SerializableRetryOptions {
  /**
   * Safe string describing the operation for log context.
   * Must NOT contain user data, tokens, or payment secrets.
   */
  operationName: string
  /** Maximum number of retry attempts after the first failure. Default: 2 */
  maxRetries?: number
}

/**
 * Wraps a function that runs a Prisma $transaction.
 *
 * The `fn` should be the full async callback that calls prisma.$transaction().
 * It is re-invoked from scratch on each attempt (not just re-run a query).
 *
 * @param fn   Async function that executes prisma.$transaction and returns its result.
 * @param opts Retry configuration.
 */
export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  opts: SerializableRetryOptions
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // Business errors: re-throw immediately, no retry
      if (isNonRetryableBusinessError(error)) {
        throw error
      }

      // Serialization conflict: eligible for retry
      if (isSerializationError(error)) {
        lastError = error
        if (attempt < maxRetries) {
          const delay = backoffMs(attempt)
          logger.info('Serialization conflict — retrying transaction', {
            operation: opts.operationName,
            attempt: attempt + 1,
            maxRetries,
            backoffMs: delay,
          })
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
        // Exhausted retries
        logger.error('Serialization conflict — retries exhausted', {
          operation: opts.operationName,
          totalAttempts: attempt + 1,
        })
        throw error
      }

      // Unknown/other error: re-throw immediately
      throw error
    }
  }

  // Unreachable, but TypeScript needs this
  throw lastError
}

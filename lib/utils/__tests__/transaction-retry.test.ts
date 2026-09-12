/**
 * Unit tests for withSerializableRetry
 *
 * Tests:
 * A. P2034 on first attempt → second attempt succeeds, callback called twice
 * B. P2034 on every attempt → bounded retries, final error returned
 * C. Non-retryable business error → callback called once, error re-thrown immediately
 * D. Non-P2034 Prisma error → not retried, re-thrown immediately
 * E. Success on first attempt → callback called once
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

// Mock logger before importing the module under test
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { withSerializableRetry } from '../transaction-retry'
import { logger } from '@/lib/logger'

// Helper to build a real P2034 error
function makeP2034(): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError(
    'Transaction failed due to a write conflict or a deadlock. Please retry your transaction',
    { code: 'P2034', clientVersion: '5.14.0' }
  )
}

// Helper to build a different Prisma error (e.g. unique constraint)
function makeP2002(): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.14.0',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Remove artificial delays in tests
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('withSerializableRetry', () => {
  describe('A — P2034 on first attempt, success on second', () => {
    it('retries on P2034 and returns result from second attempt', async () => {
      let callCount = 0
      const fn = vi.fn(async () => {
        callCount++
        if (callCount === 1) throw makeP2034()
        return 'booking-123'
      })

      const promise = withSerializableRetry(fn, { operationName: 'test-op' })
      // Fast-forward timers to bypass backoff
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('booking-123')
      expect(fn).toHaveBeenCalledTimes(2)
      expect(logger.info).toHaveBeenCalledWith(
        'Serialization conflict — retrying transaction',
        expect.objectContaining({ operation: 'test-op', attempt: 1 })
      )
    })
  })

  describe('B — P2034 on every attempt, exhausted retries', () => {
    it('throws after maxRetries + 1 attempts (default 3 total)', async () => {
      const fn = vi.fn(async () => { throw makeP2034() })

      let caughtError: unknown
      const promise = withSerializableRetry(fn, { operationName: 'test-op' }).catch(e => { caughtError = e })
      await vi.runAllTimersAsync()
      await promise

      expect(caughtError).toMatchObject({ code: 'P2034' })
      // default maxRetries=2 means 3 total attempts
      expect(fn).toHaveBeenCalledTimes(3)
      expect(logger.error).toHaveBeenCalledWith(
        'Serialization conflict — retries exhausted',
        expect.objectContaining({ operation: 'test-op', totalAttempts: 3 })
      )
    })

    it('respects custom maxRetries=1 (2 total attempts)', async () => {
      const fn = vi.fn(async () => { throw makeP2034() })

      let caughtError: unknown
      const promise = withSerializableRetry(fn, { operationName: 'test-op', maxRetries: 1 }).catch(e => { caughtError = e })
      await vi.runAllTimersAsync()
      await promise

      expect(caughtError).toMatchObject({ code: 'P2034' })
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('C — Non-retryable business errors', () => {
    const businessErrors = [
      'SLOT_TAKEN',
      'SLOT_CONFLICT',
      'SLOT_ALREADY_BOOKED',
      'INSUFFICIENT_BALANCE',
      'WALLET_INSUFFICIENT',
      'Wallet not found',
    ]

    for (const msg of businessErrors) {
      it(`does not retry and re-throws immediately: ${msg}`, async () => {
        const fn = vi.fn(async () => { throw new Error(msg) })

        await expect(
          withSerializableRetry(fn, { operationName: 'test-op' })
        ).rejects.toThrow(msg)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(logger.info).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
      })
    }
  })

  describe('D — Non-P2034 Prisma error', () => {
    it('does not retry P2002 (unique constraint)', async () => {
      const fn = vi.fn(async () => { throw makeP2002() })

      await expect(
        withSerializableRetry(fn, { operationName: 'test-op' })
      ).rejects.toMatchObject({ code: 'P2002' })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(logger.info).not.toHaveBeenCalled()
    })
  })

  describe('E — Success on first attempt', () => {
    it('returns result without retry', async () => {
      const fn = vi.fn(async () => ({ id: 'booking-456' }))

      const result = await withSerializableRetry(fn, { operationName: 'test-op' })

      expect(result).toEqual({ id: 'booking-456' })
      expect(fn).toHaveBeenCalledTimes(1)
      expect(logger.info).not.toHaveBeenCalled()
    })
  })

  describe('F — Null result (edge case)', () => {
    it('handles null return without error', async () => {
      const fn = vi.fn(async () => null)
      const result = await withSerializableRetry(fn, { operationName: 'test-op' })
      expect(result).toBeNull()
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})

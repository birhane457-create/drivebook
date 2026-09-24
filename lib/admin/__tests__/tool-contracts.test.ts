/**
 * P1-01 Unit Tests: Tool Result Contract
 *
 * Decision: D-01
 * Finding:  C-1 — .catch(() => 0) converts DB errors to valid business zeros
 *
 * Verifies:
 *   - ok(), empty(), partial(), toolError(), unknown() return correct shapes
 *   - safeQuery() returns SUCCESS on resolution, ERROR on rejection
 *   - safeQueryAll() captures individual failures without losing successes
 *   - collectErrors() and hasErrors() report correctly
 *   - unwrapOr() returns data on SUCCESS/PARTIAL/EMPTY/UNKNOWN
 *   - unwrapOr() THROWS on ERROR — never silently swallows failures
 */

import { vi } from 'vitest'
import {
  ok,
  empty,
  partial,
  toolError,
  unknown,
  safeQuery,
  safeQueryAll,
  collectErrors,
  hasErrors,
  unwrapOr,
} from '../tool-contracts'

describe('Tool Result Contract — P1-01 (D-01)', () => {

  // ── Builders ──────────────────────────────────────────────────────────────

  describe('ok()', () => {
    it('returns SUCCESS status with data', () => {
      const r = ok(42)
      expect(r.status).toBe('SUCCESS')
      expect((r as { status: 'SUCCESS'; data: number }).data).toBe(42)
    })

    it('accepts objects', () => {
      const r = ok({ count: 5, items: [] })
      expect(r.status).toBe('SUCCESS')
    })
  })

  describe('empty()', () => {
    it('returns EMPTY status with reason', () => {
      const r = empty('no bookings found')
      expect(r.status).toBe('EMPTY')
      expect((r as { status: 'EMPTY'; reason: string }).reason).toBe('no bookings found')
    })
  })

  describe('partial()', () => {
    it('returns PARTIAL status with data and missing list', () => {
      const r = partial({ score: 72 }, ['insuranceExpiry', 'wwcExpiry'])
      expect(r.status).toBe('PARTIAL')
      expect((r as { status: 'PARTIAL'; data: { score: number }; missing: string[] }).data.score).toBe(72)
      expect((r as { status: 'PARTIAL'; data: { score: number }; missing: string[] }).missing).toEqual(['insuranceExpiry', 'wwcExpiry'])
    })
  })

  describe('toolError()', () => {
    it('returns ERROR status with message', () => {
      const r = toolError('connection refused')
      expect(r.status).toBe('ERROR')
      expect((r as { status: 'ERROR'; error: string }).error).toBe('connection refused')
    })
  })

  describe('unknown()', () => {
    it('returns UNKNOWN status with reason', () => {
      const r = unknown('metric not available in current schema')
      expect(r.status).toBe('UNKNOWN')
    })
  })

  // ── safeQuery ─────────────────────────────────────────────────────────────

  describe('safeQuery()', () => {
    it('returns SUCCESS when the query resolves', async () => {
      const r = await safeQuery(() => Promise.resolve(99))
      expect(r.status).toBe('SUCCESS')
      expect((r as { status: 'SUCCESS'; data: number }).data).toBe(99)
    })

    it('returns ERROR when the query rejects — not zero', async () => {
      const r = await safeQuery(() => Promise.reject(new Error('DB timeout')))
      expect(r.status).toBe('ERROR')
      expect((r as { status: 'ERROR'; error: string }).error).toContain('DB timeout')
    })

    it('includes label in error message when provided', async () => {
      const r = await safeQuery(
        () => Promise.reject(new Error('connection failed')),
        'bookingCount'
      )
      expect(r.status).toBe('ERROR')
      expect((r as { status: 'ERROR'; error: string }).error).toContain('bookingCount')
      expect((r as { status: 'ERROR'; error: string }).error).toContain('connection failed')
    })

    it('captures non-Error throws as strings', async () => {
      const r = await safeQuery(() => Promise.reject('some string error'))
      expect(r.status).toBe('ERROR')
    })

    it('critical: DB error does NOT become zero', async () => {
      const r = await safeQuery<number>(() => Promise.reject(new Error('P1001 connection timeout')))
      // This is the C-1 finding: .catch(() => 0) made this return 0
      // The contract must return ERROR instead
      expect(r.status).toBe('ERROR')
      expect(r.status).not.toBe('SUCCESS')
      // Explicitly verify the old pattern is wrong
      const oldPatternResult = await Promise.resolve(0).catch(() => 0)  // simulates .catch(() => 0)
      expect(oldPatternResult).toBe(0)  // old pattern silently returns 0
      // New contract does not:
      if (r.status === 'SUCCESS') {
        throw new Error('Should not reach here — DB error must not become 0')
      }
    })
  })

  // ── safeQueryAll ──────────────────────────────────────────────────────────

  describe('safeQueryAll()', () => {
    it('returns SUCCESS for all when all resolve', async () => {
      const [a, b] = await safeQueryAll([
        () => Promise.resolve(10),
        () => Promise.resolve(20),
      ])
      expect(a.status).toBe('SUCCESS')
      expect(b.status).toBe('SUCCESS')
    })

    it('captures individual failures without losing successes', async () => {
      const [good, bad, alsoGood] = await safeQueryAll([
        () => Promise.resolve(5),
        () => Promise.reject(new Error('query failed')),
        () => Promise.resolve(15),
      ])
      expect(good.status).toBe('SUCCESS')
      expect(bad.status).toBe('ERROR')
      expect(alsoGood.status).toBe('SUCCESS')
    })

    it('includes labels in error messages', async () => {
      const [r] = await safeQueryAll(
        [() => Promise.reject(new Error('timeout'))],
        ['failedPayments']
      )
      expect(r.status).toBe('ERROR')
      expect((r as { status: 'ERROR'; error: string }).error).toContain('failedPayments')
    })

    it('critical: health-score C-1a — failedPayments error does not become 0', async () => {
      // C-1a: when failedPayments query fails, old code returned 0
      // which then computed Math.max(0, 20 - (0 > 0 ? 20 : 0)) = 20 bonus points
      // New contract: failedPayments query failure returns ERROR, caller handles it
      const [failedPaymentsResult] = await safeQueryAll(
        [() => Promise.reject(new Error('DB error'))],
        ['failedPayments']
      )
      expect(failedPaymentsResult.status).toBe('ERROR')
      // Caller must NOT proceed to score calculation when this is ERROR
      // (tested in getHealthScore migration — P1-02)
    })
  })

  // ── collectErrors / hasErrors ─────────────────────────────────────────────

  describe('collectErrors()', () => {
    it('returns empty array when no errors', () => {
      const results = [ok(1), ok(2), empty('none')]
      expect(collectErrors(results)).toEqual([])
    })

    it('returns all error messages', () => {
      const results = [ok(1), toolError('err-a'), toolError('err-b')]
      expect(collectErrors(results)).toEqual(['err-a', 'err-b'])
    })
  })

  describe('hasErrors()', () => {
    it('returns false when no errors', () => {
      expect(hasErrors([ok(1), empty('x')])).toBe(false)
    })

    it('returns true when any error present', () => {
      expect(hasErrors([ok(1), toolError('boom')])).toBe(true)
    })
  })

  // ── unwrapOr ──────────────────────────────────────────────────────────────

  describe('unwrapOr()', () => {
    it('returns data on SUCCESS', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42)
    })

    it('returns data on PARTIAL', () => {
      expect(unwrapOr(partial({ score: 72 }, ['x']), { score: 0 })).toEqual({ score: 72 })
    })

    it('returns fallback on EMPTY', () => {
      expect(unwrapOr(empty('none'), 0)).toBe(0)
    })

    it('returns fallback on UNKNOWN', () => {
      expect(unwrapOr(unknown('not available'), -1)).toBe(-1)
    })

    it('THROWS on ERROR — never silently returns fallback', () => {
      // This is the critical safety guarantee:
      // unwrapOr must not silently swallow an ERROR as if it were EMPTY
      expect(() => unwrapOr(toolError('connection refused'), 0)).toThrow()
      expect(() => unwrapOr(toolError('connection refused'), 0)).toThrow(
        /handle errors explicitly/
      )
    })
  })
})

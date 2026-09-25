/**
 * P1-02 Tests: getHealthScore() migration to ToolResult contract
 *
 * Decision: D-01, D-02
 * Finding:  C-1  — .catch(() => 0) masks DB errors
 *           C-1a — failedPayments query failure inflates health score by +20
 *
 * Verifies at the tool level (not just contract level):
 *   - All queries succeed → SUCCESS with correct score
 *   - All queries fail   → ERROR (not score=0)
 *   - failedPayments fails → PARTIAL, score NOT inflated
 *   - Some queries fail  → PARTIAL with missing[] populated
 *   - Score components correctly weighted
 */

import { vi } from 'vitest'

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  booking: {
    count: vi.fn(),
  },
  provider: {
    count: vi.fn(),
  },
  stripeDispute: {
    count: vi.fn(),
  },
  walletTransaction: {
    aggregate: vi.fn(),
  },
  payout: {
    count: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { getHealthScore } from '../ai-tools'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Set all 10 queries to succeed with realistic values */
function setupAllSuccess({
  completed = 80,
  finalized = 100,
  failedPayments = 0,
  approved = 20,
  stripeComplete = 18,
  openDisputes = 0,
  thisWeekAmount = 5000,
  lastWeekAmount = 4500,
  failedPayouts = 0,
  totalPayouts = 50,
} = {}) {
  // booking.count called 3 times: completed, finalized, failedPayments
  mockPrisma.booking.count
    .mockResolvedValueOnce(completed)
    .mockResolvedValueOnce(finalized)
    .mockResolvedValueOnce(failedPayments)

  // provider.count called twice: approved, stripeComplete
  mockPrisma.provider.count
    .mockResolvedValueOnce(approved)
    .mockResolvedValueOnce(stripeComplete)

  // stripeDispute.count once: openDisputes
  mockPrisma.stripeDispute.count.mockResolvedValueOnce(openDisputes)

  // walletTransaction.aggregate twice: thisWeek, lastWeek
  mockPrisma.walletTransaction.aggregate
    .mockResolvedValueOnce({ _sum: { amount: thisWeekAmount } })
    .mockResolvedValueOnce({ _sum: { amount: lastWeekAmount } })

  // payout.count twice: failedPayouts, totalPayouts
  mockPrisma.payout.count
    .mockResolvedValueOnce(failedPayouts)
    .mockResolvedValueOnce(totalPayouts)
}

/** Fail all queries */
function setupAllFail() {
  const err = new Error('DB connection failed')
  mockPrisma.booking.count.mockRejectedValue(err)
  mockPrisma.provider.count.mockRejectedValue(err)
  mockPrisma.stripeDispute.count.mockRejectedValue(err)
  mockPrisma.walletTransaction.aggregate.mockRejectedValue(err)
  mockPrisma.payout.count.mockRejectedValue(err)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getHealthScore() — P1-02 (D-01, D-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── SUCCESS path ─────────────────────────────────────────────────────────

  describe('all queries succeed', () => {
    it('returns SUCCESS status', async () => {
      setupAllSuccess()
      const result = await getHealthScore()
      expect(result.status).toBe('SUCCESS')
    })

    it('returns a numeric score between 0 and 100', async () => {
      setupAllSuccess()
      const result = await getHealthScore()
      expect(result.status).toBe('SUCCESS')
      if (result.status === 'SUCCESS') {
        expect(result.data.score).toBeGreaterThanOrEqual(0)
        expect(result.data.score).toBeLessThanOrEqual(100)
      }
    })

    it('includes status label (healthy/watch/critical)', async () => {
      setupAllSuccess({ completed: 95, finalized: 100 })
      const result = await getHealthScore()
      expect(result.status).toBe('SUCCESS')
      if (result.status === 'SUCCESS') {
        expect(['healthy', 'watch', 'critical']).toContain(result.data.status)
      }
    })

    it('includes all signal values in output', async () => {
      setupAllSuccess()
      const result = await getHealthScore()
      expect(result.status).toBe('SUCCESS')
      if (result.status === 'SUCCESS') {
        const signals = result.data.signals as Record<string, unknown>
        expect(signals).toHaveProperty('completionRate')
        expect(signals).toHaveProperty('onboardingRate')
        expect(signals).toHaveProperty('openDisputes')
        expect(signals).toHaveProperty('revChangePercent')
        expect(signals).toHaveProperty('payoutFailRate')
        expect(signals).toHaveProperty('failedPayments')
      }
    })

    it('exposes the score semantics and null-vs-zero policy to the Copilot', async () => {
      setupAllSuccess()
      const result = await getHealthScore()
      expect(result.status).toBe('SUCCESS')
      if (result.status !== 'SUCCESS') return

      expect(result.data.semantics).toMatchObject({
        formula: expect.stringMatching(/weighted|sum/i),
        allSignalsFail: 'ERROR',
        partialPolicy: expect.stringMatching(/missing|PARTIAL/i),
        nullMeans: 'unavailable, not zero',
      })
      expect(result.data.signalDefinitions).toEqual(expect.objectContaining({
        completionRate: expect.stringMatching(/completion/i),
        onboardingRate: expect.stringMatching(/current approved providers|not time-windowed/i),
        openDisputes: expect.stringMatching(/disputes/i),
        revChangePercent: expect.stringMatching(/revenue change/i),
        payoutFailRate: expect.stringMatching(/failed payout rate/i),
        failedPayments: expect.stringMatching(/pending-payment failures/i),
      }))
      expect(result.data.signalDefinitions.onboardingRate).not.toMatch(/30 days|last 30 days|over the last 30 days/i)
      expect(Object.keys(result.data.signalDefinitions)).toEqual([
        'completionRate',
        'onboardingRate',
        'openDisputes',
        'revChangePercent',
        'payoutFailRate',
        'failedPayments',
      ])
    })
  })

  // ── ERROR path — all queries fail ────────────────────────────────────────

  describe('all queries fail', () => {
    it('returns ERROR — not a score of 0', async () => {
      setupAllFail()
      const result = await getHealthScore()
      // C-1: old code returned { score: 0, status: 'critical' } silently
      expect(result.status).toBe('ERROR')
      expect(result.status).not.toBe('SUCCESS')
    })

    it('ERROR message identifies the tool', async () => {
      setupAllFail()
      const result = await getHealthScore()
      expect(result.status).toBe('ERROR')
      if (result.status === 'ERROR') {
        expect(result.error).toContain('getHealthScore')
      }
    })
  })

  // ── C-1a: failedPayments query failure ───────────────────────────────────

  describe('C-1a: failedPayments query fails independently', () => {
    it('returns PARTIAL — not SUCCESS or ERROR', async () => {
      // All queries succeed except failedPayments (index 2)
      mockPrisma.booking.count
        .mockResolvedValueOnce(80)   // completed
        .mockResolvedValueOnce(100)  // finalized
        .mockRejectedValueOnce(new Error('timeout'))  // failedPayments FAILS
      mockPrisma.provider.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(18)
      mockPrisma.stripeDispute.count.mockResolvedValueOnce(0)
      mockPrisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 4500 } })
      mockPrisma.payout.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(50)

      const result = await getHealthScore()
      expect(result.status).toBe('PARTIAL')
    })

    it('PARTIAL missing[] includes failedPayments', async () => {
      mockPrisma.booking.count
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(100)
        .mockRejectedValueOnce(new Error('timeout'))
      mockPrisma.provider.count.mockResolvedValueOnce(20).mockResolvedValueOnce(18)
      mockPrisma.stripeDispute.count.mockResolvedValueOnce(0)
      mockPrisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 4500 } })
      mockPrisma.payout.count.mockResolvedValueOnce(0).mockResolvedValueOnce(50)

      const result = await getHealthScore()
      expect(result.status).toBe('PARTIAL')
      if (result.status === 'PARTIAL') {
        expect(result.missing).toContain('failedPayments')
      }
    })

    it('C-1a: score is NOT inflated when failedPayments fails', async () => {
      // Baseline: everything perfect, failedPayments=0 → score with full points
      setupAllSuccess({ failedPayments: 0 })
      const baselineResult = await getHealthScore()
      expect(baselineResult.status).toBe('SUCCESS')
      const baselineScore = (baselineResult as any).data.score as number

      vi.clearAllMocks()

      // Now: failedPayments query FAILS → old code treated as 0 → same +20 bonus
      // New code: excludes the component entirely → score should be LOWER than baseline
      mockPrisma.booking.count
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(100)
        .mockRejectedValueOnce(new Error('DB timeout'))  // failedPayments fails
      mockPrisma.provider.count.mockResolvedValueOnce(20).mockResolvedValueOnce(18)
      mockPrisma.stripeDispute.count.mockResolvedValueOnce(0)
      mockPrisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 4500 } })
      mockPrisma.payout.count.mockResolvedValueOnce(0).mockResolvedValueOnce(50)

      const partialResult = await getHealthScore()
      expect(partialResult.status).toBe('PARTIAL')
      const partialScore = (partialResult as any).data.score as number

      // Score with missing component must be less than score with all components
      // (the failedPayments component contributed up to +20 in baseline)
      expect(partialScore).toBeLessThan(baselineScore)
    })

    it('failedPayments=null in signals output when query failed', async () => {
      mockPrisma.booking.count
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(100)
        .mockRejectedValueOnce(new Error('timeout'))
      mockPrisma.provider.count.mockResolvedValueOnce(20).mockResolvedValueOnce(18)
      mockPrisma.stripeDispute.count.mockResolvedValueOnce(0)
      mockPrisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 4500 } })
      mockPrisma.payout.count.mockResolvedValueOnce(0).mockResolvedValueOnce(50)

      const result = await getHealthScore()
      expect(result.status).toBe('PARTIAL')
      if (result.status === 'PARTIAL') {
        const signals = result.data.signals as Record<string, unknown>
        // null signals the value is unknown — not zero
        expect(signals.failedPayments).toBeNull()
      }
    })
  })

  // ── PARTIAL — some queries fail ──────────────────────────────────────────

  describe('some queries fail', () => {
    it('returns PARTIAL with missing[] populated', async () => {
      mockPrisma.booking.count
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(2)
      mockPrisma.provider.count
        .mockRejectedValueOnce(new Error('timeout'))  // approved fails
        .mockRejectedValueOnce(new Error('timeout'))  // stripeComplete fails
      mockPrisma.stripeDispute.count.mockResolvedValueOnce(1)
      mockPrisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 4500 } })
      mockPrisma.payout.count.mockResolvedValueOnce(0).mockResolvedValueOnce(50)

      const result = await getHealthScore()
      expect(result.status).toBe('PARTIAL')
      if (result.status === 'PARTIAL') {
        expect(result.missing).toContain('approved')
        expect(result.missing).toContain('stripeComplete')
        expect(result.missing.length).toBe(2)
      }
    })

    it('PARTIAL data includes scoringNotes explaining excluded components', async () => {
      mockPrisma.booking.count
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(100)
        .mockRejectedValueOnce(new Error('timeout'))
      mockPrisma.provider.count.mockResolvedValueOnce(20).mockResolvedValueOnce(18)
      mockPrisma.stripeDispute.count.mockResolvedValueOnce(0)
      mockPrisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 4500 } })
      mockPrisma.payout.count.mockResolvedValueOnce(0).mockResolvedValueOnce(50)

      const result = await getHealthScore()
      expect(result.status).toBe('PARTIAL')
      if (result.status === 'PARTIAL') {
        const notes = (result.data as any).scoringNotes as string[] | undefined
        expect(notes).toBeDefined()
        expect(notes!.some((n: string) => n.toLowerCase().includes('failedpayments'))).toBe(true)
      }
    })
  })
})

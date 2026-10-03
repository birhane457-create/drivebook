/**
 * MM-03: Customer PaymentIntent Amount Bounds (Wallet Top-Up)
 *
 * FINDING (MONEY-MOVEMENT-INVENTORY.md MM-03):
 *   "Amount validation for wallet top-up relies on platformSettings.walletTopUpMin/Max.
 *   If admin sets these to extreme values, a customer could create a very large payment
 *   intent. Not a direct vulnerability but worth noting."
 *
 * ROOT CAUSE:
 *   wallet-topup-intent/route.ts had hardcoded Zod min(10)/max(10000), ignoring the
 *   admin-configurable walletTopUpMin/walletTopUpMax platform settings. An admin setting
 *   walletTopUpMax=$200 had no enforcement effect on this route.
 *
 * FIX (MM-03):
 *   route.ts now calls getPlatformPricing() after schema parse and enforces
 *   amount >= walletTopUpMin and amount <= walletTopUpMax, returning 400 if violated.
 *   Zod schema retains only type/format validation (positive, 2 decimal places).
 *
 * WHAT IS TESTED:
 *   B1 Amount below platform minimum → 400
 *   B2 Amount above platform maximum → 400
 *   B3 Amount at exact minimum → accepted (proceeds to Stripe)
 *   B4 Amount at exact maximum → accepted
 *   B5 Amount within bounds → accepted
 *   B6 Platform settings respected: custom min=$50, max=$200 enforced correctly
 *   B7 Non-positive amount → 400 (Zod type guard unchanged)
 *   B8 AUTH: unauthenticated → 401
 *   B9 AUTH: non-CLIENT role → 403
 *
 * WHAT IS MOCKED:
 *   getServerSession, getPlatformPricing, prisma, stripeService, rate limiter
 *
 * EVIDENCE FOR: MM-03 FIX-VERIFIED gate
 */

// ─── Mock function declarations ───────────────────────────────────────────────

const mockGetServerSession    = vi.fn()
const mockGetPlatformPricing  = vi.fn()
const mockPrismaUserFindUnique = vi.fn()
const mockPrismaWalletTxCreate = vi.fn()
const mockPrismaWalletTxDelete = vi.fn()
const mockGetOrCreateWallet   = vi.fn()
const mockCreatePaymentIntent = vi.fn()
const mockCheckRateLimit      = vi.fn()

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next-auth/next', () => ({
  getServerSession: (...a: any[]) => mockGetServerSession(...a),
}))

vi.mock('@/lib/services/platform-pricing', () => ({
  getPlatformPricing: (...a: any[]) => mockGetPlatformPricing(...a),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user:              { findUnique: (...a: any[]) => mockPrismaUserFindUnique(...a) },
    walletTransaction: {
      create: (...a: any[]) => mockPrismaWalletTxCreate(...a),
      delete: (...a: any[]) => mockPrismaWalletTxDelete(...a),
    },
  } as any,
}))

vi.mock('@/lib/services/wallet-helpers', () => ({
  getOrCreateWallet: (...a: any[]) => mockGetOrCreateWallet(...a),
}))

vi.mock('@/lib/services/stripe', () => ({
  stripeService: {
    createPaymentIntent: (...a: any[]) => mockCreatePaymentIntent(...a),
  },
}))

vi.mock('@/lib/ratelimit', () => ({
  walletRateLimit:        {},
  checkRateLimit:         (...a: any[]) => mockCheckRateLimit(...a),
  getRateLimitIdentifier: (..._a: any[]) => 'test-rate-id',
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

// ─── Handler import (after mocks) ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/client/wallet-topup-intent/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/client/wallet-topup-intent', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const CLIENT_SESSION = {
  user: { id: 'user_001', email: 'client@example.com', role: 'CLIENT' },
  expires: new Date(Date.now() + 3600_000).toISOString(),
}

const DEFAULT_PRICING = {
  walletTopUpMin: 10,
  walletTopUpMax: 500,
}

function setupHappyPath() {
  mockGetServerSession.mockResolvedValue(CLIENT_SESSION)
  mockCheckRateLimit.mockResolvedValue({ success: true })
  mockGetPlatformPricing.mockResolvedValue(DEFAULT_PRICING)
  mockPrismaUserFindUnique.mockResolvedValue({ id: 'user_001', email: 'client@example.com', name: 'Test Client' })
  mockGetOrCreateWallet.mockResolvedValue({ id: 'wallet_001' })
  mockPrismaWalletTxCreate.mockResolvedValue({ id: 'tx_001' })
  mockCreatePaymentIntent.mockResolvedValue({ clientSecret: 'pi_secret_test', paymentIntentId: 'pi_001' })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MM-03: Wallet top-up amount bounds (platform-configured)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    setupHappyPath()
  })

  // ── B: Amount bounds enforcement ───────────────────────────────────────────

  describe('B: Platform-configured amount bounds', () => {

    it('B1: amount below walletTopUpMin → 400 with descriptive error', async () => {
      mockGetPlatformPricing.mockResolvedValue({ walletTopUpMin: 10, walletTopUpMax: 500 })

      const res  = await POST(makeRequest({ amount: 5 })) // $5 < min $10
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('10')              // error references the min
      expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
      expect(mockPrismaWalletTxCreate).not.toHaveBeenCalled()
    })

    it('B2: amount above walletTopUpMax → 400 with descriptive error', async () => {
      mockGetPlatformPricing.mockResolvedValue({ walletTopUpMin: 10, walletTopUpMax: 500 })

      const res  = await POST(makeRequest({ amount: 501 })) // $501 > max $500
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('500')              // error references the max
      expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
      expect(mockPrismaWalletTxCreate).not.toHaveBeenCalled()
    })

    it('B3: amount exactly at walletTopUpMin → accepted, Stripe PI created', async () => {
      mockGetPlatformPricing.mockResolvedValue({ walletTopUpMin: 10, walletTopUpMax: 500 })

      const res  = await POST(makeRequest({ amount: 10 })) // exactly $10
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.clientSecret).toBe('pi_secret_test')
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10 })
      )
    })

    it('B4: amount exactly at walletTopUpMax → accepted', async () => {
      mockGetPlatformPricing.mockResolvedValue({ walletTopUpMin: 10, walletTopUpMax: 500 })

      const res  = await POST(makeRequest({ amount: 500 })) // exactly $500
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 500 })
      )
    })

    it('B5: amount within bounds → accepted', async () => {
      mockGetPlatformPricing.mockResolvedValue({ walletTopUpMin: 10, walletTopUpMax: 500 })

      const res  = await POST(makeRequest({ amount: 100 }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.clientSecret).toBeDefined()
    })

    it('B6: custom platform settings (min=$50, max=$200) are enforced', async () => {
      // Admin has configured tighter bounds — route must respect them
      mockGetPlatformPricing.mockResolvedValue({ walletTopUpMin: 50, walletTopUpMax: 200 })

      // $30 is above the hardcoded $10 but below the platform $50 → must be rejected
      const resLow  = await POST(makeRequest({ amount: 30 }))
      expect(resLow.status).toBe(400)
      const bodyLow = await resLow.json()
      expect(bodyLow.error).toContain('50')

      // $250 is below the hardcoded $10,000 but above platform $200 → must be rejected
      const resHigh = await POST(makeRequest({ amount: 250 }))
      expect(resHigh.status).toBe(400)
      const bodyHigh = await resHigh.json()
      expect(bodyHigh.error).toContain('200')

      // $100 is within $50–$200 → must be accepted
      const resOk = await POST(makeRequest({ amount: 100 }))
      expect(resOk.status).toBe(200)
    })

    it('B7: non-positive amount → 400 (Zod type guard still present)', async () => {
      const res = await POST(makeRequest({ amount: -50 }))
      expect(res.status).toBe(400)
      expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
    })
  })

  // ── A: Auth ────────────────────────────────────────────────────────────────

  describe('A: Authentication / authorization', () => {

    it('B8: no session → 401, bounds never checked', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const res = await POST(makeRequest({ amount: 100 }))
      expect(res.status).toBe(401)
      expect(mockGetPlatformPricing).not.toHaveBeenCalled()
    })

    it('B9: non-CLIENT role (INSTRUCTOR) → 403, bounds never checked', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user_002', email: 'instructor@example.com', role: 'INSTRUCTOR' },
        expires: new Date(Date.now() + 3600_000).toISOString(),
      })

      const res = await POST(makeRequest({ amount: 100 }))
      expect(res.status).toBe(403)
      expect(mockGetPlatformPricing).not.toHaveBeenCalled()
    })
  })

  // ── I: Integration of fix with rest of route ───────────────────────────────

  describe('I: Fix does not break existing happy path', () => {

    it('I1: valid amount → WalletTransaction created with correct amount', async () => {
      const res = await POST(makeRequest({ amount: 75 }))

      expect(res.status).toBe(200)
      expect(mockPrismaWalletTxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type:   'CREDIT',
            amount: 75,
            status: 'PENDING',
          }),
        })
      )
    })

    it('I2: stripeService failure → PENDING WalletTransaction deleted', async () => {
      mockCreatePaymentIntent.mockRejectedValue(new Error('Stripe error'))

      const res = await POST(makeRequest({ amount: 50 }))

      // Route catches the error, returns 500
      expect(res.status).toBe(500)
      // The pending transaction must be cleaned up
      expect(mockPrismaWalletTxDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tx_001' } })
      )
    })
  })
})

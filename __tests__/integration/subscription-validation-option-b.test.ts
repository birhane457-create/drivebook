/**
 * Integration tests for Option B subscription validation fixes
 * 
 * Covers:
 * - HIGH-1: isActive enforcement in booking routes
 * - MEDIUM-3: Client creation approval gate
 * - MEDIUM-5: Missing Provider fail-closed behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as bookingsPost } from '@/app/api/bookings/route'
import { POST as offlineBookingsPost } from '@/app/api/bookings/offline/route'
import { POST as clientsPost } from '@/app/api/clients/route'
import { checkSubscriptionAccess } from '@/lib/middleware/subscriptionValidation'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

describe('Option B: isActive Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/bookings', () => {
    it('should block isActive=false provider from creating bookings', async () => {
      // Setup: Approved provider but isActive=false
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', providerId: 'provider-123', role: 'PROVIDER' },
      } as any)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider-123',
        approvalStatus: 'APPROVED',
        isActive: false, // Deactivated
        subscriptionStatus: 'ACTIVE',
        businessModel: 'MARKETPLACE',
        paymentMode: 'SUBSCRIPTION',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'customer-123',
          startTime: new Date().toISOString(),
          duration: 60,
        }),
      })

      const response = await bookingsPost(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.requiresActivation).toBe(true)
      expect(data.error).toContain('deactivated')
    })

    it('should allow approved + active provider to create bookings', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', providerId: 'provider-123', role: 'PROVIDER' },
      } as any)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider-123',
        approvalStatus: 'APPROVED',
        isActive: true, // Active
        subscriptionStatus: 'ACTIVE',
        businessModel: 'MARKETPLACE',
        paymentMode: 'SUBSCRIPTION',
      } as any)

      // This would need full booking logic mocking to pass
      // For now, verify we get past the isActive check
      const req = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'customer-123',
          startTime: new Date().toISOString(),
          duration: 60,
        }),
      })

      const response = await bookingsPost(req)
      
      // Should not fail on isActive check (will fail on other validation)
      expect(response.status).not.toBe(403)
      const data = await response.json()
      expect(data.requiresActivation).not.toBe(true)
    })
  })

  describe('POST /api/bookings/offline', () => {
    it('should block isActive=false provider from creating offline bookings', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', providerId: 'provider-123', role: 'PROVIDER' },
      } as any)

      // First query: provider with isActive field (CRITICAL: must be in select)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider-123',
        approvalStatus: 'APPROVED',
        isActive: false, // Deactivated - field MUST be selected in Prisma query
        subscriptionTier: 'PROFESSIONAL',
        subscriptionStatus: 'ACTIVE',
        businessModel: 'MARKETPLACE',
        paymentMode: 'SUBSCRIPTION',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/bookings/offline', {
        method: 'POST',
        body: JSON.stringify({
          customerName: 'Test Customer',
          customerPhone: '+1234567890',
          startTime: new Date().toISOString(),
          duration: 60,
        }),
      })

      const response = await offlineBookingsPost(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.requiresActivation).toBe(true)
      expect(data.error).toContain('deactivated')
    })

    it('should verify isActive field is selected in Prisma query', async () => {
      // This is a regression test for the defect where isActive was not selected
      // If isActive is not in the Prisma select, instructor.isActive will be undefined
      // and undefined !== true will incorrectly evaluate to true, blocking all providers

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', providerId: 'provider-123', role: 'PROVIDER' },
      } as any)

      // Simulate missing isActive in Prisma select (the bug)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider-123',
        approvalStatus: 'APPROVED',
        // isActive: undefined, // Not selected - this was the bug
        subscriptionTier: 'PROFESSIONAL',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/bookings/offline', {
        method: 'POST',
        body: JSON.stringify({
          customerName: 'Test Customer',
          startTime: new Date().toISOString(),
          duration: 60,
        }),
      })

      const response = await offlineBookingsPost(req)
      
      // With the bug, this would return 403 even for active providers
      // After fix, isActive must be explicitly selected in Prisma query
      const mockCall = vi.mocked(prisma.provider.findUnique).mock.calls[0]
      expect(mockCall[0].select).toHaveProperty('isActive')
    })
  })

  describe('POST /api/clients', () => {
    it('should block pending provider from creating clients', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', providerId: 'provider-123', role: 'PROVIDER' },
      } as any)

      // First call: subscription check
      vi.mocked(prisma.provider.findUnique)
        .mockResolvedValueOnce({
          subscriptionStatus: 'ACTIVE',
          businessModel: 'MARKETPLACE',
          paymentMode: 'SUBSCRIPTION',
        } as any)
        // Second call: approval check
        .mockResolvedValueOnce({
          id: 'provider-123',
          approvalStatus: 'PENDING', // Not approved
          isActive: true,
        } as any)

      const req = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Client',
          email: 'test@example.com',
          phone: '+1234567890',
        }),
      })

      const response = await clientsPost(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.requiresApproval).toBe(true)
      expect(data.error).toContain('pending approval')
    })

    it('should allow approved + active provider to create clients', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', providerId: 'provider-123', role: 'PROVIDER' },
      } as any)

      // First call: subscription check
      vi.mocked(prisma.provider.findUnique)
        .mockResolvedValueOnce({
          subscriptionStatus: 'ACTIVE',
          businessModel: 'MARKETPLACE',
          paymentMode: 'SUBSCRIPTION',
        } as any)
        // Second call: approval check
        .mockResolvedValueOnce({
          id: 'provider-123',
          approvalStatus: 'APPROVED',
          isActive: true,
        } as any)

      vi.mocked(prisma.customer.findFirst).mockResolvedValue(null) // No duplicate
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // New user

      const req = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Client',
          email: 'test@example.com',
          phone: '+1234567890',
        }),
      })

      const response = await clientsPost(req)
      
      // Should get past approval check (may fail on other validation)
      expect(response.status).not.toBe(403)
      const data = await response.json()
      expect(data.requiresApproval).not.toBe(true)
    })
  })

  describe('Missing Provider Fail-Closed', () => {
    it('should return read-only access when Provider record is missing', async () => {
      vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

      const result = await checkSubscriptionAccess('user-123')

      expect(result.valid).toBe(true)
      expect(result.readOnly).toBe(true)
      expect(result.status).toBe('PROVIDER_MISSING')
      expect(result.reason).toContain('Provider record not found')
    })

    it('should not grant write access when Provider record is missing', async () => {
      vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

      const result = await checkSubscriptionAccess('user-123')

      // Critical: must be read-only, not full access
      expect(result.readOnly).toBe(true)
      expect(result.readOnly).not.toBe(false) // Explicit assertion against fail-open
    })
  })
})

describe('Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should preserve SaaS DIRECT bypass in subscription checks', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      subscriptionStatus: 'TRIAL_EXPIRED',
      businessModel: 'SAAS',
      paymentMode: 'DIRECT',
    } as any)

    const result = await checkSubscriptionAccess('user-123')

    expect(result.valid).toBe(true)
    expect(result.readOnly).toBe(false) // Full access for SaaS DIRECT
  })

  it('should enforce subscription for MARKETPLACE providers', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      subscriptionStatus: 'CANCELLED',
      businessModel: 'MARKETPLACE',
      paymentMode: 'SUBSCRIPTION',
    } as any)

    const result = await checkSubscriptionAccess('user-123')

    expect(result.valid).toBe(true)
    expect(result.readOnly).toBe(true) // Read-only for inactive subscription
  })
})

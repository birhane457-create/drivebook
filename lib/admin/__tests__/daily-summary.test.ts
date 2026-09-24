import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  booking: { count: vi.fn() },
  customer: { count: vi.fn() },
  stripeDispute: { count: vi.fn() },
  provider: { count: vi.fn(), findMany: vi.fn() },
  walletTransaction: { aggregate: vi.fn() },
  drivingProviderProfile: { count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { getDailySummary } from '../ai-tools'

const NOW = new Date('2026-09-24T00:00:00.000Z')

function setSuccessfulQueries() {
  mockPrisma.booking.count
    .mockResolvedValueOnce(8)
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(3)
  mockPrisma.customer.count.mockResolvedValue(4)
  mockPrisma.stripeDispute.count.mockResolvedValue(1)
  mockPrisma.provider.count.mockResolvedValue(6)
  mockPrisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: 1250 } })
  mockPrisma.provider.findMany.mockResolvedValue([{ id: 'provider-1' }, { id: 'provider-2' }])
  mockPrisma.drivingProviderProfile.count.mockResolvedValue(2)
}

describe('getDailySummary - P1-04', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.clearAllMocks()
    setSuccessfulQueries()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns SUCCESS and counts expiring documents from DrivingProviderProfile', async () => {
    const result = await getDailySummary()

    expect(result).toEqual({
      status: 'SUCCESS',
      data: {
        yesterday: { completed: 8, cancelled: 2, newBookings: 5, newStudents: 4 },
        weekRevenue: 1250,
        openIssues: { stuckPayments: 3, openDisputes: 1, pendingApprovals: 6, expiringDocs: 2 },
      },
    })
    expect(mockPrisma.drivingProviderProfile.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        providerId: { in: ['provider-1', 'provider-2'] },
        OR: expect.arrayContaining([
          expect.objectContaining({ licenseExpiry: expect.any(Object) }),
          expect.objectContaining({ insuranceExpiry: expect.any(Object) }),
          expect.objectContaining({ policeCheckExpiry: expect.any(Object) }),
          expect.objectContaining({ wwcCheckExpiry: expect.any(Object) }),
        ]),
      }),
    }))
  })

  it('returns PARTIAL when an independent summary signal fails', async () => {
    mockPrisma.stripeDispute.count.mockRejectedValue(new Error('dispute query failed'))

    const result = await getDailySummary()

    expect(result.status).toBe('PARTIAL')
    if (result.status !== 'PARTIAL') return
    expect(result.missing).toContain('disputes')
    expect(result.data.openIssues.openDisputes).toBeNull()
    expect(result.data.openIssues.expiringDocs).toBe(2)
  })

  it('does not turn provider/profile query failure into zero expiring documents', async () => {
    mockPrisma.provider.findMany.mockRejectedValue(new Error('provider query failed'))

    const result = await getDailySummary()

    expect(result.status).toBe('PARTIAL')
    if (result.status !== 'PARTIAL') return
    expect(result.missing).toContain('approved providers')
    expect(result.missing).toContain('expiring documents')
    expect(result.data.openIssues.expiringDocs).toBeNull()
    expect(mockPrisma.drivingProviderProfile.count).not.toHaveBeenCalled()
  })
})

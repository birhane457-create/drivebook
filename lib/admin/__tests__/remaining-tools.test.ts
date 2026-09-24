import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  walletTransaction: { aggregate: vi.fn() },
  booking: { aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
  provider: { findMany: vi.fn() },
  customer: { count: vi.fn() },
  payout: { groupBy: vi.fn() },
  stripeDispute: { count: vi.fn() },
  auditLog: { count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { getOperationsTimeline, getRevenueBreakdown, getStudentRetention } from '../ai-tools'

describe('remaining Admin Copilot tools - P1-06', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T00:00:00.000Z'))
    vi.clearAllMocks()
  })

  it('returns SUCCESS for revenue breakdown', async () => {
    mockPrisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: 1500 } })
    mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { price: 200 }, _count: { id: 2 } })
    mockPrisma.booking.groupBy.mockResolvedValue([{ providerId: 'provider-1', _sum: { price: 900 }, _count: { id: 9 } }])
    mockPrisma.provider.findMany.mockResolvedValue([{ id: 'provider-1', name: 'Alex' }])

    const result = await getRevenueBreakdown({ days: 30 })

    expect(result).toEqual({
      status: 'SUCCESS',
      data: {
        period: 'Last 30 days',
        totalRevenue: 1500,
        cancellationLoss: { amount: 200, count: 2 },
        topEarners: [{ name: 'Alex', revenue: 900, lessons: 9 }],
      },
    })
  })

  it('returns PARTIAL for revenue breakdown query failure', async () => {
    mockPrisma.walletTransaction.aggregate.mockRejectedValue(new Error('revenue unavailable'))
    mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { price: 0 }, _count: { id: 0 } })
    mockPrisma.booking.groupBy.mockResolvedValue([])

    const result = await getRevenueBreakdown({})

    expect(result.status).toBe('PARTIAL')
    if (result.status !== 'PARTIAL') return
    expect(result.missing).toContain('total revenue')
    expect(result.data.totalRevenue).toBeNull()
  })

  it('returns SUCCESS for student retention', async () => {
    mockPrisma.booking.findMany
      .mockResolvedValueOnce([{ customerId: 'student-1' }, { customerId: 'student-2' }])
      .mockResolvedValueOnce([{ customerId: 'student-1' }])
    mockPrisma.booking.groupBy.mockResolvedValue([{ customerId: 'student-1', _count: { id: 2 } }])
    mockPrisma.customer.count.mockResolvedValue(20)

    const result = await getStudentRetention()

    expect(result).toEqual({
      status: 'SUCCESS',
      data: { totalStudents: 20, activeStudents30d: 1, repeatBookers60d: 1, returnRatePercent: 50 },
    })
  })

  it('returns ERROR when all student-retention queries fail', async () => {
    mockPrisma.booking.findMany.mockRejectedValue(new Error('retention unavailable'))
    mockPrisma.booking.groupBy.mockRejectedValue(new Error('retention unavailable'))
    mockPrisma.customer.count.mockRejectedValue(new Error('retention unavailable'))

    const result = await getStudentRetention()

    expect(result.status).toBe('ERROR')
  })

  it('returns SUCCESS for operations timeline', async () => {
    mockPrisma.booking.groupBy.mockResolvedValue([{ status: 'COMPLETED', _count: { id: 4 } }])
    mockPrisma.payout.groupBy.mockResolvedValue([{ status: 'PAID', _count: { id: 3 } }])
    mockPrisma.stripeDispute.count.mockResolvedValue(1)
    mockPrisma.auditLog.count.mockResolvedValue(7)

    const result = await getOperationsTimeline({ hours: 24 })

    expect(result).toEqual({
      status: 'SUCCESS',
      data: {
        period: 'Last 24 hours',
        bookings: { COMPLETED: 4 },
        payouts: { PAID: 3 },
        disputeActivity: 1,
        auditEvents: 7,
      },
    })
  })

  it('returns PARTIAL for operations timeline query failure', async () => {
    mockPrisma.booking.groupBy.mockRejectedValue(new Error('booking activity unavailable'))
    mockPrisma.payout.groupBy.mockResolvedValue([])
    mockPrisma.stripeDispute.count.mockResolvedValue(0)
    mockPrisma.auditLog.count.mockResolvedValue(2)

    const result = await getOperationsTimeline({})

    expect(result.status).toBe('PARTIAL')
    if (result.status !== 'PARTIAL') return
    expect(result.missing).toContain('booking activity')
    expect(result.data.bookings).toBeNull()
  })
})

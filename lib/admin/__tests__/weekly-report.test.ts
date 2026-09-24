import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  walletTransaction: { aggregate: vi.fn() },
  booking: { count: vi.fn() },
  customer: { count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { getWeeklyReport } from '../ai-tools'

describe('getWeeklyReport - P1-06', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T00:00:00.000Z'))
    vi.clearAllMocks()
    mockPrisma.walletTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1200 } })
      .mockResolvedValueOnce({ _sum: { amount: 1000 } })
    mockPrisma.booking.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(3)
    mockPrisma.customer.count.mockResolvedValue(4)
  })

  it('returns SUCCESS with the existing weekly metrics', async () => {
    const result = await getWeeklyReport()

    expect(result).toEqual({
      status: 'SUCCESS',
      data: {
        revenue: { thisWeek: 1200, lastWeek: 1000, changePercent: 20 },
        bookings: { thisWeek: 12, lastWeek: 10, changePercent: 20, completed: 9, cancelled: 3, completionRate: 75 },
        newStudents: 4,
      },
    })
  })

  it('returns PARTIAL and null for a failed revenue signal', async () => {
    mockPrisma.walletTransaction.aggregate.mockReset()
    mockPrisma.walletTransaction.aggregate
      .mockRejectedValueOnce(new Error('revenue query failed'))
      .mockResolvedValueOnce({ _sum: { amount: 1000 } })

    const result = await getWeeklyReport()

    expect(result.status).toBe('PARTIAL')
    if (result.status !== 'PARTIAL') return
    expect(result.missing).toContain('this-week revenue')
    expect(result.data.revenue.thisWeek).toBeNull()
    expect(result.data.revenue.changePercent).toBeNull()
  })

  it('returns ERROR when every weekly query fails', async () => {
    mockPrisma.walletTransaction.aggregate.mockReset()
    mockPrisma.walletTransaction.aggregate.mockRejectedValue(new Error('database unavailable'))
    mockPrisma.booking.count.mockReset()
    mockPrisma.booking.count.mockRejectedValue(new Error('database unavailable'))
    mockPrisma.customer.count.mockReset()
    mockPrisma.customer.count.mockRejectedValue(new Error('database unavailable'))

    const result = await getWeeklyReport()

    expect(result.status).toBe('ERROR')
    if (result.status !== 'ERROR') return
    expect(result.error).toContain('getWeeklyReport: all queries failed')
  })
})

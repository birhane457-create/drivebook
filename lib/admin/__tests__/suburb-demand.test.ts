import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  booking: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { getSuburbDemand } from '../ai-tools'

describe('getSuburbDemand - P1-05', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T00:00:00.000Z'))
    vi.clearAllMocks()
  })

  it('aggregates the complete result instead of silently sampling 500 rows', async () => {
    mockPrisma.booking.findMany.mockResolvedValue(
      Array.from({ length: 501 }, () => ({ pickupAddress: '1 Main Street, Richmond, VIC 3121' })),
    )

    const result = await getSuburbDemand({ limit: 1 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    expect(result.data).toMatchObject({
      totalBookings: 501,
      sampleSize: 501,
      truncated: false,
      topSuburbs: [{ suburb: 'Richmond', bookings: 501 }],
    })
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'asc' },
    }))
    expect(mockPrisma.booking.findMany.mock.calls[0][0]).not.toHaveProperty('take')
  })

  it('returns EMPTY when no qualifying bookings exist', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([])

    const result = await getSuburbDemand({})

    expect(result).toEqual({
      status: 'EMPTY',
      reason: 'No bookings with pickup addresses found in the last 30 days',
    })
  })

  it('returns ERROR when the booking query fails', async () => {
    mockPrisma.booking.findMany.mockRejectedValue(new Error('booking database unavailable'))

    const result = await getSuburbDemand({})

    expect(result).toEqual({
      status: 'ERROR',
      error: 'suburb demand bookings: booking database unavailable',
    })
  })
})

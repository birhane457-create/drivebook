import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  provider: { findMany: vi.fn() },
  drivingProviderProfile: { findMany: vi.fn() },
  booking: { groupBy: vi.fn() },
  stripeDispute: { groupBy: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { getInstructorRisk } from '../ai-tools'

const NOW = new Date('2026-09-24T00:00:00.000Z')

const providers = [
  { id: 'provider-1', name: 'Alex', stripeAccountId: 'acct_1', chargesEnabled: true },
]

function profileWithExpiry(days: number | null, providerId = 'provider-1') {
  return {
    providerId,
    licenseExpiry: days === null ? null : new Date(NOW.getTime() + days * 86400000),
    insuranceExpiry: new Date(NOW.getTime() + 31 * 86400000),
    wwcCheckExpiry: new Date(NOW.getTime() + 31 * 86400000),
    policeCheckExpiry: new Date(NOW.getTime() + 31 * 86400000),
  }
}

function setSuccessfulQueries(profileRows = [profileWithExpiry(31)]) {
  mockPrisma.provider.findMany.mockResolvedValue(providers)
  mockPrisma.drivingProviderProfile.findMany.mockResolvedValue(profileRows)
  mockPrisma.booking.groupBy.mockResolvedValue([])
  mockPrisma.stripeDispute.groupBy.mockResolvedValue([])
}

describe('getInstructorRisk - P1-03', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.clearAllMocks()
    setSuccessfulQueries()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns SUCCESS for a provider with a complete, valid profile', async () => {
    const result = await getInstructorRisk({ minScore: 0 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    expect(result.data.providers[0]).toMatchObject({
      name: 'Alex',
      riskScore: 0,
      riskLevel: 'low',
      documents: { profile: 'present', licence: 'valid', insurance: 'valid', wwcCheck: 'valid' },
    })
  })

  it.each([
    [0, 'expired', 'Licence expired'],
    [1, 'expiring', 'Licence expires in 1 days'],
    [14, 'expiring', 'Licence expires in 14 days'],
    [15, 'expiring', 'Licence expires in 15 days'],
    [30, 'expiring', 'Licence expires in 30 days'],
    [31, 'valid', undefined],
  ])('preserves expiry boundary at %i days', async (days, expectedStatus, expectedFlag) => {
    setSuccessfulQueries([profileWithExpiry(days)])

    const result = await getInstructorRisk({ minScore: 0 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    const provider = result.data.providers[0]
    expect(provider.documents.licence).toBe(expectedStatus)
    if (expectedFlag) expect(provider.flags).toContain(expectedFlag)
    else expect(provider.flags).not.toContain('Licence expired')
  })

  it('flags expired licence, insurance, and WWCC documents', async () => {
    setSuccessfulQueries([{
      providerId: 'provider-1',
      licenseExpiry: new Date(NOW.getTime() - 86400000),
      insuranceExpiry: new Date(NOW.getTime() - 86400000),
      wwcCheckExpiry: new Date(NOW.getTime() - 86400000),
      policeCheckExpiry: new Date(NOW.getTime() - 86400000),
    }])

    const result = await getInstructorRisk({ minScore: 0 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    expect(result.data.providers[0]).toMatchObject({
      riskScore: 60,
      documents: { licence: 'expired', insurance: 'expired', wwcCheck: 'expired', policeCheck: 'expired' },
    })
    expect(result.data.providers[0].flags).toEqual(expect.arrayContaining([
      'Licence expired',
      'Insurance expired',
      'WWC Check expired',
      'Police Check expired',
    ]))
  })

  it('represents a missing expiry date as unavailable evidence', async () => {
    setSuccessfulQueries([profileWithExpiry(null)])

    const result = await getInstructorRisk({ minScore: 0 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    expect(result.data.providers[0]).toMatchObject({
      riskScore: null,
      riskLevel: 'unknown',
      documents: { licence: 'unavailable' },
    })
    expect(result.data.providers[0].flags).toContain('Licence expiry unavailable')
  })

  it('represents a missing profile as unknown rather than clean risk', async () => {
    setSuccessfulQueries([])

    const result = await getInstructorRisk({ minScore: 30 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    expect(result.data.providers[0]).toMatchObject({
      riskScore: null,
      riskLevel: 'unknown',
      documents: { profile: 'missing', licence: 'no_profile' },
    })
    expect(result.data.providers[0].flags).toContain('Driving profile missing')
  })

  it('returns ERROR when the required provider query fails', async () => {
    mockPrisma.provider.findMany.mockRejectedValue(new Error('provider database unavailable'))

    const result = await getInstructorRisk({})

    expect(result).toEqual({
      status: 'ERROR',
      error: 'approved providers: provider database unavailable',
    })
  })

  it('returns PARTIAL and identifies failed independent signals', async () => {
    mockPrisma.drivingProviderProfile.findMany.mockRejectedValue(new Error('profile query failed'))

    const result = await getInstructorRisk({ minScore: 30 })

    expect(result.status).toBe('PARTIAL')
    if (result.status !== 'PARTIAL') return
    expect(result.missing).toEqual(['driving profiles'])
    expect(result.data.providers[0]).toMatchObject({ riskScore: null, riskLevel: 'unknown' })
  })

  it('keeps one provider missing data from corrupting another provider result', async () => {
    mockPrisma.provider.findMany.mockResolvedValue([
      providers[0],
      { id: 'provider-2', name: 'Sam', stripeAccountId: 'acct_2', chargesEnabled: true },
    ])
    mockPrisma.drivingProviderProfile.findMany.mockResolvedValue([profileWithExpiry(31, 'provider-1')])

    const result = await getInstructorRisk({ minScore: 0 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    expect(result.data.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Alex', riskLevel: 'low', riskScore: 0 }),
      expect.objectContaining({ name: 'Sam', riskLevel: 'unknown', riskScore: null }),
    ]))
  })

  it('flags an expired policeCheckExpiry (C-2: all four documents scored)', async () => {
    // policeCheckExpiry was the missing fourth document in the original C-2 finding.
    // This test verifies it is now selected from DrivingProviderProfile and scored.
    setSuccessfulQueries([{
      providerId: 'provider-1',
      licenseExpiry:     new Date(NOW.getTime() + 31 * 86400000),
      insuranceExpiry:   new Date(NOW.getTime() + 31 * 86400000),
      wwcCheckExpiry:    new Date(NOW.getTime() + 31 * 86400000),
      policeCheckExpiry: new Date(NOW.getTime() - 86400000), // expired yesterday
    }])

    const result = await getInstructorRisk({ minScore: 0 })

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') return
    const provider = result.data.providers[0]
    expect(provider.documents.policeCheck).toBe('expired')
    expect(provider.riskScore).toBe(15)   // +15 for one expired document
    expect(provider.flags).toContain('Police Check expired')
  })
})

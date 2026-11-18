/**
 * CP-07 Regression Tests — Profile endpoint booking counts
 *
 * These tests call getProfileBookingCounts() — the PRODUCTION function
 * extracted from the route into lib/services/profile-counts.ts.
 * Any regression to the route's count logic will fail these tests
 * because the route now delegates to the same function.
 *
 * pastCount business definition (preserved from original code):
 *   - COMPLETED bookings
 *   - NO_SHOW bookings
 *   - CONFIRMED bookings whose endTime is non-null and in the past
 *
 * upcomingCount:
 *   - CONFIRMED with endTime null OR in the future
 *
 * Regression guard (T5 + T7):
 *   T5 proves counts cover >1 page of data (up+past = 12, page = 10).
 *   T7 simulates what page-local counting would return and asserts it
 *   is WRONG — confirming the fix is load-bearing.
 *
 * DATABASE: Japan Supabase direct connection (port 5432)
 *           postgresql://postgres.zzntmozvppyzeaqautpi:...@...5432/postgres
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { getProfileBookingCounts } from '@/lib/services/profile-counts'

const TEST_PREFIX = 'CP07'

const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

// ── Types ─────────────────────────────────────────────────────────────────────

type CreatedFixture = {
  userId: string
  providerUserId: string
  customerId: string
  providerIds: string[]
  bookingIds: string[]
}

// ── Fixture ───────────────────────────────────────────────────────────────────

async function createFixture(): Promise<CreatedFixture> {
  const ts    = Date.now()
  const email = `${TEST_PREFIX}_user_${ts}@test.invalid`

  const user = await testPrisma.user.create({
    data: { email, name: 'CP07 Test User', role: 'CLIENT' },
  })

  const providerUser = await testPrisma.user.create({
    data: {
      email: `${TEST_PREFIX}_inst_${ts}@test.invalid`,
      name: `${TEST_PREFIX} Instructor`,
      role: 'INSTRUCTOR',
    },
  })

  const provider = await testPrisma.provider.create({
    data: {
      user: { connect: { id: providerUser.id } },
      name: `${TEST_PREFIX} Instructor`,
      phone: '0400000000',
      hourlyRate: 70,
      approvalStatus: 'APPROVED',
      isActive: true,
      subscriptionStatus: 'ACTIVE',
      subscriptionTier: 'STANDARD',
    } as any,
  })

  const customer = await testPrisma.customer.create({
    data: {
      user:  { connect: { id: user.id } },
      name:  'CP07 Test User',
      email,
      phone: '0400000000',
    } as any,
  })

  const past   = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000)

  // 12 bookings — more than a default page of 10
  //   4 × COMPLETED                     → pastCount
  //   3 × NO_SHOW                        → pastCount
  //   2 × CONFIRMED, endTime in past     → pastCount
  //   3 × CONFIRMED, endTime in future   → upcomingCount
  const bookings = await Promise.all([
    ...Array.from({ length: 4 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'COMPLETED',
          startTime: past,
          endTime:   new Date(past.getTime() + 60 * 60 * 1000),
          duration: 1, price: 70, bookingType: 'LESSON', createdBy: 'customer',
        } as any,
      })
    ),
    ...Array.from({ length: 3 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'NO_SHOW',
          startTime: past,
          endTime:   new Date(past.getTime() + 60 * 60 * 1000),
          duration: 1, price: 70, bookingType: 'LESSON', createdBy: 'customer',
        } as any,
      })
    ),
    ...Array.from({ length: 2 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'CONFIRMED',
          startTime: new Date(past.getTime() - 60 * 60 * 1000),
          endTime:   past,   // endTime < now → past
          duration: 1, price: 70, bookingType: 'LESSON', createdBy: 'customer',
        } as any,
      })
    ),
    ...Array.from({ length: 3 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'CONFIRMED',
          startTime: future,
          endTime:   new Date(future.getTime() + 60 * 60 * 1000),
          duration: 1, price: 70, bookingType: 'LESSON', createdBy: 'customer',
        } as any,
      })
    ),
  ])

  return {
    userId:        user.id,
    providerUserId: providerUser.id,
    customerId:    customer.id,
    providerIds:   [provider.id],
    bookingIds:    bookings.map(b => b.id),
  }
}

async function cleanup(fixture: CreatedFixture) {
  if (!fixture) return
  await testPrisma.booking.deleteMany({ where: { id: { in: fixture.bookingIds } } })
  await testPrisma.customer.deleteMany({ where: { id: fixture.customerId } })
  await testPrisma.provider.deleteMany({ where: { id: { in: fixture.providerIds } } })
  await testPrisma.user.deleteMany({ where: { id: { in: [fixture.userId, fixture.providerUserId] } } })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CP-07 — profile booking counts (production function)', () => {
  let fixture: CreatedFixture

  beforeAll(async () => { fixture = await createFixture() })
  afterAll(async () => { await cleanup(fixture); await testPrisma.$disconnect() })

  it('CP07-T1: upcomingCount = CONFIRMED with future endTime (3)', async () => {
    const { upcomingCount } = await getProfileBookingCounts([fixture.customerId], new Date(), testPrisma as any)
    expect(upcomingCount).toBe(3)
  })

  it('CP07-T2: pastCount includes all COMPLETED bookings (4)', async () => {
    const { pastCount } = await getProfileBookingCounts([fixture.customerId], new Date(), testPrisma as any)
    expect(pastCount).toBeGreaterThanOrEqual(4)
  })

  it('CP07-T3: pastCount includes NO_SHOW bookings (3)', async () => {
    const { pastCount } = await getProfileBookingCounts([fixture.customerId], new Date(), testPrisma as any)
    expect(pastCount).toBeGreaterThanOrEqual(7)   // 4 + 3
  })

  it('CP07-T4: pastCount includes CONFIRMED with past endTime (total = 9)', async () => {
    const { pastCount } = await getProfileBookingCounts([fixture.customerId], new Date(), testPrisma as any)
    expect(pastCount).toBe(9)
  })

  it('CP07-T5: 12 bookings > 1 page — counts cover the full dataset', async () => {
    const { upcomingCount, pastCount } = await getProfileBookingCounts([fixture.customerId], new Date(), testPrisma as any)
    expect(upcomingCount + pastCount).toBe(12)
  })

  it('CP07-T6: null endTime is counted as upcoming not past', async () => {
    const noEnd = await testPrisma.booking.create({
      data: {
        customerId: fixture.customerId,
        providerId: fixture.providerIds[0],
        status:    'CONFIRMED',
        startTime:  new Date(Date.now() + 3 * 60 * 60 * 1000),
        endTime:    null,
        duration: 1, price: 70, bookingType: 'LESSON', createdBy: 'customer',
      } as any,
    })
    try {
      const { upcomingCount, pastCount } = await getProfileBookingCounts([fixture.customerId], new Date(), testPrisma as any)
      expect(upcomingCount).toBe(4)
      expect(pastCount).toBe(9)
    } finally {
      await testPrisma.booking.delete({ where: { id: noEnd.id } })
    }
  })

  it('CP07-T7: regression guard — page-local counting would give wrong results', async () => {
    const now = new Date()
    const page = await testPrisma.booking.findMany({
      where: { customerId: { in: [fixture.customerId] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }) as any[]

    const pageUpcoming = page.filter(
      (b: any) => b.status === 'CONFIRMED' && (!b.endTime || b.endTime > now)
    ).length
    const pagePast = page.filter(
      (b: any) =>
        b.status === 'COMPLETED' || b.status === 'NO_SHOW' ||
        (b.status === 'CONFIRMED' && b.endTime && b.endTime <= now)
    ).length

    expect(pageUpcoming + pagePast).toBe(10)

    const { upcomingCount, pastCount } = await getProfileBookingCounts([fixture.customerId], new Date(), testPrisma as any)
    expect(upcomingCount + pastCount).toBe(12)
    expect(upcomingCount + pastCount).not.toBe(pageUpcoming + pagePast)
  })
})

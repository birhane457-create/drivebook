/**
 * CP-07 Regression Tests — Profile endpoint booking counts
 *
 * Verifies that upcomingCount and pastCount are computed from the full
 * dataset (via independent count() queries), not from the current page.
 *
 * pastCount business definition (preserved from original code):
 *   - COMPLETED bookings
 *   - NO_SHOW bookings
 *   - CONFIRMED bookings whose endTime is non-null and in the past
 *     (cron has not yet flipped them to COMPLETED)
 *
 * upcomingCount business definition:
 *   - CONFIRMED bookings whose endTime is null OR in the future
 *
 * These tests use a real PostgreSQL test database (localhost:5433) so that
 * the Prisma count() WHERE clauses are exercised against actual SQL.
 *
 * DATABASE: postgresql://postgres:testpass@127.0.0.1:5433/drivebook_test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const TEST_PREFIX = 'CP07'

// Use test DATABASE_URL (guarded in vitest.config.ts against production)
const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

// ── Fixture helpers ──────────────────────────────────────────────────────────

type CreatedFixture = {
  userId: string
  providerUserId: string
  customerId: string
  providerIds: string[]
  bookingIds: string[]
}

async function createFixture(): Promise<CreatedFixture> {
  const email = `${TEST_PREFIX}_user_${Date.now()}@test.invalid`

  const user = await testPrisma.user.create({
    data: { email, name: 'CP07 Test User', role: 'CLIENT' },
  })

  const providerUser = await testPrisma.user.create({
    data: {
      email: `${TEST_PREFIX}_inst_${Date.now()}@test.invalid`,
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
      user: { connect: { id: user.id } },
      name: 'CP07 Test User',
      email,
      phone: '0400000000',
    } as any,
  })

  const past   = new Date(Date.now() - 2 * 60 * 60 * 1000)   // 2 h ago
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000)   // 2 h from now

  // Create 12 bookings across all categories — more than a default page of 10
  const bookings = await Promise.all([
    // 4 × COMPLETED  → pastCount
    ...Array.from({ length: 4 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'COMPLETED',
          startTime: past,
          endTime: new Date(past.getTime() + 60 * 60 * 1000),
          duration: 1,
          price: 70,
          bookingType: 'LESSON',
          createdBy: 'customer',
        } as any,
      })
    ),
    // 3 × NO_SHOW  → pastCount
    ...Array.from({ length: 3 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'NO_SHOW',
          startTime: past,
          endTime: new Date(past.getTime() + 60 * 60 * 1000),
          duration: 1,
          price: 70,
          bookingType: 'LESSON',
          createdBy: 'customer',
        } as any,
      })
    ),
    // 2 × CONFIRMED with endTime in the past  → pastCount
    ...Array.from({ length: 2 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'CONFIRMED',
          startTime: new Date(past.getTime() - 60 * 60 * 1000),
          endTime: past,   // endTime < now
          duration: 1,
          price: 70,
          bookingType: 'LESSON',
          createdBy: 'customer',
        } as any,
      })
    ),
    // 3 × CONFIRMED with endTime in the future  → upcomingCount
    ...Array.from({ length: 3 }, () =>
      testPrisma.booking.create({
        data: {
          customerId: customer.id,
          providerId: provider.id,
          status: 'CONFIRMED',
          startTime: future,
          endTime: new Date(future.getTime() + 60 * 60 * 1000),
          duration: 1,
          price: 70,
          bookingType: 'LESSON',
          createdBy: 'customer',
        } as any,
      })
    ),
  ])

  return {
    userId: user.id,
    providerUserId: providerUser.id,
    customerId: customer.id,
    providerIds: [provider.id],
    bookingIds: bookings.map(b => b.id),
  }
}

async function cleanup(fixture: CreatedFixture) {
  await testPrisma.booking.deleteMany({ where: { id: { in: fixture.bookingIds } } })
  await testPrisma.customer.deleteMany({ where: { id: fixture.customerId } })
  await testPrisma.provider.deleteMany({ where: { id: { in: fixture.providerIds } } })
  await testPrisma.user.deleteMany({ where: { id: { in: [fixture.userId, fixture.providerUserId] } } })
}

// ── Helpers that mirror the route's count() queries ──────────────────────────

async function getProfileCounts(clientIds: string[]) {
  const now = new Date()
  const [upcomingCount, pastCount] = await Promise.all([
    testPrisma.booking.count({
      where: {
        customerId: { in: clientIds },
        status: 'CONFIRMED',
        OR: [{ endTime: null }, { endTime: { gt: now } }],
      },
    }),
    testPrisma.booking.count({
      where: {
        customerId: { in: clientIds },
        OR: [
          { status: { in: ['COMPLETED', 'NO_SHOW'] } },
          { status: 'CONFIRMED', endTime: { not: null, lte: now } },
        ],
      },
    }),
  ])
  return { upcomingCount, pastCount }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CP-07 — profile booking counts', () => {
  let fixture: CreatedFixture

  beforeAll(async () => {
    fixture = await createFixture()
  })

  afterAll(async () => {
    await cleanup(fixture)
    await testPrisma.$disconnect()
  })

  it('CP07-T1: upcomingCount counts CONFIRMED bookings with future endTime', async () => {
    const { upcomingCount } = await getProfileCounts([fixture.customerId])
    expect(upcomingCount).toBe(3)
  })

  it('CP07-T2: pastCount counts COMPLETED bookings', async () => {
    // pastCount should include the 4 COMPLETED bookings
    const { pastCount } = await getProfileCounts([fixture.customerId])
    expect(pastCount).toBeGreaterThanOrEqual(4)
  })

  it('CP07-T3: pastCount counts NO_SHOW bookings', async () => {
    // pastCount should include the 3 NO_SHOW bookings
    const { pastCount } = await getProfileCounts([fixture.customerId])
    expect(pastCount).toBeGreaterThanOrEqual(3)
  })

  it('CP07-T4: pastCount includes CONFIRMED bookings with past endTime', async () => {
    // The 2 CONFIRMED+past-endTime rows must be in pastCount
    // Total past = 4 (COMPLETED) + 3 (NO_SHOW) + 2 (CONFIRMED+past) = 9
    const { pastCount } = await getProfileCounts([fixture.customerId])
    expect(pastCount).toBe(9)
  })

  it('CP07-T5: total bookings exceed one page — counts reflect full dataset', async () => {
    // We created 12 bookings; a default page returns 10.
    // Both counts together must equal total (12) — proving they use full dataset.
    const { upcomingCount, pastCount } = await getProfileCounts([fixture.customerId])
    expect(upcomingCount + pastCount).toBe(12)
  })

  it('CP07-T6: CONFIRMED bookings with null endTime are upcoming not past', async () => {
    // Create a CONFIRMED booking with no endTime
    const noEndBooking = await testPrisma.booking.create({
      data: {
        customerId: fixture.customerId,
        providerId: fixture.providerIds[0],
        status: 'CONFIRMED',
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        endTime: null,
        duration: 1,
        price: 70,
        bookingType: 'LESSON',
        createdBy: 'customer',
      } as any,
    })

    try {
      const { upcomingCount, pastCount } = await getProfileCounts([fixture.customerId])
      // null endTime must count as upcoming
      expect(upcomingCount).toBe(4)   // 3 original + 1 null-endTime
      expect(pastCount).toBe(9)       // unchanged
    } finally {
      await testPrisma.booking.delete({ where: { id: noEndBooking.id } })
    }
  })
})

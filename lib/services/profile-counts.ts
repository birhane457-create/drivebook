/**
 * lib/services/profile-counts.ts
 *
 * Shared booking count queries for the client profile endpoint.
 * Extracted so tests can exercise the same SQL the route uses,
 * not a duplicated copy.
 *
 * pastCount business definition:
 *   - COMPLETED bookings
 *   - NO_SHOW bookings
 *   - CONFIRMED bookings whose endTime is non-null and in the past
 *     (cron has not yet flipped them to COMPLETED)
 *
 * upcomingCount business definition:
 *   - CONFIRMED bookings whose endTime is null OR in the future
 */

import { prisma as defaultPrisma } from '@/lib/prisma'
import type { PrismaClient } from '@prisma/client'

export interface BookingCounts {
  upcomingCount: number
  pastCount: number
}

/**
 * Returns upcoming and past booking counts for the given customer IDs.
 * Uses the full dataset — independent of any pagination applied to the
 * booking list in the same request.
 *
 * @param clientIds  Customer record IDs to scope the query.
 * @param asOf       Reference timestamp (default: now). Injected by tests.
 * @param db         Prisma client to use (default: module singleton). Injected by tests.
 */
export async function getProfileBookingCounts(
  clientIds: string[],
  asOf: Date = new Date(),
  db: PrismaClient = defaultPrisma as unknown as PrismaClient,
): Promise<BookingCounts> {
  const [upcomingCount, pastCount] = await Promise.all([
    db.booking.count({
      where: {
        customerId: { in: clientIds },
        status: 'CONFIRMED',
        OR: [{ endTime: null }, { endTime: { gt: asOf } }],
      },
    }),
    db.booking.count({
      where: {
        customerId: { in: clientIds },
        OR: [
          { status: { in: ['COMPLETED', 'NO_SHOW'] } },
          // CP-07 FIX: include CONFIRMED whose endTime has passed — cron
          // hasn't flipped them to COMPLETED yet.
          { status: 'CONFIRMED', endTime: { not: null, lte: asOf } },
        ],
      },
    }),
  ])

  return { upcomingCount, pastCount }
}

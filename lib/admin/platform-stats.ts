/**
 * Shared platform statistics for admin dashboards.
 * Reduces redundant database queries by centralizing common counts.
 * 
 * Usage:
 *   const stats = await getPlatformStats()
 *   console.log(stats.instructors.total, stats.bookings.thisMonth)
 */

import { prisma } from '@/lib/prisma'

export interface PlatformStats {
  instructors: {
    total: number
    pending: number
    approved: number
    suspended: number
    emailVerified: number
    withDocuments: number
    withFirstBooking: number
  }
  bookings: {
    total: number
    thisMonth: number
    confirmed: number
    pending: number
    completed: number
  }
  clients: {
    total: number
  }
  revenue: {
    platformFeeThisMonth: number
  }
  subscriptions: Record<string, number>
}

/**
 * Fetch all platform statistics in a single optimized query batch.
 * Results are NOT cached — if you need caching, wrap this with React Server Components
 * or implement a Redis layer.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  try {
    const [
      totalInstructors,
      pendingInstructors,
      suspendedInstructors,
      emailVerifiedInstructors,
      instructorsWithDocs,
      instructorsWithFirstBooking,
      totalBookings,
      bookingsThisMonth,
      confirmedBookings,
      pendingBookings,
      completedBookings,
      totalClients,
      revenueData,
      subscriptionDistribution,
    ] = await Promise.all([
      // Instructors
      prisma.provider.count(),
      prisma.provider.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.provider.count({ where: { approvalStatus: 'SUSPENDED' } }),
      prisma.provider.count({ where: { user: { emailVerified: true } } }),
      prisma.drivingProviderProfile.count({ where: { licenseNumber: { not: null } } }),
      prisma.provider.count({ where: { bookings: { some: {} } } }),

      // Bookings
      prisma.booking.count(),
      prisma.booking.count({
        where: {
          createdAt: { gte: monthStart },
        },
      }),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),

      // Clients
      prisma.customer.count(),

      // Revenue
      prisma.transaction.aggregate({
        _sum: { platformFee: true },
        where: {
          type: 'PLATFORM_FEE',
          createdAt: { gte: monthStart },
        },
      }),

      // Subscriptions
      prisma.provider.groupBy({
        by: ['subscriptionTier'],
        _count: true,
      }),
    ])

    const subscriptionMap: Record<string, number> = subscriptionDistribution.reduce(
      (acc, { subscriptionTier, _count }) => {
        acc[subscriptionTier] = _count
        return acc
      },
      {} as Record<string, number>
    )

    const approvedInstructors =
      totalInstructors - pendingInstructors - suspendedInstructors

    return {
      instructors: {
        total: totalInstructors,
        pending: pendingInstructors,
        approved: approvedInstructors,
        suspended: suspendedInstructors,
        emailVerified: emailVerifiedInstructors,
        withDocuments: instructorsWithDocs,
        withFirstBooking: instructorsWithFirstBooking,
      },
      bookings: {
        total: totalBookings,
        thisMonth: bookingsThisMonth,
        confirmed: confirmedBookings,
        pending: pendingBookings,
        completed: completedBookings,
      },
      clients: {
        total: totalClients,
      },
      revenue: {
        platformFeeThisMonth: Number(revenueData._sum?.platformFee ?? 0),
      },
      subscriptions: subscriptionMap,
    }
  } catch (error) {
    console.error('[getPlatformStats] Error fetching stats:', error)
    // Return zeroed stats on error rather than throwing
    return {
      instructors: {
        total: 0,
        pending: 0,
        approved: 0,
        suspended: 0,
        emailVerified: 0,
        withDocuments: 0,
        withFirstBooking: 0,
      },
      bookings: {
        total: 0,
        thisMonth: 0,
        confirmed: 0,
        pending: 0,
        completed: 0,
      },
      clients: {
        total: 0,
      },
      revenue: {
        platformFeeThisMonth: 0,
      },
      subscriptions: {},
    }
  }
}

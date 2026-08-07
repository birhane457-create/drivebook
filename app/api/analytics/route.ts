import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month' // week, month, year, all

    const now = new Date()
    let startDate: Date | null = null

    switch (period) {
      case 'week': {
        // Mon–Sun week matching the earnings page convention
        const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday)
        break
      }
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'all':
        startDate = null // No filter - all time
        break
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Fetch instructor's subscription tier for commission rate lookup
    const instructorRecord = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { subscriptionTier: true },
    })
    const { getCommissionRate } = await import('@/lib/services/platform-pricing')
    const commissionRate = await getCommissionRate(instructorRecord?.subscriptionTier ?? 'BASIC')

    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      completedTransactions,
      clientCount,
      avgRating
    ] = await Promise.all([
      // Total bookings in period — platform only (exclude offline from schedule count too? No — include all for schedule)
      prisma.booking.count({
        where: {
          instructorId: session.user.instructorId,
          ...(startDate && { startTime: { gte: startDate } })
        }
      }),
      // Completed bookings (all sources — for schedule stats)
      prisma.booking.count({
        where: {
          instructorId: session.user.instructorId,
          status: 'COMPLETED',
          ...(startDate && { startTime: { gte: startDate } })
        }
      }),
      // Cancelled bookings
      prisma.booking.count({
        where: {
          instructorId: session.user.instructorId,
          status: 'CANCELLED',
          ...(startDate && { startTime: { gte: startDate } })
        }
      }),
      // Pending bookings
      prisma.booking.count({
        where: {
          instructorId: session.user.instructorId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          ...(startDate && { startTime: { gte: startDate } })
        }
      }),
      // Revenue: platform transactions only — filter by the booking's startTime
      // so "this month" means lessons that occurred this month, not when payment was processed
      prisma.transaction.aggregate({
        where: {
          instructorId: session.user.instructorId,
          status: 'COMPLETED',
          ...(startDate && {
            booking: { startTime: { gte: startDate } }
          })
        },
        _sum: { 
          amount: true,
          platformFee: true,
          instructorPayout: true
        }
      }),
      // New clients created in period
      prisma.client.count({
        where: {
          instructorId: session.user.instructorId,
          ...(startDate && { createdAt: { gte: startDate } })
        }
      }),
      // Average rating from performanceScore on completed bookings
      prisma.booking.aggregate({
        where: {
          instructorId: session.user.instructorId,
          status: 'COMPLETED',
          performanceScore: { not: null },
          ...(startDate && { startTime: { gte: startDate } }),
        },
        _avg: { performanceScore: true },
      }).catch(() => null)
    ])

    // Use transaction data (same as earnings API)
    const grossRevenue = completedTransactions._sum.amount || 0
    const commission = completedTransactions._sum.platformFee || 0
    const netEarnings = completedTransactions._sum.instructorPayout || 0

    // Average rating: null if no feedback yet
    const avgRatingValue = avgRating?._avg?.performanceScore != null
      ? Math.round(avgRating._avg.performanceScore / 20 * 10) / 10 // convert 0–100 score to 0–5 stars
      : null

    // Calculate completion rate
    const completionRate = totalBookings > 0 
      ? Math.round((completedBookings / totalBookings) * 1000) / 10 
      : 0

    return NextResponse.json({
      period,
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      grossRevenue,
      commission,
      netEarnings,
      commissionRate,
      newClients: clientCount,
      averageRating: avgRatingValue,
      completionRate
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

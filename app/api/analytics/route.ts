import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'all':
        startDate = null // No filter - all time
        break
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Get instructor's commission rate
    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { commissionRate: true }
    })

    const commissionRate = instructor?.commissionRate || 15

    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      completedTransactions,
      clientCount,
      avgRating
    ] = await Promise.all([
      // Total bookings in period
      prisma.booking.count({
        where: {
          instructorId: session.user.instructorId,
          ...(startDate && { startTime: { gte: startDate } })
        }
      }),
      // Completed bookings
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
      // FIXED: Use Transaction table like earnings API does
      (prisma as any).transaction.aggregate({
        where: {
          instructorId: session.user.instructorId,
          status: 'COMPLETED',
          ...(startDate && { createdAt: { gte: startDate } })
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
      // Mock rating for now - would need a ratings table
      Promise.resolve(4.8)
    ])

    // Use transaction data (same as earnings API)
    const grossRevenue = completedTransactions._sum.amount || 0
    const commission = completedTransactions._sum.platformFee || 0
    const netEarnings = completedTransactions._sum.instructorPayout || 0

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
      averageRating: avgRating,
      completionRate
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

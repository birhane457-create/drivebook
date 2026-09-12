import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/cancellations/stats
 * Get cancellation statistics for admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Pending count
    const pendingCount = await prisma.booking.count({
      where: { cancellationStatus: 'PENDING' },
    })

    // Approved today
    const approvedToday = await prisma.booking.count({
      where: {
        cancellationStatus: 'APPROVED',
        adminReviewedAt: { gte: todayStart },
      },
    })

    // Rejected today
    const rejectedToday = await prisma.booking.count({
      where: {
        cancellationStatus: 'REJECTED',
        adminReviewedAt: { gte: todayStart },
      },
    })

    // Total refunded today (approved cancellations with refund amounts)
    const approvedBookingsToday = await prisma.booking.findMany({
      where: {
        cancellationStatus: 'APPROVED',
        adminReviewedAt: { gte: todayStart },
      },
      select: {
        adminOverrideAmount: true,
        packageTotalPaid: true,
        packageHoursUsed: true,
        packageHours: true,
      },
    })

    const totalRefundedToday = approvedBookingsToday.reduce((sum: number, booking: any) => {
      if (booking.adminOverrideAmount !== null) {
        return sum + Number(booking.adminOverrideAmount)
      }
      // Calculate refund
      const totalPaid = Number(booking.packageTotalPaid) || 0
      const hoursUsed = Number(booking.packageHoursUsed) || 0
      const totalHours = Number(booking.packageHours) || 1
      const hourlyRate = totalPaid / totalHours
      const refund = totalPaid - (hoursUsed * hourlyRate)
      return sum + refund
    }, 0)

    // Average approval time (for approved bookings in last 30 days)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentApproved = await prisma.booking.findMany({
      where: {
        cancellationStatus: 'APPROVED',
        adminReviewedAt: { gte: thirtyDaysAgo },
        cancellationRequestedAt: { not: null },
      },
      select: {
        cancellationRequestedAt: true,
        adminReviewedAt: true,
      },
    })

    let avgApprovalTimeHours = 0
    if (recentApproved.length > 0) {
      const totalHours = recentApproved.reduce((sum: number, booking: any) => {
        if (booking.cancellationRequestedAt && booking.adminReviewedAt) {
          const diffMs = new Date(booking.adminReviewedAt).getTime() - new Date(booking.cancellationRequestedAt).getTime()
          return sum + (diffMs / (1000 * 60 * 60))
        }
        return sum
      }, 0)
      avgApprovalTimeHours = totalHours / recentApproved.length
    }

    return NextResponse.json({
      pendingCount,
      approvedToday,
      rejectedToday,
      totalRefundedToday: totalRefundedToday.toFixed(2),
      avgApprovalTimeHours: avgApprovalTimeHours.toFixed(1),
    })
  } catch (error: any) {
    console.error('[API] Cancellation stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instructor/earnings/this-week
 *
 * Returns this week's earnings summary
 * - Week date range (Mon-Sun)
 * - Completed lessons count
 * - Total earned this week
 * - Hourly rate
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const instructorId = session.user.instructorId

    // Calculate current week boundaries (Mon–Sun) in UTC
    const now = new Date()
    const dayOfWeek = now.getUTCDay() // 0 = Sunday
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const mondayDate = new Date(now)
    mondayDate.setUTCDate(mondayDate.getUTCDate() - daysFromMonday)
    const mondayStr = mondayDate.toISOString().slice(0, 10)
    const mondayStart = new Date(`${mondayStr}T00:00:00.000Z`)

    const sundayDate = new Date(mondayStart)
    sundayDate.setUTCDate(sundayDate.getUTCDate() + 6)
    const sundayStr = sundayDate.toISOString().slice(0, 10)
    const sundayEnd = new Date(`${sundayStr}T23:59:59.999Z`)

    // Get instructor's hourly rate
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { hourlyRate: true }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // Get completed bookings for this week (platform only)
    const weeklyBookings = await prisma.booking.findMany({
      where: {
        instructorId,
        status: 'COMPLETED',
        startTime: {
          gte: mondayStart,
          lte: sundayEnd
        },
        // Platform bookings only (not offline)
        source: { not: 'offline' }
      },
      select: {
        id: true,
        price: true,
        duration: true,
        startTime: true,
        endTime: true
      }
    })

    // Calculate totals
    const completedCount = weeklyBookings.length
    const totalEarned = weeklyBookings.reduce((sum, booking) => sum + booking.price, 0)

    return NextResponse.json({
      weekStart: mondayStart.toISOString(),
      weekEnd: sundayEnd.toISOString(),
      weekStartDisplay: mondayStr.slice(5).replace('-', '/'),  // MM/DD → use ISO slice, locale-free
      weekEndDisplay: sundayStr.slice(5).replace('-', '/'),
      completedCount,
      totalEarned: parseFloat(totalEarned.toFixed(2)),
      hourlyRate: instructor.hourlyRate,
      bookings: weeklyBookings.map(b => ({
        id: b.id,
        date: b.startTime ? new Date(b.startTime).toISOString().slice(0, 10) : null,
        price: b.price
      }))
    })
  } catch (error) {
    console.error('Error fetching weekly earnings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly earnings' },
      { status: 500 }
    )
  }
}

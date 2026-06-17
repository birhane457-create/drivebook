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

    // Calculate current week boundaries (Mon-Sun)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday
    
    // Calculate Monday of this week
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const mondayDate = new Date(now)
    mondayDate.setDate(mondayDate.getDate() - daysFromMonday)
    mondayDate.setHours(0, 0, 0, 0)
    
    // Calculate Sunday of this week (end of week)
    const sundayDate = new Date(mondayDate)
    sundayDate.setDate(sundayDate.getDate() + 6)
    sundayDate.setHours(23, 59, 59, 999)

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
          gte: mondayDate,
          lte: sundayDate
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
      weekStart: mondayDate.toISOString(),
      weekEnd: sundayDate.toISOString(),
      weekStartDisplay: mondayDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
      weekEndDisplay: sundayDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
      completedCount,
      totalEarned: parseFloat(totalEarned.toFixed(2)),
      hourlyRate: instructor.hourlyRate,
      bookings: weeklyBookings.map(b => ({
        id: b.id,
        date: b.startTime ? new Date(b.startTime).toLocaleDateString('en-AU') : null,
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

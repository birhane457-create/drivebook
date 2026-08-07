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

    // Get instructor's hourly rate and timezone
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { hourlyRate: true, timezone: true, state: true }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // Resolve the instructor's timezone to compute correct week boundaries
    const { resolveTimezone, timezoneFromState, localDateTimeToUTC, getLocalDateKey } = await import('@/lib/utils/timezone')
    const instructorTz = resolveTimezone(instructor.timezone) || timezoneFromState(instructor.state ?? '')

    // Calculate current week boundaries (Mon–Sun) in the instructor's local timezone
    const now = new Date()
    const todayKey = getLocalDateKey(now, instructorTz) // YYYY-MM-DD in instructor's TZ

    // Find Monday of the current local week
    const todayDate = new Date(todayKey + 'T12:00:00Z') // noon UTC to get stable day
    const dayOfWeek = todayDate.getUTCDay() // 0 = Sunday
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const mondayKey = getLocalDateKey(new Date(now.getTime() - daysFromMonday * 86400000), instructorTz)
    const sundayKey = getLocalDateKey(new Date(now.getTime() + (6 - daysFromMonday) * 86400000), instructorTz)

    // Convert local Mon 00:00 and Sun 23:59:59.999 to UTC for the DB query
    const mondayStart = localDateTimeToUTC(mondayKey, '00:00', instructorTz)
    const sundayEnd   = new Date(localDateTimeToUTC(sundayKey, '23:59', instructorTz).getTime() + 59_999)

    const mondayStr = mondayKey
    const sundayStr = sundayKey

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
        instructorPayout: true,   // FIX BUG-1: use net payout, not gross price
        commissionRate: true,      // FIX BUG-1: fallback for old bookings without payout field
        duration: true,
        startTime: true,
        endTime: true
      }
    })

    // FIX BUG-1: sum instructorPayout (net after commission), not booking.price (gross)
    // Falls back to price × (1 - commissionRate) for bookings missing instructorPayout,
    // and ultimately to price × 0.85 (BASIC rate) for very old bookings.
    const completedCount = weeklyBookings.length
    const totalEarned = weeklyBookings.reduce((sum, b) => {
      if (b.instructorPayout && b.instructorPayout > 0) return sum + b.instructorPayout
      if (b.commissionRate != null) return sum + b.price * (1 - b.commissionRate)
      return sum + b.price * 0.85 // BASIC fallback
    }, 0)

    // FIX BUG-2: AU date format DD/MM, not US format MM/DD
    const mondayDisplay = mondayStr.slice(8) + '/' + mondayStr.slice(5, 7)
    const sundayDisplay = sundayStr.slice(8)  + '/' + sundayStr.slice(5, 7)

    return NextResponse.json({
      weekStart: mondayStart.toISOString(),
      weekEnd: sundayEnd.toISOString(),
      weekStartDisplay: mondayDisplay,
      weekEndDisplay:   sundayDisplay,
      completedCount,
      totalEarned: parseFloat(totalEarned.toFixed(2)),
      hourlyRate: instructor.hourlyRate,
      // FIX DATA-3: return instructorPayout per booking, not gross price
      bookings: weeklyBookings.map(b => {
        const net = b.instructorPayout && b.instructorPayout > 0
          ? b.instructorPayout
          : b.commissionRate != null
            ? b.price * (1 - b.commissionRate)
            : b.price * 0.85
        return {
          id: b.id,
          date: b.startTime ? new Date(b.startTime).toISOString().slice(0, 10) : null,
          price: parseFloat(net.toFixed(2))
        }
      })
    })
  } catch (error) {
    console.error('Error fetching weekly earnings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly earnings' },
      { status: 500 }
    )
  }
}
